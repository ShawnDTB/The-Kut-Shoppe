import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveAccounts } from './LiveAccounts';
import { setCustomerSession } from '../data/customer-api';
import type { CustomerAccount } from '../shared/customer';

const account: CustomerAccount = { id: 'customer-one', email: 'test@example.com', role: 'customer', emailVerified: true, profile: { name: 'Test Customer', phone: '', address: { line1: '', line2: '', city: '', state: '', postalCode: '' } } };
let root: Root; let element: HTMLDivElement;
const request = vi.fn();
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('fetch', request); request.mockReset(); setCustomerSession(null);
  window.history.replaceState({}, '', '/account'); element = document.createElement('div'); document.body.append(element); root = createRoot(element);
});
afterEach(async () => { await act(async () => root.unmount()); element.remove(); setCustomerSession(null); vi.unstubAllGlobals(); });
function setup(identity: CustomerAccount | null = account, enabled = true) {
  request.mockImplementation(async (path: string) => {
    if (path.endsWith('/config')) return Response.json({ enabled, bookingEnabled: false, turnstileSiteKey: '' });
    if (path.endsWith('/me')) return identity ? Response.json({ account: identity }) : Response.json({ error: 'Sign in' }, { status: 401 });
    if (path.endsWith('/me/sessions')) return Response.json({ sessions: [] });
    if (path.endsWith('/auth/logout')) return Response.json({ message: 'Signed out' });
    throw new Error(`Unexpected request: ${path}`);
  });
}
const render = async () => { await act(async () => root.render(createElement(LiveAccounts))); };
it('keeps operational deep links and workspaces out of the public owner account', async () => {
  window.history.replaceState({}, '', '/account?view=counter'); setup({ ...account, role: 'owner' }); await render();
  expect([...element.querySelectorAll('nav a')].map(node => node.textContent)).toEqual(['Overview', 'Profile', 'Security']);
  expect(element.textContent).toContain('Those bookings do not appear in this account yet');
  expect(element.querySelector('a[href*="booksy.com"]')).not.toBeNull();
  expect(element.querySelector('a[href*="glossgenius.com"]')).not.toBeNull();
  expect(request.mock.calls.map(([path]) => path)).toEqual(['/api/v1/config', '/api/v1/me']);
});
it('supports profile navigation and browser back without loading operational data', async () => {
  setup(); await render();
  await act(async () => element.querySelector<HTMLAnchorElement>('nav a[href$="profile"]')!.click());
  expect(element.textContent).toContain('Your profile'); expect(window.location.search).toBe('?view=profile');
  window.history.replaceState({}, '', '/account'); await act(async () => window.dispatchEvent(new PopStateEvent('popstate')));
  expect(element.textContent).toContain('Your account is ready');
});
it('offers registration and recovery when signed out and clears the session after logout', async () => {
  setup(); await render();
  await act(async () => [...element.querySelectorAll('button')].find(node => node.textContent === 'Sign out')!.click());
  expect(element.textContent).toContain('You have been signed out.');
  expect(element.textContent).toContain('Create account'); expect(element.textContent).toContain('Forgot password?');
  expect(element.textContent).not.toContain('Your account is ready');
});
it('fails closed when disabled or when the account service cannot be reached', async () => {
  setup(account, false); await render(); expect(element.textContent).toContain('Account access is coming soon');
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount()); root = createRoot(element); request.mockRejectedValue(new Error('Offline')); await render();
  expect(element.textContent).toContain('We couldn’t open your account'); expect(element.querySelector('[role="alert"]')).not.toBeNull();
  expect(element.textContent).not.toContain('Your account is ready');
});
