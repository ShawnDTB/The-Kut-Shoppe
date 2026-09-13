import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { ProfessionalAccess, StaffQueue, StaffRequest } from '../src/shared/staff';
import { ApiError, type Env } from './types';
import { secretHash, stringField, verifyPassword, allowFields } from './security';
import { confirmationSchedule } from './booking';
import { localDate } from './booking-time';
import { queueAppointmentNotifications } from './appointment-notifications';
import { requireStaffMfa, staffMfaGate } from './staff-mfa';

const professionalSelect = `SELECT sp.id,sp.professional_name AS name,sp.setup_status AS setup,u.role,ps.status AS submission
  FROM users u LEFT JOIN staff_profiles sp ON sp.user_id=u.id LEFT JOIN professional_submissions ps ON ps.user_id=u.id
  WHERE u.id=? AND u.status='active' AND u.email_verified_at IS NOT NULL`;
type Professional = { id: string | null; name: string | null; setup: string | null; role: string; submission: string | null };
const staffRoles = ['staff', 'manager', 'owner', 'admin'];
export async function professionalAccess(env: Env, userId: string): Promise<ProfessionalAccess> {
  const row = await env.DB.prepare(professionalSelect).bind(userId).first<Professional>();
  const state = !row || !staffRoles.includes(row.role) ? 'not_eligible' : row.setup === 'disabled' ? 'disabled' : row.setup === 'approved' ? 'approved' : row.submission === 'submitted' || row.setup === 'pending_review' ? 'pending_review' : 'setup_required';
  return { enabled: env.STAFF_OPERATIONS_ENABLED === 'true', setupEnabled: env.STAFF_SETUP_ENABLED === 'true', canReview: Boolean(row && ['owner', 'admin'].includes(row.role)), state, ...(row?.name ? { professionalName: row.name } : {}) };
}
export async function requireProfessional(env: Env, userId: string, sessionHash: string) {
  if (env.STAFF_OPERATIONS_ENABLED !== 'true') throw new ApiError(503, 'Professional request management is not open yet.');
  const row = await env.DB.prepare(professionalSelect).bind(userId).first<Professional>();
  if (!row?.id || row.setup !== 'approved' || !staffRoles.includes(row.role)) throw new ApiError(403, 'An approved professional account is required.');
  await requireStaffMfa(env, userId, sessionHash);
  return row.id;
}
const requestSelect = `SELECT a.id,u.display_name AS customerName,s.name AS serviceName,l.name AS locationName,l.timezone AS timeZone,
  a.starts_at AS startsAt,a.ends_at AS endsAt,a.created_at AS createdAt,a.updated_at AS updatedAt,a.status,a.price_cents AS priceCents,a.customer_note AS customerNote,a.cancellation_state AS cancellationState,
  EXISTS (SELECT 1 FROM appointment_changes c WHERE c.appointment_id=a.id AND c.status='pending' AND c.kind='customer_request') AS changePending
  FROM appointments a JOIN users u ON u.id=a.customer_user_id JOIN services s ON s.id=a.service_id JOIN locations l ON l.id=a.location_id
  WHERE a.source='website' AND COALESCE(a.assigned_staff_id,a.requested_staff_id)=?
    AND EXISTS (SELECT 1 FROM staff_profiles gate JOIN users actor ON actor.id=gate.user_id JOIN sessions se ON se.user_id=actor.id
      WHERE gate.id=COALESCE(a.assigned_staff_id,a.requested_staff_id) AND gate.setup_status='approved'
        AND actor.status='active' AND actor.email_verified_at IS NOT NULL AND actor.role IN ('staff','manager','owner','admin')
        AND se.token_hash=? AND se.revoked_at IS NULL AND julianday(se.expires_at)>julianday('now') AND ${staffMfaGate('se', 'actor')})`;
export async function staffRequest(env: Env, userId: string, sessionHash: string, id: string): Promise<StaffRequest> {
  const staffId = await requireProfessional(env, userId, sessionHash);
  const row = await env.DB.prepare(`${requestSelect} AND a.id=?`).bind(staffId, sessionHash, id).first<StaffRequest>();
  if (!row) throw new ApiError(404, 'This request is not available to your professional account.');
  return row;
}
export async function staffQueue(env: Env, userId: string, sessionHash: string, value: string | null): Promise<StaffQueue> {
  const staffId = await requireProfessional(env, userId, sessionHash);
  const sign = (payload: string) => secretHash(env, `staff-queue-v1:${userId}:${staffId}:${payload}`);
  let cursor: { at: string; id: string } | null = null;
  if (value !== null) {
    try {
      if (value.length > 1024 || !/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(value)) throw new Error();
      const [payload, signature] = value.split('.') as [string, string];
      if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(sign(payload), 'hex'))) throw new Error();
      cursor = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { at: string; id: string };
      if (!cursor || typeof cursor.at !== 'string' || cursor.at.length > 64 || typeof cursor.id !== 'string' || !cursor.id || cursor.id.length > 128) throw new Error();
    } catch { throw new ApiError(400, 'Refresh the request queue and try again.'); }
  }
  const { results } = await env.DB.prepare(`${requestSelect} AND (a.status='requested' OR (a.status='confirmed' AND a.cancellation_state='pending') OR EXISTS (SELECT 1 FROM appointment_changes c WHERE c.appointment_id=a.id AND c.status='pending' AND c.kind='customer_request')) ${cursor ? 'AND (a.created_at,a.id)>(?,?)' : ''}
    ORDER BY a.created_at,a.id LIMIT 26`).bind(staffId, sessionHash, ...(cursor ? [cursor.at, cursor.id] : [])).all<StaffRequest>();
  const items = results.slice(0, 25); const last = items.at(-1);
  const payload = last && results.length > 25 ? Buffer.from(JSON.stringify({ at: last.createdAt, id: last.id })).toString('base64url') : null;
  return { items, nextCursor: payload ? `${payload}.${sign(payload)}` : null };
}
export async function decideRequest(env: Env, userId: string, sessionHash: string, id: string, body: Record<string, unknown>) {
  allowFields(body, ['action', 'updatedAt', 'decisionKey', 'currentPassword']);
  const staffId = await requireProfessional(env, userId, sessionHash);
  const action = stringField(body, 'action', 7, 1);
  if (!['confirm', 'decline', 'cancel', 'keep'].includes(action)) throw new ApiError(400, 'Choose a supported appointment decision.');
  const cancellation = action === 'cancel' || action === 'keep';
  const updatedAt = stringField(body, 'updatedAt', 40, 1);
  const decisionKey = stringField(body, 'decisionKey', 36, 36);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(decisionKey)) throw new ApiError(400, 'Review the request and try again.');
  // Decisions require both the short-lived staff grant and a fresh password.
  if (typeof body.currentPassword !== 'string' || !body.currentPassword.length || body.currentPassword.length > 128) throw new ApiError(400, 'Enter your current password.');
  const password = body.currentPassword;
  const credential = await env.DB.prepare('SELECT password_hash AS hash FROM account_credentials WHERE user_id=?').bind(userId).first<{ hash: string }>();
  if (!credential || !await verifyPassword(password, credential.hash)) throw new ApiError(400, 'The current password is incorrect.');
  const row = await env.DB.prepare(`SELECT id,customer_user_id AS customerId,service_id AS serviceId,location_id AS locationId,starts_at AS startsAt,ends_at AS endsAt,
    status,cancellation_state AS cancellationState,reserved_until AS reservedUntil,staff_decision_key AS decisionKey,staff_decision_action AS decisionAction FROM appointments
    WHERE id=? AND source='website' AND COALESCE(assigned_staff_id,requested_staff_id)=? AND customer_user_id IS NOT NULL`).bind(id, staffId)
    .first<{ id: string; customerId: string; serviceId: string; locationId: string; startsAt: string | null; endsAt: string | null; reservedUntil: string | null; status: string; cancellationState: string | null; decisionKey: string | null; decisionAction: string | null }>();
  if (!row) throw new ApiError(404, 'This request is not available to your professional account.');
  if (row.decisionKey === decisionKey && row.decisionAction === action) return { request: await staffRequest(env, userId, sessionHash, id), message: 'This decision is already saved.' };
  if (row.decisionKey === decisionKey) throw new ApiError(409, 'This decision key was already used. Refresh before making a different decision.');
  if (cancellation ? row.status !== 'confirmed' || row.cancellationState !== 'pending' : row.status !== 'requested') throw new ApiError(409, 'This request has already changed. Refresh its details.');
  let revision: number | null = null; let reservedUntil: string | null = null;
  if (action === 'confirm') {
    if (!row.startsAt || !row.endsAt || !Number.isFinite(Date.parse(row.startsAt)) || !Number.isFinite(Date.parse(row.endsAt))) throw new ApiError(409, 'A valid scheduled start and end are required before confirming.');
    const location = await env.DB.prepare('SELECT timezone FROM locations WHERE id=?').bind(row.locationId).first<{ timezone: string }>();
    if (!location) throw new ApiError(409, 'This location is unavailable.');
    const check = await confirmationSchedule(env, row.customerId, { staffId, serviceId: row.serviceId, locationId: row.locationId, date: localDate(Date.parse(row.startsAt), location.timezone) }, id, row.startsAt, row.endsAt);
    revision = check.revision; reservedUntil = check.reservedUntil;
    if (row.reservedUntil && (!Number.isFinite(Date.parse(row.reservedUntil)) || Date.parse(row.reservedUntil) > Date.parse(reservedUntil))) throw new ApiError(409, 'The saved cleanup allowance changed. The schedule needs review before confirmation.');
  }
  const receipt = randomUUID(); const now = new Date().toISOString();
  const status = action === 'cancel' ? 'cancelled' : action === 'decline' ? 'declined' : 'confirmed';
  const eventType = cancellation ? `professional_cancellation_${action === 'cancel' ? 'approved' : 'declined'}` : `professional_${status}`;
  await env.DB.batch([
    env.DB.prepare(`UPDATE appointments SET status=?,assigned_staff_id=?,updated_at=?,staff_decision_key=?,staff_decision_receipt=?,staff_decision_action=?,
      reserved_until=CASE WHEN ? IS NULL THEN reserved_until ELSE MAX(COALESCE(reserved_until,''),?) END,
      cancellation_state=CASE WHEN ?='cancel' THEN 'approved' WHEN ?='keep' THEN 'declined' ELSE cancellation_state END,
      cancelled_at=CASE WHEN ?='cancel' THEN ? ELSE cancelled_at END,
      cancellation_reason=CASE WHEN ?='cancel' THEN 'Customer cancellation approved by professional' ELSE cancellation_reason END
      WHERE id=? AND source='website' AND status=? AND updated_at=? AND customer_user_id=?
        AND (?=0 OR cancellation_state='pending')
        AND COALESCE(assigned_staff_id,requested_staff_id)=? AND (? IS NULL OR (SELECT version FROM booking_revision WHERE id=1)=?)
        AND (?='decline' OR (julianday(starts_at)>julianday(?) AND EXISTS
          (SELECT 1 FROM users customer WHERE customer.id=appointments.customer_user_id AND customer.status='active' AND customer.email_verified_at IS NOT NULL)))
        AND EXISTS (SELECT 1 FROM users u JOIN staff_profiles sp ON sp.user_id=u.id JOIN sessions se ON se.user_id=u.id JOIN account_credentials c ON c.user_id=u.id
          WHERE u.id=? AND sp.id=? AND sp.setup_status='approved' AND u.role IN ('staff','manager','owner','admin')
          AND u.status='active' AND u.email_verified_at IS NOT NULL AND se.token_hash=? AND se.revoked_at IS NULL AND se.expires_at>? AND c.password_hash=? AND ${staffMfaGate()})`)
      .bind(status, staffId, now, decisionKey, receipt, action, reservedUntil, reservedUntil,
        action, action, action, now, action, id, cancellation ? 'confirmed' : 'requested', updatedAt, row.customerId, cancellation ? 1 : 0, staffId,
        revision, revision, action, now, userId, staffId, sessionHash, now, credential.hash),
    env.DB.prepare(`INSERT INTO appointment_events(id,appointment_id,actor_user_id,event_type,created_at)
      SELECT ?,id,?,?,? FROM appointments WHERE id=? AND staff_decision_receipt=?`).bind(receipt, userId, eventType, now, id, receipt),
    env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,action,entity_type,entity_id,created_at)
      SELECT ?,?,?,'appointment',id,? FROM appointments WHERE id=? AND staff_decision_receipt=?`).bind(randomUUID(), userId, eventType, now, id, receipt),
    ...queueAppointmentNotifications(env, receipt),
  ]);
  const saved = await env.DB.prepare('SELECT staff_decision_key AS decisionKey,staff_decision_action AS action FROM appointments WHERE id=?').bind(id).first<{ decisionKey: string | null; action: string | null }>();
  if (saved?.decisionKey !== decisionKey || saved.action !== action) throw new ApiError(409, 'The request, schedule, or your account changed. Refresh before responding.');
  return { request: await staffRequest(env, userId, sessionHash, id), message: `${action === 'keep' ? 'Cancellation declined. The appointment remains confirmed.' : action === 'cancel' ? 'Cancellation approved. The appointment is cancelled.' : `Request ${status}.`} An account-update notice is queued; email delivery is separate.` };
}
