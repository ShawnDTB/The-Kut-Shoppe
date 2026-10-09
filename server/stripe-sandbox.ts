import { createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError, type Env } from './types';

// Live keys are deliberately unsupported in this milestone.
export function sandboxConfiguration(env: Env, creating = false) {
  let origin: URL;
  try { origin = new URL(env.APP_ORIGIN); } catch { throw new ApiError(503, 'Payment testing is not configured.'); }
  if (origin.origin !== env.APP_ORIGIN || origin.username || origin.password ||
      (!['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) && origin.protocol !== 'https:') ||
      /(^|\.)thekutshoppe\.com$/i.test(origin.hostname) ||
      !/^sk_test_[A-Za-z0-9]+$/.test(env.STRIPE_SECRET_KEY ?? '') ||
      !/^acct_[A-Za-z0-9]+$/.test(env.STRIPE_ACCOUNT_ID ?? '') ||
      !/^whsec_[A-Za-z0-9]+$/.test(env.STRIPE_WEBHOOK_SECRET ?? '') ||
      (creating && env.PAYMENTS_SANDBOX_ENABLED !== 'true')) {
    throw new ApiError(503, 'Payment testing is not configured. Live payments remain closed.');
  }
}

export async function stripeRequest(env: Env, path: string, body?: string, key?: string): Promise<Record<string, unknown>> {
  sandboxConfiguration(env);
  try {
    const response = await fetch(`https://api.stripe.com/v1/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY!}`, 'Stripe-Version': '2025-02-24.acacia',
        ...(body === undefined ? {} : { 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': key! }) },
      // Workers supports manual/follow, not redirect:error. A 3xx fails the
      // response.ok check below; credentials are never forwarded elsewhere.
      body, signal: AbortSignal.timeout(10_000), redirect: 'manual',
    });
    if (!response.ok) throw new Error();
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    // Even a timeout may have created a Session. Keep the original identity.
    throw new ApiError(503, 'The payment provider could not confirm the result. Retry this same sale; do not start another payment.');
  }
}

export async function verifiedStripeEvent(request: Request, env: Env) {
  sandboxConfiguration(env);
  if (request.headers.get('Content-Type')?.split(';')[0]?.trim() !== 'application/json') throw new ApiError(415, 'Expected JSON.');
  if (Number(request.headers.get('Content-Length')) > 65_536) throw new ApiError(413, 'Event is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'Missing event.');
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    length += value.length;
    if (length > 65_536) { await reader.cancel(); throw new ApiError(413, 'Event is too large.'); }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks);
  const header = request.headers.get('Stripe-Signature') ?? '';
  if (header.length > 2048) throw new ApiError(400, 'Invalid signature.');
  const parts = header.split(',').map(part => part.trim());
  const times = parts.filter(part => /^t=\d+$/.test(part));
  const timestamp = times[0]?.slice(2) ?? '';
  const signatures = parts.filter(part => /^v1=[a-f0-9]{64}$/.test(part)).map(part => part.slice(3));
  const expected = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET!).update(`${timestamp}.`).update(raw).digest();
  if (times.length !== 1 || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
      !signatures.some(signature => timingSafeEqual(Buffer.from(signature, 'hex'), expected))) throw new ApiError(400, 'Invalid signature.');
  try {
    const event: unknown = JSON.parse(raw.toString('utf8'));
    if (!event || typeof event !== 'object' || Array.isArray(event)) throw Error();
    return { event: event as Record<string, unknown>, raw };
  } catch { throw new ApiError(400, 'Invalid event.'); }
}
