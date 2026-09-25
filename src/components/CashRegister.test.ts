import { createElement, act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CashRegister } from './CashRegister';
import { accountApi } from '../data/customer-api';
import type { RegisterSession } from '../shared/register';

vi.mock('./StaffAuthenticator',()=>({StaffAuthenticator:({children}:{children:ReactNode})=>children}));
vi.mock('../data/customer-api',async importOriginal=>({...await importOriginal<typeof import('../data/customer-api')>(),accountApi:vi.fn()}));
const api=vi.mocked(accountApi);let root:Root;let element:HTMLDivElement;
const register:RegisterSession={id:'register-one',openedAt:'2026-09-25T14:00:00Z',close:null,closeToken:'signed-count',totals:{openingCents:10000,paymentsCents:3000,refundsCents:0,paidInCents:0,paidOutCents:0,depositsCents:1000,expectedCents:12000,entryCount:2}};
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);api.mockReset();window.history.replaceState({},'','/account?view=register');element=document.createElement('div');document.body.append(element);root=createRoot(element);});
afterEach(async()=>{await act(async()=>root.unmount());element.remove();vi.unstubAllGlobals();});
const click=async(text:string)=>{const button=[...element.querySelectorAll('button')].find(node=>node.textContent===text);expect(button).toBeDefined();await act(async()=>button!.click());};
const fill=async(label:string,value:string)=>{const input=[...element.querySelectorAll('label')].find(node=>node.textContent?.startsWith(label))!.querySelector('input')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});};
it('opens a counted drawer and retains its request identity across an uncertain response',async()=>{
  let opened=false;let attempts=0;
  api.mockImplementation(async(path,body)=>{
    if(path==='/me/register'&&body){attempts++;if(attempts===1)throw new Error('Connection lost');opened=true;return{registerId:register.id};}
    if(path==='/me/register')return{open:opened?register:null,items:[],nextCursor:null};
    if(path.endsWith('/entries'))return{items:[],nextCursor:null};throw new Error(path);
  });
  await act(async()=>root.render(createElement(CashRegister)));await fill('Opening cash','100.00');await click('Review register action');
  expect(attempts).toBe(0);await fill('Your current password','test password');await click('Confirm register action');
  expect(element.textContent).toContain('Connection lost');expect(element.textContent).not.toContain('Back to register details');
  expect(element.querySelector<HTMLInputElement>('input[type=password]')!.value).toBe('');
  await fill('Your current password','test password');await click('Retry same register action');
  const writes=api.mock.calls.filter(([,body])=>body);expect(writes[0]![1]).toEqual(writes[1]![1]);expect(writes[0]![1]).toMatchObject({action:'open',amountCents:10000,registerId:''});
  expect(element.textContent).toContain('Expected in drawer$120.00');
});
it('requires an explanation for closing variance and submits the reviewed ledger token',async()=>{
  let closed=false;
  api.mockImplementation(async(path,body)=>{
    if(path==='/me/register'&&body){closed=true;return{registerId:register.id};}
    if(path==='/me/register')return{open:closed?null:register,items:[],nextCursor:null};
    if(path.endsWith('/entries'))return{items:[],nextCursor:null};throw new Error(path);
  });
  await act(async()=>root.render(createElement(CashRegister)));
  await act(async()=>{const select=element.querySelector('select')!;select.value='close';select.dispatchEvent(new Event('change',{bubbles:true}));});
  await fill('Counted closing cash','119.50');await click('Review register action');expect(element.textContent).toContain('Explain the difference');
  await fill('Explanation','Counted short');await click('Review register action');expect(element.textContent).toContain('Variance: -$0.50');
  await fill('Your current password','test password');await click('Confirm register action');
  expect(api.mock.calls.find(([,body])=>body)?.[1]).toMatchObject({action:'close',amountCents:11950,registerId:register.id,token:'signed-count',reason:'Counted short'});
  expect(element.textContent).toContain('No register is open');
});
