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
async function accountResponse(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, { method, credentials: 'same-origin', cache: 'no-store',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Kut-Request': '1' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  } catch { throw new AccountApiError(0, 'We could not reach your account. Check your connection and try again.'); }
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string };
    if (response.status === 401 && !path.startsWith('/auth/')) setCustomerSession(null);
    throw new AccountApiError(response.status, data.error ?? 'Account access is temporarily unavailable. Please try again later.');
  }
  return response;
}
export async function accountApi<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const response = await accountResponse(path, body, method);
  try { return await response.json() as T; }
  catch { throw new AccountApiError(0, 'We received an incomplete response. Please try again.'); }
}
export async function downloadAppointmentCalendar(id: string) {
  const response = await accountResponse(`/me/appointments/${encodeURIComponent(id)}/calendar`);
  if (!response.headers.get('Content-Type')?.startsWith('text/calendar')) throw new AccountApiError(0, 'We could not download this appointment. Please try again.');
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = objectUrl; link.download = 'kut-shoppe-appointment.ics';
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
export async function downloadAccountDocument(kind: 'appointments' | 'orders', id: string) {
  const response = await accountResponse(`/me/${kind}/${encodeURIComponent(id)}/document`);
  if (!response.headers.get('Content-Type')?.startsWith('text/html')) throw new AccountApiError(0, 'The document could not be downloaded. Please try again.');
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement('a'); link.href = objectUrl;
  link.download = `kut-shoppe-${kind === 'appointments' ? 'appointment' : 'order'}.html`;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
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
