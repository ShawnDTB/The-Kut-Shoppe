import type { CustomerAccount } from '../shared/customer';

export class AccountApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
let account: CustomerAccount | null = null;
const listeners = new Set<() => void>();
export const getCustomerSession = () => account;
export const subscribeToCustomerSession = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export function setCustomerSession(next: CustomerAccount | null) {
  account = next;
  listeners.forEach((listener) => listener());
}
export async function accountApi<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, { method, credentials: 'same-origin', cache: 'no-store',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Kut-Request': '1' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  } catch { throw new AccountApiError(0, 'We could not reach your account. Check your connection and try again.'); }
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) setCustomerSession(null);
    throw new AccountApiError(response.status, data.error ?? 'Account access is temporarily unavailable. Please try again later.');
  }
  return data;
}
export async function loadCustomerSession() {
  try {
    const result = await accountApi<{ account: CustomerAccount }>('/me');
    setCustomerSession(result.account);
    return result.account;
  } catch (error) {
    setCustomerSession(null);
    if (error instanceof AccountApiError && error.status === 401) return null;
    throw error;
  }
}
