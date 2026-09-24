import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { VisitActions } from './VisitActions';
import { accountApi } from '../data/customer-api';
import type { StaffVisit } from '../shared/staff-visits';

vi.mock('../data/customer-api', () => ({ accountApi: vi.fn() }));
const api = vi.mocked(accountApi);
let root: Root; let element: HTMLDivElement;
const visit: StaffVisit = { id: 'visit', customerName: 'Customer', serviceName: 'Haircut', locationName: 'Shop', timeZone: 'America/New_York', startsAt: '2026-10-01T14:00:00Z', endsAt: '2026-10-01T14:30:00Z', status: 'confirmed', priceCents: 3000, customerNote: null, proposedStartsAt: null, proposedEndsAt: null, updatedAt: 'version-one', cancellationPending: false, changePending: false, actions: ['checked_in','cancelled'] };
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); api.mockReset(); element = document.createElement('div'); document.body.append(element); root = createRoot(element); });
afterEach(async () => { await act(async () => root.unmount()); element.remove(); vi.unstubAllGlobals(); });
const click = async (text: string) => { const button = [...element.querySelectorAll('button')].find(node => node.textContent === text); expect(button).toBeDefined(); await act(async () => button!.click()); };
const submit = async () => {
  await act(async () => { const input = element.querySelector('input')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'test password'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
};
it('requires review, clears the password, and retains the same operation key after an uncertain response', async () => {
  const onSaved = vi.fn(); await act(async () => root.render(createElement(VisitActions, { visit, onSaved })));
  await click('Check in'); expect(api).not.toHaveBeenCalled(); await click('Go back');
  await click('Check in'); api.mockRejectedValueOnce(new Error('Connection lost')); await submit();
  expect(element.textContent).toContain('Retry the same action'); expect(element.querySelector('input')!.value).toBe('');
  expect([...element.querySelectorAll('button')].some(button => button.textContent === 'Go back')).toBe(false);
  api.mockResolvedValueOnce({ message: 'Visit updated.' }); await submit();
  expect(api.mock.calls[0]).toEqual(api.mock.calls[1]);
  expect(api.mock.calls[0]![1]).toMatchObject({ action: 'checked_in', updatedAt: 'version-one' });
  expect(onSaved).toHaveBeenCalledWith('Visit updated.');
});
it('explains pending schedule conflicts without exposing blocked actions', async () => {
  await act(async () => root.render(createElement(VisitActions, { visit: { ...visit, changePending: true, actions: [] }, onSaved: vi.fn() })));
  expect(element.textContent).toContain('Resolve the pending rescheduling request'); expect(element.querySelectorAll('button')).toHaveLength(0);
});
it('distinguishes cancellation from refunds and service completion from payment', async () => {
  await act(async () => root.render(createElement(VisitActions, { visit: { ...visit, cancellationPending: true, actions: ['cancelled'] }, onSaved: vi.fn() })));
  await click('Cancel visit'); expect(element.textContent).toContain('It does not process a refund');
  await act(async () => root.render(createElement(VisitActions, { key: 'complete', visit: { ...visit, status: 'in_service', actions: ['completed'] }, onSaved: vi.fn() })));
  await click('Complete visit'); expect(element.textContent).toContain('Completing service does not record payment');
});
