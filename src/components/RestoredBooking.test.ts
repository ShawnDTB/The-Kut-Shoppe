import { act,createElement } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import { RestoredBooking } from './RestoredBooking';
import { ProductionBooking } from './ProductionAccess';
import { accountApi,AccountApiError,setCustomerSession } from '../data/customer-api';
vi.mock('../data/customer-api',async original=>({...await original<typeof import('../data/customer-api')>(),accountApi:vi.fn()}));
vi.mock('./CustomerAccount',()=>({CustomerAccount:()=>createElement('div',{'data-testid':'account-access'},'Account access')}));
const api=vi.mocked(accountApi);
const account={id:'alice',email:'alice@example.test',role:'customer' as const,emailVerified:true,profile:{name:'Alice',phone:'5551234567',address:{line1:'',line2:'',city:'',state:'',postalCode:''}}};
const option={serviceId:'cut',serviceName:'Haircut',staffId:'one',professionalName:'Barber One',locationId:'shop',locationName:'The Shop',timeZone:'America/New_York',durationMinutes:30,priceCents:3000};
const second={...option,staffId:'two',professionalName:'Barber Two',priceCents:4000};
const available=(choice=option)=>({option:choice,date:'2026-09-20',quote:choice.staffId,slots:[{startsAt:'2026-09-20T14:00:00.000Z',endsAt:'2026-09-20T14:30:00.000Z'}]});
let root:Root;let element:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);window.history.replaceState({},'','/book');setCustomerSession(account);api.mockReset();element=document.createElement('div');document.body.append(element);root=createRoot(element);});
afterEach(async()=>{await act(async()=>root.unmount());element.remove();vi.unstubAllGlobals();});
const click=async(selector:string)=>{const button=element.querySelector<HTMLElement>(selector);expect(button).not.toBeNull();await act(async()=>button!.click());};
const button=async(text:string)=>{const node=[...element.querySelectorAll('button')].find(node=>node.textContent===text);expect(node).toBeDefined();await act(async()=>node!.click());};
const start=async(options=[option])=>{api.mockResolvedValueOnce({options});await act(async()=>root.render(createElement(RestoredBooking,{onBack:vi.fn(),onOpen:vi.fn()})));await click('.booking-v2-service-list button');await click('.booking-v2-barber-grid button');};

it('restores exactly the Barber and Loctician gateway and routes Barber into the service rows',async()=>{
  api.mockResolvedValueOnce({enabled:true,bookingEnabled:true});await act(async()=>root.render(createElement(ProductionBooking)));
  expect(element.textContent).toContain('Who do you need?');expect(element.querySelectorAll('.booking-gateway-v3-card')).toHaveLength(2);
  expect(element.querySelector('.booking-gateway-v3-barber')?.getAttribute('href')).toBe('/book?barber=any');expect(element.querySelector('.booking-gateway-v3-loctician')?.getAttribute('href')).toBe('https://crownedbysteph.glossgenius.com');
  api.mockResolvedValueOnce({options:[option]});await act(async()=>{window.history.pushState({},'','/book?barber=any');window.dispatchEvent(new PopStateEvent('popstate'));});
  expect(element.querySelector('.booking-v2-service-list')?.textContent).toContain('Haircut');expect(element.querySelector('.booking-v4-week')).toBeNull();
});
it('keeps provider fallback usable when native booking is disabled and never creates a replacement for edit links',async()=>{
  window.history.replaceState({},'','/book?barber=any');api.mockResolvedValueOnce({enabled:false,bookingEnabled:false});await act(async()=>root.render(createElement(ProductionBooking)));
  expect(element.querySelector('a[href^="https://booksy.com/"]')).not.toBeNull();
  await act(async()=>{window.history.pushState({},'','/book?appointment=existing');window.dispatchEvent(new PopStateEvent('popstate'));});
  expect(element.textContent).toContain('existing appointment has not changed');expect(element.querySelector('.booking-v2-service-list')).toBeNull();
});
it('shows one time then lets the customer choose a matching chair, preserving its price and signed quote',async()=>{
  await start([option,second]);api.mockResolvedValueOnce(available(option));api.mockResolvedValueOnce(available(second));await click('.booking-v4-week button');
  expect(element.querySelectorAll('.booking-v4-times > div > button')).toHaveLength(1);await click('.booking-v4-times > div > button');expect(element.querySelectorAll('.booking-v5-candidate-picker button')).toHaveLength(2);
  await act(async()=>element.querySelectorAll<HTMLButtonElement>('.booking-v5-candidate-picker button')[1]!.click());expect(element.querySelector('.booking-v2-review')?.textContent).toContain('$40.00');
  api.mockRejectedValueOnce(new AccountApiError(0,'Connection lost'));await button('Request appointment');const payload=api.mock.calls.at(-1)![1];expect(payload).toMatchObject({staffId:'two',quote:'two'});
  expect(element.querySelector<HTMLButtonElement>('.booking-v5-panel-toolbar button')?.disabled).toBe(true);
  api.mockResolvedValueOnce({appointmentId:'saved'});await button('Retry same request');expect(api.mock.calls.at(-1)![1]).toEqual(payload);expect(element.textContent).toContain('Your appointment request was sent.');
});
it('retains a guest selection through sign-in and ignores a late availability response after changing week',async()=>{
  setCustomerSession(null);await start();expect(api.mock.calls[0]![0]).toBe('/booking/options');
  let resolve!:(value:ReturnType<typeof available>)=>void;api.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));await click('.booking-v4-week button');await click('[aria-label="Next week"]');await act(async()=>resolve(available()));expect(element.querySelector('.booking-v4-times')).toBeNull();
  api.mockResolvedValueOnce(available());await click('.booking-v4-week button');await click('.booking-v4-times > div > button');expect(element.querySelector('[data-testid="account-access"]')).not.toBeNull();
  api.mockResolvedValueOnce({options:[option]});await act(async()=>setCustomerSession(account));expect(element.querySelector('[data-testid="account-access"]')).toBeNull();expect(element.querySelector('.booking-v2-review')?.textContent).toContain('Haircut');
  api.mockResolvedValueOnce({appointmentId:'guest-continued'});await button('Request appointment');expect(element.textContent).toContain('Your appointment request was sent.');
});
