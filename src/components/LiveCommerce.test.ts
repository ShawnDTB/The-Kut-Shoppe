import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { accountApi, AccountApiError, setCustomerSession } from '../data/customer-api';
import { addToCart, loadCatalog, readCart } from '../data/live-storefront';
import { StorefrontV5 } from './LiveStorefrontV5';
import { ProductDetailPageV5, CheckoutPageV5 } from './LiveCommerceCustomerV5';
import { CartPageV4 } from './LiveCartPageV4';

vi.mock('../data/customer-api', async original=>({...await original<typeof import('../data/customer-api')>(),accountApi:vi.fn()}));
const api=vi.mocked(accountApi);
const product={id:'pomade',name:'Shop pomade',slug:'shop-pomade',category:'Grooming',description:'Matte finish',status:'published',pickupEnabled:true,shippingEnabled:true,amazonUrl:'',images:[],variants:[{id:'matte',name:'Matte',sku:'POM-M',priceCents:1500,stockOnHand:2,active:true}]};
let element:HTMLDivElement;let root:Root;
const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
const showModal = vi.fn(function(this: HTMLDialogElement) { this.open = true; });
beforeEach(() => {
  showModal.mockClear();
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: showModal });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.open = false; } });
});
afterEach(() => {
  for (const [name, descriptor] of [['showModal', originalShow], ['close', originalClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});

beforeEach(async()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);window.localStorage.clear();api.mockReset();setCustomerSession({id:'alice',email:'alice@example.test',role:'customer',emailVerified:true,profile:{name:'Alice Customer',phone:'5551234567',address:{line1:'',line2:'',city:'',state:'',postalCode:''}}});api.mockResolvedValueOnce({products:[product]});await loadCatalog();element=document.createElement('div');document.body.append(element);root=createRoot(element);});
afterEach(async()=>{await act(async()=>root.unmount());element.remove();vi.unstubAllGlobals();});
const button=async(text:string)=>{const node=[...document.querySelectorAll('button')].find(node=>node.textContent===text);expect(node).toBeDefined();await act(async()=>node!.click());};
it('restores catalog, product, cart and checkout controls using the server catalog',async()=>{
  await act(async()=>root.render(createElement(StorefrontV5)));
  expect(element.querySelector('a[href="/shop/shop-pomade"]')).not.toBeNull();
  await button('Add to cart');expect(readCart()).toEqual([{productId:'pomade',variantId:'matte',quantity:1}]);
  expect(document.querySelector('a[href="/checkout"]')).not.toBeNull();
  await act(async()=>root.render(createElement(ProductDetailPageV5,{slug:'shop-pomade'})));
  expect(element.textContent).toContain('Matte finish');
  await button('Add to cart');expect(readCart()[0]?.quantity).toBe(2);
  await act(async()=>root.render(createElement(CartPageV4)));
  expect(element.textContent).toContain('$30.00');
  await act(async()=>element.querySelector<HTMLButtonElement>('[aria-label="Decrease Shop pomade quantity"]')!.click());
  expect(readCart()[0]?.quantity).toBe(1);
});
it('submits an unpaid request, preserves its key on uncertain retry, and opens the saved order',async()=>{
  addToCart('pomade','matte');const onSubmitted=vi.fn();
  await act(async()=>root.render(createElement(CheckoutPageV5,{onSubmitted})));
  expect(element.textContent).toContain('unpaid order request');
  api.mockRejectedValueOnce(new AccountApiError(0,'Connection lost'));
  await button('Submit pickup request');const first=api.mock.calls.at(-1)!;
  expect(first[0]).toBe('/me/orders/request');expect(first[1]).toMatchObject({fulfillment:'pickup',items:[{variantId:'matte',quantity:1,unitPriceCents:1500}],customer:{name:'Alice Customer',phone:'5551234567'}});
  expect(readCart()).toHaveLength(1);
  api.mockResolvedValueOnce({orderId:'saved-order'});await button('Submit pickup request');
  expect(api.mock.calls.at(-1)![1]).toEqual(first[1]);expect(onSubmitted).toHaveBeenCalledWith('saved-order');expect(readCart()).toEqual([]);
  expect(window.localStorage.getItem('kut-shoppe.live-cart.v1')).not.toContain('Alice');
});

it('shares a native modal cart, keeps focus through quantity changes and restores the opener on cancel', async () => {
  document.documentElement.style.overflow = 'auto';
  await act(async () => root.render(createElement(StorefrontV5)));
  const add = element.querySelector<HTMLButtonElement>('[aria-label="Add to cart: Shop pomade"]')!;
  add.focus(); await act(async () => add.click());
  const dialog = document.querySelector('dialog')!;
  expect(dialog.open).toBe(true); expect(showModal).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(dialog.querySelector('[aria-label="Close cart"]'));
  const increase = dialog.querySelector<HTMLButtonElement>('[aria-label="Increase Shop pomade quantity"]')!;
  increase.focus(); await act(async () => increase.click());
  expect(readCart()[0]?.quantity).toBe(2); expect(showModal).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(increase);
  await act(async () => dialog.dispatchEvent(new Event('cancel', { cancelable: true })));
  expect(document.querySelector('dialog')).toBeNull(); expect(document.activeElement).toBe(add);
  expect(document.documentElement.style.overflow).toBe('auto');
  document.documentElement.style.overflow = '';
});
it('exposes category selection and uses a single main landmark throughout the purchase request flow', async () => {
  await act(async () => root.render(createElement(StorefrontV5)));
  const filters = element.querySelector('nav[aria-label="Product categories"]')!;
  expect(filters.querySelector('[aria-pressed="true"]')?.textContent).toContain('All');
  await act(async () => filters.querySelector<HTMLButtonElement>('button:nth-child(2)')!.click());
  expect(filters.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
  expect(filters.querySelector('[aria-pressed="true"]')?.textContent).toContain('Grooming');
  addToCart('pomade', 'matte');
  await act(async () => root.render(createElement('main', {}, createElement(CartPageV4))));
  expect(element.querySelectorAll('main')).toHaveLength(1);
  expect(element.querySelector('.commerce-cart-image')?.getAttribute('aria-label')).toBe('View Shop pomade');
  expect(element.textContent).toContain('Confirmed by the shop');
  expect(element.textContent).not.toContain('Calculated next');
  await act(async () => root.render(createElement('main', {}, createElement(CheckoutPageV5))));
  expect(element.querySelectorAll('main')).toHaveLength(1);
  expect(element.querySelector('h1')?.textContent).toBe('Review your order request.');
});
