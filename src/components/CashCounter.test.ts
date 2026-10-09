import { createElement, act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CashCounter, CustomerReceipts } from './CashCounter';
import { accountApi, downloadAccountDocument } from '../data/customer-api';
import type { FinalizedSale, CashReceipt } from '../shared/counter';

vi.mock('./StaffAuthenticator', () => ({ StaffAuthenticator: ({ children }: { children: ReactNode }) => children }));
vi.mock('../data/customer-api', async importOriginal => ({ ...await importOriginal<typeof import('../data/customer-api')>(), accountApi: vi.fn(), downloadAccountDocument: vi.fn() }));
const api = vi.mocked(accountApi); let root: Root; let element: HTMLDivElement;
const original: FinalizedSale = { id:'sale-one',estimateId:'estimate-one',createdAt:'2026-09-24T12:00:00Z',totalCents:2399,state:'unpaid',receipts:[],estimate:{schemaVersion:1,id:'estimate-one',createdAt:'2026-09-24T12:00:00Z',customerName:'Alice',appointmentId:'visit-one',orderId:null,appointmentTime:null,timeZone:'America/New_York',currency:'USD',discountReason:'Loyalty',chargeNote:'Confirmed test amount',subtotalCents:2500,discountCents:101,netCents:2399,taxCents:0,shippingCents:0,totalCents:2399,lines:[{id:'line-one',kind:'service',description:'Haircut',quantity:1,unitPriceCents:2500,grossCents:2500,discountCents:101,netCents:2399,professionalId:'barber-one',professionalName:'Barber'}]}};
const receipt: CashReceipt = {id:'receipt-one',saleId:original.id,createdAt:original.createdAt,kind:'payment',sale:original.estimate,amountCents:2600,tipCents:201,cashReceivedCents:3000,changeCents:400,reason:'',originalReceiptId:null,sellerName:'The Kut Shoppe',sellerAddress:'518 Main Street'};
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); api.mockReset(); vi.mocked(downloadAccountDocument).mockReset();
  window.history.replaceState({}, '', '/account?view=counter&sale=sale-one');
  element=document.createElement('div');document.body.append(element);root=createRoot(element);
});
afterEach(async()=>{await act(async()=>root.unmount());element.remove();vi.unstubAllGlobals();});
const click=async(text:string)=>{const button=[...element.querySelectorAll('button')].find(node=>node.textContent===text);expect(button).toBeDefined();await act(async()=>button!.click());};
const fill=async(label:string,value:string)=>{const field=[...element.querySelectorAll('label')].find(node=>node.textContent?.startsWith(label))!.querySelector('input')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}));});};
it('keeps card tests explicit, hides cash during an uncertain payment, and recovers the same checkout',async()=>{
  let sale:FinalizedSale={...original,sandboxCheckoutEnabled:true};let attempts=0;
  api.mockImplementation(async(path,body)=>{
    if(path==='/me/counter')return{items:[sale],nextCursor:null};
    if(path==='/me/counter/sale-one')return{sale};
    if(path==='/me/payments/checkout'&&body){attempts++;sale={...sale,cardPayment:{id:'payment-one',state:'pending',checkoutUrl:attempts>1?'https://checkout.stripe.com/c/pay/cs_test_fixture':null}};if(attempts===1)throw new Error('Provider reply lost. Retry this sale.');return{state:'pending'};}
    if(path==='/me/payments/payment-one/reconcile'){sale={...sale,cardPayment:{id:'payment-one',state:'paid',checkoutUrl:null}};return{state:'paid'};}
    throw new Error(path);
  });
  await act(async()=>root.render(createElement(CashCounter)));expect(element.textContent).toContain('Test mode only');
  await fill('Your current password','test password');await click('Create test card checkout');
  expect(element.textContent).toContain('Provider reply lost');expect(element.querySelector<HTMLInputElement>('input[type=password]')!.value).toBe('');
  await click('Refresh sales and receipts');expect(element.textContent).toContain('Cash collection and voiding are locked');
  expect(element.textContent).not.toContain('Review cash action');
  await fill('Your current password','test password');await click('Recover the same test checkout');
  expect(element.querySelector('a[href^="https://checkout.stripe.com"]')?.textContent).toContain('new tab');
  await click('Check Stripe payment status');expect(element.textContent).toContain('Stripe confirmed the test payment');
  expect(element.textContent).not.toContain('Full cash refund');
  const writes=api.mock.calls.filter(([path])=>path==='/me/payments/checkout');expect(writes[0]![1]).toEqual(writes[1]![1]);
});
it('reviews change due and freezes the cash action across a lost response, then shows the saved receipt',async()=>{
  let sale=original;let attempts=0;
  api.mockImplementation(async(path,body)=>{
    if(path==='/me/register')return{open:{id:'register-one'}};
    if(path==='/me/counter')return{items:[sale],nextCursor:null};
    if(path==='/me/counter/sale-one'&&body){attempts++;if(attempts===1)throw new Error('Connection lost');sale={...original,state:'paid',receipts:[receipt]};return{receiptId:receipt.id};}
    if(path==='/me/counter/sale-one')return{sale};throw new Error(path);
  });
  await act(async()=>root.render(createElement(CashCounter)));
  await fill('Cash received','30.00');await fill('Service tip','2.01');await click('Review cash action');
  expect(element.textContent).toContain('Change due: $4.00');expect(attempts).toBe(0);
  await fill('Your current password','test password');await click('Confirm cash record');
  expect(element.textContent).toContain('Connection lost');expect(element.textContent).toContain('Do not collect or return cash again');
  expect(element.textContent).not.toContain('Back to cash details');expect(element.querySelector<HTMLInputElement>('input[type=password]')!.value).toBe('');
  await fill('Your current password','test password');await click('Retry same cash action');
  const writes=api.mock.calls.filter(([,body])=>body);expect(writes[0]![1]).toEqual(writes[1]![1]);
  expect(writes[0]![1]).toMatchObject({cashReceivedCents:3000,tipCents:201,requestKey:expect.any(String)});
  expect(element.textContent).toContain('Full cash refund');expect(element.textContent).toContain('Cash payment · $26.00');
});
it('rejects underpayment before creating any cash record',async()=>{
  api.mockImplementation(async path=>path==='/me/register'?{open:{id:'register-one'}}:path==='/me/counter'?{items:[original],nextCursor:null}:{sale:original});
  await act(async()=>root.render(createElement(CashCounter)));await fill('Cash received','23.98');await click('Review cash action');
  expect(element.textContent).toContain('Cash received must cover the full sale and tip');expect(api.mock.calls.every(([,body])=>body===undefined)).toBe(true);
});
it('finalizes the selected estimate without claiming payment and recovers failed downloads',async()=>{
  window.history.replaceState({},'','/account?view=counter&estimate=estimate-one');
  api.mockImplementation(async(path,body)=>{
    if(path==='/me/counter'&&body)return{saleId:original.id};
    if(path==='/me/counter')return{items:[],nextCursor:null};
    if(path==='/me/sales/estimate-one')return{estimate:original.estimate};
    if(path==='/me/counter/sale-one')return{sale:original};throw new Error(path);
  });
  await act(async()=>root.render(createElement(CashCounter)));await fill('Your current password','test password');await click('Finalize sale');
  expect(element.textContent).toContain('No cash has been recorded');expect(window.location.search).toContain('sale=sale-one');
  api.mockResolvedValue({items:[receipt],nextCursor:null});await act(async()=>root.render(createElement(CustomerReceipts)));
  vi.mocked(downloadAccountDocument).mockRejectedValueOnce(new Error('Download unavailable'));await click('Download receipt');expect(element.textContent).toContain('Download unavailable');
  vi.mocked(downloadAccountDocument).mockResolvedValueOnce(undefined);await click('Download receipt');expect(downloadAccountDocument).toHaveBeenLastCalledWith('receipts',receipt.id);expect(element.textContent).toContain('Download started');
});
