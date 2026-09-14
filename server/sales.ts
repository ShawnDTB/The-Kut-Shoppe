import { randomUUID, timingSafeEqual } from 'node:crypto';
import { ApiError, type Env } from './types';
import { allowFields, secretHash, stringField, verifyPassword } from './security';
import { requireFrontDesk } from './front-desk';
import { staffMfaGate } from './staff-mfa';
import { cents, saleAmounts } from './sale-amounts';
import type { EstimateInput, EstimatePage, EstimatePreview, SaleEstimate, SaleLine, SaleSource, SaleSourcePage } from '../src/shared/sales';

const gate = `EXISTS (SELECT 1 FROM users u JOIN sessions se ON se.user_id=u.id WHERE u.id=? AND se.token_hash=?
  AND u.status='active' AND u.email_verified_at IS NOT NULL AND u.role IN ('owner','manager','admin') AND ${staffMfaGate()})`;
const fields = ['appointmentId','orderId','discountCents','discountReason','taxCents','shippingCents','chargeNote'];
const identifier = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new ApiError(400, 'Choose a valid appointment or order.');
  return value;
};
function inputOf(body: Record<string, unknown>): EstimateInput {
  const input = { appointmentId: identifier(body.appointmentId), orderId: identifier(body.orderId), discountCents: cents(body.discountCents),
    discountReason: stringField(body, 'discountReason', 200), taxCents: body.taxCents === null ? null : cents(body.taxCents),
    shippingCents: body.shippingCents === null ? null : cents(body.shippingCents), chargeNote: stringField(body, 'chargeNote', 300) };
  if (!input.appointmentId && !input.orderId) throw new ApiError(400, 'Choose an appointment, an order, or both.');
  if (input.discountCents && !input.discountReason) throw new ApiError(400, 'Explain the discount for the customer.');
  if ((input.taxCents !== null || input.shippingCents !== null) && !input.chargeNote) throw new ApiError(400, 'Explain how the entered tax or shipping amount was determined. Leave unknown charges blank.');
  return input;
}
type Appointment = { id: string; customerId: string | null; customerName: string; serviceName: string; professionalName: string | null; professionalId: string | null;
  priceCents: number; startsAt: string | null; timeZone: string; status: string; source: string };
type Order = { id: string; customerId: string | null; customerName: string; fulfillment: string; subtotal: number; status: string };
type OrderLine = { id: string; product: string; variant: string; quantity: number; price: number };
type Rows<T> = { results: T[] };
async function prepare(env: Env, actor: string, session: string, input: EstimateInput) {
  if (input.orderId && env.COMMERCE_ENABLED !== 'true') throw new ApiError(503, 'Store access is not open.');
  const batch = await env.DB.batch<Rows<Record<string, unknown>>>([
    env.DB.prepare('SELECT version FROM booking_revision WHERE id=1'),
    env.DB.prepare('SELECT value FROM commerce_revision WHERE id=1'),
    env.DB.prepare(`SELECT a.id,a.customer_user_id AS customerId,COALESCE(u.display_name,a.guest_name,'Guest') AS customerName,
      s.name AS serviceName,sp.professional_name AS professionalName,a.assigned_staff_id AS professionalId,a.price_cents AS priceCents,a.starts_at AS startsAt,l.timezone AS timeZone,a.status,a.source
      FROM appointments a JOIN services s ON s.id=a.service_id JOIN locations l ON l.id=a.location_id
      LEFT JOIN users u ON u.id=a.customer_user_id LEFT JOIN staff_profiles sp ON sp.id=a.assigned_staff_id WHERE a.id=? AND ${gate}`)
      .bind(input.appointmentId, actor, session),
    env.DB.prepare(`SELECT o.id,o.customer_user_id AS customerId,COALESCE(u.display_name,o.guest_name,'Guest') AS customerName,
      o.fulfillment_type AS fulfillment,o.subtotal_cents AS subtotal,o.status FROM orders o LEFT JOIN users u ON u.id=o.customer_user_id WHERE o.id=? AND ${gate}`)
      .bind(input.orderId, actor, session),
    env.DB.prepare(`SELECT i.id,i.product_name AS product,i.variant_name AS variant,i.quantity,i.unit_price_cents AS price FROM order_items i
      WHERE i.order_id=? AND ${gate} ORDER BY i.id LIMIT 101`).bind(input.orderId, actor, session),
  ]);
  const appointment = batch[2]!.results[0] as Appointment | undefined;
  const order = batch[3]!.results[0] as Order | undefined;
  const items = batch[4]!.results as OrderLine[];
  if (input.appointmentId && !appointment || input.orderId && !order) throw new ApiError(404, 'The selected record is unavailable.');
  if (appointment && (!['website','walk_in','staff'].includes(appointment.source) || !['confirmed','checked_in','in_service','completed'].includes(appointment.status))) throw new ApiError(409, 'Use a confirmed or completed native appointment. Provider bookings remain with their original provider.');
  if (order && !['submitted','payment_required','accepted','preparing','ready_for_pickup','shipped','completed'].includes(order.status)) throw new ApiError(409, 'This order cannot be used for an estimate.');
  if (appointment && order && (!appointment.customerId || appointment.customerId !== order.customerId)) throw new ApiError(409, 'Combined estimates require an appointment and order belonging to the same customer account. Prepare guest records separately.');
  if (order && (!items.length || items.length > 100 || items.reduce((sum, line) => sum + line.quantity * line.price, 0) !== order.subtotal)) throw new ApiError(409, 'The complete order item list must reconcile with its recorded subtotal. Contact the shop to correct the source record.');
  if (order?.fulfillment !== 'shipping' && input.shippingCents !== null && input.shippingCents !== 0) throw new ApiError(400, 'Shipping charges apply only to shipping orders.');
  const lines: Omit<SaleLine, 'grossCents' | 'discountCents' | 'netCents'>[] = [
    ...(appointment ? [{ id: `appointment:${appointment.id}`, kind: 'service' as const, description: appointment.serviceName,
      quantity: 1, unitPriceCents: appointment.priceCents, professionalName: appointment.professionalName, professionalId: appointment.professionalId }] : []),
    ...items.map(line => ({ id: `order-item:${line.id}`, kind: 'merchandise' as const, description: `${line.product} · ${line.variant}`,
      quantity: line.quantity, unitPriceCents: line.price, professionalName: null, professionalId: null })),
  ];
  const estimate = { schemaVersion: 1 as const, currency: 'USD' as const, appointmentId: input.appointmentId, orderId: input.orderId,
    customerName: appointment?.customerName ?? order!.customerName, appointmentTime: appointment?.startsAt ?? null,
    timeZone: appointment?.timeZone ?? 'America/New_York', discountReason: input.discountReason, chargeNote: input.chargeNote,
    ...saleAmounts(lines, input.discountCents, input.taxCents, order?.fulfillment === 'shipping' ? input.shippingCents : 0) };
  return { estimate, customerId: appointment?.customerId ?? order?.customerId ?? null,
    bookingRevision: Number(batch[0]!.results[0]!.version), commerceRevision: Number(batch[1]!.results[0]!.value) };
}
function signed(env: Env, scope: string, value: unknown) {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${payload}.${secretHash(env, `sales-v1:${scope}:${payload}`)}`;
}
function decoded<T>(env: Env, scope: string, token: string): T {
  try {
    if (token.length > 2048 || !/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(token)) throw Error();
    const [payload, signature] = token.split('.') as [string, string];
    if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(secretHash(env, `sales-v1:${scope}:${payload}`), 'hex'))) throw Error();
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T;
  } catch { throw new ApiError(400, 'This review or history link is invalid. Refresh and try again.'); }
}
type Review = { digest: string; expiresAt: string; createdAt: string; nonce: string };
export async function previewEstimate(env: Env, actor: string, session: string, body: Record<string, unknown>): Promise<EstimatePreview> {
  await requireFrontDesk(env, actor, session); allowFields(body, fields);
  const input = inputOf(body); const data = await prepare(env, actor, session, input);
  const createdAt = new Date().toISOString(); const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const review: Review = { digest: secretHash(env, JSON.stringify({ input, data })), createdAt, expiresAt, nonce: randomUUID() };
  return { estimate: { ...data.estimate, id: review.nonce, createdAt }, expiresAt, token: signed(env, `review:${actor}:${session}`, review) };
}
export async function saveEstimate(env: Env, actor: string, session: string, body: Record<string, unknown>) {
  await requireFrontDesk(env, actor, session); allowFields(body, [...fields, 'token','requestKey','currentPassword']);
  const input = inputOf(body); const token = stringField(body, 'token', 2048, 1); const key = stringField(body, 'requestKey', 36, 36);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(key)) throw new ApiError(400, 'Review the estimate before saving.');
  if (typeof body.currentPassword !== 'string' || !body.currentPassword.length || body.currentPassword.length > 128) throw new ApiError(400, 'Enter your current password.');
  const credential = await env.DB.prepare('SELECT password_hash AS hash FROM account_credentials WHERE user_id=?').bind(actor).first<{ hash: string }>();
  if (!credential || !await verifyPassword(body.currentPassword, credential.hash)) throw new ApiError(400, 'The current password is incorrect.');
  const fingerprint = secretHash(env, JSON.stringify({ input, token })); const reviewKey = secretHash(env, token);
  const replay = async () => {
    const row = await env.DB.prepare(`SELECT id,request_fingerprint AS fingerprint FROM sale_estimates WHERE actor_user_id=? AND (request_key=? OR review_key=?) AND ${gate} ORDER BY CASE WHEN request_key=? THEN 0 ELSE 1 END LIMIT 1`)
      .bind(actor, key, reviewKey, actor, session, key).first<{ id: string; fingerprint: string }>();
    if (row && row.fingerprint !== fingerprint) throw new ApiError(409, 'This request was already used for another estimate. Review again.');
    return row ? { estimateId: row.id } : null;
  };
  const old = await replay(); if (old) return old;
  const review = decoded<Review>(env, `review:${actor}:${session}`, token);
  if (!Number.isFinite(Date.parse(review.expiresAt)) || Date.parse(review.expiresAt) <= Date.now()) throw new ApiError(409, 'This review expired. Review current amounts again.');
  const data = await prepare(env, actor, session, input);
  const concurrent = await replay(); if (concurrent) return concurrent;
  if (review.digest !== secretHash(env, JSON.stringify({ input, data }))) throw new ApiError(409, 'The selected records or amounts changed. Review the estimate again.');
  const now = new Date().toISOString(); const id = randomUUID();
  const snapshot: SaleEstimate = { ...data.estimate, id, createdAt: now };
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO sale_estimates(id,actor_user_id,customer_user_id,appointment_id,order_id,request_key,request_fingerprint,review_key,snapshot_json,created_at)
      SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${gate} AND EXISTS(SELECT 1 FROM account_credentials WHERE user_id=? AND password_hash=?)
      AND (SELECT version FROM booking_revision WHERE id=1)=? AND (SELECT value FROM commerce_revision WHERE id=1)=?
      AND julianday(?)>julianday('now') ON CONFLICT DO NOTHING`)
      .bind(id, actor, data.customerId, input.appointmentId, input.orderId, key, fingerprint, reviewKey, JSON.stringify(snapshot), now,
        actor, session, actor, credential.hash, data.bookingRevision, data.commerceRevision, review.expiresAt),
    env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,action,entity_type,entity_id,created_at)
      SELECT ?,?,'sale_estimate_issued','sale_estimate',?,? WHERE EXISTS(SELECT 1 FROM sale_estimates WHERE id=?)`).bind(randomUUID(), actor, id, now, id),
  ]);
  const result = await replay(); if (!result) throw new ApiError(409, 'Your access or the source records changed. Refresh before saving.');
  return result;
}
type Cursor = { at: string; id: string };
function pageCursor(env: Env, scope: string, cursor: string | null) {
  if (cursor === null) return null;
  const value = decoded<Cursor>(env, scope, cursor);
  if (!value || typeof value.at !== 'string' || value.at.length > 64 || typeof value.id !== 'string' || value.id.length > 128 || !value.id) throw new ApiError(400, 'Refresh this history page.');
  return value;
}
export async function estimates(env: Env, actor: string, session: string, admin: boolean, cursorValue: string | null): Promise<EstimatePage> {
  if (admin) await requireFrontDesk(env, actor, session);
  const scope = `history:${actor}:${admin}`; const cursor = pageCursor(env, scope, cursorValue);
  const { results } = await env.DB.prepare(`SELECT id,created_at AS at,snapshot_json AS snapshot FROM sale_estimates
    WHERE ${admin ? gate : 'customer_user_id=?'} ${cursor ? 'AND (created_at,id)<(?,?)' : ''} ORDER BY created_at DESC,id DESC LIMIT 26`)
    .bind(...(admin ? [actor, session] : [actor]), ...(cursor ? [cursor.at, cursor.id] : [])).all<{ id: string; at: string; snapshot: string }>();
  const items = results.slice(0, 25); const last = items.at(-1);
  return { items: items.map(row => JSON.parse(row.snapshot) as SaleEstimate), nextCursor: results.length > 25 && last ? signed(env, scope, { at: last.at, id: last.id }) : null };
}
export async function estimateDetail(env: Env, actor: string, session: string, admin: boolean, id: string): Promise<SaleEstimate> {
  if (admin) await requireFrontDesk(env, actor, session);
  const row = await env.DB.prepare(`SELECT snapshot_json AS snapshot FROM sale_estimates WHERE id=? AND ${admin ? gate : 'customer_user_id=?'}`)
    .bind(id, ...(admin ? [actor, session] : [actor])).first<{ snapshot: string }>();
  if (!row) throw new ApiError(404, 'Estimate not found.');
  return JSON.parse(row.snapshot) as SaleEstimate;
}
export async function saleSources(env: Env, actor: string, session: string, kind: string, cursorValue: string | null): Promise<SaleSourcePage> {
  await requireFrontDesk(env, actor, session);
  if (!['appointment','order'].includes(kind)) throw new ApiError(400, 'Choose appointments or orders.');
  if (kind === 'order' && env.COMMERCE_ENABLED !== 'true') return { items: [], nextCursor: null };
  const scope = `sources:${actor}:${kind}`; const cursor = pageCursor(env, scope, cursorValue);
  const appointment = kind === 'appointment';
  const { results } = await env.DB.prepare(`SELECT a.id,a.created_at AS at,a.status,COALESCE(u.display_name,a.guest_name,'Guest') AS customerName,
    ${appointment ? "s.name || ' · ' || COALESCE(a.starts_at,'Time not set')" : "'Order ' || a.id || ' · ' || a.fulfillment_type"} AS description
    FROM ${appointment ? 'appointments a JOIN services s ON s.id=a.service_id' : 'orders a'} LEFT JOIN users u ON u.id=a.customer_user_id
    WHERE ${gate} AND ${appointment ? "a.source IN ('website','walk_in','staff') AND a.status IN ('confirmed','checked_in','in_service','completed')" : "a.status IN ('submitted','payment_required','accepted','preparing','ready_for_pickup','shipped','completed')"}
    ${cursor ? 'AND (a.created_at,a.id)<(?,?)' : ''} ORDER BY a.created_at DESC,a.id DESC LIMIT 26`)
    .bind(actor, session, ...(cursor ? [cursor.at, cursor.id] : [])).all<Omit<SaleSource, 'kind'> & Cursor>();
  const items = results.slice(0, 25); const last = items.at(-1);
  return { items: items.map(({ id, customerName, description, status }) => ({ id, kind: kind as SaleSource['kind'], customerName, description, status })),
    nextCursor: results.length > 25 && last ? signed(env, scope, { at: last.at, id: last.id }) : null };
}
