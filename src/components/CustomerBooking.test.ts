import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CustomerBooking } from './CustomerBooking';
import { accountApi, AccountApiError } from '../data/customer-api';

vi.mock('../data/customer-api', async (original) => ({ ...await original<typeof import('../data/customer-api')>(), accountApi: vi.fn() }));
const api = vi.mocked(accountApi);
const option = { serviceId: 'cut', serviceName: 'Haircut', staffId: 'one', professionalName: 'Professional One', locationId: 'shop', locationName: 'The Shop', timeZone: 'America/New_York', durationMinutes: 30, priceCents: 3000 };
let element: HTMLDivElement; let root: Root;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); api.mockReset(); element = document.createElement('div'); document.body.append(element); root = createRoot(element); });
afterEach(async () => { await act(async () => root.unmount()); element.remove(); vi.unstubAllGlobals(); });
const click = async (selector: string) => { const node = element.querySelector<HTMLElement>(selector); expect(node).not.toBeNull(); await act(async () => node!.click()); };
const button = async (text: string) => { const node = [...element.querySelectorAll('button')].find((item) => item.textContent === text); expect(node).toBeDefined(); await act(async () => node!.click()); };
it('separates service and professional selection and clears stale times when the professional changes', async () => {
  api.mockResolvedValueOnce({ options: [option, { ...option, staffId: 'two', professionalName: 'Professional Two' }] });
  await act(async () => root.render(createElement(CustomerBooking, { onBack: vi.fn(), onOpen: vi.fn() })));
  expect(element.querySelectorAll('[name="booking-service"]')).toHaveLength(1);
  await click('[name="booking-service"]'); expect(element.querySelectorAll('[name="booking-professional"]')).toHaveLength(2);
  await click('[name="booking-professional"][value="one"]'); await click('.customer-date-shortcuts button');
  api.mockResolvedValueOnce({ option, date: '2026-09-12', quote: 'signed', slots: [{ startsAt: '2026-09-12T14:00:00Z', endsAt: '2026-09-12T14:30:00Z' }] });
  await act(async () => element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(api.mock.calls.at(-1)![0]).toContain('staffId=one'); expect(element.querySelector('[name="appointment-time"]')).not.toBeNull();
  await click('[name="booking-professional"][value="two"]'); expect(element.querySelector('[name="appointment-time"]')).toBeNull();
  expect((element.querySelector('input[type="date"]') as HTMLInputElement).value).toBe('');
});
it('retries an uncertain submission with the same idempotency key and locks selection', async () => {
  api.mockResolvedValueOnce({ options: [option] }); const onOpen = vi.fn();
  await act(async () => root.render(createElement(CustomerBooking, { onBack: vi.fn(), onOpen })));
  await click('[name="booking-service"]'); await click('[name="booking-professional"]'); await click('.customer-date-shortcuts button');
  api.mockResolvedValueOnce({ option, date: '2026-09-12', quote: 'signed', slots: [{ startsAt: '2026-09-12T14:00:00Z', endsAt: '2026-09-12T14:30:00Z' }] });
  await act(async () => element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await click('[name="appointment-time"]'); await button('Review request'); api.mockRejectedValueOnce(new AccountApiError(0, 'Connection lost'));
  await button('Submit appointment request'); const payload = api.mock.calls.at(-1)![1];
  expect(element.querySelector('fieldset')!.disabled).toBe(true);
  api.mockResolvedValueOnce({ appointmentId: 'saved' }); await button('Retry same request');
  expect(api.mock.calls.at(-1)![1]).toEqual(payload); expect(onOpen).toHaveBeenCalledWith('saved');
});
