// @vitest-environment node
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleApi } from './api';
import { createSession } from './accounts';
import { hashPassword, secretHash, verifyPassword } from './security';
import { canChangeRole } from './permissions';
import type { Database, Env, Statement } from './types';

// Actual SQLite executes the repository migrations and every API query. Only
// network delivery/bot services are replaced; authorization is never mocked.
class SqliteDatabase implements Database {
  readonly sqlite = new DatabaseSync(':memory:');
  prepare(sql: string): Statement {
    let values: SQLInputValue[] = [];
    const statement: Statement = {
      bind: (...next) => { values = next as SQLInputValue[]; return statement; },
      first: async <T>() => this.sqlite.prepare(sql).get(...values) as T ?? null,
      all: async <T>() => ({ results: this.sqlite.prepare(sql).all(...values) as T[] }),
      run: async () => ({ meta: { changes: Number(this.sqlite.prepare(sql).run(...values).changes) } }),
    };
    return statement;
  }
  async batch<T>(statements: Statement[]): Promise<T[]> {
    this.sqlite.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) {
        const { results: rows } = await statement.all();
        const { changes } = this.sqlite.prepare('SELECT changes() AS changes').get()!;
        results.push({ results: rows, meta: { changes: Number(changes) } });
      }
      this.sqlite.exec('COMMIT');
      return results as T[];
    } catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
}
let db: SqliteDatabase;
let env: Env;
let passwordHash: string;
const password = 'My long test passphrase 42';
const origin = 'https://accounts.example.test';
let deliveries: { to: string[]; text: string }[];
beforeAll(async () => { passwordHash = await hashPassword(password); });
beforeEach(() => {
  db = new SqliteDatabase();
  for (const file of readdirSync('migrations').filter((name) => name.endsWith('.sql')).sort()) db.sqlite.exec(readFileSync(`migrations/${file}`, 'utf8'));
  env = { DB: db, APP_ORIGIN: origin, ACCOUNTS_ENABLED: 'true', AUTH_SECRET: 'test-only-secret-with-more-than-32-characters',
    TURNSTILE_SECRET_KEY: 'test-only', TURNSTILE_SITE_KEY: 'test-only', RESEND_API_KEY: 'test-only', MAIL_FROM: 'Test <no-reply@example.test>' };
  deliveries = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    if (url.includes('siteverify')) return Response.json({ success: true, hostname: 'accounts.example.test', action: 'account' });
    if (url === 'https://api.resend.com/emails') { deliveries.push(JSON.parse(String(init.body))); return Response.json({ id: 'test-email' }); }
    throw new Error('Unexpected network request');
  }));
});
afterEach(() => { db.sqlite.close(); vi.unstubAllGlobals(); });

function request(path: string, body?: unknown, session = '', method = body === undefined ? 'GET' : 'POST', headers: Record<string, string> = {}) {
  return handleApi(new Request(`${origin}/api/v1${path}`, { method,
    headers: { Origin: origin, 'X-Kut-Request': '1', 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...(session ? { Cookie: session.split(';')[0]! } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body) }), env);
}
async function seed(id: string, role = 'customer', verified = true) {
  const now = new Date().toISOString();
  db.sqlite.prepare('INSERT INTO users(id,email,display_name,role,email_verified_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, `${id}@example.test`, `Customer ${id}`, role, verified ? now : null, now, now);
  db.sqlite.prepare('INSERT INTO customer_profiles(user_id,created_at,updated_at) VALUES (?,?,?)').run(id, now, now);
  db.sqlite.prepare('INSERT INTO account_credentials(user_id,password_hash,updated_at) VALUES (?,?,?)').run(id, passwordHash, now);
  return verified ? createSession(env, id) : '';
}
function latestCode() { return deliveries.at(-1)!.text.match(/code is (\d{8})/)![1]!; }
async function register(email = 'new@example.test') {
  const response = await request('/auth/register', { name: 'New Customer', email, password, turnstileToken: 'test-token', website: '' });
  expect(response.status).toBe(202);
  return await response.json() as { challengeId: string };
}

describe('customer account security boundary', () => {
  it('fails closed when disabled or missing a secret, with no prototype fallback', async () => {
    env.ACCOUNTS_ENABLED = 'false';
    expect(await (await request('/config')).json()).toEqual({ enabled: false, turnstileSiteKey: '' });
    expect((await request('/auth/login', {})).status).toBe(503);
    env.ACCOUNTS_ENABLED = 'true'; env.AUTH_SECRET = '';
    expect((await request('/me')).status).toBe(503);
  });
  it('requires a valid cookie, and never accepts an account ID or bearer token as identity', async () => {
    await seed('alice');
    const variants: Record<string, string>[] = [{}, { Authorization: 'Bearer alice' }, { Cookie: '__Host-kut-session=alice' }, { 'X-User-ID': 'alice', 'X-Role': 'owner' }];
    for (const headers of variants) {
      expect((await request('/me?accountId=alice', undefined, '', 'GET', headers)).status).toBe(401);
    }
  });
  it('returns only safe account fields with private no-store headers', async () => {
    const session = await seed('alice');
    const response = await request('/me', undefined, session);
    expect(response.status).toBe(200);
    const { account } = await response.json();
    expect(account.id).toBe('alice');
    expect(account.passwordHash).toBeUndefined();
    expect(JSON.stringify(account)).not.toContain(passwordHash);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
  it('protects mutations against cross-site origins, missing CSRF headers, and non-JSON bodies', async () => {
    const session = await seed('alice');
    expect((await request('/auth/logout', {}, session, 'POST', { Origin: 'https://attacker.test' })).status).toBe(403);
    expect((await request('/auth/logout', {}, session, 'POST', { 'X-Kut-Request': '' })).status).toBe(403);
    expect((await request('/auth/logout', {}, session, 'POST', { 'Content-Type': 'text/plain' })).status).toBe(415);
    expect((await request('/me', undefined, session, 'GET', { 'Sec-Fetch-Site': 'cross-site' })).status).toBe(403);
    expect((await request('/auth/logout', {}, session, 'POST', { 'Content-Length': '9000' })).status).toBe(413);
  });
  it('rejects client-controlled roles, IDs, verification flags, and prototype password hashes', async () => {
    const session = await seed('alice');
    for (const extra of [{ role: 'owner' }, { userId: 'bob' }, { emailVerified: true }, { passwordHash }]) {
      expect((await request('/me/profile', { name: 'Alice New', phone: '', address: { line1: '', line2: '', city: '', state: '', postalCode: '' }, ...extra }, session, 'PATCH')).status).toBe(400);
    }
    expect((await request('/auth/register', { name: 'Mallory', email: 'm@example.test', password, role: 'owner', turnstileToken: 'x' })).status).toBe(400);
    expect(db.sqlite.prepare('SELECT role FROM users WHERE id=?').get('alice')!.role).toBe('customer');
  });
  it('keeps appointment and order history attached to the account after contact changes', async () => {
    const session = await seed('alice'); await seed('bob');
    const now = new Date().toISOString();
    db.sqlite.prepare("INSERT INTO services(id,name,category,duration_minutes,price_cents,created_at,updated_at) VALUES ('s','Test service','test',30,2500,?,?)").run(now, now);
    const location = String(db.sqlite.prepare('SELECT id FROM locations LIMIT 1').get()!.id);
    for (const id of ['alice', 'bob']) {
      db.sqlite.prepare(`INSERT INTO appointments(id,customer_user_id,service_id,location_id,price_cents,status,internal_note,created_at,updated_at)
        VALUES (?,?,'s',?,2500,'requested','PRIVATE STAFF NOTE',?,?)`).run(`a-${id}`, id, location, now, now);
      db.sqlite.prepare(`INSERT INTO orders(id,customer_user_id,status,fulfillment_type,subtotal_cents,total_cents,internal_note,created_at,updated_at)
        VALUES (?,?,'submitted','pickup',2500,2500,'PRIVATE ORDER NOTE',?,?)`).run(`o-${id}`, id, now, now);
    }
    const result = await request('/me/profile', { name: 'Alice Changed', phone: '570-555-0101', address: { line1: '', line2: '', city: '', state: '', postalCode: '' } }, session, 'PATCH');
    expect(result.status).toBe(200);
    const data = await (await request('/me/overview?customerId=bob', undefined, session)).json();
    expect(data.appointments.map((row: { id: string }) => row.id)).toEqual(['a-alice']);
    expect(data.orders.map((row: { id: string }) => row.id)).toEqual(['o-alice']);
    expect(JSON.stringify(data)).not.toMatch(/bob|PRIVATE/);
    expect((await request('/me/profile', { name: 'Alice', phone: '', address: { line1: 'Partial', line2: '', city: '', state: '', postalCode: '' } }, session, 'PATCH')).status).toBe(400);
  });
  it('enforces expiry, revocation, suspension, email verification, and shorter staff idle time', async () => {
    const session = await seed('alice');
    db.sqlite.prepare("UPDATE sessions SET expires_at='2000-01-01T00:00:00.000Z'").run();
    expect((await request('/me', undefined, session)).status).toBe(401);
    const active = await createSession(env, 'alice');
    db.sqlite.prepare("UPDATE users SET status='suspended' WHERE id='alice'").run();
    expect((await request('/me', undefined, active)).status).toBe(401);
    const staff = await seed('owner', 'owner');
    db.sqlite.prepare("UPDATE sessions SET last_seen_at=? WHERE user_id='owner'").run(new Date(Date.now() - 31 * 60000).toISOString());
    expect((await request('/me', undefined, staff)).status).toBe(401);
    await seed('unverified', 'customer', false);
    await expect(createSession(env, 'unverified')).rejects.toThrow();
  });
  it('revokes all devices and leaves other customers signed in', async () => {
    const first = await seed('alice'); const second = await createSession(env, 'alice'); const bob = await seed('bob');
    const result = await request('/me/sessions/revoke', {}, first);
    expect(result.status).toBe(200); expect(result.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect((await request('/me', undefined, first)).status).toBe(401);
    expect((await request('/me', undefined, second)).status).toBe(401);
    expect((await request('/me', undefined, bob)).status).toBe(200);
  });
  it('keeps staff/admin APIs closed until their protected workflows exist', async () => {
    const owner = await seed('owner', 'owner');
    expect((await request('/admin/users', undefined, owner)).status).toBe(404);
    expect((await request('/staff/appointments', undefined, owner)).status).toBe(404);
    expect(canChangeRole('manager', 'owner', 'customer', false)).toBe(false);
    expect(canChangeRole('customer', 'customer', 'barber', false)).toBe(false);
    expect(canChangeRole('owner', 'customer', 'barber', false)).toBe(true);
    expect(canChangeRole('owner', 'owner', 'customer', true)).toBe(false);
  });
});

describe('authentication and recovery', () => {
  it('registers, verifies once, signs in on a second device, and logs out with hardened cookies', async () => {
    const { challengeId } = await register();
    const code = latestCode();
    const row = db.sqlite.prepare('SELECT code_hash FROM account_challenges WHERE id=?').get(challengeId)!;
    expect(row.code_hash).not.toBe(code);
    const verified = await request('/auth/verify', { challengeId, code });
    expect(verified.status).toBe(200);
    const session = verified.headers.get('Set-Cookie')!;
    for (const flag of ['__Host-kut-session=', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) expect(session).toContain(flag);
    const rawToken = session.split(';')[0]!.split('=')[1]!;
    const stored = db.sqlite.prepare('SELECT token_hash FROM sessions').get()!;
    expect(stored.token_hash).toBe(secretHash(env, rawToken));
    expect(stored.token_hash).not.toBe(rawToken);
    expect((await request('/auth/verify', { challengeId, code })).status).toBe(400);
    const login = await request('/auth/login', { email: 'new@example.test', password, turnstileToken: 'test-token' });
    expect(login.status).toBe(200);
    expect(login.headers.get('Set-Cookie')).not.toBe(session);
    expect((await request('/auth/logout', {}, session)).status).toBe(200);
    expect((await request('/me', undefined, session)).status).toBe(401);
  });
  it('rejects invalid bot verification and bounds incorrect code attempts', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ success: false }));
    expect((await request('/auth/register', { name: 'Bot', email: 'bot@example.test', password, turnstileToken: 'bad' })).status).toBe(400);
    const { challengeId } = await register();
    const correct = latestCode();
    const wrong = correct === '11111111' ? '22222222' : '11111111';
    for (let i = 0; i < 5; i++) expect((await request('/auth/verify', { challengeId, code: wrong })).status).toBe(400);
    expect((await request('/auth/verify', { challengeId, code: correct })).status).toBe(400);
    expect(db.sqlite.prepare('SELECT attempts FROM account_challenges WHERE id=?').get(challengeId)!.attempts).toBe(5);
  });
  it('invalidates expired codes and never includes codes in API responses', async () => {
    const { challengeId } = await register();
    const code = latestCode();
    db.sqlite.prepare("UPDATE account_challenges SET expires_at='2000-01-01T00:00:00.000Z'").run();
    const result = await request('/auth/verify', { challengeId, code });
    expect(result.status).toBe(400); expect(await result.text()).not.toContain(code);
  });
  it('recovers a password, revokes previous sessions, and requires a new sign-in', async () => {
    const session = await seed('alice');
    const recovery = await request('/auth/recover', { email: 'alice@example.test', turnstileToken: 'test-token' });
    const { challengeId } = await recovery.json(); const code = latestCode();
    const result = await request('/auth/reset', { challengeId, code, password: 'A completely new test passphrase' });
    expect(result.status).toBe(200);
    expect(result.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect((await request('/me', undefined, session)).status).toBe(401);
    expect((await request('/auth/reset', { challengeId, code, password })).status).toBe(400);
    expect((await request('/auth/login', { email: 'alice@example.test', password, turnstileToken: 'test-token' })).status).toBe(401);
    expect((await request('/auth/login', { email: 'alice@example.test', password: 'A completely new test passphrase', turnstileToken: 'test-token' })).status).toBe(200);
  });
  it('requires the current password to change it, then revokes every old session', async () => {
    const session = await seed('alice');
    expect((await request('/me/password', { currentPassword: 'wrong', password }, session)).status).toBe(400);
    const result = await request('/me/password', { currentPassword: password, password: 'Changed to a new test passphrase' }, session);
    expect(result.status).toBe(200);
    expect((await request('/me', undefined, session)).status).toBe(401);
    expect(await verifyPassword(password, db.sqlite.prepare('SELECT password_hash FROM account_credentials WHERE user_id=?').get('alice')!.password_hash as string)).toBe(false);
  });
  it('throttles repeated authentication requests before expensive password checks', async () => {
    await seed('alice');
    for (let i = 0; i < 8; i++) await request('/auth/recover', { email: 'alice@example.test', turnstileToken: 'test-token' });
    const response = await request('/auth/recover', { email: 'alice@example.test', turnstileToken: 'test-token' });
    expect(response.status).toBe(429); expect(response.headers.get('Retry-After')).toBe('900');
    expect(deliveries).toHaveLength(8);
  });
  it('reports delivery failure honestly and leaves no usable challenge', async () => {
    await seed('alice');
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ success: true, hostname: 'accounts.example.test', action: 'account' })).mockResolvedValueOnce(new Response('', { status: 503 }));
    const result = await request('/auth/recover', { email: 'alice@example.test', turnstileToken: 'test-token' });
    expect(result.status).toBe(503);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM account_challenges').get()!.n).toBe(0);
  });
});
