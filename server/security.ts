import { createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { ApiError, type Env } from './types';

export const SESSION_COOKIE = '__Host-kut-session';
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
const scryptOptions = { N: 32768, r: 8, p: 3, maxmem: 48 * 1024 * 1024 };
// OWASP's 32 MiB / p=3 scrypt profile fits Workers' 128 MiB isolate limit.
// Native Argon2 is unavailable in Workers. This is server-only code.
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, scryptOptions,
    (error, result) => error ? reject(error) : resolve(result)));
}
export function validatePassword(password: unknown): asserts password is string {
  if (typeof password !== 'string' || password.length < 15 || password.length > 128) {
    throw new ApiError(400, 'Use a password with 15 to 128 characters. A memorable phrase works well.');
  }
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:32768:8:3:${salt}:${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split(':');
  if (parts.length !== 6 || parts.slice(0, 4).join(':') !== 'scrypt:32768:8:3') return false;
  const candidate = await derive(password, parts[4]!);
  const expected = Buffer.from(parts[5]!, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
export function secretHash(env: Env, value: string) {
  return createHmac('sha256', env.AUTH_SECRET!).update(value).digest('hex');
}
export const newToken = () => randomBytes(32).toString('hex');
export const newCode = () => String(randomInt(100_000_000)).padStart(8, '0');

export function configured(env: Env) {
  return env.ACCOUNTS_ENABLED === 'true' && Boolean(env.DB && env.APP_ORIGIN &&
    env.AUTH_SECRET && env.AUTH_SECRET.length >= 32 && env.TURNSTILE_SECRET_KEY &&
    env.TURNSTILE_SITE_KEY && env.RESEND_API_KEY && env.MAIL_FROM);
}
export function guardRequest(request: Request, env: Env) {
  const url = new URL(request.url);
  let origin: URL;
  try { origin = new URL(env.APP_ORIGIN); } catch { throw new ApiError(503, 'Account access is temporarily unavailable.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  if ((!local && origin.protocol !== 'https:') || url.origin !== origin.origin) throw new ApiError(403, 'This request is not allowed.');
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new ApiError(403, 'This request is not allowed.');
  if (!['GET', 'HEAD'].includes(request.method)) {
    if (request.headers.get('Origin') !== origin.origin || request.headers.get('X-Kut-Request') !== '1') {
      throw new ApiError(403, 'Refresh this page and try again.');
    }
    if (request.headers.get('Content-Type')?.split(';')[0]?.trim() !== 'application/json') {
      throw new ApiError(415, 'Send this request as JSON.');
    }
  }
}
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('Content-Length')) > 8192) throw new ApiError(413, 'This request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'A request body is required.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) { await reader.cancel(); throw new ApiError(413, 'This request is too large.'); }
    chunks.push(value);
  }
  try {
    const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data as Record<string, unknown>;
  } catch { throw new ApiError(400, 'Check the information and try again.'); }
}
export function allowFields(body: Record<string, unknown>, fields: string[]) {
  if (Object.keys(body).some((key) => !fields.includes(key))) throw new ApiError(400, 'This request includes an unsupported field.');
}
export function stringField(body: Record<string, unknown>, field: string, max: number, min = 0) {
  const value = body[field];
  if (typeof value !== 'string' || value.trim().length < min || value.length > max || Array.from(value).some((character) => character.charCodeAt(0) < 32)) {
    throw new ApiError(400, `Check the ${field} field.`);
  }
  return value.trim();
}
export function emailField(body: Record<string, unknown>) {
  const email = stringField(body, 'email', 254, 3).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'Enter a valid email address.');
  return email;
}
export async function rateLimit(env: Env, key: string, limit: number, seconds = 900) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(`INSERT INTO auth_rate_limits(key_hash, count, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(key_hash) DO UPDATE SET
    count = CASE WHEN expires_at <= ? THEN 1 ELSE count + 1 END,
    expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END
    RETURNING count`).bind(secretHash(env, key), now + seconds, now, now).first<{ count: number }>();
  if (!row || row.count > limit) throw new ApiError(429, 'Too many attempts. Please try again in 15 minutes.');
}
export async function verifyBot(request: Request, env: Env, body: Record<string, unknown>) {
  const token = stringField(body, 'turnstileToken', 2048, 1);
  const ip = request.headers.get('CF-Connecting-IP');
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, ...(ip ? { remoteip: ip } : {}) }),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json() as { success?: boolean; hostname?: string; action?: string };
  if (!response.ok || !result.success || result.hostname !== new URL(env.APP_ORIGIN).hostname || result.action !== 'account') {
    throw new ApiError(400, 'Please complete the security check again.');
  }
}
export function cookie(token: string, clear = false) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${clear ? 0 : SESSION_SECONDS}`;
}
export function sessionToken(request: Request) {
  const cookies = (request.headers.get('Cookie') ?? '').split(';').map((part) => part.trim());
  const matches = cookies.filter((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const value = matches.length === 1 ? matches[0]!.slice(SESSION_COOKIE.length + 1) : '';
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}
