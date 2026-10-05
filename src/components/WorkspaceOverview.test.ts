import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { accountApi } from '../data/customer-api';
import { WorkspaceOverview } from './WorkspaceOverview';
import type { CustomerAccount } from '../shared/customer';
vi.mock('../data/customer-api', () => ({ accountApi: vi.fn() }));
vi.mock('./StaffAuthenticator', () => ({ StaffAuthenticator: ({ children }: { children: React.ReactNode }) => children }));
let element: HTMLDivElement; let root: Root;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.mocked(accountApi).mockReset(); element = document.createElement('div'); document.body.append(element); root = createRoot(element); });
afterEach(async () => { await act(async () => root.unmount()); element.remove(); vi.unstubAllGlobals(); });
it.each(['owner', 'manager', 'barber'] as const)('keeps %s dashboard shortcuts within the workspace scope', async role => {
  const shop = role !== 'barber';
  vi.mocked(accountApi).mockResolvedValue({ scope: shop ? 'shop' : 'chair', access: { state: 'approved', setupEnabled: true }, counts: { pending: 0, upcoming: 0, active: 0, orders: shop ? 0 : null, reviews: role === 'owner' ? 0 : null }, visits: [] });
  await act(async () => root.render(createElement(WorkspaceOverview, { account: { id: 'staff', role } as CustomerAccount })));
  for (const view of ['sales', 'counter', 'register']) expect(Boolean(element.querySelector('a[href="/account?view=' + view + '"]'))).toBe(shop);
  expect(Boolean(element.querySelector('a[href="/account?view=setup-reviews"]'))).toBe(role === 'owner');
  if (!shop) expect(element.querySelector('a[href="/account?view=professional"]')).not.toBeNull();
});
