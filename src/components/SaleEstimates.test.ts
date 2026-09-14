import { createElement, act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CustomerEstimates, SalesPreparation } from './SaleEstimates';
import { accountApi, downloadAccountDocument } from '../data/customer-api';
import type { SaleEstimate } from '../shared/sales';

vi.mock('./StaffAuthenticator', () => ({ StaffAuthenticator: ({ children }: { children: ReactNode }) => children }));
vi.mock('../data/customer-api', async importOriginal => ({ ...await importOriginal<typeof import('../data/customer-api')>(), accountApi: vi.fn(), downloadAccountDocument: vi.fn() }));
const api = vi.mocked(accountApi); let root: Root; let element: HTMLDivElement;
const estimate: SaleEstimate = { schemaVersion: 1, id: 'estimate-one', createdAt: '2026-09-14T14:00:00Z', customerName: 'Customer Alice', appointmentId: 'visit-one', orderId: null,
  appointmentTime: '2026-09-14T15:00:00Z', timeZone: 'America/New_York', currency: 'USD', discountReason: 'Loyalty', chargeNote: '',
  subtotalCents: 3200, discountCents: 1005, netCents: 2195, taxCents: null, shippingCents: 0, totalCents: null,
  lines: [{ id: 'service', kind: 'service', description: 'Haircut', quantity: 1, unitPriceCents: 3200, professionalName: 'Barber', professionalId: 'professional', grossCents: 3200, discountCents: 1005, netCents: 2195 }] };
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); api.mockReset(); vi.mocked(downloadAccountDocument).mockReset();
  window.history.replaceState({}, '', '/account?view=sales&appointment=visit-one');
  element = document.createElement('div'); document.body.append(element); root = createRoot(element);
});
afterEach(async () => { await act(async () => root.unmount()); element.remove(); vi.unstubAllGlobals(); });
const click = async (text: string) => { const button = [...element.querySelectorAll('button')].find(node => node.textContent === text); expect(button).toBeDefined(); await act(async () => button!.click()); };
const fill = async (label: string, value: string) => {
  const field = [...element.querySelectorAll('label')].find(node => node.textContent?.startsWith(label))!.querySelector('input')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })); });
};
it('reviews server amounts before saving and reuses the request identity after a lost response', async () => {
  let attempts = 0; let saved = false;
  api.mockImplementation(async (path, body) => {
    if (path.startsWith('/me/sales/sources')) return { items: [], nextCursor: null };
    if (path === '/me/sales/preview') return { estimate, expiresAt: '2026-09-14T14:10:00Z', token: 'signed-review' };
    if (path === '/me/sales' && body) { attempts++; if (attempts === 1) throw new Error('Connection lost'); saved = true; return { estimateId: estimate.id }; }
    if (path === '/me/sales') return { items: saved ? [estimate] : [], nextCursor: null };
    throw new Error(path);
  });
  await act(async () => root.render(createElement(SalesPreparation)));
  await fill('Discount ($)', '10.05'); await fill('Discount explanation', 'Loyalty'); await click('Review estimate');
  expect(api.mock.calls.find(([path]) => path.endsWith('/preview'))?.[1]).toEqual({ appointmentId: 'visit-one', orderId: null, discountCents: 1005, discountReason: 'Loyalty', taxCents: null, shippingCents: null, chargeNote: '' });
  expect(element.textContent).toContain('Not yet determined'); expect(attempts).toBe(0);
  await fill('Your current password', 'password for test'); await click('Save estimate');
  expect(element.textContent).toContain('Connection lost'); expect(element.textContent).not.toContain('Back to amounts');
  expect(element.querySelector<HTMLInputElement>('input[type=password]')!.value).toBe('');
  await fill('Your current password', 'password for test'); await click('Retry saving estimate');
  const writes = api.mock.calls.filter(([path, body]) => path === '/me/sales' && body);
  expect(writes[0]![1]).toEqual(writes[1]![1]); expect(writes[0]![1]).toMatchObject({ token: 'signed-review', requestKey: expect.any(String) });
  expect(element.textContent).toContain('saved. No payment was requested or recorded.');
});
it('rejects invalid monetary input before requesting a quote', async () => {
  api.mockResolvedValue({ items: [], nextCursor: null }); await act(async () => root.render(createElement(SalesPreparation)));
  await fill('Discount ($)', '1e3'); await click('Review estimate');
  expect(element.textContent).toContain('Use dollar amounts'); expect(api.mock.calls.every(([, body]) => body === undefined)).toBe(true);
});
it('loads only customer estimates and uses the private document download with visible recovery', async () => {
  api.mockResolvedValue({ items: [estimate], nextCursor: null }); await act(async () => root.render(createElement(CustomerEstimates)));
  expect(api.mock.calls.map(([path]) => path)).toEqual(['/me/estimates']);
  vi.mocked(downloadAccountDocument).mockRejectedValueOnce(new Error('Try downloading again'));
  await click('Download estimate'); expect(element.textContent).toContain('Try downloading again');
  vi.mocked(downloadAccountDocument).mockResolvedValueOnce(undefined); await click('Download estimate');
  expect(downloadAccountDocument).toHaveBeenLastCalledWith('estimates', 'estimate-one'); expect(element.textContent).toContain('Download started');
});
