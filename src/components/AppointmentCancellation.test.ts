import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CustomerAppointmentDetails } from './CustomerRecordDetails';
import { StaffRequests } from './StaffRequests';
import { accountApi } from '../data/customer-api';

vi.mock('../data/customer-api', () => ({ accountApi: vi.fn(), downloadAppointmentCalendar: vi.fn() }));
vi.mock('./StaffAuthenticator', () => ({ StaffAuthenticator: ({ children }: { children: ReactNode }) => children }));
const api = vi.mocked(accountApi);
let root: Root; let element: HTMLDivElement;
const appointment = { id: 'visit', serviceName: 'Haircut', barberName: 'Barber', status: 'confirmed', startsAt: '2026-10-01T14:00:00Z', endsAt: '2026-10-01T14:30:00Z', priceCents: 3000, updatedAt: 'original', canRequestCancellation: true, canDownloadCalendar: true, location: { name: 'Shop', timeZone: 'America/New_York', address: { line1: 'Main St', line2: '', city: 'Stroudsburg', state: 'PA', postalCode: '18360' } } };
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); api.mockReset(); element = document.createElement('div'); document.body.append(element); root = createRoot(element); });
afterEach(async () => { await act(async () => root.unmount()); element.remove(); vi.unstubAllGlobals(); });
const click = async (text: string) => { const button = [...element.querySelectorAll('button')].find(node => node.textContent === text); expect(button).toBeDefined(); await act(async () => button!.click()); };

it('requires customer confirmation and safely retries without presenting a pending cancellation as cancelled', async () => {
  api.mockResolvedValueOnce({ appointment });
  await act(async () => root.render(createElement(CustomerAppointmentDetails, { id: 'visit', onBack: vi.fn() })));
  await click('Request cancellation'); expect(api).toHaveBeenCalledTimes(1);
  await click('Go back'); expect(api).toHaveBeenCalledTimes(1);
  await click('Request cancellation'); api.mockRejectedValueOnce(new Error('Connection lost'));
  await click('Send cancellation request'); expect(element.textContent).toContain('Connection lost');
  api.mockResolvedValueOnce({ appointment: { ...appointment, canRequestCancellation: false, cancellationState: 'pending' }, message: 'Cancellation requested.' });
  await click('Send cancellation request');
  expect(api.mock.calls[1]).toEqual(api.mock.calls[2]);
  expect(api.mock.calls[2]).toEqual(['/me/appointments/visit/cancellation', { updatedAt: 'original' }]);
  expect(element.textContent).toContain('Your appointment remains confirmed until your barber approves');
  expect(element.querySelector('.customer-status')?.textContent).toBe('confirmed');
  expect([...element.querySelectorAll('button')].some(node => node.textContent === 'Request cancellation')).toBe(false);
});

it('lets the professional review a cancellation and retains the same decision key after an uncertain response', async () => {
  const pending = { ...appointment, customerName: 'Customer', locationName: 'Shop', timeZone: 'America/New_York', cancellationState: 'pending' };
  api.mockResolvedValueOnce({ state: 'approved', enabled: true }).mockResolvedValueOnce({ items: [pending], nextCursor: null }).mockResolvedValueOnce({ request: pending });
  await act(async () => root.render(createElement(StaffRequests)));
  await click('Review request'); await click('Review cancellation approval');
  expect(element.textContent).toContain('This cancels the visit and releases the reserved time');
  const submit = async () => {
    const input = element.querySelector('input')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'test password'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  };
  api.mockRejectedValueOnce(new Error('Connection lost')); await submit();
  api.mockResolvedValueOnce({ request: { ...pending, status: 'cancelled', cancellationState: 'approved' }, message: 'Cancellation approved.' }); await submit();
  expect(api.mock.calls[3]![1]).toMatchObject({ action: 'cancel', updatedAt: 'original' });
  expect(api.mock.calls[3]).toEqual(api.mock.calls[4]);
  expect(element.textContent).toContain('Cancellation approved.');
  expect(element.querySelector('form')).toBeNull();
});
