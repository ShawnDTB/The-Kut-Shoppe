import { randomUUID } from 'node:crypto';
import { ApiError, type Env } from './types';
import { allowFields, secretHash, stringField, verifyPassword } from './security';
import { requireStaffMfa, staffMfaGate } from './staff-mfa';
import { bookingSelection, walkInAvailability } from './booking';
import { MINUTE } from './booking-time';
import type { WalkInVisit } from '../src/shared/front-desk';

const gate = `EXISTS (SELECT 1 FROM users u JOIN sessions se ON se.user_id=u.id WHERE u.id=? AND se.token_hash=?
  AND u.status='active' AND u.email_verified_at IS NOT NULL AND u.role IN ('owner','manager','admin') AND ${staffMfaGate()})`;
export async function requireFrontDesk(env: Env, actor: string, session: string) {
  if (env.STAFF_OPERATIONS_ENABLED !== 'true') throw new ApiError(503, 'Front desk access is not open.');
  await requireStaffMfa(env, actor, session);
  if (!await env.DB.prepare(`SELECT id FROM users WHERE id=? AND ${gate}`).bind(actor, actor, session).first()) throw new ApiError(403, 'Owner or manager access is required for the front desk.');
}
const fields = `a.id,a.guest_name AS name,s.name AS serviceName,sp.professional_name AS professionalName,a.status,
  a.starts_at AS startsAt,a.ends_at AS endsAt,l.timezone AS timeZone,a.price_cents AS priceCents,a.updated_at AS updatedAt`;
export async function walkIns(env: Env, actor: string, session: string) {
  await requireFrontDesk(env, actor, session);
  const { results } = await env.DB.prepare(`SELECT ${fields} FROM appointments a JOIN services s ON s.id=a.service_id
    JOIN staff_profiles sp ON sp.id=a.assigned_staff_id JOIN locations l ON l.id=a.location_id
    WHERE a.source='walk_in' AND ${gate}
    AND (a.status IN ('confirmed','checked_in','in_service') OR julianday(a.updated_at)>julianday('now','-1 day'))
    ORDER BY CASE WHEN a.status IN ('confirmed','checked_in','in_service') THEN 0 ELSE 1 END,a.starts_at,a.id LIMIT 101`).bind(actor, session).all<WalkInVisit>();
  return { items: results.slice(0, 100), more: results.length > 100 };
}
async function passwordGate(env: Env, actor: string, body: Record<string, unknown>) {
  if (typeof body.currentPassword !== 'string' || !body.currentPassword.length || body.currentPassword.length > 128) throw new ApiError(400, 'Enter your current password.');
  const password = body.currentPassword;
  const credential = await env.DB.prepare('SELECT password_hash AS hash FROM account_credentials WHERE user_id=?').bind(actor).first<{ hash: string }>();
  if (!credential || !await verifyPassword(password, credential.hash)) throw new ApiError(400, 'The current password is incorrect.');
  return credential.hash;
}
function keyField(body: Record<string, unknown>) {
  const key = stringField(body, 'requestKey', 36, 36);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(key)) throw new ApiError(400, 'Review this front desk action again.');
  return key;
}
async function replay(env: Env, actor: string, key: string, fingerprint: string) {
  const prior = await env.DB.prepare('SELECT appointment_id AS appointmentId,fingerprint FROM walk_in_operations WHERE actor_user_id=? AND request_key=?').bind(actor, key).first<{ appointmentId: string; fingerprint: string }>();
  if (prior && prior.fingerprint !== fingerprint) throw new ApiError(409, 'This request key was already used for another action. Refresh first.');
  return prior;
}
const saved = 'EXISTS (SELECT 1 FROM walk_in_operations WHERE id=?)';
export async function createWalkIn(env: Env, actor: string, session: string, body: Record<string, unknown>) {
  await requireFrontDesk(env, actor, session);
  allowFields(body, ['staffId','serviceId','locationId','date','startsAt','quote','name','phone','requestKey','currentPassword']);
  const selection = bookingSelection(body); const startsAt = stringField(body, 'startsAt', 24, 24);
  const quote = stringField(body, 'quote', 128, 1); const name = stringField(body, 'name', 100, 1); const phone = stringField(body, 'phone', 30);
  if (phone && !/^[+\d ()-]{7,30}$/.test(phone)) throw new ApiError(400, 'Check the phone number or leave it blank.');
  const key = keyField(body); const hash = await passwordGate(env, actor, body);
  const fingerprint = secretHash(env, JSON.stringify({ selection, startsAt, quote, name, phone }));
  const prior = await replay(env, actor, key, fingerprint); if (prior) return { appointmentId: prior.appointmentId };
  const available = await walkInAvailability(env, selection);
  const concurrent = await replay(env, actor, key, fingerprint); if (concurrent) return { appointmentId: concurrent.appointmentId };
  const slot = available.slots.find(value => value.startsAt === startsAt);
  if (!slot || available.quote !== quote) throw new ApiError(409, 'This opening or service changed. Refresh available times.');
  const receipt = randomUUID(); const id = randomUUID(); const now = new Date().toISOString();
  const reserved = new Date(Date.parse(slot.endsAt) + available.bufferMinutes * MINUTE).toISOString();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO walk_in_operations(id,actor_user_id,request_key,fingerprint,appointment_id,action,created_at)
      SELECT ?,?,?,?,?,'create',? WHERE (SELECT version FROM booking_revision WHERE id=1)=? AND julianday(?)>julianday('now') AND ${gate}
      AND EXISTS (SELECT 1 FROM account_credentials WHERE user_id=? AND password_hash=?) ON CONFLICT(actor_user_id,request_key) DO NOTHING`)
      .bind(receipt, actor, key, fingerprint, id, now, available.revision, startsAt, actor, session, actor, hash),
    env.DB.prepare(`INSERT INTO appointments(id,guest_name,guest_phone,assigned_staff_id,requested_staff_id,service_id,location_id,starts_at,ends_at,reserved_until,price_cents,status,source,created_at,updated_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,'confirmed','walk_in',?,? WHERE ${saved}`)
      .bind(id, name, phone || null, selection.staffId, selection.staffId, selection.serviceId, selection.locationId, slot.startsAt, slot.endsAt, reserved, available.option.priceCents, now, now, receipt),
    env.DB.prepare(`INSERT INTO appointment_events(id,appointment_id,actor_user_id,event_type,created_at) SELECT ?,?,?,'front_desk_walk_in_created',? WHERE ${saved}`).bind(receipt, id, actor, now, receipt),
    env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,action,entity_type,entity_id,created_at) SELECT ?,?,'front_desk_walk_in_created','appointment',?,? WHERE ${saved}`).bind(randomUUID(), actor, id, now, receipt),
  ]);
  const result = await replay(env, actor, key, fingerprint);
  if (!result) throw new ApiError(409, 'The opening or your access changed. Refresh before trying again.');
  return { appointmentId: result.appointmentId };
}
export async function progressWalkIn(env: Env, actor: string, session: string, id: string, body: Record<string, unknown>) {
  await requireFrontDesk(env, actor, session); allowFields(body, ['action','updatedAt','requestKey','currentPassword']);
  const action = stringField(body, 'action', 20, 1); const updatedAt = stringField(body, 'updatedAt', 40, 1); const key = keyField(body);
  const hash = await passwordGate(env, actor, body); const fingerprint = secretHash(env, JSON.stringify({ id, action, updatedAt }));
  if (await replay(env, actor, key, fingerprint)) return { message: 'This visit update is already saved.' };
  const row = await env.DB.prepare("SELECT status FROM appointments WHERE id=? AND source='walk_in'").bind(id).first<{ status: string }>();
  if (!row) throw new ApiError(404, 'Walk-in visit not found.');
  const next: Record<string, string[]> = { confirmed: ['checked_in','cancelled','no_show'], checked_in: ['in_service','cancelled'], in_service: ['completed'] };
  if (!next[row.status]?.includes(action)) throw new ApiError(409, 'This visit changed or the action is unavailable. Refresh its status.');
  const receipt = randomUUID(); const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO walk_in_operations(id,actor_user_id,request_key,fingerprint,appointment_id,action,created_at)
      SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM appointments WHERE id=? AND source='walk_in' AND status=? AND updated_at=?
        AND (?!='in_service' OR (julianday(starts_at)<=julianday('now') AND julianday(ends_at)>julianday('now'))))
      AND ${gate} AND EXISTS (SELECT 1 FROM account_credentials WHERE user_id=? AND password_hash=?) ON CONFLICT(actor_user_id,request_key) DO NOTHING`)
      .bind(receipt, actor, key, fingerprint, id, action, now, id, row.status, updatedAt, action, actor, session, actor, hash),
    env.DB.prepare(`UPDATE appointments SET status=?,updated_at=?,cancelled_at=CASE WHEN ?='cancelled' THEN ? ELSE cancelled_at END WHERE id=? AND ${saved}`).bind(action, now, action, now, id, receipt),
    env.DB.prepare(`INSERT INTO appointment_events(id,appointment_id,actor_user_id,event_type,created_at) SELECT ?,?,?,?,? WHERE ${saved}`).bind(receipt, id, actor, `front_desk_${action}`, now, receipt),
    env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,action,entity_type,entity_id,created_at) SELECT ?,?,?,'appointment',?,? WHERE ${saved}`).bind(randomUUID(), actor, `front_desk_${action}`, id, now, receipt),
  ]);
  if (!await replay(env, actor, key, fingerprint)) throw new ApiError(409, 'The visit or your account changed. Refresh before trying again.');
  return { message: 'Visit updated. Service completion does not record a payment.' };
}
