import { randomBytes, randomUUID } from 'node:crypto';
import type { StaffMfaStatus } from '../src/shared/mfa';
import { ApiError, type Env } from './types';
import { allowFields, secretHash, stringField, verifyPassword } from './security';
import { authenticatorSecret, decryptSecret, encryptSecret, matchingCounter, mfaConfigured } from './totp';

// Alias arguments are internal constants, never request data. Use this predicate
// in the final resource query/write as well as the early authorization check.
export const staffMfaGate = (session = 'se', user = 'u') => `${session}.mfa_role=${user}.role
  AND ${session}.revoked_at IS NULL AND julianday(${session}.expires_at)>julianday('now')
  AND julianday(${session}.last_seen_at)>julianday('now','-30 minutes')
  AND julianday(${session}.mfa_until)>julianday('now')
  AND EXISTS (SELECT 1 FROM staff_authenticators mfa WHERE mfa.user_id=${user}.id AND mfa.version=${session}.mfa_version)`;
const eligibleSession = `SELECT se.token_hash FROM sessions se JOIN users u ON u.id=se.user_id
  JOIN account_credentials c ON c.user_id=u.id WHERE u.id=? AND se.token_hash=?
  AND u.status='active' AND u.email_verified_at IS NOT NULL AND u.role IN ('staff','manager','owner','admin')
  AND se.revoked_at IS NULL AND julianday(se.expires_at)>julianday('now')
  AND julianday(se.last_seen_at)>julianday('now','-30 minutes')`;
export async function mfaStatus(env: Env, userId: string, sessionHash: string): Promise<StaffMfaStatus> {
  if (!await env.DB.prepare(eligibleSession).bind(userId, sessionHash).first()) throw new ApiError(403, 'A professional account is required.');
  const enrolled = Boolean(await env.DB.prepare('SELECT 1 FROM staff_authenticators WHERE user_id=?').bind(userId).first());
  const unlocked = await env.DB.prepare(`SELECT se.mfa_until AS until FROM sessions se JOIN users u ON u.id=se.user_id
    WHERE se.token_hash=? AND se.user_id=? AND ${staffMfaGate()}`).bind(sessionHash, userId).first<{ until: string }>();
  return { configured: mfaConfigured(env), enrolled, unlockedUntil: mfaConfigured(env) ? unlocked?.until ?? null : null };
}
export async function requireStaffMfa(env: Env, userId: string, sessionHash: string) {
  if (!mfaConfigured(env)) throw new ApiError(503, 'Staff verification is temporarily unavailable.');
  if (!await env.DB.prepare(`${eligibleSession} AND ${staffMfaGate()}`).bind(userId, sessionHash).first()) {
    throw new ApiError(403, 'Verify your authenticator in Professional requests to unlock staff access.');
  }
}
async function passwordProof(env: Env, userId: string, sessionHash: string, password: unknown) {
  if (!mfaConfigured(env)) throw new ApiError(503, 'Staff verification is temporarily unavailable.');
  if (typeof password !== 'string' || !password.length || password.length > 128) throw new ApiError(400, 'Enter your current password.');
  const row = await env.DB.prepare(`SELECT c.password_hash AS hash FROM account_credentials c WHERE c.user_id=?
    AND EXISTS (${eligibleSession})`).bind(userId, userId, sessionHash).first<{ hash: string }>();
  if (!row || !await verifyPassword(password, row.hash)) throw new ApiError(400, 'Check your password and professional account access.');
  return row.hash;
}
const invalidCode = () => new ApiError(400, 'That code is invalid, expired, or already used. Try the next authenticator code or an unused recovery code.');
export async function startMfaEnrollment(env: Env, userId: string, sessionHash: string, body: Record<string, unknown>) {
  allowFields(body, ['currentPassword']);
  const credential = await passwordProof(env, userId, sessionHash, body.currentPassword);
  const status = await mfaStatus(env, userId, sessionHash);
  if (status.enrolled) await requireStaffMfa(env, userId, sessionHash);
  const id = randomUUID(); const secret = authenticatorSecret(); const expiresAt = new Date(Date.now() + 600000).toISOString();
  const saved = await env.DB.prepare(`INSERT INTO staff_mfa_enrollments(user_id,id,session_hash,credential_hash,previous_version,encrypted_secret,expires_at)
    SELECT ?,?,?,?,COALESCE((SELECT version FROM staff_authenticators WHERE user_id=?),''),?,?
    WHERE EXISTS (${eligibleSession} AND c.password_hash=? AND
      (NOT EXISTS (SELECT 1 FROM staff_authenticators WHERE user_id=u.id) OR (${staffMfaGate()})))
    ON CONFLICT(user_id) DO UPDATE SET id=excluded.id,session_hash=excluded.session_hash,credential_hash=excluded.credential_hash,
      previous_version=excluded.previous_version,encrypted_secret=excluded.encrypted_secret,expires_at=excluded.expires_at,attempts=0,consumed_receipt=NULL`)
    .bind(userId, id, sessionHash, credential, userId, encryptSecret(env, userId, secret), expiresAt, userId, sessionHash, credential).run();
  if (saved.meta.changes !== 1) throw new ApiError(409, 'Your account changed. Verify staff access again.');
  return { enrollmentId: id, setupKey: secret, expiresAt };
}
export async function confirmMfaEnrollment(env: Env, userId: string, sessionHash: string, body: Record<string, unknown>) {
  allowFields(body, ['enrollmentId', 'code']);
  const id = stringField(body, 'enrollmentId', 36, 36); const code = stringField(body, 'code', 6, 6);
  const pending = await env.DB.prepare(`UPDATE staff_mfa_enrollments SET attempts=attempts+1
    WHERE user_id=? AND id=? AND session_hash=? AND attempts<5 AND consumed_receipt IS NULL AND julianday(expires_at)>julianday('now')
    RETURNING encrypted_secret AS secret,credential_hash AS credential,previous_version AS previous`)
    .bind(userId, id, sessionHash).first<{ secret: string; credential: string; previous: string }>();
  if (!pending) throw new ApiError(400, 'Start authenticator setup again in this session.');
  const counter = matchingCounter(decryptSecret(env, userId, pending.secret), code, -1);
  if (counter === null) throw invalidCode();
  const version = randomUUID(); const now = new Date().toISOString(); const until = new Date(Date.now() + 900000).toISOString();
  const recoveryCodes = Array.from({ length: 8 }, () => randomBytes(10).toString('hex').match(/.{5}/g)!.join('-'));
  const claimed = `EXISTS (SELECT 1 FROM staff_mfa_enrollments WHERE user_id=? AND consumed_receipt=?)`;
  const results = await env.DB.batch<{ meta: { changes: number } }>([
    env.DB.prepare(`UPDATE staff_mfa_enrollments SET consumed_receipt=? WHERE user_id=? AND id=? AND session_hash=?
      AND consumed_receipt IS NULL AND attempts<=5 AND julianday(expires_at)>julianday('now')
      AND previous_version=COALESCE((SELECT version FROM staff_authenticators WHERE user_id=?),'')
      AND EXISTS (${eligibleSession} AND c.password_hash=? AND (previous_version='' OR (${staffMfaGate()})))`)
      .bind(version, userId, id, sessionHash, userId, userId, sessionHash, pending.credential),
    env.DB.prepare(`DELETE FROM staff_mfa_recovery_codes WHERE user_id=? AND ${claimed}`).bind(userId, userId, version),
    env.DB.prepare(`INSERT INTO staff_authenticators(user_id,version,encrypted_secret,last_counter,created_at)
      SELECT user_id,?,encrypted_secret,?,? FROM staff_mfa_enrollments WHERE user_id=? AND consumed_receipt=?
      ON CONFLICT(user_id) DO UPDATE SET version=excluded.version,encrypted_secret=excluded.encrypted_secret,last_counter=excluded.last_counter,receipt=NULL,created_at=excluded.created_at`)
      .bind(version, counter, now, userId, version),
    ...recoveryCodes.map((recovery) => env.DB.prepare(`INSERT INTO staff_mfa_recovery_codes(user_id,version,code_hash)
      SELECT ?,?,? WHERE ${claimed}`).bind(userId, version, recoveryHash(env, userId, recovery), userId, version)),
    // Replacement invalidates every previous staff grant, including other devices.
    env.DB.prepare(`UPDATE sessions SET mfa_version=?,mfa_role=(SELECT role FROM users WHERE id=?),mfa_until=?
      WHERE token_hash=? AND ${claimed}`).bind(version, userId, until, sessionHash, userId, version),
    env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,action,entity_type,entity_id,created_at)
      SELECT ?,?,'staff_authenticator_enrolled','user',?,? WHERE ${claimed}`).bind(randomUUID(), userId, userId, now, userId, version),
    env.DB.prepare('DELETE FROM staff_mfa_enrollments WHERE user_id=? AND consumed_receipt=?').bind(userId, version),
  ]);
  if (results[0]?.meta.changes !== 1) throw new ApiError(409, 'Your account or setup changed. Start authenticator setup again.');
  return { recoveryCodes, unlockedUntil: until };
}
const recoveryHash = (env: Env, userId: string, code: string) => secretHash(env, `staff-recovery-v1:${userId}:${code.replaceAll('-', '').toLowerCase()}`);
export async function unlockStaffMfa(env: Env, userId: string, sessionHash: string, body: Record<string, unknown>) {
  allowFields(body, ['currentPassword', 'code']);
  const credential = await passwordProof(env, userId, sessionHash, body.currentPassword);
  const code = stringField(body, 'code', 23, 6);
  const active = await env.DB.prepare('SELECT version,encrypted_secret AS secret,last_counter AS counter FROM staff_authenticators WHERE user_id=?')
    .bind(userId).first<{ version: string; secret: string; counter: number }>();
  if (!active) throw new ApiError(400, 'Set up your authenticator first.');
  const recovery = /^(?:[a-f0-9]{20}|[a-f0-9]{5}(?:-[a-f0-9]{5}){3})$/i.test(code);
  const counter = recovery ? null : matchingCounter(decryptSecret(env, userId, active.secret), code, active.counter);
  if (!recovery && counter === null) throw invalidCode();
  const receipt = randomUUID(); const until = new Date(Date.now() + 900000).toISOString();
  const claim = recovery
    ? env.DB.prepare(`UPDATE staff_mfa_recovery_codes SET used_receipt=? WHERE user_id=? AND version=? AND code_hash=? AND used_receipt IS NULL
        AND EXISTS (${eligibleSession} AND c.password_hash=?)`).bind(receipt, userId, active.version, recoveryHash(env, userId, code), userId, sessionHash, credential)
    : env.DB.prepare(`UPDATE staff_authenticators SET last_counter=?,receipt=? WHERE user_id=? AND version=? AND last_counter<?
        AND EXISTS (${eligibleSession} AND c.password_hash=?)`).bind(counter, receipt, userId, active.version, counter, userId, sessionHash, credential);
  const proof = recovery ? 'SELECT 1 FROM staff_mfa_recovery_codes WHERE user_id=? AND version=? AND used_receipt=?' : 'SELECT 1 FROM staff_authenticators WHERE user_id=? AND version=? AND receipt=?';
  const results = await env.DB.batch<{ meta: { changes: number } }>([
    claim,
    env.DB.prepare(`UPDATE sessions SET mfa_version=?,mfa_role=(SELECT role FROM users WHERE id=?),mfa_until=?
      WHERE token_hash=? AND EXISTS (${proof})`).bind(active.version, userId, until, sessionHash, userId, active.version, receipt),
    env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,action,entity_type,entity_id,created_at)
      SELECT ?,?,?,'user',?,? WHERE EXISTS (${proof})`).bind(randomUUID(), userId, recovery ? 'staff_recovery_code_used' : 'staff_access_verified', userId, new Date().toISOString(), userId, active.version, receipt),
  ]);
  if (results[0]?.meta.changes !== 1 || results[1]?.meta.changes !== 1) throw invalidCode();
  return { unlockedUntil: until };
}
