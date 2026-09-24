import { randomUUID } from 'node:crypto';
import { ApiError, type Env } from './types';
import { allowFields, secretHash, stringField, verifyPassword } from './security';
import { requireStaffMfa, staffMfaGate } from './staff-mfa';
import { requireProfessional } from './staff-requests';
import { queueAppointmentNotifications } from './appointment-notifications';
import { availableVisitActions, type VisitAction, type VisitActionState } from '../src/shared/visit-actions';

// a is the appointment being changed. Re-evaluated inside the write transaction.
const scope = (professional: boolean) => `EXISTS (SELECT 1 FROM users u JOIN sessions se ON se.user_id=u.id
  WHERE u.id=? AND se.token_hash=? AND u.status='active' AND u.email_verified_at IS NOT NULL
  AND ${staffMfaGate()} AND ${professional ? `u.role IN ('staff','manager','owner','admin') AND EXISTS
    (SELECT 1 FROM staff_profiles sp WHERE sp.user_id=u.id AND sp.id=a.assigned_staff_id AND sp.setup_status='approved')` : "u.role IN ('owner','manager','admin')"})`;
export const visitPendingFields = `a.cancellation_state='pending' AS cancellationPending,
  EXISTS (SELECT 1 FROM appointment_changes ch WHERE ch.appointment_id=a.id AND ch.status='pending'
    AND julianday(ch.expires_at)>julianday('now')) AS changePending`;

export async function progressVisit(env: Env, actor: string, session: string, id: string, body: Record<string, unknown>, professional = false) {
  if (env.STAFF_OPERATIONS_ENABLED !== 'true') throw new ApiError(503, 'Visit management is not open.');
  if (professional) await requireProfessional(env, actor, session);
  else await requireStaffMfa(env, actor, session);
  allowFields(body, ['action','updatedAt','requestKey','currentPassword']);
  const action = stringField(body, 'action', 20, 1) as VisitAction;
  const updatedAt = stringField(body, 'updatedAt', 40, 1);
  const key = stringField(body, 'requestKey', 36, 36);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(key)) throw new ApiError(400, 'Review this visit action again.');
  const row = await env.DB.prepare(`SELECT a.status,a.starts_at AS startsAt,a.ends_at AS endsAt,${visitPendingFields}
    FROM appointments a WHERE a.id=? AND a.source IN ('website','walk_in') AND ${scope(professional)}`)
    .bind(id, actor, session).first<VisitActionState>();
  if (!row) throw new ApiError(404, 'This visit is not available to your account.');
  if (typeof body.currentPassword !== 'string' || !body.currentPassword.length || body.currentPassword.length > 128) throw new ApiError(400, 'Enter your current password.');
  const credential = await env.DB.prepare('SELECT password_hash AS hash FROM account_credentials WHERE user_id=?').bind(actor).first<{ hash: string }>();
  if (!credential || !await verifyPassword(body.currentPassword, credential.hash)) throw new ApiError(400, 'The current password is incorrect.');
  const fingerprint = secretHash(env, JSON.stringify({ id, action, updatedAt, professional }));
  const replay = async () => {
    const prior = await env.DB.prepare('SELECT fingerprint FROM visit_operations WHERE actor_user_id=? AND request_key=?').bind(actor, key).first<{ fingerprint: string }>();
    if (prior && prior.fingerprint !== fingerprint) throw new ApiError(409, 'This request key was used for a different action. Refresh the visit.');
    return prior;
  };
  if (await replay()) return { message: 'This visit update is already saved.' };
  if (!availableVisitActions(row).includes(action)) throw new ApiError(409, 'This action is unavailable. Refresh the visit; resolve any pending schedule change first.');
  const receipt = randomUUID(); const now = new Date().toISOString();
  const saved = 'EXISTS (SELECT 1 FROM visit_operations WHERE id=?)';
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO visit_operations(id,actor_user_id,request_key,fingerprint,appointment_id,action,created_at)
      SELECT ?,?,?,?,a.id,?,? FROM appointments a WHERE a.id=? AND a.source IN ('website','walk_in') AND a.status=? AND a.updated_at=?
      AND ${scope(professional)} AND EXISTS (SELECT 1 FROM account_credentials WHERE user_id=? AND password_hash=?)
      AND (COALESCE(a.cancellation_state,'')!='pending' OR ?='cancelled')
      AND NOT EXISTS (SELECT 1 FROM appointment_changes ch WHERE ch.appointment_id=a.id AND ch.status='pending' AND julianday(ch.expires_at)>julianday('now'))
      AND (? NOT IN ('checked_in','in_service','no_show') OR (julianday(a.ends_at)>julianday(a.starts_at)
        AND (?='no_show' OR julianday(a.ends_at)>julianday('now')) AND (?='checked_in' OR julianday(a.starts_at)<=julianday('now'))))
      AND (?!='in_service' OR NOT EXISTS (SELECT 1 FROM appointments other WHERE other.assigned_staff_id=a.assigned_staff_id AND other.id!=a.id AND other.status='in_service'))
      ON CONFLICT(actor_user_id,request_key) DO NOTHING`)
      .bind(receipt, actor, key, fingerprint, action, now, id, row.status, updatedAt, actor, session, actor, credential.hash, action, action, action, action, action),
    env.DB.prepare(`UPDATE appointments SET status=?,updated_at=?,change_version=change_version+1,
      cancelled_at=CASE WHEN ?='cancelled' THEN ? ELSE cancelled_at END,
      cancellation_state=CASE WHEN ?='cancelled' AND cancellation_state='pending' THEN 'approved' ELSE cancellation_state END
      WHERE id=? AND ${saved}`).bind(action, now, action, now, action, id, receipt),
    env.DB.prepare(`UPDATE appointment_changes SET status='expired',resolved_at=? WHERE appointment_id=? AND status='pending' AND ${saved}`).bind(now, id, receipt),
    env.DB.prepare(`INSERT INTO appointment_events(id,appointment_id,actor_user_id,event_type,created_at) SELECT ?,?,?,?,? WHERE ${saved}`).bind(receipt, id, actor, `visit_${action}`, now, receipt),
    env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,action,entity_type,entity_id,created_at) SELECT ?,?,?,'appointment',?,? WHERE ${saved}`).bind(randomUUID(), actor, `visit_${action}`, id, now, receipt),
    ...queueAppointmentNotifications(env, receipt),
  ]);
  if (!await replay()) throw new ApiError(409, 'The visit, professional availability or your access changed. Refresh before retrying.');
  return { message: 'Visit updated. No payment or refund has been recorded.' };
}
