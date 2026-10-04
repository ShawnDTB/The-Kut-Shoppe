import { randomUUID } from 'node:crypto';
import type { AccountDirectory, AccountSession, ManagedAccount } from '../src/shared/account-management';
import type { AccountRole } from '../src/shared/customer';
import { ApiError, type Env } from './types';
import { allowFields, stringField, verifyPassword } from './security';
import { requireStaffMfa, staffMfaGate } from './staff-mfa';

const roles = { customer: 'customer', barber: 'staff', manager: 'manager', owner: 'owner', developer: 'admin' } as const;
const roleSql = "CASE role WHEN 'staff' THEN 'barber' WHEN 'admin' THEN 'developer' ELSE role END";
const managerGate = `EXISTS (SELECT 1 FROM users u JOIN sessions se ON se.user_id=u.id
  WHERE u.id=? AND se.token_hash=? AND u.status='active' AND u.email_verified_at IS NOT NULL
  AND u.role IN ('manager','owner','admin') AND ${staffMfaGate()})`;
async function requireManager(env: Env, actor: string, session: string) {
  if (env.STAFF_OPERATIONS_ENABLED !== 'true') throw new ApiError(503, 'Staff account management is not open.');
  await requireStaffMfa(env, actor, session);
  if (!await env.DB.prepare(`SELECT 1 WHERE ${managerGate}`).bind(actor, session).first()) throw new ApiError(403, 'Shop management access is required.');
}
export async function accountDirectory(env: Env, actor: string, session: string, query: string): Promise<AccountDirectory> {
  await requireManager(env, actor, session);
  if (query.length > 100) throw new ApiError(400, 'Search using at most 100 characters.');
  const { results } = await env.DB.prepare(`SELECT id,display_name AS name,email,${roleSql} AS role,
    email_verified_at IS NOT NULL AS verified,updated_at AS updatedAt,
    (SELECT setup_status FROM staff_profiles WHERE user_id=users.id) AS professionalStatus
    FROM users WHERE status='active' AND (instr(lower(display_name),lower(?))>0 OR instr(lower(email),lower(?))>0)
    AND ${managerGate} ORDER BY display_name COLLATE NOCASE,id LIMIT 51`).bind(query, query, actor, session).all<ManagedAccount>();
  return { items: results.slice(0, 50).map(row => ({ ...row, verified: Boolean(row.verified) })), more: results.length > 50 };
}
export async function changeAccountRole(env: Env, actor: string, session: string, id: string, body: Record<string, unknown>) {
  await requireManager(env, actor, session);
  allowFields(body, ['role', 'previousRole', 'updatedAt', 'currentPassword']);
  const next = stringField(body, 'role', 20, 1) as AccountRole;
  const previous = stringField(body, 'previousRole', 20, 1) as AccountRole;
  if (!Object.hasOwn(roles, next) || !Object.hasOwn(roles, previous)) throw new ApiError(400, 'Choose a supported account role.');
  if (id === actor) throw new ApiError(400, 'Another authorized owner must change your access.');
  if (next === previous) throw new ApiError(400, 'Choose a different role.');
  const updatedAt = stringField(body, 'updatedAt', 40, 1);
  if (typeof body.currentPassword !== 'string' || !body.currentPassword.length || body.currentPassword.length > 128) throw new ApiError(400, 'Enter your current password.');
  const password = body.currentPassword;
  const credential = await env.DB.prepare('SELECT password_hash AS hash FROM account_credentials WHERE user_id=?').bind(actor).first<{ hash: string }>();
  if (!credential || !await verifyPassword(password, credential.hash)) throw new ApiError(400, 'The current password is incorrect.');
  const receipt = randomUUID(); const now = new Date().toISOString();
  const saved = 'EXISTS (SELECT 1 FROM audit_events WHERE id=?)';
  const result = await env.DB.batch<{ meta: { changes: number } }>([
    env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,action,entity_type,entity_id,metadata_json,created_at)
      SELECT ?,?,'account_role_changed','user',id,?,? FROM users
      WHERE id=? AND id<>? AND status='active' AND email_verified_at IS NOT NULL AND role=? AND updated_at=?
      AND ${managerGate} AND EXISTS (SELECT 1 FROM account_credentials WHERE user_id=? AND password_hash=?)
      AND (NOT (role IN ('owner','admin') OR ? IN ('owner','admin')) OR EXISTS (SELECT 1 FROM users WHERE id=? AND role IN ('owner','admin')))
      AND (role<>'owner' OR ?='owner' OR EXISTS (SELECT 1 FROM users other WHERE other.id<>users.id AND other.role='owner' AND other.status='active' AND other.email_verified_at IS NOT NULL))
      AND (?<>'customer' OR NOT EXISTS (SELECT 1 FROM staff_profiles sp JOIN appointments a ON COALESCE(a.assigned_staff_id,a.requested_staff_id)=sp.id
        WHERE sp.user_id=users.id AND a.status IN ('requested','waitlisted','confirmed','reschedule_proposed','checked_in','in_service')))`)
      .bind(receipt, actor, JSON.stringify({ previousRole: previous, role: next }), now, id, actor, roles[previous], updatedAt,
        actor, session, actor, credential.hash, roles[next], actor, roles[next], roles[next]),
    env.DB.prepare(`UPDATE users SET role=?,updated_at=? WHERE id=? AND ${saved}`).bind(roles[next], now, id, receipt),
    env.DB.prepare(`UPDATE sessions SET revoked_at=? WHERE user_id=? AND ${saved}`).bind(now, id, receipt),
    env.DB.prepare(`DELETE FROM account_email_changes WHERE user_id=? AND ${saved}`).bind(id, receipt),
  ]);
  if (result[0]?.meta.changes !== 1) throw new ApiError(409, 'Access was not changed. Refresh the account and check its verified email, role permissions and outstanding visits. The last owner must keep owner access.');
  return { message: 'Access updated. This person must sign in again. Professional setup and approval are still required before taking bookings.' };
}

export async function accountSessions(env: Env, actor: string, session: string) {
  const { results } = await env.DB.prepare(`SELECT id,created_at AS createdAt,last_seen_at AS lastSeenAt,expires_at AS expiresAt,token_hash=? AS current
    FROM sessions WHERE user_id=? AND revoked_at IS NULL AND julianday(expires_at)>julianday('now')
    AND julianday(last_seen_at)>julianday('now',CASE WHEN (SELECT role FROM users WHERE id=?)='customer' THEN '-12 hours' ELSE '-30 minutes' END)
    ORDER BY current DESC,last_seen_at DESC LIMIT 51`).bind(session, actor, actor).all<AccountSession>();
  return { items: results.slice(0, 50).map(row => ({ ...row, current: Boolean(row.current) })), more: results.length > 50 };
}
export async function revokeAccountSession(env: Env, actor: string, session: string, id: string) {
  const target = await env.DB.prepare('SELECT id FROM sessions WHERE id=? AND user_id=? AND token_hash<>? AND revoked_at IS NULL').bind(id, actor, session).first();
  if (!target) throw new ApiError(404, 'This other session is no longer available.');
  await env.DB.batch([
    env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE id=? AND user_id=? AND token_hash<>?').bind(new Date().toISOString(), id, actor, session),
    env.DB.prepare("INSERT INTO audit_events(id,actor_user_id,action,entity_type,entity_id,created_at) VALUES (?,?,'session_revoked','session',?,?)").bind(randomUUID(), actor, id, new Date().toISOString()),
  ]);
  return { message: 'The other session has been signed out.' };
}
