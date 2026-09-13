import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CustomerOverview } from './CustomerOverview';
import { accountApi, AccountApiError } from '../data/customer-api';
import type { CustomerAccount } from '../shared/customer';
import type { CustomerDashboard } from '../shared/dashboard';

vi.mock('../data/customer-api', async (original) => ({ ...await original<typeof import('../data/customer-api')>(), accountApi: vi.fn() }));
const api = vi.mocked(accountApi);
const account: CustomerAccount = { id: 'alice', email: 'alice@example.test', role: 'customer', emailVerified: true, profile: { name: 'Alice', phone: '', address: { line1: '', line2: '', city: '', state: '', postalCode: '' } } };
const visit = { id: 'private/visit', serviceName: 'Alice haircut', barberName: 'Barber', status: 'confirmed', cancellationState: 'pending' as const, startsAt: '2026-10-01T14:00:00Z', timeZone: 'America/Los_Angeles' };
const order = { id: 'private/order', status: 'ready_for_pickup', fulfillment: 'pickup', totalCents: 1500, createdAt: '2026-09-01' };
const dashboard: CustomerDashboard = { counts: { upcoming: 1, pending: 6, completed: 2, orders: 5 }, nextVisit: visit, pendingAppointments: [visit], readyOrders: [order], readyOrderCount: 5, recentAppointments: [visit], recentOrders: [order] };
let root: Root; let element: HTMLDivElement;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); api.mockReset(); element = document.createElement('div'); document.body.append(element); root = createRoot(element); });
afterEach(async () => { await act(async () => root.unmount()); element.remove(); vi.unstubAllGlobals(); });
const render = async (who = account) => { await act(async () => root.render(createElement(CustomerOverview, { account: who, bookingEnabled: true }))); };
const refresh = async () => { await act(async () => element.querySelector<HTMLButtonElement>('button')!.click()); };

it('shows actual pending and pickup records without presenting a cancellation as complete or a total as paid', async () => {
  api.mockResolvedValue(dashboard); await render();
  expect(element.querySelector('.customer-status')?.textContent).toBe('confirmed');
  expect(element.textContent).toContain('remains confirmed until your professional approves');
  expect(element.textContent).toContain('7:00 AM PDT');
  expect(element.textContent).toContain('6 appointment requests or decisions pending');
  expect(element.textContent).toContain('5 orders ready for pickup');
  expect(element.querySelector('a[href="/account?view=appointments&record=private%2Fvisit"]')).not.toBeNull();
  expect(element.querySelector('a[href="/account?view=orders&record=private%2Forder"]')).not.toBeNull();
  expect(element.textContent).toContain('View all appointments and requests');
  expect(element.textContent).toContain('Order total: $15.00'); expect(element.textContent).not.toMatch(/paid|receipt/i);
  expect(element.querySelector('a[href="/book"]')).not.toBeNull(); expect(element.querySelector('a[href="/account?view=profile"]')).not.toBeNull();
});

it('preserves records during refresh and network failure, labels stale data, and recovers on retry', async () => {
  api.mockResolvedValueOnce(dashboard); await render();
  let reject!: (error: Error) => void;
  api.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  await refresh(); expect(element.textContent).toContain('Alice haircut');
  expect(element.querySelector('button')!.disabled).toBe(true); expect(element.textContent).toContain('Refreshing your dashboard');
  await act(async () => reject(new Error('Connection lost')));
  expect(element.querySelector('[role="alert"]')?.textContent).toContain('may be out of date'); expect(element.textContent).toContain('Alice haircut');
  api.mockResolvedValueOnce({ ...dashboard, counts: { ...dashboard.counts, pending: 0 }, pendingAppointments: [], nextVisit: { ...visit, cancellationState: 'declined' } });
  await refresh(); expect(element.querySelector('[role="alert"]')).toBeNull(); expect(element.textContent).not.toContain('Cancellation requested.');
});

it('drops cached records on lost authorization', async () => {
  api.mockResolvedValueOnce(dashboard); await render();
  api.mockRejectedValueOnce(new AccountApiError(401, 'Please sign in again.')); await refresh();
  expect(element.textContent).not.toContain('Alice haircut'); expect(element.textContent).toContain('Please sign in again.');
});

it('clears private records on identity change and ignores an old account’s late response', async () => {
  let resolve!: (value: CustomerDashboard) => void;
  api.mockImplementationOnce(() => new Promise(done => { resolve = done; })); await render();
  api.mockResolvedValueOnce({ counts: { upcoming: 0, pending: 0, completed: 0, orders: 0 }, nextVisit: null, pendingAppointments: [], readyOrders: [], readyOrderCount: 0, recentAppointments: [], recentOrders: [] });
  await render({ ...account, id: 'bob', email: 'bob@example.test', profile: { ...account.profile, name: 'Bob' } });
  await act(async () => resolve(dashboard));
  expect(element.textContent).not.toContain('Alice'); expect(element.textContent).toContain('Bob');
  expect(element.textContent).toContain('No confirmed upcoming visit yet.'); expect(element.textContent).toContain('No pending appointment decisions');
});
