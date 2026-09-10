import { randomUUID } from 'node:crypto';
import type { CustomerAccount } from '../src/shared/customer';
import { ApiError, type Env } from './types';
import { newCode, newToken, secretHash, verifyPassword } from './security';
import { sendAccountEmail } from './accounts';

const invalidCode = 'These codes are invalid or expired. Check both emails, or start a new request.';

export async function startEmailChange(env: Env, account: CustomerAccount, sessionHash: string, email: string, password: unknown) {
  if (typeof password !== 'string' || password.length > 128) throw new ApiError(400, 'Enter your current password.');
  const credential = await env.DB.prepare('SELECT password_hash FROM account_credentials WHERE user_id = ?')
    .bind(account.id).first<{ password_hash: string }>();
  if (!credential || !await verifyPassword(password, credential.password_hash)) throw new ApiError(400, 'The current password is incorrect.');
  if (email === account.email) throw new ApiError(400, 'Enter a different email address.');
  const id = randomUUID();
  const currentCode = newCode();
  let newCodeValue = newCode();
  while (newCodeValue === currentCode) newCodeValue = newCode();
  const now = new Date().toISOString();
  // Recheck the credential and initiating session at the write boundary, so a
  // concurrent password change or sign-out cannot create a usable stale request.
  const result = await env.DB.prepare(`INSERT INTO account_email_changes
    (id, user_id, session_hash, current_email, new_email, current_code_hash, new_code_hash, expires_at, created_at)
    SELECT ?, u.id, ?, u.email, ?, ?, ?, ?, ? FROM users u
    JOIN account_credentials c ON c.user_id = u.id JOIN sessions s ON s.user_id = u.id
    WHERE u.id = ? AND u.email = ? AND u.status = 'active' AND c.password_hash = ?
      AND s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
      AND NOT EXISTS (SELECT 1 FROM users WHERE email = ?)
    ON CONFLICT(user_id) DO UPDATE SET id = excluded.id, session_hash = excluded.session_hash,
      current_email = excluded.current_email, new_email = excluded.new_email,
      current_code_hash = excluded.current_code_hash, new_code_hash = excluded.new_code_hash,
      expires_at = excluded.expires_at, created_at = excluded.created_at,
      attempts = 0, consumed_at = NULL, consumed_by = NULL`)
    .bind(id, sessionHash, email, secretHash(env, `${id}:current:${currentCode}`), secretHash(env, `${id}:new:${newCodeValue}`),
      new Date(Date.now() + 10 * 60000).toISOString(), now, account.id, account.email,
      credential.password_hash, sessionHash, now, email).run();
  if (result.meta.changes !== 1) throw new ApiError(409, 'This email change could not be started. Check the address and sign in again before retrying.');
  try {
    // No MFA exists yet: confirm access to BOTH inboxes, not just the destination.
    await sendAccountEmail(env, `${id}-current`, account.email, 'Confirm a Kut Shoppe email change',
      `Your current-email confirmation code is ${currentCode}. Someone requested a sign-in email change to ${email}. Only enter this code if you made that request. It expires in 10 minutes. Enter both codes on ${env.APP_ORIGIN}/account?view=security using the same signed-in device. If this was not you, do not share the code; sign in and change your password.`);
    await sendAccountEmail(env, `${id}-new`, email, 'Verify your new Kut Shoppe email',
      `Your new-email confirmation code is ${newCodeValue}. It expires in 10 minutes. Enter it with the code sent to your current email on ${env.APP_ORIGIN}/account?view=security using the same signed-in device. If you did not request this, ignore this email. Never share this code.`);
  } catch (error) {
    await env.DB.prepare('DELETE FROM account_email_changes WHERE id = ?').bind(id).run();
    throw error;
  }
  return { challengeId: id, message: 'Codes sent to your current and new email addresses. Your sign-in email has not changed yet.' };
}

export async function finishEmailChange(env: Env, userId: string, sessionHash: string, id: string, currentCode: string, newCodeValue: string) {
  const now = new Date().toISOString();
  const claim = newToken();
  const owner = 'SELECT user_id FROM account_email_changes WHERE id = ? AND consumed_by = ?';
  // A single D1 transaction claims the codes, changes the address, invalidates
  // old recovery codes, revokes every session, and records a non-PII audit event.
  const results = await env.DB.batch<{ meta: { changes: number } }>([
    env.DB.prepare(`UPDATE account_email_changes SET consumed_at = ?, consumed_by = ?
      WHERE id = ? AND user_id = ? AND session_hash = ? AND consumed_at IS NULL
        AND expires_at > ? AND attempts < 5 AND current_code_hash = ? AND new_code_hash = ?
        AND EXISTS (SELECT 1 FROM users u WHERE u.id = user_id AND u.email = current_email AND u.status = 'active')
        AND EXISTS (SELECT 1 FROM sessions s WHERE s.token_hash = session_hash AND s.revoked_at IS NULL AND s.expires_at > ?)
        AND NOT EXISTS (SELECT 1 FROM users u WHERE u.email = new_email)`)
      .bind(now, claim, id, userId, sessionHash, now, secretHash(env, `${id}:current:${currentCode}`), secretHash(env, `${id}:new:${newCodeValue}`), now),
    env.DB.prepare(`UPDATE users SET email = (SELECT new_email FROM account_email_changes WHERE id = ? AND consumed_by = ?),
      email_verified_at = ?, updated_at = ? WHERE id = (${owner})`).bind(id, claim, now, now, id, claim),
    env.DB.prepare(`UPDATE account_challenges SET consumed_at = ? WHERE user_id = (${owner}) AND consumed_at IS NULL`).bind(now, id, claim),
    env.DB.prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = (${owner})`).bind(now, id, claim),
    env.DB.prepare(`INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, created_at)
      SELECT ?, user_id, 'email_changed', 'account', user_id, ? FROM account_email_changes WHERE id = ? AND consumed_by = ?`)
      .bind(randomUUID(), now, id, claim),
  ]);
  if (results[0]?.meta.changes !== 1) {
    await env.DB.prepare(`UPDATE account_email_changes SET attempts = attempts + 1
      WHERE id = ? AND user_id = ? AND session_hash = ? AND consumed_at IS NULL AND attempts < 5`).bind(id, userId, sessionHash).run();
    throw new ApiError(400, invalidCode);
  }
}
