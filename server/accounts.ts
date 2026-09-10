import { randomUUID } from 'node:crypto';
import type { CustomerAccount, CustomerOverview, CustomerProfile } from '../src/shared/customer';
import { ApiError, type Env, type Statement } from './types';
import { cookie, newCode, newToken, secretHash, SESSION_SECONDS, sessionToken, stringField, allowFields } from './security';

interface AccountRow {
  id: string; email: string; display_name: string; role: string;
  email_verified_at: string | null; phone: string; address_json: string;
}
const profileSelect = `SELECT u.id, u.email, u.display_name, u.role, u.email_verified_at, p.phone, p.address_json
  FROM users u JOIN customer_profiles p ON p.user_id = u.id`;
function publicAccount(row: AccountRow): CustomerAccount {
  const role = ({ customer: 'customer', staff: 'barber', manager: 'manager', owner: 'owner', admin: 'developer' } as const)[row.role as 'customer'];
  if (!role) throw new ApiError(403, 'This account is unavailable.');
  return { id: row.id, email: row.email, role, emailVerified: Boolean(row.email_verified_at),
    profile: { name: row.display_name, phone: row.phone, address: JSON.parse(row.address_json) as CustomerProfile['address'] } };
}
export async function getAccount(env: Env, userId: string) {
  const row = await env.DB.prepare(`${profileSelect} WHERE u.id = ? AND u.status = 'active'`).bind(userId).first<AccountRow>();
  if (!row) throw new ApiError(401, 'Please sign in again.');
  return publicAccount(row);
}
export async function authenticate(request: Request, env: Env) {
  const token = sessionToken(request);
  if (!token) throw new ApiError(401, 'Please sign in to your account.');
  const now = new Date();
  const row = await env.DB.prepare(`${profileSelect} JOIN sessions s ON s.user_id = u.id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
    AND s.last_seen_at > CASE WHEN u.role = 'customer' THEN ? ELSE ? END
    AND u.status = 'active' AND u.email_verified_at IS NOT NULL`)
    .bind(secretHash(env, token), now.toISOString(), new Date(now.getTime() - 12 * 3600000).toISOString(),
      new Date(now.getTime() - 30 * 60000).toISOString()).first<AccountRow>();
  if (!row) throw new ApiError(401, 'Your session has ended. Please sign in again.');
  await env.DB.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ? AND revoked_at IS NULL')
    .bind(now.toISOString(), secretHash(env, token)).run();
  return publicAccount(row);
}
export async function createSession(env: Env, userId: string, proof?: { email: string; passwordHash: string }) {
  const token = newToken();
  const now = new Date();
  const result = await env.DB.prepare(`INSERT INTO sessions(id, user_id, token_hash, expires_at, created_at, last_seen_at)
    SELECT ?, id, ?, ?, ?, ? FROM users WHERE id = ? AND status = 'active' AND email_verified_at IS NOT NULL
      ${proof ? 'AND email = ? AND EXISTS (SELECT 1 FROM account_credentials c WHERE c.user_id = users.id AND c.password_hash = ?)' : ''}`)
    .bind(randomUUID(), secretHash(env, token), new Date(now.getTime() + SESSION_SECONDS * 1000).toISOString(),
      now.toISOString(), now.toISOString(), userId, ...(proof ? [proof.email, proof.passwordHash] : [])).run();
  if (result.meta.changes !== 1) throw new ApiError(401, 'Please sign in again.');
  return cookie(token);
}
export function audit(env: Env, userId: string, action: string): Statement {
  return env.DB.prepare(`INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, created_at)
    VALUES (?, ?, ?, 'account', ?, ?)`)
    .bind(randomUUID(), userId, action, userId, new Date().toISOString());
}
export async function sendAccountEmail(env: Env, id: string, email: string, subject: string, text: string) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': id },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [email], subject, text }), signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Email delivery failed');
  } catch { throw new ApiError(503, 'We could not send the email. Please try again shortly.'); }
}
export async function sendChallenge(env: Env, user: { id: string; email: string }, purpose: 'verify_email' | 'reset_password') {
  const id = randomUUID();
  const code = newCode();
  const now = new Date();
  const inserted = await env.DB.prepare(`INSERT INTO account_challenges(id, user_id, purpose, code_hash, expires_at, created_at, email)
    SELECT ?, id, ?, ?, ?, ?, email FROM users WHERE id = ? AND email = ? AND status = 'active'`)
    .bind(id, purpose, secretHash(env, `${id}:${code}`), new Date(now.getTime() + 10 * 60000).toISOString(), now.toISOString(), user.id, user.email).run();
  if (inserted.meta.changes !== 1) throw new ApiError(409, 'Your account changed. Please start again.');
  try {
    await sendAccountEmail(env, id, user.email, purpose === 'verify_email' ? 'Verify your Kut Shoppe email' : 'Reset your Kut Shoppe password',
      `Your Kut Shoppe code is ${code}. It expires in 10 minutes and can be used once. Enter it on ${env.APP_ORIGIN}/account. If you did not request this, you can ignore this email. Never share this code.`);
  } catch {
    await env.DB.prepare('DELETE FROM account_challenges WHERE id = ?').bind(id).run();
    throw new ApiError(503, 'We could not send the email. Please try again shortly.');
  }
  return id;
}
export async function consumeChallenge(env: Env, id: string, code: string, purpose: string, passwordHash?: string) {
  const now = new Date().toISOString();
  const challenge = await env.DB.prepare(`SELECT ac.user_id, ac.email, c.password_hash FROM account_challenges ac
    JOIN account_credentials c ON c.user_id = ac.user_id
    WHERE ac.id = ? AND ac.purpose = ? AND ac.code_hash = ? AND ac.consumed_at IS NULL AND ac.expires_at > ? AND ac.attempts < 5`)
    .bind(id, purpose, secretHash(env, `${id}:${code}`), now).first<{ user_id: string; email: string; password_hash: string }>();
  if (!challenge) {
    await env.DB.prepare('UPDATE account_challenges SET attempts = attempts + 1 WHERE id = ? AND consumed_at IS NULL AND attempts < 5').bind(id).run();
    throw new ApiError(400, 'That code is invalid or expired. Request a new email and try again.');
  }
  const claim = newToken();
  const owner = 'SELECT user_id FROM account_challenges WHERE id = ? AND consumed_by = ?';
  const statements = [
    env.DB.prepare(`UPDATE account_challenges SET consumed_at = ?, consumed_by = ?
      WHERE id = ? AND consumed_at IS NULL AND expires_at > ? AND attempts < 5
        AND EXISTS (SELECT 1 FROM users u WHERE u.id = account_challenges.user_id AND u.email = account_challenges.email AND u.status = 'active')
      RETURNING user_id`)
      .bind(now, claim, id, now),
    env.DB.prepare(`UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = (${owner})`)
      .bind(now, now, id, claim),
  ];
  if (passwordHash) {
    statements.push(
      env.DB.prepare(`UPDATE account_credentials SET password_hash = ?, updated_at = ? WHERE user_id = (${owner})`).bind(passwordHash, now, id, claim),
      env.DB.prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = (${owner})`).bind(now, id, claim),
      env.DB.prepare(`DELETE FROM account_email_changes WHERE user_id = (${owner})`).bind(id, claim),
    );
  }
  statements.push(env.DB.prepare(`UPDATE account_challenges SET consumed_at = ? WHERE user_id = (${owner}) AND consumed_at IS NULL`).bind(now, id, claim));
  const results = await env.DB.batch<{ results: { user_id: string }[] }>(statements);
  if (!results[0]?.results.length) throw new ApiError(400, 'That code has already been used.');
  await audit(env, challenge.user_id, purpose === 'verify_email' ? 'email_verified' : 'password_reset').run();
  return { userId: challenge.user_id, email: challenge.email, passwordHash: challenge.password_hash };
}
export function parseProfile(body: Record<string, unknown>): CustomerProfile {
  allowFields(body, ['name', 'phone', 'address']);
  const name = stringField(body, 'name', 100, 2);
  const phone = stringField(body, 'phone', 30);
  if (phone && !/^\+?[\d ()-]{7,30}$/.test(phone)) throw new ApiError(400, 'Enter a valid phone number or leave it blank.');
  if (!body.address || typeof body.address !== 'object' || Array.isArray(body.address)) throw new ApiError(400, 'Check the address.');
  const input = body.address as Record<string, unknown>;
  allowFields(input, ['line1', 'line2', 'city', 'state', 'postalCode']);
  const address = { line1: stringField(input, 'line1', 150), line2: stringField(input, 'line2', 100),
    city: stringField(input, 'city', 100), state: stringField(input, 'state', 2).toUpperCase(), postalCode: stringField(input, 'postalCode', 10) };
  if (Object.values(address).some(Boolean) && (!address.line1 || !address.city || !/^[A-Z]{2}$/.test(address.state) || !/^\d{5}(-\d{4})?$/.test(address.postalCode))) {
    throw new ApiError(400, 'Complete the street, city, two-letter state, and ZIP code, or leave the address blank.');
  }
  return { name, phone, address };
}
export async function overview(env: Env, userId: string): Promise<CustomerOverview> {
  // Ownership is the authenticated immutable user ID. Never match by contact
  // details or return internal notes, payment references, guest data, or SELECT *.
  const appointments = await env.DB.prepare(`SELECT a.id, s.name AS serviceName, sp.professional_name AS barberName,
    a.starts_at AS startsAt, a.status FROM appointments a JOIN services s ON s.id = a.service_id
    LEFT JOIN staff_profiles sp ON sp.id = a.assigned_staff_id WHERE a.customer_user_id = ?
    ORDER BY a.starts_at DESC LIMIT 100`).bind(userId).all<CustomerOverview['appointments'][number]>();
  const orders = await env.DB.prepare(`SELECT id, status, fulfillment_type AS fulfillment, total_cents AS totalCents,
    created_at AS createdAt FROM orders WHERE customer_user_id = ? ORDER BY created_at DESC LIMIT 100`)
    .bind(userId).all<CustomerOverview['orders'][number]>();
  return { appointments: appointments.results, orders: orders.results };
}
