import { ApiError, type Env } from './types';
import { verifyPassword } from './security';
import { requireFrontDesk } from './front-desk';
import { staffMfaGate } from './staff-mfa';

export const cashGate = `EXISTS(SELECT 1 FROM users u JOIN sessions se ON se.user_id=u.id WHERE u.id=? AND se.token_hash=? AND u.status='active'
 AND u.email_verified_at IS NOT NULL AND u.role IN ('owner','manager','admin') AND ${staffMfaGate()})`;
export async function authorizeCash(env: Env, actor: string, session: string, body: Record<string, unknown>) {
  await requireFrontDesk(env, actor, session);
  if (env.CASH_SALES_ENABLED !== 'true') throw new ApiError(503, 'Cash sales are not enabled in this environment.');
  if (typeof body.currentPassword !== 'string' || !body.currentPassword.length || body.currentPassword.length > 128) throw new ApiError(400, 'Enter your current password.');
  const row = await env.DB.prepare('SELECT password_hash AS hash FROM account_credentials WHERE user_id=?').bind(actor).first<{hash:string}>();
  if (!row || !await verifyPassword(body.currentPassword, row.hash)) throw new ApiError(400, 'The current password is incorrect.');
  return row.hash;
}
