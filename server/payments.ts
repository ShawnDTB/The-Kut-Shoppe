import { createHash, randomUUID } from 'node:crypto';
import { ApiError, type Env } from './types';
import { allowFields, stringField } from './security';
import { cashGate, authorizeCash } from './cash-access';
import { requireFrontDesk } from './front-desk';
import { sandboxConfiguration, stripeRequest, verifiedStripeEvent } from './stripe-sandbox';

type Attempt = { id: string; sale_id: string; merchant_id: string; amount_cents: number; currency: string;
  state: 'pending' | 'paid' | 'expired' | 'review'; request_body: string; create_before: number;
  provider_session_id: string | null; checkout_url: string | null };
const identifier = (value: unknown, prefix: string) => typeof value === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9]+$`).test(value);
const accountGate = `EXISTS(SELECT 1 FROM users u JOIN sessions se ON se.user_id=u.id
 WHERE u.id=? AND se.token_hash=? AND u.status='active' AND u.email_verified_at IS NOT NULL
 AND se.revoked_at IS NULL AND julianday(se.expires_at)>julianday('now'))`;

export async function paymentStatus(env: Env, actor: string, session: string, id: string) {
  const row = await env.DB.prepare(`SELECT p.id,p.sale_id AS saleId,p.amount_cents AS amountCents,p.state,p.created_at AS createdAt
    FROM payment_attempts p JOIN finalized_sales s ON s.id=p.sale_id WHERE p.id=? AND
    ((s.customer_user_id=? AND ${accountGate}) OR (?='true' AND ${cashGate}))`)
    .bind(id, actor, actor, session, env.STAFF_OPERATIONS_ENABLED ?? 'false', actor, session)
    .first<{ id: string; saleId: string; amountCents: number; state: Attempt['state']; createdAt: string }>();
  if (!row) throw new ApiError(404, 'Payment not found.');
  return { ...row, currency: 'USD', sandbox: true };
}

async function staffAttempt(env: Env, actor: string, session: string, id: string) {
  await requireFrontDesk(env, actor, session);
  const row = await env.DB.prepare(`SELECT p.* FROM payment_attempts p WHERE p.id=? AND ${cashGate}`)
    .bind(id, actor, session).first<Attempt>();
  if (!row) throw new ApiError(404, 'Payment not found.');
  if (row.merchant_id !== env.STRIPE_ACCOUNT_ID) throw new ApiError(409, 'Use the original merchant account to reconcile this payment.');
  return row;
}

export async function createCheckout(env: Env, actor: string, session: string, body: Record<string, unknown>) {
  sandboxConfiguration(env, true);
  allowFields(body, ['saleId', 'currentPassword']);
  const hash = await authorizeCash(env, actor, session, body);
  const saleId = stringField(body, 'saleId', 128, 1);
  const id = randomUUID(); const now = new Date();
  const sale = await env.DB.prepare(`SELECT total_cents AS total FROM finalized_sales WHERE id=? AND ${cashGate}`)
    .bind(saleId, actor, session).first<{ total: number }>();
  if (!sale) throw new ApiError(404, 'Sale not found.');
  if (!Number.isSafeInteger(sale.total) || sale.total < 50 || sale.total > 99_999_999) throw new ApiError(409, 'This sale amount is outside the supported card-payment range.');
  const payload = new URLSearchParams({ mode: 'payment', 'payment_method_types[0]': 'card',
    'line_items[0][price_data][currency]': 'usd', 'line_items[0][price_data][unit_amount]': String(sale.total),
    'line_items[0][price_data][product_data][name]': 'The Kut Shoppe — finalized bill', 'line_items[0][quantity]': '1',
    client_reference_id: id, 'metadata[attempt_id]': id, 'payment_intent_data[metadata][attempt_id]': id,
    success_url: `${env.APP_ORIGIN}/account?payment=${id}`, cancel_url: `${env.APP_ORIGIN}/account?payment=${id}`,
    expires_at: String(Math.floor(now.getTime() / 1000) + 3600),
  }).toString();
  // One identity per sale, independent of browser keys and cashier concurrency.
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO payment_attempts(id,sale_id,actor_user_id,merchant_id,currency,amount_cents,sandbox,request_body,create_before,state,created_at)
      SELECT ?,?,?,?,'usd',?,1,?,?,'pending',? WHERE ${cashGate}
      AND EXISTS(SELECT 1 FROM account_credentials WHERE user_id=? AND password_hash=?)
      AND NOT EXISTS(SELECT 1 FROM cash_sale_events WHERE sale_id=?) ON CONFLICT DO NOTHING`)
      .bind(id, saleId, actor, env.STRIPE_ACCOUNT_ID, sale.total, payload, Math.floor(now.getTime() / 1000) + 1500, now.toISOString(), actor, session, actor, hash, saleId),
    env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,action,entity_type,entity_id,created_at)
      SELECT ?,?,'sandbox_checkout_reserved','payment_attempt',?,? WHERE EXISTS(SELECT 1 FROM payment_attempts WHERE id=?)`)
      .bind(randomUUID(), actor, id, now.toISOString(), id),
  ]);
  const existing = await env.DB.prepare(`SELECT id FROM payment_attempts WHERE sale_id=? AND ${cashGate}`).bind(saleId, actor, session).first<{ id: string }>();
  if (!existing) throw new ApiError(409, 'This sale has a cash record or your access changed. Refresh before taking payment.');
  const attempt = await staffAttempt(env, actor, session, existing.id);
  if (attempt.state !== 'pending') return paymentStatus(env, actor, session, attempt.id);
  const merchant = await stripeRequest(env, 'account');
  if (merchant.id !== attempt.merchant_id) throw new ApiError(503, 'The configured payment account does not match this sale.');
  let checkout: Record<string, unknown>;
  if (attempt.provider_session_id) checkout = await stripeRequest(env, `checkout/sessions/${attempt.provider_session_id}`);
  else {
    // Stripe may prune idempotency keys after 24h. Never recreate an unknown
    // Session after our much shorter creation window; investigate instead.
    if (Math.floor(Date.now() / 1000) >= attempt.create_before) throw new ApiError(409, 'This payment needs reconciliation. Do not create another charge.');
    checkout = await stripeRequest(env, 'checkout/sessions', attempt.request_body, `kut-checkout-${attempt.id}`);
  }
  await applySession(env, attempt, checkout, `reconcile_${randomUUID()}`, 'session.retrieved', createHash('sha256').update(JSON.stringify(checkout)).digest('hex'));
  const latest = await staffAttempt(env, actor, session, attempt.id);
  const status = await paymentStatus(env, actor, session, attempt.id);
  return { ...status, checkoutUrl: latest.state === 'pending' ? latest.checkout_url : null };
}

function validSession(attempt: Attempt, value: Record<string, unknown>) {
  const metadata = value.metadata as Record<string, unknown> | undefined;
  return value.object === 'checkout.session' && value.livemode === false && value.mode === 'payment' &&
    identifier(value.id, 'cs_test') && (!attempt.provider_session_id || attempt.provider_session_id === value.id) &&
    value.client_reference_id === attempt.id && metadata?.attempt_id === attempt.id &&
    value.amount_total === attempt.amount_cents && value.currency === attempt.currency &&
    (value.status === 'open' || value.status === 'complete' || value.status === 'expired') &&
    (value.payment_status === 'paid' || value.payment_status === 'unpaid');
}
function safeCheckoutUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 4096) return null;
  try { const url = new URL(value); return url.origin === 'https://checkout.stripe.com' && !url.username && !url.password ? value : null; } catch { return null; }
}

async function applySession(env: Env, attempt: Attempt, value: Record<string, unknown>, eventId: string, eventType: string, digest: string) {
  const valid = validSession(attempt, value) &&
    (eventType === 'session.retrieved' || eventType === 'checkout.session.completed' && value.status === 'complete' ||
      eventType === 'checkout.session.expired' && value.status === 'expired');
  const paid = valid && value.status === 'complete' && value.payment_status === 'paid' && identifier(value.payment_intent, 'pi');
  const expired = valid && value.status === 'expired' && value.payment_status === 'unpaid';
  const open = valid && value.status === 'open' && value.payment_status === 'unpaid' && safeCheckoutUrl(value.url) !== null;
  const accepted = paid || expired || open;
  const now = new Date().toISOString();
  // Inbox and financial projection commit together. A retry resumes the same
  // transaction, and a different event for one payment cannot allocate twice.
  const eventGate = `EXISTS(SELECT 1 FROM payment_provider_events WHERE id=? AND payload_hash=? AND attempt_id=?)`;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO payment_provider_events(id,event_type,attempt_id,payload_hash,outcome,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT DO NOTHING`)
      .bind(eventId, eventType, attempt.id, digest, accepted ? 'applied' : 'review', now),
    env.DB.prepare(`UPDATE payment_attempts SET provider_session_id=COALESCE(provider_session_id,?),checkout_url=?
      WHERE id=? AND ?=1 AND ${eventGate} AND (provider_session_id IS NULL OR provider_session_id=?)`)
      .bind(valid ? value.id : null, open ? safeCheckoutUrl(value.url) : null, attempt.id, valid ? 1 : 0, eventId, digest, attempt.id, valid ? value.id : null),
    env.DB.prepare(`INSERT INTO payment_allocations(id,attempt_id,sale_id,provider_payment_id,amount_cents,currency,sandbox,created_at)
      SELECT ?,id,sale_id,?,amount_cents,currency,1,? FROM payment_attempts WHERE id=? AND ?=1 AND ${eventGate}
      AND provider_session_id=? ON CONFLICT DO NOTHING`)
      .bind(randomUUID(), paid ? value.payment_intent : '', now, attempt.id, paid ? 1 : 0, eventId, digest, attempt.id, valid ? value.id : null),
    env.DB.prepare(`UPDATE payment_attempts SET state=CASE
      WHEN ?=0 THEN 'review'
      WHEN ?=1 THEN CASE WHEN state IN ('expired','review') OR EXISTS(SELECT 1 FROM cash_sale_events WHERE sale_id=payment_attempts.sale_id)
        OR NOT EXISTS(SELECT 1 FROM payment_allocations WHERE attempt_id=payment_attempts.id AND provider_payment_id=?) THEN 'review' ELSE 'paid' END
      WHEN state='paid' THEN 'paid'
      WHEN ?=1 AND state='pending' THEN 'expired' ELSE state END
      WHERE id=? AND ${eventGate}`)
      .bind(accepted ? 1 : 0, paid ? 1 : 0, paid ? value.payment_intent : '', expired ? 1 : 0, attempt.id, eventId, digest, attempt.id),
  ]);
  const receipt = await env.DB.prepare('SELECT payload_hash AS hash FROM payment_provider_events WHERE id=?').bind(eventId).first<{ hash: string }>();
  if (receipt?.hash !== digest) throw new ApiError(400, 'Event identity does not match its original payload.');
}

export async function reconcilePayment(env: Env, actor: string, session: string, id: string, body: Record<string, unknown>) {
  allowFields(body, []); sandboxConfiguration(env);
  const attempt = await staffAttempt(env, actor, session, id);
  if (!attempt.provider_session_id) throw new ApiError(409, 'Retry the original sale checkout within its creation window, or inspect this attempt in Stripe.');
  const merchant = await stripeRequest(env, 'account');
  if (merchant.id !== attempt.merchant_id) throw new ApiError(503, 'The payment account does not match.');
  const value = await stripeRequest(env, `checkout/sessions/${attempt.provider_session_id}`);
  await applySession(env, attempt, value, `reconcile_${randomUUID()}`, 'session.retrieved', createHash('sha256').update(JSON.stringify(value)).digest('hex'));
  return paymentStatus(env, actor, session, id);
}

export async function receiveStripeEvent(request: Request, env: Env) {
  const { event, raw } = await verifiedStripeEvent(request, env);
  if (!identifier(event.id, 'evt') || typeof event.type !== 'string' || event.type.length > 100 || event.livemode !== false ||
      (event.account !== undefined && event.account !== env.STRIPE_ACCOUNT_ID)) throw new ApiError(400, 'Unsupported event.');
  const digest = createHash('sha256').update(raw).digest('hex');
  const existing = await env.DB.prepare('SELECT payload_hash AS hash FROM payment_provider_events WHERE id=?').bind(event.id).first<{ hash: string }>();
  if (existing) {
    if (existing.hash !== digest) throw new ApiError(400, 'Event identity does not match its original payload.');
    return { received: true };
  }
  const value = (event.data as { object?: Record<string, unknown> } | undefined)?.object;
  const reference = (value?.metadata as { attempt_id?: unknown } | undefined)?.attempt_id;
  const supported = ['checkout.session.completed', 'checkout.session.expired'].includes(event.type);
  const attempt = supported && typeof reference === 'string' && reference.length <= 128
    ? await env.DB.prepare('SELECT * FROM payment_attempts WHERE id=? AND merchant_id=?').bind(reference, env.STRIPE_ACCOUNT_ID).first<Attempt>() : null;
  if (attempt && value) await applySession(env, attempt, value, String(event.id), event.type, digest);
  else await env.DB.prepare(`INSERT INTO payment_provider_events(id,event_type,payload_hash,outcome,created_at) VALUES (?,?,?,'ignored',?) ON CONFLICT DO NOTHING`)
    .bind(event.id, event.type, digest, new Date().toISOString()).run();
  return { received: true };
}
