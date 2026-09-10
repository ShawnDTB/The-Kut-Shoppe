// @vitest-environment node
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleApi } from './api';
import { createSession, sendChallenge } from './accounts';
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

async function emailChange(session: string, email = 'updated@example.test') {
  const response = await request('/me/email/start', { email, currentPassword: password }, session);
  expect(response.status).toBe(202);
  const payload = await response.json();
  const codes = { challengeId: payload.challengeId as string,
    currentCode: deliveries.at(-2)!.text.match(/code is (\d{8})/)![1]!, newCode: latestCode() };
  expect(JSON.stringify(payload)).not.toContain(codes.currentCode);
  expect(JSON.stringify(payload)).not.toContain(codes.newCode);
  return codes;
}

describe('verified email changes', () => {
  it('requires the password and both inboxes, preserving identity and revoking sessions and old recovery codes', async () => {
    const alice = await seed('alice'); const second = await createSession(env, 'alice'); const bob = await seed('bob');
    const recovery = await sendChallenge(env, { id: 'alice', email: 'alice@example.test' }, 'reset_password');
    const recoveryCode = latestCode();
    expect((await request('/me/email/start', { email: 'new@example.test', currentPassword: 'wrong' }, alice)).status).toBe(400);
    const codes = await emailChange(alice, ' NEW@example.test ');
    expect(deliveries.at(-2)!.to).toEqual(['alice@example.test']);
    expect(deliveries.at(-1)!.to).toEqual(['new@example.test']);
    expect(db.sqlite.prepare('SELECT email FROM users WHERE id=?').get('alice')!.email).toBe('alice@example.test');
    const stored = db.sqlite.prepare('SELECT * FROM account_email_changes').get()!;
    expect(stored.current_code_hash).not.toBe(codes.currentCode);
    expect(stored.new_code_hash).not.toBe(codes.newCode);
    expect(codes.currentCode).not.toBe(codes.newCode);
    expect((await request('/me/email/confirm', { ...codes, currentCode: 'wrong' }, alice)).status).toBe(400);
    expect((await request('/me/email/confirm', { ...codes, currentCode: codes.newCode, newCode: codes.currentCode }, alice)).status).toBe(400);
    const result = await request('/me/email/confirm', codes, alice);
    expect(result.status).toBe(200); expect(result.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect(db.sqlite.prepare('SELECT email,role FROM users WHERE id=?').get('alice')).toEqual({ email: 'new@example.test', role: 'customer' });
    expect((await request('/me', undefined, second)).status).toBe(401);
    expect((await request('/me', undefined, bob)).status).toBe(200);
    expect((await request('/auth/reset', { challengeId: recovery, code: recoveryCode, password })).status).toBe(400);
    expect((await request('/auth/login', { email: 'alice@example.test', password, turnstileToken: 'test' })).status).toBe(401);
    const login = await request('/auth/login', { email: 'new@example.test', password, turnstileToken: 'test' });
    expect(login.status).toBe(200); expect((await login.json()).account.id).toBe('alice');
    expect((await request('/me/email/confirm', codes, login.headers.get('Set-Cookie')!)).status).toBe(400);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM audit_events WHERE action='email_changed'").get()!.n).toBe(1);
  });
  it('binds a change to its customer and initiating session, and permits explicit cancellation', async () => {
    const alice = await seed('alice'); const second = await createSession(env, 'alice'); const bob = await seed('bob');
    const codes = await emailChange(alice);
    expect((await request('/me/email/confirm', codes, bob)).status).toBe(400);
    expect((await request('/me/email/confirm', codes, second)).status).toBe(400);
    await request('/me/email/cancel', { challengeId: codes.challengeId }, bob);
    expect(db.sqlite.prepare('SELECT attempts FROM account_email_changes').get()!.attempts).toBe(0);
    expect((await request('/me/email/cancel', { challengeId: codes.challengeId }, alice)).status).toBe(200);
    expect((await request('/me/email/confirm', codes, alice)).status).toBe(400);
    expect(db.sqlite.prepare('SELECT email FROM users WHERE id=?').get('alice')!.email).toBe('alice@example.test');
  });
  it('locks after five incorrect attempts and invalidates expired or superseded requests', async () => {
    const alice = await seed('alice');
    const codes = await emailChange(alice);
    const wrong = codes.newCode === '11111111' ? '22222222' : '11111111';
    for (let i = 0; i < 5; i++) expect((await request('/me/email/confirm', { ...codes, newCode: wrong }, alice)).status).toBe(400);
    expect((await request('/me/email/confirm', codes, alice)).status).toBe(400);
    const replacement = await emailChange(alice);
    expect((await request('/me/email/confirm', codes, alice)).status).toBe(400);
    db.sqlite.prepare("UPDATE account_email_changes SET expires_at='2000-01-01T00:00:00.000Z'").run();
    expect((await request('/me/email/confirm', replacement, alice)).status).toBe(400);
  });
  it('removes pending email changes after password changes, recovery, or all-device sign-out', async () => {
    for (const action of ['password', 'reset', 'sessions/revoke']) {
      const session = await seed(action.replace('/', '-'));
      const codes = await emailChange(session, `${action.replace('/', '-')}@new.example.test`);
      if (action === 'reset') {
        const challengeId = await sendChallenge(env, { id: 'reset', email: 'reset@example.test' }, 'reset_password');
        expect((await request('/auth/reset', { challengeId, code: latestCode(), password })).status).toBe(200);
      } else expect((await request(`/me/${action}`, action === 'password' ? { currentPassword: password, password } : {}, session)).status).toBe(200);
      expect(db.sqlite.prepare('SELECT id FROM account_email_changes WHERE id=?').get(codes.challengeId)).toBeUndefined();
    }
  });
  it('does not change an email if either delivery fails', async () => {
    const alice = await seed('alice');
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ id: 'sent' })).mockResolvedValueOnce(new Response('', { status: 503 }));
    const result = await request('/me/email/start', { email: 'new@example.test', currentPassword: password }, alice);
    expect(result.status).toBe(503);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM account_email_changes').get()!.n).toBe(0);
    expect(db.sqlite.prepare('SELECT email FROM users WHERE id=?').get('alice')!.email).toBe('alice@example.test');
  });
  it('resolves a destination collision without mutating the losing account or revoking its session', async () => {
    const alice = await seed('alice'); const bob = await seed('bob');
    const first = await emailChange(alice); const second = await emailChange(bob);
    expect((await request('/me/email/confirm', first, alice)).status).toBe(200);
    expect((await request('/me/email/confirm', second, bob)).status).toBe(400);
    expect((await request('/me', undefined, bob)).status).toBe(200);
    expect(db.sqlite.prepare('SELECT email FROM users WHERE id=?').get('bob')!.email).toBe('bob@example.test');
  });
  it('does not issue challenges or sessions against stale credential/email snapshots', async () => {
    await seed('alice');
    db.sqlite.prepare("UPDATE users SET email='updated@example.test' WHERE id='alice'").run();
    await expect(sendChallenge(env, { id: 'alice', email: 'alice@example.test' }, 'reset_password')).rejects.toThrow();
    await expect(createSession(env, 'alice', { email: 'alice@example.test', passwordHash })).rejects.toThrow();
    await expect(createSession(env, 'alice', { email: 'updated@example.test', passwordHash: 'stale' })).rejects.toThrow();
    expect(deliveries).toHaveLength(0);
  });
});

describe('private paginated history', () => {
  it('reads beyond 100 records with tied/null dates and never exposes another customer or guest', async () => {
    const alice = await seed('alice'); const bob = await seed('bob');
    const now = new Date().toISOString();
    db.sqlite.prepare("INSERT INTO services(id,name,category,duration_minutes,price_cents,created_at,updated_at) VALUES ('s','Test service','test',30,2500,?,?)").run(now, now);
    const location = String(db.sqlite.prepare('SELECT id FROM locations LIMIT 1').get()!.id);
    for (let i = 0; i < 112; i++) {
      const owner = i === 110 ? 'bob' : i === 111 ? null : 'alice';
      const id = String(i).padStart(3, '0');
      db.sqlite.prepare(`INSERT INTO appointments(id,customer_user_id,guest_email,service_id,location_id,price_cents,status,starts_at,internal_note,created_at,updated_at)
        VALUES (?,?,'alice@example.test','s',?,2500,'requested',?,'PRIVATE',?,?)`).run(`a-${id}`, owner, location, i < 95 ? now : null, now, now);
      db.sqlite.prepare(`INSERT INTO orders(id,customer_user_id,status,fulfillment_type,subtotal_cents,total_cents,internal_note,created_at,updated_at)
        VALUES (?,?,'submitted','pickup',2500,2500,'PRIVATE',?,?)`).run(`o-${id}`, owner, now, now);
    }
    for (const kind of ['appointments', 'orders']) {
      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const response = await request(`/me/${kind}${cursor ? `?cursor=${cursor}` : ''}`, undefined, alice);
        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toContain('no-store');
        const page = await response.json();
        expect(page.items.length).toBeLessThanOrEqual(25);
        expect(JSON.stringify(page)).not.toMatch(/PRIVATE|alice@example/);
        expect(page.items.some((row: { id: string }) => row.id.endsWith('110') || row.id.endsWith('111'))).toBe(false);
        seen.push(...page.items.map((row: { id: string }) => row.id));
        cursor = page.nextCursor;
        if (cursor && seen.length === 25) {
          expect((await request(`/me/${kind}?cursor=${cursor}`, undefined, bob)).status).toBe(400);
          expect((await request(`/me/${kind === 'orders' ? 'appointments' : 'orders'}?cursor=${cursor}`, undefined, alice)).status).toBe(400);
          expect((await request(`/me/${kind}?cursor=${cursor}bad`, undefined, alice)).status).toBe(400);
        }
      } while (cursor);
      expect(seen).toHaveLength(110); expect(new Set(seen).size).toBe(110);
    }
    expect((await request('/me/orders?customerId=bob', undefined, alice)).status).toBe(400);
    expect((await request('/me/orders?cursor=&cursor=x', undefined, alice)).status).toBe(400);
    for (const [table, sort, index] of [['appointments', "COALESCE(starts_at, '')", 'appointments_customer_history_idx'], ['orders', 'created_at', 'orders_customer_history_idx']]) {
      const plan = db.sqlite.prepare(`EXPLAIN QUERY PLAN SELECT id FROM ${table} WHERE customer_user_id=? AND (${sort}, id) < (?,?) ORDER BY ${sort} DESC, id DESC LIMIT 26`).all('alice', now, 'o-050');
      expect(JSON.stringify(plan)).toContain(index);
      expect(JSON.stringify(plan)).not.toContain('TEMP B-TREE');
    }
  });
});
function seedRecords(owner: string | null = 'alice') {
  const now = new Date().toISOString();
  db.sqlite.prepare("INSERT OR IGNORE INTO services(id,name,category,duration_minutes,price_cents,created_at,updated_at) VALUES ('detail-service','Test service','test',30,2500,?,?)").run(now, now);
  const location = String(db.sqlite.prepare('SELECT id FROM locations LIMIT 1').get()!.id);
  db.sqlite.prepare(`INSERT INTO appointments(id,customer_user_id,service_id,location_id,price_cents,status,source,customer_note,internal_note,created_at,updated_at)
    VALUES ('detail-appointment',?,'detail-service',?,2500,'requested','website','My private note','SECRET',?,?)`).run(owner, location, now, now);
  db.sqlite.prepare(`INSERT INTO orders(id,customer_user_id,status,fulfillment_type,subtotal_cents,total_cents,internal_note,created_at,updated_at)
    VALUES ('detail-order',?,'submitted','shipping',2500,2700,'SECRET',?,?)`).run(owner, now, now);
  return now;
}
describe('customer record details', () => {
  it('isolates details, downloads, and mutations even for an owner role', async () => {
    const alice = await seed('alice'); const owner = await seed('owner', 'owner'); seedRecords();
    for (const kind of ['appointments', 'orders']) {
      const id = kind === 'orders' ? 'detail-order' : 'detail-appointment';
      const own = await request(`/me/${kind}/${id}`, undefined, alice);
      expect(own.status).toBe(200); expect(own.headers.get('Cache-Control')).toContain('no-store');
      expect(await own.text()).not.toMatch(/SECRET|customer_user_id|internal_note|payment_reference/);
      const foreign = await request(`/me/${kind}/${id}`, undefined, owner);
      const missing = await request(`/me/${kind}/missing`, undefined, owner);
      expect(foreign.status).toBe(404); expect(await foreign.text()).toBe(await missing.text());
      expect((await request(`/me/${kind}/${id}`)).status).toBe(401);
      expect((await request(`/me/${kind}/${id}?customerId=alice`, undefined, alice)).status).toBe(400);
    }
    expect((await request('/me/appointments/detail-appointment/calendar', undefined, owner)).status).toBe(404);
    expect((await request('/me/appointments/detail-appointment/withdraw', { updatedAt: 'old' }, owner)).status).toBe(404);
    db.sqlite.exec('UPDATE appointments SET customer_user_id=NULL; UPDATE orders SET customer_user_id=NULL');
    expect((await request('/me/appointments/detail-appointment', undefined, alice)).status).toBe(404);
    expect((await request('/me/orders/detail-order', undefined, alice)).status).toBe(404);
  });
  it('withdraws once, rejects stale views and unsupported appointment transitions', async () => {
    const alice = await seed('alice'); const updatedAt = seedRecords();
    const path = '/me/appointments/detail-appointment/withdraw';
    expect((await request(path, { updatedAt: 'stale' }, alice)).status).toBe(409);
    expect((await request(path, { updatedAt, customerId: 'alice' }, alice)).status).toBe(400);
    for (const status of ['confirmed', 'reschedule_proposed', 'completed', 'cancelled', 'declined', 'checked_in', 'in_service', 'no_show']) {
      db.sqlite.prepare('UPDATE appointments SET status=?').run(status);
      expect((await request(path, { updatedAt }, alice)).status).toBe(409);
    }
    db.sqlite.exec("UPDATE appointments SET status='requested', source='staff'");
    expect((await request(path, { updatedAt }, alice)).status).toBe(409);
    db.sqlite.exec("UPDATE appointments SET source='website', starts_at='2000-01-01T00:00:00Z'");
    expect((await request(path, { updatedAt }, alice)).status).toBe(409);
    db.sqlite.exec("UPDATE appointments SET starts_at=NULL, status='waitlisted'");
    expect((await request(path, { updatedAt }, alice)).status).toBe(200);
    expect((await request(path, { updatedAt }, alice)).status).toBe(200);
    expect(db.sqlite.prepare('SELECT status FROM appointments').get()!.status).toBe('cancelled');
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM appointment_events WHERE event_type='customer_withdrew_request'").get()!.n).toBe(1);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM audit_events WHERE action='customer_withdrew_request'").get()!.n).toBe(1);
  });
  it('rolls back withdrawal when its audit transaction cannot complete', async () => {
    const alice = await seed('alice'); const updatedAt = seedRecords();
    db.sqlite.exec("CREATE TRIGGER reject_event BEFORE INSERT ON appointment_events BEGIN SELECT RAISE(ABORT, 'test failure'); END;");
    expect((await request('/me/appointments/detail-appointment/withdraw', { updatedAt }, alice)).status).toBe(500);
    expect(db.sqlite.prepare('SELECT status, customer_withdrawal_id FROM appointments').get()).toEqual({ status: 'requested', customer_withdrawal_id: null });
  });
  it('exports only confirmed calendar times, escapes labels, and excludes personal data', async () => {
    const alice = await seed('alice'); seedRecords();
    const path = '/me/appointments/detail-appointment/calendar';
    expect((await request(path, undefined, alice)).status).toBe(409);
    db.sqlite.exec("UPDATE appointments SET status='confirmed', starts_at='2027-11-07T01:30:00-04:00', ends_at='2027-11-07T01:30:00-05:00'");
    db.sqlite.prepare('UPDATE services SET name=?').run('剪'.repeat(80) + '\r\nBEGIN:VEVENT\r\nATTENDEE:secret;comma,slash\\');
    const response = await request(path, undefined, alice);
    expect(response.status).toBe(200); expect(response.headers.get('Content-Type')).toContain('text/calendar');
    expect(response.headers.get('Content-Disposition')).toContain('attachment'); expect(response.headers.get('Cache-Control')).toContain('no-store');
    const raw = await response.text(); const unfolded = raw.replace(/\r\n /g, '');
    expect(unfolded).toContain('DTSTART:20271107T053000Z\r\nDTEND:20271107T063000Z');
    expect(unfolded.match(/^BEGIN:VEVENT$/gm)).toHaveLength(1);
    expect(unfolded).toContain('\\nATTENDEE:secret\\;comma\\,slash\\\\');
    expect(unfolded).not.toMatch(/My private note|SECRET|alice@example|^ATTENDEE:/m);
    for (const line of raw.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    for (const end of [null, 'invalid', '2028-01-01', '2028-01-01T12:00:00', '2020-01-01T00:00:00Z']) {
      db.sqlite.prepare('UPDATE appointments SET ends_at=?').run(end);
      expect((await request(path, undefined, alice)).status).toBe(409);
    }
  });
  it('returns saved order amounts and only allowlisted shipping fields', async () => {
    const alice = await seed('alice'); seedRecords();
    db.sqlite.prepare('UPDATE orders SET shipping_address_json=?').run(JSON.stringify({ line1: '1 Test St', city: 'Test', state: 'PA', postalCode: '12345', secret: 'SECRET' }));
    const read = async () => (await (await request('/me/orders/detail-order', undefined, alice)).json()).order;
    const order = await read();
    expect(order.totalCents).toBe(2700); expect(order.subtotalCents).toBe(2500);
    expect(order.shippingAddress).toEqual({ line1: '1 Test St', line2: '', city: 'Test', state: 'PA', postalCode: '12345' });
    expect(order.itemsComplete).toBe(true); expect(order.items).toEqual([]);
    const now = new Date().toISOString();
    db.sqlite.prepare("INSERT INTO products(id,name,slug,category,description,base_sku,created_at,updated_at) VALUES ('p','Current name','p','test','test','p',?,?)").run(now, now);
    db.sqlite.prepare("INSERT INTO product_variants(id,product_id,name,sku,price_cents,created_at,updated_at) VALUES ('v','p','Current variant','v',9999,?,?)").run(now, now);
    for (let i = 0; i < 101; i++) db.sqlite.prepare("INSERT INTO order_items(id,order_id,variant_id,product_name,variant_name,sku,quantity,unit_price_cents,created_at) VALUES (?,'detail-order','v','Saved name','Saved variant','PRIVATE-SKU',2,1250,?)").run(`item-${String(i).padStart(3, '0')}`, now);
    const detailed = await read();
    expect(detailed.items).toHaveLength(100); expect(detailed.itemsComplete).toBe(false);
    expect(detailed.items[0]).toEqual({ id: 'item-000', productName: 'Saved name', variantName: 'Saved variant', quantity: 2, unitPriceCents: 1250 });
    expect(JSON.stringify(detailed)).not.toMatch(/Current name|PRIVATE-SKU|9999/);
    expect(detailed.totalCents).toBe(2700);
    db.sqlite.exec("UPDATE orders SET shipping_address_json='invalid'"); expect((await read()).shippingAddress).toBeNull();
    db.sqlite.exec("UPDATE orders SET fulfillment_type='pickup', shipping_address_json='{}'"); expect((await read()).shippingAddress).toBeNull();
  });
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
