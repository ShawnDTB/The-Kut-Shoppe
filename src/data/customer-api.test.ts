import { afterEach, expect, it, vi } from 'vitest';
import { getCustomerSession, loadCustomerSession, setCustomerSession } from './customer-api';
import type { CustomerAccount } from '../shared/customer';
const alice: CustomerAccount = { id: 'alice', email: 'alice@example.test', role: 'customer', emailVerified: true, profile: { name: 'Alice', phone: '', address: { line1: '', line2: '', city: '', state: '', postalCode: '' } } };
afterEach(() => { setCustomerSession(null); vi.unstubAllGlobals(); });
it('shares simultaneous session requests without allowing late responses to restore a signed-out account', async () => {
  let resolve!: (value: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>(done => { resolve = done; })); vi.stubGlobal('fetch', fetcher);
  setCustomerSession(alice);
  const first = loadCustomerSession(); const second = loadCustomerSession();
  expect(fetcher).toHaveBeenCalledTimes(1);
  setCustomerSession(null); resolve(Response.json({ account: alice }));
  await Promise.all([first, second]); expect(getCustomerSession()).toBeNull();
});
it('preserves the session on a transient network error and ignores stale unauthorized responses after a new sign-in', async () => {
  setCustomerSession(alice); vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  await expect(loadCustomerSession()).rejects.toThrow('Check your connection'); expect(getCustomerSession()).toEqual(alice);
  let resolve!: (value: Response) => void; vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(done => { resolve = done; })));
  const pending = loadCustomerSession(); setCustomerSession({ ...alice, id: 'bob' });
  resolve(Response.json({ error: 'Expired' }, { status: 401 })); await pending; expect(getCustomerSession()?.id).toBe('bob');
});
