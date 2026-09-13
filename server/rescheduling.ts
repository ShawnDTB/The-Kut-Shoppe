import { randomUUID } from 'node:crypto';
import { ApiError, type Env } from './types';
import { allowFields, secretHash, stringField, verifyPassword } from './security';
import { bookingSelection, rescheduleAvailability } from './booking';
import { localDate, MINUTE } from './booking-time';
import { requireProfessional } from './staff-requests';
import { staffMfaGate } from './staff-mfa';
import { queueAppointmentNotifications } from './appointment-notifications';
import type { AppointmentChange, ReschedulePage } from '../src/shared/rescheduling';

interface Visit {
  id: string; customerId: string; staffId: string; serviceId: string; locationId: string;
  startsAt: string | null; endsAt: string | null; status: string; cancellationState: string | null;
  updatedAt: string; version: number; timeZone: string; priceCents: number;
}
const changeSelect = `SELECT id,kind,status,starts_at AS startsAt,ends_at AS endsAt,expires_at AS expiresAt,
  original_starts_at AS originalStartsAt,original_ends_at AS originalEndsAt FROM appointment_changes`;
async function context(env: Env, actor: string, session: string, id: string, professional: boolean) {
  if (env.STAFF_OPERATIONS_ENABLED !== 'true') throw new ApiError(503, 'Appointment changes are temporarily unavailable. Contact the shop.');
  const staffId = professional ? await requireProfessional(env, actor, session) : null;
  const visit = await env.DB.prepare(`SELECT a.id,a.customer_user_id AS customerId,COALESCE(a.assigned_staff_id,a.requested_staff_id) AS staffId,
    a.service_id AS serviceId,a.location_id AS locationId,a.starts_at AS startsAt,a.ends_at AS endsAt,a.status,
    a.cancellation_state AS cancellationState,a.updated_at AS updatedAt,a.change_version AS version,l.timezone AS timeZone,a.price_cents AS priceCents
    FROM appointments a JOIN locations l ON l.id=a.location_id WHERE a.id=? AND a.source='website' AND a.customer_user_id IS NOT NULL
    AND ${professional ? 'COALESCE(a.assigned_staff_id,a.requested_staff_id)' : 'a.customer_user_id'}=?
    AND EXISTS (SELECT 1 FROM users u JOIN sessions se ON se.user_id=u.id WHERE u.id=? AND u.status='active'
      AND u.email_verified_at IS NOT NULL AND se.token_hash=? AND se.revoked_at IS NULL AND se.expires_at>?
      ${professional ? `AND u.role IN ('staff','manager','owner','admin') AND ${staffMfaGate()} AND EXISTS
        (SELECT 1 FROM staff_profiles sp WHERE sp.id=COALESCE(a.assigned_staff_id,a.requested_staff_id) AND sp.user_id=u.id AND sp.setup_status='approved')` : ''})`)
    .bind(id, professional ? staffId : actor, actor, session, new Date().toISOString()).first<Visit>();
  if (!visit) throw new ApiError(404, 'This appointment is not available to your account.');
  const change = await env.DB.prepare(`${changeSelect} WHERE appointment_id=? ORDER BY CASE WHEN status='pending' THEN 0 ELSE 1 END,created_at DESC,id DESC LIMIT 1`).bind(id).first<AppointmentChange>();
  return { visit, change };
}
const changeable = (visit: Visit) => visit.status === 'confirmed' && visit.cancellationState !== 'pending'
  && Boolean(visit.startsAt && visit.endsAt && Date.parse(visit.startsAt) > Date.now());
const live = (change: AppointmentChange | null) => change?.status === 'pending' && Date.parse(change.expiresAt) > Date.now();
export async function reschedulePage(env: Env, actor: string, session: string, id: string, professional: boolean): Promise<ReschedulePage> {
  const { visit, change } = await context(env, actor, session, id, professional);
  return { updatedAt: visit.updatedAt, version: visit.version, startsAt: visit.startsAt, endsAt: visit.endsAt,
    timeZone: visit.timeZone, priceCents: visit.priceCents, canRequest: changeable(visit) && (!live(change) || (professional && change?.kind === 'customer_request')),
    canResolve: change?.status === 'pending',
    change: change ? { ...change, status: change.status === 'pending' && !live(change) ? 'expired' : change.status } : null };
}
export async function changeAvailability(env: Env, actor: string, session: string, id: string, professional: boolean, date: string) {
  const { visit } = await context(env, actor, session, id, professional);
  if (!changeable(visit)) throw new ApiError(409, 'Only a future confirmed visit without a pending cancellation can be rescheduled.');
  const selection = bookingSelection({ ...visit, date });
  const { option, slots, quote } = await rescheduleAvailability(env, visit.customerId, selection, id);
  return { option: { ...option, priceCents: visit.priceCents }, date, slots: slots.filter(slot => slot.startsAt !== visit.startsAt), quote };
}

export async function changeAppointment(env: Env, actor: string, session: string, id: string, professional: boolean, body: Record<string, unknown>) {
  allowFields(body, ['action', 'updatedAt', 'version', 'requestKey', 'changeId', 'date', 'startsAt', 'quote', ...(professional ? ['currentPassword'] : [])]);
  const action = stringField(body, 'action', 10, 1);
  if (!(professional ? ['approve', 'decline', 'propose', 'withdraw'] : ['request', 'withdraw', 'accept', 'decline']).includes(action)) throw new ApiError(400, 'Choose a supported appointment change.');
  const updatedAt = stringField(body, 'updatedAt', 40, 1);
  const version = body.version;
  if (!Number.isSafeInteger(version) || Number(version) < 0) throw new ApiError(400, 'Refresh this appointment.');
  const key = stringField(body, 'requestKey', 36, 36);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(key)) throw new ApiError(400, 'Review this change again.');
  const { visit, change } = await context(env, actor, session, id, professional);
  let passwordHash: string | null = null;
  if (professional) {
    if (typeof body.currentPassword !== 'string' || !body.currentPassword.length || body.currentPassword.length > 128) throw new ApiError(400, 'Enter your current password.');
    const password = body.currentPassword;
    const credentials = await env.DB.prepare('SELECT password_hash AS hash FROM account_credentials WHERE user_id=?').bind(actor).first<{ hash: string }>();
    if (!credentials || !await verifyPassword(password, credentials.hash)) throw new ApiError(400, 'The current password is incorrect.');
    passwordHash = credentials.hash;
  }
  const fingerprint = secretHash(env, JSON.stringify({ id, professional, action, updatedAt, version, changeId: body.changeId ?? null, date: body.date ?? null, startsAt: body.startsAt ?? null, quote: body.quote ?? null }));
  const existing = () => env.DB.prepare('SELECT fingerprint FROM appointment_change_operations WHERE actor_user_id=? AND request_key=?').bind(actor, key).first<{ fingerprint: string }>();
  const response = async () => ({ ...await reschedulePage(env, actor, session, id, professional), message: 'Your change is saved. The confirmed appointment and current request status are shown below.' });
  const prior = await existing();
  if (prior) { if (prior.fingerprint !== fingerprint) throw new ApiError(409, 'This request key was already used for a different change. Refresh first.'); return response(); }
  const creating = action === 'request' || action === 'propose';
  const moving = action === 'approve' || action === 'accept';
  if (visit.updatedAt !== updatedAt || visit.version !== version) throw new ApiError(409, 'This appointment changed. Refresh before continuing.');
  if (creating || moving) {
    if (!changeable(visit)) throw new ApiError(409, 'This visit cannot be moved now. Your original appointment has not been changed.');
  }
  if (creating) {
    if (live(change) && !(professional && action === 'propose' && change?.kind === 'customer_request')) throw new ApiError(409, 'Resolve the current change request before choosing another time.');
    if (live(change) && body.changeId !== change?.id) throw new ApiError(409, 'Refresh the current change request.');
  } else {
    if (!change || change.id !== body.changeId || change.status !== 'pending') throw new ApiError(409, 'This change request has already been resolved. Refresh its status.');
    const proposer = professional ? change.kind === 'professional_proposal' : change.kind === 'customer_request';
    if ((action === 'withdraw') !== proposer) throw new ApiError(403, 'Only the other party can accept or decline a proposed change.');
    if (moving && !live(change)) throw new ApiError(409, 'This proposed time has expired. Choose another time; the original visit was not moved.');
  }
  let startsAt = creating ? stringField(body, 'startsAt', 24, 24) : change!.startsAt;
  let endsAt = creating ? '' : change!.endsAt;
  let revision: number | null = null; let reservedUntil: string | null = null;
  if (creating || moving) {
    const date = creating ? stringField(body, 'date', 10, 10) : localDate(Date.parse(startsAt), visit.timeZone);
    const selection = bookingSelection({ ...visit, date });
    const available = await rescheduleAvailability(env, visit.customerId, selection, id);
    const concurrent = await existing();
    if (concurrent) { if (concurrent.fingerprint !== fingerprint) throw new ApiError(409, 'This request key was already used.'); return response(); }
    const slot = available.slots.find(item => item.startsAt === startsAt && (creating || item.endsAt === endsAt));
    if (!slot || startsAt === visit.startsAt) throw new ApiError(409, 'The replacement time is no longer available. Refresh available times. Your original visit is unchanged.');
    if (creating && body.quote !== available.quote) throw new ApiError(409, 'Service details changed. Refresh available times before sending this change.');
    startsAt = slot.startsAt; endsAt = slot.endsAt; revision = available.revision;
    reservedUntil = new Date(Date.parse(endsAt) + available.bufferMinutes * MINUTE).toISOString();
  }
  const receipt = randomUUID(); const changeId = randomUUID(); const now = new Date().toISOString();
  const expiry = new Date(Math.min(Date.parse(visit.startsAt ?? startsAt), Date.parse(startsAt))).toISOString();
  const eventType = `appointment_change_${action}`;
  const savedGate = 'EXISTS (SELECT 1 FROM appointment_change_operations WHERE id=?)';
  await env.DB.batch([
    // The operation receipt, reservation mutation, change history and outbox are
    // one transaction. A stale account, schedule or appointment saves nothing.
    env.DB.prepare(`INSERT INTO appointment_change_operations(id,appointment_id,actor_user_id,request_key,fingerprint,action,created_at)
      SELECT ?,a.id,?,?,?,?,? FROM appointments a WHERE a.id=? AND a.updated_at=? AND a.change_version=?
        AND a.customer_user_id=? AND COALESCE(a.assigned_staff_id,a.requested_staff_id)=? AND a.source='website'
        AND (? IS NULL OR (SELECT version FROM booking_revision WHERE id=1)=?)
        AND (?=0 OR (a.status='confirmed' AND COALESCE(a.cancellation_state,'')!='pending' AND julianday(a.starts_at)>julianday(?) AND julianday(?)>julianday(?)))
        AND (?=0 OR EXISTS (SELECT 1 FROM appointment_changes c WHERE c.id=? AND c.appointment_id=a.id AND c.status='pending'))
        AND EXISTS (SELECT 1 FROM users u JOIN sessions se ON se.user_id=u.id JOIN account_credentials cred ON cred.user_id=u.id
          WHERE u.id=? AND u.status='active' AND u.email_verified_at IS NOT NULL AND se.token_hash=? AND se.revoked_at IS NULL AND se.expires_at>?
          ${professional ? `AND cred.password_hash=? AND u.role IN ('staff','manager','owner','admin') AND ${staffMfaGate()}` : 'AND u.id=a.customer_user_id'})
        AND (?=0 OR EXISTS (SELECT 1 FROM staff_profiles sp JOIN users u ON u.id=sp.user_id
          WHERE sp.id=COALESCE(a.assigned_staff_id,a.requested_staff_id) AND sp.setup_status='approved' AND u.status='active'
          AND u.email_verified_at IS NOT NULL AND u.role IN ('staff','manager','owner','admin') ${professional ? 'AND sp.user_id=?' : ''}))
        AND (?=0 OR EXISTS (SELECT 1 FROM users u WHERE u.id=a.customer_user_id AND u.status='active' AND u.email_verified_at IS NOT NULL))
      ON CONFLICT(actor_user_id,request_key) DO NOTHING`)
      .bind(receipt, actor, key, fingerprint, action, now, id, updatedAt, version, visit.customerId, visit.staffId, revision, revision,
        creating || moving ? 1 : 0, now, startsAt, now, creating ? 0 : 1, change?.id ?? null,
        actor, session, now, ...(professional ? [passwordHash] : []), professional || creating || moving ? 1 : 0, ...(professional ? [actor] : []), moving ? 1 : 0),
    env.DB.prepare(`UPDATE appointment_changes SET status=CASE WHEN expires_at<=? THEN 'expired' ELSE 'declined' END,resolved_at=?
      WHERE appointment_id=? AND status='pending' AND ?=1 AND ${savedGate}`).bind(now, now, id, creating ? 1 : 0, receipt),
    env.DB.prepare(`INSERT INTO appointment_changes(id,appointment_id,requested_by,kind,status,original_starts_at,original_ends_at,starts_at,ends_at,expires_at,created_at)
      SELECT ?,?,?,?,'pending',?,?,?,?,?,? WHERE ?=1 AND ${savedGate}`)
      .bind(changeId, id, actor, professional ? 'professional_proposal' : 'customer_request', visit.startsAt, visit.endsAt, startsAt, endsAt, expiry, now, creating ? 1 : 0, receipt),
    env.DB.prepare(`UPDATE appointment_changes SET status=?,resolved_at=? WHERE id=? AND ?=0 AND ${savedGate}`)
      .bind(moving ? 'approved' : action === 'withdraw' ? 'withdrawn' : 'declined', now, change?.id ?? null, creating ? 1 : 0, receipt),
    env.DB.prepare(`UPDATE appointments SET updated_at=?,change_version=change_version+1,
      starts_at=CASE WHEN ?=1 THEN ? ELSE starts_at END,ends_at=CASE WHEN ?=1 THEN ? ELSE ends_at END,
      reserved_until=CASE WHEN ?=1 THEN ? ELSE reserved_until END WHERE id=? AND ${savedGate}`)
      .bind(now, moving ? 1 : 0, startsAt, moving ? 1 : 0, endsAt, moving ? 1 : 0, reservedUntil, id, receipt),
    env.DB.prepare(`INSERT INTO appointment_events(id,appointment_id,actor_user_id,event_type,created_at) SELECT ?,?,?,?,? WHERE ${savedGate}`).bind(receipt, id, actor, eventType, now, receipt),
    env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,action,entity_type,entity_id,created_at) SELECT ?,?,?,'appointment',?,? WHERE ${savedGate}`).bind(randomUUID(), actor, eventType, id, now, receipt),
    ...queueAppointmentNotifications(env, receipt),
  ]);
  const saved = await existing();
  if (!saved || saved.fingerprint !== fingerprint) throw new ApiError(409, 'The appointment, schedule or account changed. Refresh its status before trying again.');
  return response();
}
