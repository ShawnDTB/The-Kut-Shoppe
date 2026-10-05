import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveCommerce } from './LiveCommerce';
import { accountApi, getCustomerSession, setCustomerSession } from '../data/customer-api';
import { addToCart, loadCatalog, readCart } from '../data/live-storefront';
vi.mock('../data/customer-api', async original => ({ ...await original<typeof import('../data/customer-api')>(), accountApi: vi.fn(), loadCustomerSession: vi.fn(async () => getCustomerSession()) }));
vi.mock('./CustomerAccount', () => ({ CustomerAccount: () => createElement('h1', {}, 'Sign in') }));
vi.mock('./StaffAuthenticator', () => ({ StaffAuthenticator: ({ children }: { children: React.ReactNode }) => children }));
const account = { id: 'customer', role: 'customer' as const, email: 'customer@example.test', emailVerified: true, profile: { name: 'Customer', phone: '5551234567', address: { line1: '', line2: '', city: '', state: '', postalCode: '' } } };
const product = { id: 'pomade', name: 'Shop pomade', slug: 'shop-pomade', category: 'Grooming', description: '', status: 'published', pickupEnabled: true, shippingEnabled: false, amazonUrl: '', images: [], variants: [{ id: 'matte', name: 'Matte', sku: 'POM', priceCents: 1500, stockOnHand: 4, active: true }] };
let element: HTMLDivElement; let root: Root;
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); localStorage.clear(); setCustomerSession(null);
  vi.mocked(accountApi).mockReset(); vi.mocked(accountApi).mockImplementation(async target => target === '/catalog' ? { products: [product] } : { products: [], orders: [], revision: 1 });
  await loadCatalog(); element = document.createElement('div'); document.body.append(element); root = createRoot(element);
});
afterEach(async () => { await act(async () => root.unmount()); element.remove(); vi.unstubAllGlobals(); });
it('keeps the checkout destination and cart when a guest signs in', async () => {
  addToCart('pomade', 'matte', 2);
  await act(async () => root.render(createElement(LiveCommerce, { path: '/checkout' })));
  expect(element.textContent).toContain('Your cart is saved on this device');
  expect(element.querySelector('a[href="/cart"]')).not.toBeNull();
  await act(async () => setCustomerSession(account));
  expect(element.querySelector('h1')?.textContent).toBe('Review your order request.');
  expect(readCart()).toEqual([{ productId: 'pomade', variantId: 'matte', quantity: 2 }]);
  expect(element.textContent).toContain('$30.00');
});
it('provides a dashboard return from store management and keeps customer access restricted', async () => {
  setCustomerSession({ ...account, role: 'owner' });
  await act(async () => root.render(createElement(LiveCommerce, { path: '/admin/products' })));
  expect(element.querySelector('nav[aria-label="Store workspace"] a')?.getAttribute('href')).toBe('/dashboard');
  expect(element.querySelector('h1')?.textContent).toBe('Manage products');
  await act(async () => setCustomerSession(account));
  expect(element.textContent).toContain('does not have store management access');
  expect(element.querySelector('form')).toBeNull();
});
it('handles a malformed product URL with a useful product-not-found page', async () => {
  await act(async () => root.render(createElement(LiveCommerce, { path: '/shop/%E0%A4%A' })));
  expect(element.querySelector('a[href="/shop"]')).not.toBeNull();
  expect(element.textContent).toMatch(/not found|unavailable/i);
});
