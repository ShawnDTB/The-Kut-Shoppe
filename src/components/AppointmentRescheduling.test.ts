import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppointmentRescheduling } from './AppointmentRescheduling';
import { accountApi } from '../data/customer-api';

vi.mock('../data/customer-api', () => ({ accountApi: vi.fn() }));
const api = vi.mocked(accountApi);
let root: Root; let element: HTMLDivElement;
const current = { updatedAt: 'original', version: 0, startsAt: '2026-10-01T14:00:00Z', endsAt: '2026-10-01T14:30:00Z', priceCents: 3000, timeZone: 'America/New_York', canRequest: true, canResolve: false, change: null };
const change = { id: 'change', kind: 'professional_proposal', status: 'pending', startsAt: '2026-10-01T15:00:00Z', endsAt: '2026-10-01T15:30:00Z', expiresAt: current.startsAt };
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); api.mockReset(); element = document.createElement('div'); document.body.append(element); root = createRoot(element); });
afterEach(async () => { await act(async () => root.unmount()); element.remove(); vi.unstubAllGlobals(); });
const click = async (text: string) => { const button = [...element.querySelectorAll('button')].find(node => node.textContent === text); expect(button).toBeDefined(); await act(async () => button!.click()); };
const render = async (professional = false) => { await act(async () => root.render(createElement(AppointmentRescheduling, { id: 'visit', professional, onSaved: vi.fn() }))); };
const input = async (selector: string, value: string) => { const field = element.querySelector<HTMLInputElement>(selector)!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })); }); };

it('requires explicit review before accepting, preserves retry identity, and updates only on a successful save', async () => {
  api.mockResolvedValueOnce({ ...current, canRequest: false, canResolve: true, change }); await render();
  await click('Review replacement time'); expect(api).toHaveBeenCalledTimes(1);
  api.mockRejectedValueOnce(new Error('Connection lost')); await click('Confirm appointment change');
  expect(element.textContent).toContain('Retry the same change'); expect(element.textContent).toContain('Confirmed time: Oct 1, 2026, 10:00 AM');
  api.mockResolvedValueOnce({ ...current, startsAt: change.startsAt, change: { ...change, status: 'approved' }, message: 'Saved' });
  await click('Confirm appointment change'); expect(api.mock.calls[1]).toEqual(api.mock.calls[2]);
  expect(api.mock.calls[2]![1]).toMatchObject({ action: 'accept', updatedAt: 'original', version: 0, changeId: 'change' });
  expect(element.textContent).toContain('The appointment has moved');
});

it('uses current server availability and quote to review and request a replacement', async () => {
  api.mockResolvedValueOnce(current); await render(); await input('input[type="date"]', '2026-10-01');
  api.mockResolvedValueOnce({ option: { professionalName: 'Barber', timeZone: current.timeZone }, date: '2026-10-01', quote: 'server-quote', slots: [{ startsAt: change.startsAt, endsAt: change.endsAt }] });
  await click('Find replacement times'); expect(api.mock.calls[1]![0]).toBe('/me/appointments/visit/reschedule?date=2026-10-01');
  await act(async () => element.querySelector<HTMLInputElement>('input[type="radio"]')!.click());
  await click('Review change request'); expect(api).toHaveBeenCalledTimes(2);
  api.mockResolvedValueOnce({ ...current, canRequest: false, canResolve: true, change: { ...change, kind: 'customer_request' }, message: 'Saved' });
  await click('Confirm appointment change'); expect(api.mock.calls[2]![1]).toMatchObject({ action: 'request', date: '2026-10-01', startsAt: change.startsAt, quote: 'server-quote' });
  expect(element.textContent).toContain('Waiting for the other party');
});

it('lets a professional decline an expired customer request without offering an invalid approval', async () => {
  api.mockResolvedValueOnce({ ...current, canRequest: false, canResolve: true, change: { ...change, status: 'expired', kind: 'customer_request' } }); await render(true);
  expect(element.textContent).not.toContain('Review replacement time');
  await click('Decline change request'); await input('input[type="password"]', 'test password');
  api.mockResolvedValueOnce({ ...current, canResolve: false, change: { ...change, status: 'declined' }, message: 'Saved' });
  await click('Confirm appointment change'); expect(api.mock.calls[1]![0]).toBe('/me/professional/requests/visit/reschedule');
  expect(api.mock.calls[1]![1]).toMatchObject({ action: 'decline', currentPassword: 'test password' });
  expect(element.querySelector('input[type="password"]')).toBeNull();
});
