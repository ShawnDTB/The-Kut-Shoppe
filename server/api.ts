import { randomUUID } from 'node:crypto';
import { ApiError, type Env } from './types';
import { allowFields, configured, cookie, emailField, guardRequest, hashPassword, newToken, rateLimit, readBody,
  secretHash, sessionToken, stringField, validatePassword, verifyBot, verifyPassword } from './security';
import { audit, authenticate, consumeChallenge, createSession, getAccount, overview, parseProfile, sendChallenge } from './accounts';
import { finishEmailChange, startEmailChange } from './email-change';
import { historyPage } from './history';
import { appointmentDetail, orderDetail, withdrawAppointment } from './customer-records';
import { appointmentCalendar } from './calendar';
import { bookingAvailability, bookingOptions, bookingSelection, requestAppointment, requireBooking } from './booking';
import { decideRequest, professionalAccess, staffQueue, staffRequest } from './staff-requests';
import { confirmMfaEnrollment, mfaStatus, startMfaEnrollment, unlockStaffMfa } from './staff-mfa';
import { reviewQueue, reviewSetup, saveSetup, setupPage } from './professional-setup';

const genericEmailMessage = 'If this email can be used for that request, a code will arrive shortly. Check your spam folder too.';
// A fixed dummy credential gives nonexistent accounts the same expensive check.
const dummyHash = `scrypt:32768:8:3:${'0'.repeat(32)}:${'0'.repeat(128)}`;

function privateHeaders(contentType = 'application/json; charset=utf-8') {
  return new Headers({ 'Content-Type': contentType, 'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", 'Vary': 'Cookie',
    'X-Robots-Tag': 'noindex, nofollow', 'Strict-Transport-Security': 'max-age=31536000' });
}
function json(data: unknown, status = 200, sessionCookie?: string) {
  const headers = privateHeaders();
  if (sessionCookie) headers.set('Set-Cookie', sessionCookie);
  if (status === 429) headers.set('Retry-After', '900');
  return new Response(JSON.stringify(data), { status, headers });
}
async function route(request: Request, env: Env): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === '/api/v1/config' && request.method === 'GET') {
    return json({ enabled: configured(env), turnstileSiteKey: configured(env) ? env.TURNSTILE_SITE_KEY : '', bookingEnabled: configured(env) && env.CUSTOMER_BOOKING_ENABLED === 'true' });
  }
  if (!configured(env)) throw new ApiError(503, 'Account access is temporarily unavailable. You can still book or call the shop.');
  guardRequest(request, env);
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  await rateLimit(env, `requests:${ip}`, 300);
  // Bound accumulation without putting raw IP addresses, emails, or codes in logs.
  await env.DB.prepare('DELETE FROM auth_rate_limits WHERE expires_at <= ?').bind(Math.floor(Date.now() / 1000)).run();
  await env.DB.prepare('DELETE FROM account_challenges WHERE expires_at <= ?').bind(new Date(Date.now() - 86400000).toISOString()).run();
  await env.DB.prepare('DELETE FROM account_email_changes WHERE expires_at <= ? OR consumed_at IS NOT NULL').bind(new Date().toISOString()).run();
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL').bind(new Date().toISOString()).run();
  await env.DB.prepare("DELETE FROM staff_mfa_enrollments WHERE julianday(expires_at)<=julianday('now')").run();
  const body = request.method === 'GET' ? {} : await readBody(request);
  const action = `${request.method} ${path}`;

  if (['POST /api/v1/auth/register', 'POST /api/v1/auth/login', 'POST /api/v1/auth/recover'].includes(action)) {
    const register = path.endsWith('/register');
    const recover = path.endsWith('/recover');
    allowFields(body, register ? ['name', 'email', 'password', 'turnstileToken', 'website'] : recover ? ['email', 'turnstileToken'] : ['email', 'password', 'turnstileToken']);
    const email = emailField(body);
    await rateLimit(env, `auth-ip:${ip}`, 20);
    await rateLimit(env, `auth-email:${email}`, 8);
    await verifyBot(request, env, body);
    const user = await env.DB.prepare(`SELECT u.id, u.email, u.email_verified_at, u.status, c.password_hash
      FROM users u JOIN account_credentials c ON c.user_id = u.id WHERE u.email = ?`)
      .bind(email).first<{ id: string; email: string; email_verified_at: string | null; status: string; password_hash: string }>();
    if (register) {
      const name = stringField(body, 'name', 100, 2);
      if (body.website) throw new ApiError(400, 'Unable to create this account.');
      validatePassword(body.password);
      const passwordHash = await hashPassword(body.password);
      if (user) return json({ challengeId: randomUUID(), message: genericEmailMessage }, 202);
      const id = randomUUID();
      const now = new Date().toISOString();
      // Conditional inserts handle concurrent registration without trusting a
      // browser-provided role, verification flag, profile ID, or password hash.
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO users(id, email, display_name, role, created_at, updated_at)
          VALUES (?, ?, ?, 'customer', ?, ?) ON CONFLICT(email) DO NOTHING`).bind(id, email, name, now, now),
        env.DB.prepare(`INSERT INTO account_credentials(user_id, password_hash, updated_at)
          SELECT id, ?, ? FROM users WHERE id = ?`).bind(passwordHash, now, id),
        env.DB.prepare(`INSERT INTO customer_profiles(user_id, created_at, updated_at)
          SELECT id, ?, ? FROM users WHERE id = ?`).bind(now, now, id),
      ]);
      const created = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
      const challengeId = created ? await sendChallenge(env, { id, email }, 'verify_email') : randomUUID();
      return json({ challengeId, message: genericEmailMessage }, 202);
    }
    if (recover) {
      const challengeId = user?.status === 'active' ? await sendChallenge(env, user, 'reset_password') : randomUUID();
      return json({ challengeId, message: genericEmailMessage }, 202);
    }
    if (typeof body.password !== 'string' || body.password.length > 128) throw new ApiError(400, 'Check your email and password.');
    const valid = await verifyPassword(body.password, user?.password_hash ?? dummyHash);
    if (!valid || !user || user.status !== 'active') throw new ApiError(401, 'The email or password is incorrect.');
    if (!user.email_verified_at) {
      return json({ challengeId: await sendChallenge(env, user, 'verify_email'), verificationRequired: true, message: 'Check your email for a verification code.' }, 202);
    }
    const sessionCookie = await createSession(env, user.id, { email: user.email, passwordHash: user.password_hash });
    await audit(env, user.id, 'signed_in').run();
    return json({ account: await getAccount(env, user.id) }, 200, sessionCookie);
  }

  if (action === 'POST /api/v1/auth/verify' || action === 'POST /api/v1/auth/reset') {
    const reset = path.endsWith('/reset');
    allowFields(body, reset ? ['challengeId', 'code', 'password'] : ['challengeId', 'code']);
    await rateLimit(env, `code:${ip}`, 30);
    const id = stringField(body, 'challengeId', 64, 1);
    const code = stringField(body, 'code', 8, 8);
    if (!/^\d{8}$/.test(code)) throw new ApiError(400, 'Enter the eight-digit code from your email.');
    let passwordHash: string | undefined;
    if (reset) { validatePassword(body.password); passwordHash = await hashPassword(body.password); }
    const proof = await consumeChallenge(env, id, code, reset ? 'reset_password' : 'verify_email', passwordHash);
    // Recovery never silently signs in. Old sessions are revoked atomically.
    if (reset) return json({ message: 'Password reset. Sign in with your new password.' }, 200, cookie('', true));
    return json({ account: await getAccount(env, proof.userId) }, 200, await createSession(env, proof.userId, proof));
  }

  if (action === 'POST /api/v1/auth/logout') {
    allowFields(body, []);
    const token = sessionToken(request);
    if (token) await env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ?')
      .bind(new Date().toISOString(), secretHash(env, token)).run();
    return json({ message: 'Signed out.' }, 200, cookie('', true));
  }
  if (!path.startsWith('/api/v1/me')) throw new ApiError(404, 'This action is not available.');
  const account = await authenticate(request, env);
  const sessionHash = secretHash(env, sessionToken(request)!);
  if (path === '/api/v1/me/mfa' && request.method === 'GET') return json(await mfaStatus(env, account.id, sessionHash));
  if (path.startsWith('/api/v1/me/mfa/') && request.method === 'POST') {
    if (path !== '/api/v1/me/mfa/lock') await rateLimit(env, `staff-mfa:${account.id}`, 10);
    if (path === '/api/v1/me/mfa/enroll/start') return json(await startMfaEnrollment(env, account.id, sessionHash, body));
    if (path === '/api/v1/me/mfa/enroll/confirm') return json(await confirmMfaEnrollment(env, account.id, sessionHash, body));
    if (path === '/api/v1/me/mfa/unlock') return json(await unlockStaffMfa(env, account.id, sessionHash, body));
    if (path === '/api/v1/me/mfa/lock') {
      allowFields(body, []);
      await env.DB.prepare('UPDATE sessions SET mfa_until=NULL,mfa_version=NULL,mfa_role=NULL WHERE token_hash=?').bind(sessionHash).run();
      return json({ message: 'Staff access locked on this device.' });
    }
    throw new ApiError(404, 'This action is not available.');
  }
  if (action === 'GET /api/v1/me') return json({ account });
  if (action === 'GET /api/v1/me/overview') return json(await overview(env, account.id));
  if (action === 'GET /api/v1/me/professional') return json(await professionalAccess(env, account.id));
  if (path.startsWith('/api/v1/me/professional/')) {
    const params = new URL(request.url).searchParams;
    if (path === '/api/v1/me/professional/setup' && params.size === 0) {
      if (request.method === 'GET') return json(await setupPage(env, account.id, sessionHash));
      if (request.method === 'POST') {
        await rateLimit(env, `professional-setup:${account.id}`, 20);
        return json(await saveSetup(env, account.id, sessionHash, body));
      }
    }
    if (path === '/api/v1/me/professional/reviews' && request.method === 'GET') {
      if ([...params.keys()].some((key) => key !== 'after') || params.getAll('after').length > 1) throw new ApiError(400, 'Refresh the review queue.');
      return json(await reviewQueue(env, account.id, sessionHash, params.get('after')));
    }
    const review = path.match(/^\/api\/v1\/me\/professional\/reviews\/([a-f0-9-]{36})$/);
    if (review && params.size === 0) {
      if (request.method === 'GET') return json(await setupPage(env, account.id, sessionHash, review[1]!));
      if (request.method === 'POST') {
        await rateLimit(env, `professional-review:${account.id}`, 10);
        return json(await reviewSetup(env, account.id, sessionHash, review[1]!, body));
      }
    }
    if (action === 'GET /api/v1/me/professional/requests') {
      if ([...params.keys()].some((key) => key !== 'cursor') || params.getAll('cursor').length > 1) throw new ApiError(400, 'This request queue is not supported.');
      return json(await staffQueue(env, account.id, sessionHash, params.get('cursor')));
    }
    const match = path.match(/^\/api\/v1\/me\/professional\/requests\/([A-Za-z0-9_-]{1,128})$/);
    if (match && params.size === 0) {
      if (request.method === 'GET') return json({ request: await staffRequest(env, account.id, sessionHash, match[1]!) });
      if (request.method === 'POST') {
        await rateLimit(env, `professional-password:${account.id}`, 10);
        return json(await decideRequest(env, account.id, secretHash(env, sessionToken(request)!), match[1]!, body));
      }
    }
    throw new ApiError(404, 'This action is not available.');
  }
  if (path.startsWith('/api/v1/me/booking/')) {
    requireBooking(env);
    const params = new URL(request.url).searchParams;
    if (action === 'GET /api/v1/me/booking/options' && params.size === 0) return json(await bookingOptions(env, account.id));
    if (action === 'GET /api/v1/me/booking/availability') {
      if ([...params.keys()].some((key) => !['staffId', 'serviceId', 'locationId', 'date'].includes(key) || params.getAll(key).length !== 1)) throw new ApiError(400, 'This availability request is not supported.');
      await rateLimit(env, `availability:${account.id}`, 60);
      return json(await bookingAvailability(env, account.id, bookingSelection(Object.fromEntries(params))));
    }
    if (action === 'POST /api/v1/me/booking/requests' && params.size === 0) {
      await rateLimit(env, `booking-request:${account.id}`, 12);
      return json(await requestAppointment(env, account.id, secretHash(env, sessionToken(request)!), body));
    }
    throw new ApiError(404, 'This action is not available.');
  }
  const record = path.match(/^\/api\/v1\/me\/(appointments|orders)\/([A-Za-z0-9_-]{1,128})(?:\/(calendar|withdraw))?$/);
  if (record) {
    const [, kind, id, operation] = record as [string, 'appointments' | 'orders', string, string | undefined];
    if (new URL(request.url).search) throw new ApiError(400, 'This record request is not supported.');
    if (request.method === 'GET' && !operation) return json(kind === 'appointments'
      ? { appointment: await appointmentDetail(env, account.id, id) } : { order: await orderDetail(env, account.id, id) });
    if (request.method === 'GET' && kind === 'appointments' && operation === 'calendar') {
      const headers = privateHeaders('text/calendar; charset=utf-8');
      headers.set('Content-Disposition', 'attachment; filename="kut-shoppe-appointment.ics"');
      return new Response(appointmentCalendar(await appointmentDetail(env, account.id, id)), { headers });
    }
    if (request.method === 'POST' && kind === 'appointments' && operation === 'withdraw') {
      allowFields(body, ['updatedAt']);
      await rateLimit(env, `withdraw-request:${account.id}`, 20);
      return json(await withdrawAppointment(env, account.id, secretHash(env, sessionToken(request)!), id, stringField(body, 'updatedAt', 40, 1)));
    }
    throw new ApiError(404, 'This action is not available.');
  }
  if (action === 'GET /api/v1/me/appointments' || action === 'GET /api/v1/me/orders') {
    const kind = path.endsWith('/appointments') ? 'appointments' : 'orders';
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some((key) => key !== 'cursor') || params.getAll('cursor').length > 1) throw new ApiError(400, 'This history request is not supported.');
    return json(await historyPage(env, account.id, kind, params.get('cursor')));
  }
  if (action === 'POST /api/v1/me/email/start') {
    allowFields(body, ['email', 'currentPassword']);
    await rateLimit(env, `password:${account.id}`, 5);
    await rateLimit(env, `email-change:${account.id}`, 3);
    const email = emailField(body);
    await rateLimit(env, `email-change-recipient:${email}`, 5);
    return json(await startEmailChange(env, account, secretHash(env, sessionToken(request)!), email, body.currentPassword), 202);
  }
  if (action === 'POST /api/v1/me/email/confirm') {
    allowFields(body, ['challengeId', 'currentCode', 'newCode']);
    await rateLimit(env, `email-change-code:${account.id}`, 15);
    const id = stringField(body, 'challengeId', 64, 1);
    const currentCode = stringField(body, 'currentCode', 8, 8);
    const newCode = stringField(body, 'newCode', 8, 8);
    if (!/^\d{8}$/.test(currentCode) || !/^\d{8}$/.test(newCode)) throw new ApiError(400, 'Enter the eight-digit code from each email.');
    await finishEmailChange(env, account.id, secretHash(env, sessionToken(request)!), id, currentCode, newCode);
    return json({ message: 'Email changed. Sign in with your new email address on each device.' }, 200, cookie('', true));
  }
  if (action === 'POST /api/v1/me/email/cancel') {
    allowFields(body, ['challengeId']);
    await env.DB.prepare('DELETE FROM account_email_changes WHERE id = ? AND user_id = ?')
      .bind(stringField(body, 'challengeId', 64, 1), account.id).run();
    return json({ message: 'Email change cancelled. Your sign-in email has not changed.' });
  }
  if (action === 'PATCH /api/v1/me/profile') {
    const profile = parseProfile(body);
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?').bind(profile.name, now, account.id),
      env.DB.prepare('UPDATE customer_profiles SET phone = ?, address_json = ?, updated_at = ? WHERE user_id = ?')
        .bind(profile.phone, JSON.stringify(profile.address), now, account.id),
      audit(env, account.id, 'profile_updated'),
    ]);
    return json({ account: await getAccount(env, account.id) });
  }
  if (action === 'POST /api/v1/me/password') {
    allowFields(body, ['currentPassword', 'password']);
    await rateLimit(env, `password:${account.id}`, 5);
    validatePassword(body.password);
    if (typeof body.currentPassword !== 'string' || body.currentPassword.length > 128) throw new ApiError(400, 'Enter your current password.');
    const credential = await env.DB.prepare('SELECT password_hash FROM account_credentials WHERE user_id = ?')
      .bind(account.id).first<{ password_hash: string }>();
    if (!credential || !await verifyPassword(body.currentPassword, credential.password_hash)) throw new ApiError(400, 'The current password is incorrect.');
    const passwordHash = await hashPassword(body.password);
    const now = new Date().toISOString();
    const results = await env.DB.batch<{ meta: { changes: number } }>([
      env.DB.prepare('UPDATE account_credentials SET password_hash = ?, updated_at = ? WHERE user_id = ? AND password_hash = ?')
        .bind(passwordHash, now, account.id, credential.password_hash),
      env.DB.prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND EXISTS
        (SELECT 1 FROM account_credentials WHERE user_id = ? AND password_hash = ?)`).bind(now, account.id, account.id, passwordHash),
      env.DB.prepare(`DELETE FROM account_email_changes WHERE user_id = ? AND EXISTS
        (SELECT 1 FROM account_credentials WHERE user_id = ? AND password_hash = ?)`).bind(account.id, account.id, passwordHash),
      env.DB.prepare(`UPDATE account_challenges SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL AND EXISTS
        (SELECT 1 FROM account_credentials WHERE user_id = ? AND password_hash = ?)`).bind(now, account.id, account.id, passwordHash),
    ]);
    if (results[0]?.meta.changes !== 1) throw new ApiError(409, 'Your account changed. Sign in again before retrying.');
    await audit(env, account.id, 'password_changed').run();
    return json({ message: 'Password changed. Sign in again on each device.' }, 200, cookie('', true));
  }
  if (action === 'POST /api/v1/me/sessions/revoke') {
    allowFields(body, []);
    await env.DB.batch([
      env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ?').bind(new Date().toISOString(), account.id),
      env.DB.prepare('DELETE FROM account_email_changes WHERE user_id = ?').bind(account.id),
      audit(env, account.id, 'all_sessions_revoked'),
    ]);
    return json({ message: 'Signed out on every device.' }, 200, cookie('', true));
  }
  throw new ApiError(404, 'This action is not available.');
}
export async function handleApi(request: Request, env: Env): Promise<Response> {
  try { return await route(request, env); }
  catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    // Never serialize exceptions, bodies, database rows, codes, or provider errors.
    const reference = newToken().slice(0, 12);
    console.error(`Account request failed (${reference})`);
    return json({ error: `We could not complete that request. Please try again. Reference: ${reference}` }, 500);
  }
}
