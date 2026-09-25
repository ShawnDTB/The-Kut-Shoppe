// @vitest-environment node
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleApi } from './api';
import { createSession, sendChallenge } from './accounts';
import { hashPassword, secretHash, verifyPassword } from './security';
import { canChangeRole } from './permissions';
import type { Database, Env, Statement } from './types';
import { wallWindow, localDate } from './booking-time';
import { deliverAppointmentNotifications } from './appointment-notifications';
import { totp } from './totp';
import type { EstimateInput } from '../src/shared/sales';

// Integration tests intentionally run real password hashing and all migrations.
// Allow slower shared CI/preview CPUs without weakening application timeouts.
vi.setConfig({ testTimeout: 15_000 });

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
    MFA_ENCRYPTION_KEY: '12'.repeat(32),
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
  it('builds an owner-scoped dashboard with uncapped counts and the nearest active visit', async () => {
    const alice = await seed('alice'); const bob = await seed('bob');
    const now = new Date().toISOString(); const future = new Date(Date.now() + 86400000).toISOString(); const later = new Date(Date.now() + 2 * 86400000).toISOString();
    db.sqlite.prepare("INSERT INTO services(id,name,category,duration_minutes,price_cents,created_at,updated_at) VALUES ('s','Test service','test',30,2500,?,?)").run(now, now);
    const location = String(db.sqlite.prepare('SELECT id FROM locations LIMIT 1').get()!.id);
    const insert = db.sqlite.prepare("INSERT INTO appointments(id,customer_user_id,service_id,location_id,price_cents,status,starts_at,ends_at,customer_note,internal_note,created_at,updated_at) VALUES (?,?,'s',?,2500,?,?,?,'PRIVATE CUSTOMER','PRIVATE STAFF',?,?)");
    for (let index = 0; index < 105; index++) insert.run(`pending-${index}`, 'alice', location, 'requested', future, later, now, now);
    insert.run('nearest', 'alice', location, 'confirmed', future, later, now, now);
    insert.run('completed', 'alice', location, 'completed', now, now, now, now);
    insert.run('foreign', 'bob', location, 'confirmed', now, later, now, now);
    const response = await request('/me/dashboard', undefined, alice); expect(response.status).toBe(200);
    const data = await response.json(); expect(data.counts).toEqual({ upcoming: 1, pending: 105, completed: 1, orders: 0 });
    expect(data.nextVisit.id).toBe('nearest'); expect(data.recentAppointments).toHaveLength(4); expect(JSON.stringify(data)).not.toMatch(/PRIVATE|foreign|password|email/);
    expect((await (await request('/me/dashboard', undefined, bob)).json()).nextVisit.id).toBe('foreign');
    db.sqlite.prepare("UPDATE users SET role='owner' WHERE id='alice'").run();
    expect((await (await request('/me/dashboard', undefined, alice)).json()).counts.pending).toBe(105);
    // Older records updated today must surface, including cancellation and
    // proposed-time decisions; one appointment is counted only once.
    const updated = new Date(Date.now() + 1000).toISOString();
    db.sqlite.prepare("UPDATE appointments SET created_at='2020-01-01T00:00:00Z',updated_at=?,cancellation_state='pending' WHERE id='nearest'").run(updated);
    db.sqlite.prepare("UPDATE appointments SET status='reschedule_proposed',cancellation_state='pending' WHERE id='pending-0'").run();
    db.sqlite.prepare("UPDATE appointments SET cancellation_state='pending' WHERE id='foreign'").run();
    const insertOrder = db.sqlite.prepare("INSERT INTO orders(id,customer_user_id,status,fulfillment_type,subtotal_cents,total_cents,internal_note,created_at,updated_at) VALUES (?,?,'ready_for_pickup','pickup',1500,1500,'PRIVATE',?,?)");
    for (let index = 0; index < 5; index++) insertOrder.run(`pickup-${index}`, 'alice', now, now);
    insertOrder.run('foreign-order', 'bob', now, updated); insertOrder.run('guest-order', null, now, updated);
    db.sqlite.prepare("UPDATE orders SET created_at='2020-01-01T00:00:00Z',updated_at=? WHERE id='pickup-0'").run(updated);
    const attention = await (await request('/me/dashboard', undefined, alice)).json();
    expect(attention.counts.pending).toBe(106); expect(attention.counts.orders).toBe(5);
    expect(attention.pendingAppointments).toHaveLength(4);
    expect(attention.pendingAppointments[0]).toMatchObject({ id: 'nearest', cancellationState: 'pending', status: 'confirmed' });
    expect(attention.recentAppointments[0]).toMatchObject({ id: 'nearest', timeZone: 'America/New_York' });
    expect(attention.recentOrders[0].id).toBe('pickup-0');
    expect(attention.readyOrderCount).toBe(5); expect(attention.readyOrders).toHaveLength(3);
    expect(JSON.stringify(attention)).not.toMatch(/PRIVATE|foreign|guest-order|password|email/);
    db.sqlite.prepare("UPDATE appointments SET cancellation_state='declined' WHERE id='nearest'").run();
    expect((await (await request('/me/dashboard', undefined, alice)).json()).counts.pending).toBe(105);
    expect((await request('/me/dashboard?user=bob', undefined, alice)).status).toBe(400);
    expect((await request('/me/dashboard')).status).toBe(401);
  });
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
async function seedBooking() {
  const alice = await seed('alice'); await seed('professional', 'staff');
  const now = new Date().toISOString();
  const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const locationId = String(db.sqlite.prepare('SELECT id FROM locations LIMIT 1').get()!.id);
  db.sqlite.prepare(`INSERT INTO staff_profiles(id,user_id,professional_name,public_slug,setup_status,booking_buffer_minutes,created_at,updated_at)
    VALUES ('book-staff','professional','Test professional','book-staff','approved',15,?,?)`).run(now, now);
  db.sqlite.prepare("INSERT INTO staff_locations(staff_id,location_id,created_at) VALUES ('book-staff',?,?)").run(locationId, now);
  db.sqlite.prepare("INSERT INTO services(id,name,category,duration_minutes,price_cents,created_at,updated_at) VALUES ('book-service','Test cut','test',30,2500,?,?)").run(now, now);
  db.sqlite.prepare("INSERT INTO staff_services(staff_id,service_id,custom_duration_minutes,custom_price_cents,created_at,updated_at) VALUES ('book-staff','book-service',45,3200,?,?)").run(now, now);
  db.sqlite.prepare("INSERT INTO weekly_availability(id,staff_id,location_id,weekday,start_time,end_time,created_at,updated_at) VALUES ('book-hours','book-staff',?,?,'09:00','17:00',?,?)").run(locationId, new Date(`${date}T00:00:00Z`).getUTCDay(), now, now);
  env.CUSTOMER_BOOKING_ENABLED = 'true';
  const selection = { staffId: 'book-staff', serviceId: 'book-service', locationId, date };
  const path = `/me/booking/availability?${new URLSearchParams(selection)}`;
  const available = async () => {
    const result = await request(path, undefined, alice); expect(result.status).toBe(200); return result.json();
  };
  const page = await available();
  const payload = { ...selection, startsAt: page.slots[0].startsAt, quote: page.quote, note: 'A test note', requestKey: randomUUID() };
  return { alice, date, locationId, path, available, payload };
}
describe('server customer booking', () => {
  it('stays disabled by default and lists only approved eligible services', async () => {
    const { alice } = await seedBooking();
    delete env.CUSTOMER_BOOKING_ENABLED;
    expect((await request('/me/booking/options', undefined, alice)).status).toBe(503);
    expect((await request('/config')).status).toBe(200);
    env.CUSTOMER_BOOKING_ENABLED = 'true';
    expect((await request('/me/booking/options')).status).toBe(401);
    const options = await (await request('/me/booking/options', undefined, alice)).json();
    expect(options.options).toHaveLength(1); expect(options.options[0].priceCents).toBe(3200);
    expect(JSON.stringify(options)).not.toMatch(/professional@example|user_id|bufferMinutes|noticeHours/);
    db.sqlite.exec("UPDATE staff_profiles SET setup_status='pending_review'");
    expect((await (await request('/me/booking/options', undefined, alice)).json()).options).toEqual([]);
    db.sqlite.exec("UPDATE staff_profiles SET setup_status='approved',accepts_new_clients=0");
    expect((await (await request('/me/booking/options', undefined, alice)).json()).options).toEqual([]);
  });
  it('uses saved service overrides, buffers, blocks, and active holds without exposing private records', async () => {
    const { date, available, locationId } = await seedBooking();
    let page = await available(); expect(page.slots).toHaveLength(29);
    const opening = wallWindow(date, '09:00', '17:00', 'America/New_York')!;
    const iso = (minutes: number) => new Date(opening.start + minutes * 60000).toISOString();
    expect(page.slots[0]).toEqual({ startsAt: iso(0), endsAt: iso(45) });
    const now = new Date().toISOString();
    db.sqlite.prepare(`INSERT INTO schedule_exceptions(id,staff_id,starts_at,ends_at,exception_type,note,created_by_user_id,created_at,updated_at)
      VALUES ('block','book-staff',?,?,'break','PRIVATE BLOCK','professional',?,?)`).run(iso(60), iso(120), now, now);
    db.sqlite.prepare(`INSERT INTO appointment_holds(id,staff_id,service_id,location_id,starts_at,ends_at,customer_email,expires_at,created_at)
      VALUES ('hold','book-staff','book-service',?,?,?,'PRIVATE EMAIL',?,?)`).run(locationId, iso(180), iso(210), new Date(Date.now() + 600000).toISOString(), now);
    page = await available();
    expect(page.slots.some((slot: { startsAt: string }) => slot.startsAt === iso(0))).toBe(true);
    expect(page.slots.some((slot: { startsAt: string }) => slot.startsAt === iso(15))).toBe(false);
    expect(page.slots.some((slot: { startsAt: string }) => slot.startsAt === iso(165))).toBe(false);
    expect(JSON.stringify(page)).not.toMatch(/PRIVATE|customer_email|hold|break/);
    db.sqlite.exec("UPDATE appointment_holds SET expires_at='2000-01-01T00:00:00Z'");
    expect((await available()).slots.some((slot: { startsAt: string }) => slot.startsAt === iso(165))).toBe(true);
  });
  it('rejects bad dates, closed services, out-of-window dates and changed quotes', async () => {
    const { alice, path, payload } = await seedBooking();
    expect((await request(path.replace(/date=[^&]+/, 'date=2027-02-30'), undefined, alice)).status).toBe(400);
    expect((await request(`${path}&staffId=other`, undefined, alice)).status).toBe(400);
    db.sqlite.exec('UPDATE staff_profiles SET booking_window_days=1');
    expect((await request(path, undefined, alice)).status).toBe(400);
    db.sqlite.exec('UPDATE staff_profiles SET booking_window_days=30; UPDATE staff_services SET custom_price_cents=3500');
    expect((await request('/me/booking/requests', payload, alice)).status).toBe(409);
    db.sqlite.exec('UPDATE services SET active=0');
    expect((await request(path, undefined, alice)).status).toBe(404);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM appointments').get()!.n).toBe(0);
  });
  it('honors added hours, notice, returning-client eligibility and cross-location commitments', async () => {
    const { alice, date, available, locationId, path } = await seedBooking();
    const now = new Date().toISOString();
    const window = wallWindow(date, '08:00', '09:00', 'America/New_York')!;
    const start = new Date(window.start).toISOString(); const end = new Date(window.end).toISOString();
    db.sqlite.prepare(`INSERT INTO schedule_exceptions(id,staff_id,location_id,starts_at,ends_at,exception_type,created_by_user_id,created_at,updated_at)
      VALUES ('added','book-staff',?,?,?,'added_availability','professional',?,?)`).run(locationId, start, end, now, now);
    expect((await available()).slots[0].startsAt).toBe(start);
    db.sqlite.exec('UPDATE staff_profiles SET minimum_notice_hours=2160');
    expect((await available()).slots).toEqual([]);
    db.sqlite.exec('UPDATE staff_profiles SET minimum_notice_hours=2, accepts_new_clients=0');
    expect((await request(path, undefined, alice)).status).toBe(404);
    db.sqlite.prepare(`INSERT INTO locations(id,name,address_line_1,city,state,postal_code,created_at,updated_at)
      VALUES ('other-location','Other location','1 Test St','Test','PA','12345',?,?)`).run(now, now);
    db.sqlite.prepare(`INSERT INTO appointments(id,customer_user_id,assigned_staff_id,service_id,location_id,starts_at,ends_at,price_cents,status,source,created_at,updated_at)
      VALUES ('other-visit','alice','book-staff','book-service','other-location',?,?,3200,'completed','staff',?,?)`).run(start, end, now, now);
    expect((await available()).slots[0].startsAt).toBe(start);
    db.sqlite.exec("UPDATE staff_profiles SET accepts_new_clients=1; UPDATE appointments SET status='confirmed'");
    expect((await available()).slots.some((slot: { startsAt: string }) => slot.startsAt === start)).toBe(false);
    db.sqlite.exec("UPDATE appointments SET status='reschedule_proposed', proposed_starts_at='invalid'");
    expect((await request(path, undefined, alice)).status).toBe(409);
  });
  it('persists one owned pending request, safely retries it, and releases its slot on withdrawal', async () => {
    const { alice, payload, available } = await seedBooking();
    expect((await request('/me/booking/requests', { ...payload, priceCents: 1, customerId: 'other' }, alice)).status).toBe(400);
    const result = await request('/me/booking/requests', payload, alice);
    expect(result.status).toBe(200);
    const saved = await result.json();
    expect((await (await request('/me/booking/requests', payload, alice)).json()).appointmentId).toBe(saved.appointmentId);
    expect((await request('/me/booking/requests', { ...payload, note: 'changed' }, alice)).status).toBe(409);
    const row = db.sqlite.prepare('SELECT * FROM appointments').get()!;
    expect(row.customer_user_id).toBe('alice'); expect(row.status).toBe('requested'); expect(row.price_cents).toBe(3200);
    expect(Date.parse(String(row.reserved_until)) - Date.parse(String(row.ends_at))).toBe(15 * 60000);
    expect((await available()).slots.some((slot: { startsAt: string }) => slot.startsAt === payload.startsAt)).toBe(false);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM appointment_events WHERE event_type='customer_requested_appointment'").get()!.n).toBe(1);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM audit_events WHERE action='customer_requested_appointment'").get()!.n).toBe(1);
    expect((await request(`/me/appointments/${saved.appointmentId}/withdraw`, { updatedAt: row.updated_at }, alice)).status).toBe(200);
    expect((await available()).slots.some((slot: { startsAt: string }) => slot.startsAt === payload.startsAt)).toBe(true);
    expect((await (await request('/me/booking/requests', payload, alice)).json()).appointmentId).toBe(saved.appointmentId);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM appointments').get()!.n).toBe(1);
  });
  it('rejects a schedule edit or session revocation made after the availability snapshot', async () => {
    const { alice, payload } = await seedBooking();
    const original = db.batch.bind(db);
    for (const sql of ["UPDATE weekly_availability SET active=0", "UPDATE sessions SET revoked_at='2026-01-01T00:00:00Z' WHERE user_id='alice'"]) {
      let first = true;
      const spy = vi.spyOn(db, 'batch').mockImplementation(async <T>(statements: Statement[]) => {
        const result = await original<T>(statements);
        if (first) { first = false; db.sqlite.exec(sql); }
        return result;
      });
      expect((await request('/me/booking/requests', payload, alice)).status).toBe(409);
      spy.mockRestore();
      db.sqlite.exec('UPDATE weekly_availability SET active=1');
    }
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM appointments').get()!.n).toBe(0);
  });
  it('limits pending requests and rolls back when recording the event fails', async () => {
    const { alice, payload, available } = await seedBooking();
    db.sqlite.exec("CREATE TRIGGER fail_booking_event BEFORE INSERT ON appointment_events BEGIN SELECT RAISE(ABORT,'test'); END;");
    expect((await request('/me/booking/requests', payload, alice)).status).toBe(500);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM appointments').get()!.n).toBe(0);
    db.sqlite.exec('DROP TRIGGER fail_booking_event');
    for (let index = 0; index < 3; index++) {
      const page = await available();
      expect((await request('/me/booking/requests', { ...payload, startsAt: page.slots[0].startsAt, requestKey: randomUUID() }, alice)).status).toBe(200);
    }
    const page = await available();
    expect((await request('/me/booking/requests', { ...payload, startsAt: page.slots[0].startsAt, requestKey: randomUUID() }, alice)).status).toBe(409);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM appointments').get()!.n).toBe(3);
  });
});
async function enrollMfa(session: string) {
  const start = await request('/me/mfa/enroll/start', { currentPassword: password }, session);
  expect(start.status).toBe(200);
  const setup = await start.json();
  const confirm = await request('/me/mfa/enroll/confirm', { enrollmentId: setup.enrollmentId, code: totp(setup.setupKey, Math.floor(Date.now() / 30000)) }, session);
  expect(confirm.status).toBe(200);
  return { ...setup, ...await confirm.json() } as { setupKey: string; enrollmentId: string; recoveryCodes: string[]; unlockedUntil: string };
}
async function staffFixture() {
  const fixture = await seedBooking();
  env.STAFF_OPERATIONS_ENABLED = 'true';
  const staff = await createSession(env, 'professional');
  await enrollMfa(staff);
  const saved = await (await request('/me/booking/requests', fixture.payload, fixture.alice)).json();
  const path = `/me/professional/requests/${saved.appointmentId}`;
  const detail = await (await request(path, undefined, staff)).json();
  const decision = { action: 'confirm', updatedAt: detail.request.updatedAt, decisionKey: randomUUID(), currentPassword: password };
  return { ...fixture, staff, id: saved.appointmentId as string, detail: detail.request, path, decision };
}
describe('appointment rescheduling', () => {
  async function fixture() {
    const f = await staffFixture();
    expect((await request(f.path, f.decision, f.staff)).status).toBe(200);
    const customerPath = `/me/appointments/${f.id}/reschedule`; const staffPath = `${f.path}/reschedule`;
    const page = await (await request(customerPath, undefined, f.alice)).json();
    const available = await (await request(`${customerPath}?date=${f.date}`, undefined, f.alice)).json();
    const body = { action: 'request', updatedAt: page.updatedAt, version: page.version, requestKey: randomUUID(), date: f.date, startsAt: available.slots[0].startsAt, quote: available.quote };
    const decide = (current: { updatedAt: string; version: number; change: { id: string } }, action = 'approve') => ({ action, updatedAt: current.updatedAt, version: current.version, changeId: current.change.id, requestKey: randomUUID(), currentPassword: password });
    return { ...f, customerPath, staffPath, page, times: available, body, decide };
  }
  it('preserves the original reservation, accepts a self-overlapping replacement once, and updates calendar/dashboard/history', async () => {
    const f = await fixture();
    expect(Date.parse(f.body.startsAt) - Date.parse(f.payload.startsAt)).toBe(15 * 60000);
    const sent = await request(f.customerPath, f.body, f.alice); expect(sent.status).toBe(200);
    const current = await sent.json(); expect(current.change.status).toBe('pending'); expect(current.startsAt).toBe(f.payload.startsAt);
    expect((await request(f.customerPath, f.body, f.alice)).status).toBe(200);
    const dashboard = await (await request('/me/dashboard', undefined, f.alice)).json();
    expect(dashboard.counts.pending).toBe(1); expect(dashboard.pendingAppointments[0].changeKind).toBe('customer_request');
    const originalSlots = await f.available(); expect(originalSlots.slots.some((s: { startsAt: string }) => s.startsAt === f.payload.startsAt)).toBe(false);
    expect((await request(`/me/appointments/${f.id}/cancellation`, { updatedAt: current.updatedAt }, f.alice)).status).toBe(409);
    const decision = f.decide(current); const saved = await request(f.staffPath, decision, f.staff); expect(saved.status).toBe(200);
    expect((await saved.json()).startsAt).toBe(f.body.startsAt);
    expect((await request(f.staffPath, decision, f.staff)).status).toBe(200);
    expect(db.sqlite.prepare('SELECT status,price_cents FROM appointments WHERE id=?').get(f.id)).toEqual({ status: 'confirmed', price_cents: 3200 });
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM appointment_change_operations').get()!.n).toBe(2);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM appointment_notifications n JOIN appointment_events e ON e.id=n.event_id WHERE e.event_type LIKE 'appointment_change_%'").get()!.n).toBe(4);
    const calendar = await request(`/me/appointments/${f.id}/calendar`, undefined, f.alice); expect(await calendar.text()).toContain('SEQUENCE:2');
    expect((await (await request('/me/dashboard', undefined, f.alice)).json()).counts.pending).toBe(0);
    expect((await request(f.staffPath, { ...decision, action: 'decline' }, f.staff)).status).toBe(409);
  });
  it('supports a professional alternative, customer acceptance, withdrawal, and repeated changes', async () => {
    const f = await fixture();
    const sent = await (await request(f.customerPath, f.body, f.alice)).json();
    const proposed = await request(f.staffPath, { ...f.body, action: 'propose', requestKey: randomUUID(), updatedAt: sent.updatedAt, version: sent.version, changeId: sent.change.id, currentPassword: password }, f.staff);
    expect(proposed.status).toBe(200); const proposal = await proposed.json(); expect(proposal.change.kind).toBe('professional_proposal');
    expect((await request(f.staffPath, f.decide(proposal), f.staff)).status).toBe(403);
    const { currentPassword: _password, ...accept } = f.decide(proposal, 'accept'); void _password;
    expect((await request(f.customerPath, accept, f.alice)).status).toBe(200);
    const page = await (await request(f.customerPath, undefined, f.alice)).json();
    const slots = await (await request(`${f.customerPath}?date=${f.date}`, undefined, f.alice)).json();
    const second = await request(f.customerPath, { ...f.body, updatedAt: page.updatedAt, version: page.version, requestKey: randomUUID(), startsAt: slots.slots.at(-1).startsAt, quote: slots.quote }, f.alice);
    expect(second.status).toBe(200); const change = await second.json();
    expect((await request(f.customerPath, { action: 'withdraw', updatedAt: change.updatedAt, version: change.version, changeId: change.change.id, requestKey: randomUUID() }, f.alice)).status).toBe(200);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM appointment_changes').get()!.n).toBe(3);
  });
  it('rejects foreign resources, stale versions, forged quotes and expired proposals while allowing cleanup', async () => {
    const f = await fixture(); const other = await seed('other');
    expect((await request(f.customerPath, undefined, other)).status).toBe(404);
    expect((await request(f.customerPath, f.body, other)).status).toBe(404);
    expect((await request(f.staffPath, undefined, f.alice)).status).toBe(403);
    expect((await request(f.customerPath, { ...f.body, version: 50 }, f.alice)).status).toBe(409);
    expect((await request(f.customerPath, { ...f.body, quote: 'forged' }, f.alice)).status).toBe(409);
    const current = await (await request(f.customerPath, f.body, f.alice)).json();
    db.sqlite.prepare("UPDATE appointment_changes SET expires_at='2020-01-01T00:00:00Z'").run();
    expect((await request(f.staffPath, f.decide(current), f.staff)).status).toBe(409);
    expect((await (await request(f.customerPath, undefined, f.alice)).json()).change.status).toBe('expired');
    expect((await request(f.staffPath, f.decide(current, 'decline'), f.staff)).status).toBe(200);
    expect(db.sqlite.prepare('SELECT starts_at FROM appointments WHERE id=?').get(f.id)!.starts_at).toBe(f.payload.startsAt);
  });
  it('rechecks competing reservations and schedule policy before accepting', async () => {
    const f = await fixture();
    const sent = await (await request(f.customerPath, { ...f.body, startsAt: f.times.slots.at(-1).startsAt }, f.alice)).json();
    const other = await seed('other');
    const page = await f.available();
    const competitor = { ...f.payload, startsAt: sent.change.startsAt, quote: page.quote, requestKey: randomUUID() };
    expect((await request('/me/booking/requests', competitor, other)).status).toBe(200);
    expect((await request(f.staffPath, f.decide(sent), f.staff)).status).toBe(409);
    expect(db.sqlite.prepare('SELECT starts_at FROM appointments WHERE id=?').get(f.id)!.starts_at).toBe(f.payload.startsAt);
    db.sqlite.prepare("UPDATE appointments SET status='cancelled' WHERE customer_user_id='other'").run();
    db.sqlite.prepare('UPDATE weekly_availability SET active=0').run();
    expect((await request(f.staffPath, f.decide(sent), f.staff)).status).toBe(409);
  });
  it('fails closed on final session/MFA revocation or audit rollback', async () => {
    const f = await fixture();
    const batch = env.DB.batch.bind(env.DB);
    let interfere = true;
    const spy = vi.spyOn(env.DB, 'batch').mockImplementation(async statements => {
      // Availability uses six statements; mutations include an operation receipt.
      if (interfere && statements.length > 6) { interfere = false; db.sqlite.prepare("UPDATE sessions SET revoked_at=? WHERE user_id='alice'").run(new Date().toISOString()); }
      return batch(statements);
    });
    expect((await request(f.customerPath, f.body, f.alice)).status).toBe(409); spy.mockRestore();
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM appointment_changes').get()!.n).toBe(0);
    const fresh = await createSession(env, 'alice');
    const current = await (await request(f.customerPath, f.body, fresh)).json();
    db.sqlite.exec("CREATE TRIGGER fail_change_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'test'); END;");
    expect((await request(f.staffPath, f.decide(current), f.staff)).status).toBe(500);
    expect(db.sqlite.prepare('SELECT status FROM appointment_changes').get()!.status).toBe('pending');
    expect(db.sqlite.prepare('SELECT starts_at FROM appointments WHERE id=?').get(f.id)!.starts_at).toBe(f.payload.startsAt);
    db.sqlite.exec('DROP TRIGGER fail_change_audit');
    let revoke = true;
    const second = vi.spyOn(env.DB, 'batch').mockImplementation(async statements => {
      if (revoke && statements.length > 6) { revoke = false; db.sqlite.prepare("UPDATE sessions SET mfa_until=NULL WHERE user_id='professional'").run(); }
      return batch(statements);
    });
    expect((await request(f.staffPath, f.decide(current), f.staff)).status).toBe(409); second.mockRestore();
  });
});
describe('front desk walk-ins', () => {
  beforeEach(() => {
    // Keep same-day opening tests deterministic even when CI runs after hours.
    // SQLite and application time use the same fixed instant in this suite.
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-20T14:00:01Z'));
    const prepare = env.DB.prepare.bind(env.DB);
    vi.spyOn(env.DB, 'prepare').mockImplementation(sql => prepare(sql.replaceAll("'now'", "'2026-10-20T14:00:01Z'")));
  });
  afterEach(() => { vi.useRealTimers(); });
  async function fixture() {
    const f = await seedBooking(); env.STAFF_OPERATIONS_ENABLED = 'true';
    const owner = await seed('desk-owner', 'owner'); await enrollMfa(owner);
    const date = localDate(Date.now(), 'America/New_York');
    db.sqlite.prepare("UPDATE weekly_availability SET weekday=?,start_time='00:00',end_time='23:59'").run(new Date(`${date}T00:00:00Z`).getUTCDay());
    const selection = { staffId: 'book-staff', serviceId: 'book-service', locationId: f.locationId, date };
    const available = await (await request(`/me/front-desk/availability?${new URLSearchParams(selection)}`, undefined, owner)).json();
    const payload = { ...selection, startsAt: available.slots[0].startsAt, quote: available.quote, name: 'Walk-in guest', phone: '', requestKey: randomUUID(), currentPassword: password };
    const list = async () => (await request('/me/front-desk/visits', undefined, owner)).json();
    return { ...f, owner, selection, available, payload, list };
  }
  it('creates a guest without an account, reserves inventory in the schedule, and supports check-in through completion', async () => {
    const f = await fixture();
    const response = await request('/me/front-desk/visits', f.payload, f.owner); expect(response.status).toBe(200);
    const { appointmentId: id } = await response.json();
    expect((await request('/me/front-desk/visits', f.payload, f.owner)).status).toBe(200);
    expect(db.sqlite.prepare('SELECT customer_user_id,guest_email,guest_name FROM appointments WHERE id=?').get(id)).toEqual({ customer_user_id: null, guest_email: null, guest_name: 'Walk-in guest' });
    const after = await (await request(`/me/front-desk/availability?${new URLSearchParams(f.selection)}`, undefined, f.owner)).json();
    expect(after.slots.some((slot: { startsAt: string }) => slot.startsAt === f.payload.startsAt)).toBe(false);
    expect((await request(`/me/appointments/${id}`, undefined, f.alice)).status).toBe(404);
    const staff = await createSession(env, 'professional'); await enrollMfa(staff);
    expect((await (await request('/me/professional/visits', undefined, staff)).json()).items[0]).toMatchObject({ id, customerName: 'Walk-in guest', source: 'walk_in' });
    for (const action of ['checked_in','in_service','completed']) {
      if (action === 'in_service') db.sqlite.prepare('UPDATE appointments SET starts_at=?,ends_at=? WHERE id=?').run(new Date(Date.now() - 60000).toISOString(), new Date(Date.now() + 3600000).toISOString(), id);
      const visit = (await f.list()).items[0];
      const body = { action, updatedAt: visit.updatedAt, requestKey: randomUUID(), currentPassword: password };
      expect((await request(`/me/front-desk/visits/${id}`, body, f.owner)).status).toBe(200);
      expect((await request(`/me/front-desk/visits/${id}`, body, f.owner)).status).toBe(200);
    }
    expect((await f.list()).items[0].status).toBe('completed');
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM walk_in_operations').get()!.n).toBe(1);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM visit_operations').get()!.n).toBe(3);
  });
  it('rejects customer access, same-slot competition, stale actions, and starting before the scheduled time', async () => {
    const f = await fixture();
    expect((await request('/me/front-desk/visits', f.payload, f.alice)).status).toBe(403);
    const saved = await (await request('/me/front-desk/visits', f.payload, f.owner)).json();
    expect((await request('/me/front-desk/visits', { ...f.payload, requestKey: randomUUID() }, f.owner)).status).toBe(409);
    const visit = (await f.list()).items[0]; const path = `/me/front-desk/visits/${saved.appointmentId}`;
    expect((await request(path, { action: 'completed', updatedAt: visit.updatedAt, requestKey: randomUUID(), currentPassword: password }, f.owner)).status).toBe(409);
    expect((await request(path, { action: 'checked_in', updatedAt: 'stale', requestKey: randomUUID(), currentPassword: password }, f.owner)).status).toBe(409);
    expect((await request(path, { action: 'checked_in', updatedAt: visit.updatedAt, requestKey: randomUUID(), currentPassword: password }, f.owner)).status).toBe(200);
    expect((await request(path, { action: 'in_service', updatedAt: (await f.list()).items[0].updatedAt, requestKey: randomUUID(), currentPassword: password }, f.owner)).status).toBe(409);
  });
  it('rolls back guest creation on audit failure and rechecks staff access inside the commit', async () => {
    const f = await fixture();
    db.sqlite.exec("CREATE TRIGGER fail_walk_in BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'test'); END;");
    expect((await request('/me/front-desk/visits', f.payload, f.owner)).status).toBe(500);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM walk_in_operations').get()!.n).toBe(0);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM appointments WHERE source='walk_in'").get()!.n).toBe(0);
    db.sqlite.exec('DROP TRIGGER fail_walk_in');
    const batch = env.DB.batch.bind(env.DB); let once = true;
    const spy = vi.spyOn(env.DB, 'batch').mockImplementation(async statements => {
      if (once && statements.length === 4) { once = false; db.sqlite.prepare("UPDATE sessions SET mfa_until=NULL WHERE user_id='desk-owner'").run(); }
      return batch(statements);
    });
    expect((await request('/me/front-desk/visits', f.payload, f.owner)).status).toBe(409); spy.mockRestore();
  });
});
describe('shared visit lifecycle', () => {
  async function fixture() {
    const f = await staffFixture();
    expect((await request(f.path, f.decision, f.staff)).status).toBe(200);
    const path = `/me/professional/visits/${f.id}`;
    db.sqlite.prepare('UPDATE appointments SET starts_at=?,ends_at=? WHERE id=?').run(new Date(Date.now() - 60000).toISOString(), new Date(Date.now() + 3600000).toISOString(), f.id);
    const detail = async () => (await (await request(path, undefined, f.staff)).json()).visit;
    const body = async (action: string) => ({ action, updatedAt: (await detail()).updatedAt, requestKey: randomUUID(), currentPassword: password });
    return { ...f, visitPath: path, detail, body };
  }
  it('lets the assigned professional run a website visit, retry safely, and retain completed history', async () => {
    const f = await fixture();
    for (const action of ['checked_in','in_service','completed']) {
      const body = await f.body(action);
      expect((await f.detail()).actions).toContain(action);
      expect((await request(f.visitPath, body, f.staff)).status).toBe(200);
      expect((await request(f.visitPath, body, f.staff)).status).toBe(200);
      expect((await (await request(`/me/appointments/${f.id}`, undefined, f.alice)).json()).appointment.status).toBe(action);
    }
    expect((await f.detail()).status).toBe('completed');
    expect((await f.detail()).actions).toEqual([]);
    expect((await (await request('/me/professional/visits', undefined, f.staff)).json()).items).toHaveLength(0);
    expect((await (await request('/me/professional/visits?view=history', undefined, f.staff)).json()).items[0].id).toBe(f.id);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM visit_operations').get()!.n).toBe(3);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM appointment_notifications n JOIN appointment_events e ON e.id=n.event_id WHERE e.event_type LIKE 'visit_%'").get()!.n).toBe(6);
  });
  it('blocks other customers/professionals and supports manager oversight of website visits', async () => {
    const f = await fixture(); const body = await f.body('checked_in');
    expect((await request(f.visitPath, body, f.alice)).status).toBe(403);
    const outsider = await seed('outsider','staff'); await enrollMfa(outsider);
    db.sqlite.prepare("INSERT INTO staff_profiles(id,user_id,professional_name,public_slug,setup_status,created_at,updated_at) VALUES ('outsider-staff','outsider','Other','other','approved',?,?)").run(new Date().toISOString(), new Date().toISOString());
    expect((await request(f.visitPath, body, outsider)).status).toBe(404);
    const manager = await seed('manager','manager'); await enrollMfa(manager);
    const list = await (await request('/me/front-desk/visits', undefined, manager)).json();
    expect(list.items[0]).toMatchObject({ id: f.id, source: 'website', name: 'Customer alice' });
    expect((await request(`/me/front-desk/visits/${f.id}`, body, manager)).status).toBe(200);
  });
  it('keeps overdue confirmations visible and permits no-show only after scheduled start', async () => {
    const f = await fixture();
    db.sqlite.prepare('UPDATE appointments SET starts_at=?,ends_at=? WHERE id=?').run(new Date(Date.now() + 3600000).toISOString(), new Date(Date.now() + 7200000).toISOString(), f.id);
    expect((await request(f.visitPath, await f.body('no_show'), f.staff)).status).toBe(409);
    db.sqlite.prepare('UPDATE appointments SET starts_at=?,ends_at=? WHERE id=?').run(new Date(Date.now() - 7200000).toISOString(), new Date(Date.now() - 3600000).toISOString(), f.id);
    expect((await (await request('/me/professional/visits', undefined, f.staff)).json()).items[0].id).toBe(f.id);
    expect((await request(f.visitPath, await f.body('checked_in'), f.staff)).status).toBe(409);
    expect((await request(f.visitPath, await f.body('no_show'), f.staff)).status).toBe(200);
  });
  it('resolves a pending cancellation after start without recording a charge or refund', async () => {
    const f = await fixture();
    db.sqlite.prepare("UPDATE appointments SET cancellation_state='pending' WHERE id=?").run(f.id);
    expect((await f.detail()).actions).toEqual(['cancelled']);
    expect((await request(f.visitPath, await f.body('checked_in'), f.staff)).status).toBe(409);
    expect((await request(f.visitPath, await f.body('cancelled'), f.staff)).status).toBe(200);
    expect(db.sqlite.prepare('SELECT status,cancellation_state FROM appointments WHERE id=?').get(f.id)).toEqual({ status: 'cancelled', cancellation_state: 'approved' });
  });
  it('lets the professional decline a pending cancellation after start so check-in can proceed', async () => {
    const f = await fixture(); db.sqlite.prepare("UPDATE appointments SET cancellation_state='pending' WHERE id=?").run(f.id);
    expect((await request(f.path, { action: 'keep', updatedAt: (await f.detail()).updatedAt, decisionKey: randomUUID(), currentPassword: password }, f.staff)).status).toBe(200);
    expect((await request(f.visitPath, await f.body('checked_in'), f.staff)).status).toBe(200);
  });
  it('blocks live rescheduling conflicts and closes expired changes on a saved visit action', async () => {
    const f = await fixture(); const now = new Date().toISOString();
    db.sqlite.prepare(`INSERT INTO appointment_changes(id,appointment_id,requested_by,kind,status,original_starts_at,original_ends_at,starts_at,ends_at,expires_at,created_at)
      SELECT 'visit-change',id,customer_user_id,'customer_request','pending',starts_at,ends_at,starts_at,ends_at,?,? FROM appointments WHERE id=?`)
      .run(new Date(Date.now() + 3600000).toISOString(), now, f.id);
    expect((await request(f.visitPath, await f.body('checked_in'), f.staff)).status).toBe(409);
    db.sqlite.prepare("UPDATE appointment_changes SET expires_at=? WHERE id='visit-change'").run(new Date(Date.now() - 60000).toISOString());
    expect((await request(f.visitPath, await f.body('checked_in'), f.staff)).status).toBe(200);
    expect(db.sqlite.prepare("SELECT status FROM appointment_changes WHERE id='visit-change'").get()!.status).toBe('expired');
  });
  it.each(['mfa','password','assignment','cancellation','session'])('rechecks %s at the transaction boundary', async kind => {
    const f = await fixture(); const body = await f.body('checked_in'); const batch = env.DB.batch.bind(env.DB);
    const spy = vi.spyOn(env.DB, 'batch').mockImplementation(async statements => {
      if (statements.length === 7) {
        if (kind === 'mfa') db.sqlite.exec("UPDATE sessions SET mfa_until=NULL WHERE user_id='professional'");
        if (kind === 'password') db.sqlite.exec("UPDATE account_credentials SET password_hash='changed' WHERE user_id='professional'");
        if (kind === 'assignment') db.sqlite.prepare('UPDATE appointments SET assigned_staff_id=NULL WHERE id=?').run(f.id);
        if (kind === 'cancellation') db.sqlite.prepare("UPDATE appointments SET cancellation_state='pending' WHERE id=?").run(f.id);
        if (kind === 'session') db.sqlite.exec("UPDATE sessions SET revoked_at='2026-01-01' WHERE user_id='professional'");
      }
      return batch(statements);
    });
    expect((await request(f.visitPath, body, f.staff)).status).toBe(409); spy.mockRestore();
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM visit_operations').get()!.n).toBe(0);
    expect(db.sqlite.prepare('SELECT status FROM appointments WHERE id=?').get(f.id)!.status).toBe('confirmed');
  });
  it('rolls back the status, operation and notification when audit fails', async () => {
    const f = await fixture(); const body = await f.body('checked_in');
    db.sqlite.exec("CREATE TRIGGER fail_visit BEFORE INSERT ON audit_events WHEN NEW.action LIKE 'visit_%' BEGIN SELECT RAISE(ABORT,'test'); END");
    expect((await request(f.visitPath, body, f.staff)).status).toBe(500);
    expect(db.sqlite.prepare('SELECT status FROM appointments WHERE id=?').get(f.id)!.status).toBe('confirmed');
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM visit_operations').get()!.n).toBe(0);
    db.sqlite.exec('DROP TRIGGER fail_visit');
    expect((await request(f.visitPath, body, f.staff)).status).toBe(200);
    expect((await request(f.visitPath, { ...body, action: 'cancelled' }, f.staff)).status).toBe(409);
  });
  it('prevents a professional from starting another visit while a prior service is still open', async () => {
    const f = await fixture();
    expect((await request(f.visitPath, await f.body('checked_in'), f.staff)).status).toBe(200);
    db.sqlite.prepare(`INSERT INTO appointments(id,assigned_staff_id,service_id,location_id,starts_at,ends_at,price_cents,status,source,created_at,updated_at)
      SELECT 'overrun',assigned_staff_id,service_id,location_id,'2000-01-01T09:00:00Z','2000-01-01T10:00:00Z',price_cents,'in_service','walk_in',created_at,updated_at FROM appointments WHERE id=?`).run(f.id);
    expect((await request(f.visitPath, await f.body('in_service'), f.staff)).status).toBe(409);
    const previous = await (await request('/me/professional/visits/overrun', undefined, f.staff)).json();
    expect((await request('/me/professional/visits/overrun', { action: 'completed', updatedAt: previous.visit.updatedAt, requestKey: randomUUID(), currentPassword: password }, f.staff)).status).toBe(200);
    expect((await request(f.visitPath, await f.body('in_service'), f.staff)).status).toBe(200);
  });
  it('paginates terminal history without duplicates and binds the cursor to its view', async () => {
    const f = await fixture(); const now = new Date().toISOString();
    for (let i = 0; i < 28; i++) db.sqlite.prepare(`INSERT INTO appointments(id,customer_user_id,assigned_staff_id,service_id,location_id,starts_at,ends_at,price_cents,status,source,created_at,updated_at)
      SELECT ?,customer_user_id,assigned_staff_id,service_id,location_id,starts_at,ends_at,price_cents,'completed','website',?,? FROM appointments WHERE id=?`).run(`history-${String(i).padStart(2,'0')}`, now, now, f.id);
    const first = await (await request('/me/professional/visits?view=history', undefined, f.staff)).json();
    const second = await (await request(`/me/professional/visits?view=history&cursor=${first.nextCursor}`, undefined, f.staff)).json();
    expect(first.items).toHaveLength(25); expect(second.items).toHaveLength(3);
    expect(new Set([...first.items, ...second.items].map(item => item.id)).size).toBe(28);
    expect((await request(`/me/professional/visits?cursor=${first.nextCursor}`, undefined, f.staff)).status).toBe(400);
  });
});
describe('private printable customer documents', () => {
  it('distinguishes pending booking acknowledgements, confirmations and orders without leaking notes or another account', async () => {
    const alice = await seed('alice'); const bob = await seed('bob'); seedRecords();
    db.sqlite.prepare("UPDATE services SET name='<script>alert(1)</script>' WHERE id='detail-service'").run();
    const url = '/me/appointments/detail-appointment/document';
    expect((await request(url, undefined, bob)).status).toBe(404);
    expect((await request(url)).status).toBe(401);
    const response = await request(url, undefined, alice); expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    const html = await response.text();
    expect(html).toContain('Appointment request acknowledgement'); expect(html).toContain('&lt;script&gt;');
    expect(html).not.toMatch(/<script>|SECRET|My private note|password|alice@example/);
    db.sqlite.prepare("UPDATE appointments SET status='confirmed' WHERE id='detail-appointment'").run();
    expect(await (await request(url, undefined, alice)).text()).toContain('Appointment confirmation');
    const order = await request('/me/orders/detail-order/document', undefined, alice); expect(order.status).toBe(200);
    const orderHtml = await order.text(); expect(orderHtml).toContain('Order acknowledgement'); expect(orderHtml).toContain('not proof of payment');
    expect((await request('/me/orders/detail-order/document', undefined, bob)).status).toBe(404);
  });
});
describe('confirmed appointment cancellation', () => {
  async function fixture() {
    const f = await staffFixture();
    expect((await request(f.path, f.decision, f.staff)).status).toBe(200);
    const customerPath = `/me/appointments/${f.id}`;
    const current = await (await request(customerPath, undefined, f.alice)).json();
    return { ...f, customerPath, cancellationPath: `${customerPath}/cancellation`, updatedAt: current.appointment.updatedAt };
  }
  it('keeps a requested cancellation reserved, approves once, releases the slot and queues private notices', async () => {
    const f = await fixture();
    const body = { updatedAt: f.updatedAt };
    expect((await request(f.cancellationPath, body, f.alice)).status).toBe(200);
    expect((await request(f.cancellationPath, body, f.alice)).status).toBe(200);
    expect(db.sqlite.prepare('SELECT status,cancellation_state FROM appointments').get()).toEqual({ status: 'confirmed', cancellation_state: 'pending' });
    expect((await f.available()).slots.some((s: { startsAt: string }) => s.startsAt === f.payload.startsAt)).toBe(false);
    const queue = await (await request('/me/professional/requests', undefined, f.staff)).json();
    expect(queue.items[0]).toMatchObject({ id: f.id, cancellationState: 'pending' });
    const decision = { ...f.decision, action: 'cancel', updatedAt: queue.items[0].updatedAt, decisionKey: randomUUID() };
    expect((await request(f.path, decision, f.staff)).status).toBe(200);
    expect((await request(f.path, decision, f.staff)).status).toBe(200);
    const detail = await (await request(f.customerPath, undefined, f.alice)).json();
    expect(detail.appointment).toMatchObject({ status: 'cancelled', cancellationState: 'approved', canDownloadCalendar: false, withdrawnByCustomer: false });
    expect((await f.available()).slots.some((s: { startsAt: string }) => s.startsAt === f.payload.startsAt)).toBe(true);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM appointment_events WHERE event_type IN ('customer_requested_cancellation','professional_cancellation_approved')").get()!.n).toBe(2);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM appointment_notifications n JOIN appointment_events e ON e.id=n.event_id WHERE e.event_type IN ('customer_requested_cancellation','professional_cancellation_approved')").get()!.n).toBe(4);
  });
  it('declines a cancellation without losing the confirmed time and prevents stale or opposite decisions', async () => {
    const f = await fixture();
    expect((await request(f.path, { ...f.decision, action: 'cancel', decisionKey: randomUUID() }, f.staff)).status).toBe(409);
    expect((await request(f.cancellationPath, { updatedAt: 'stale' }, f.alice)).status).toBe(409);
    expect((await request(f.cancellationPath, { updatedAt: f.updatedAt }, f.alice)).status).toBe(200);
    const current = await (await request(f.path, undefined, f.staff)).json();
    const decision = { ...f.decision, action: 'keep', updatedAt: current.request.updatedAt, decisionKey: randomUUID() };
    expect((await request(f.path, { ...decision, updatedAt: 'stale' }, f.staff)).status).toBe(409);
    expect((await request(f.path, decision, f.staff)).status).toBe(200);
    expect((await request(f.path, { ...decision, action: 'cancel' }, f.staff)).status).toBe(409);
    expect((await request(f.cancellationPath, { updatedAt: current.request.updatedAt }, f.alice)).status).toBe(409);
    expect(db.sqlite.prepare('SELECT status,cancellation_state FROM appointments').get()).toEqual({ status: 'confirmed', cancellation_state: 'declined' });
    expect((await f.available()).slots.some((s: { startsAt: string }) => s.startsAt === f.payload.startsAt)).toBe(false);
  });
  it('enforces ownership/MFA for cancellation and lets staff resolve an existing request after start', async () => {
    const f = await fixture(); const other = await seed('other');
    expect((await request(f.cancellationPath, { updatedAt: f.updatedAt }, other)).status).toBe(404);
    env.STAFF_OPERATIONS_ENABLED = 'false';
    expect((await request(f.cancellationPath, { updatedAt: f.updatedAt }, f.alice)).status).toBe(409);
    env.STAFF_OPERATIONS_ENABLED = 'true';
    db.sqlite.exec("UPDATE appointments SET source='migration'");
    expect((await request(f.cancellationPath, { updatedAt: f.updatedAt }, f.alice)).status).toBe(409);
    db.sqlite.exec("UPDATE appointments SET source='website'");
    expect((await request(f.cancellationPath, { updatedAt: f.updatedAt }, f.alice)).status).toBe(200);
    const current = await (await request(f.path, undefined, f.staff)).json();
    const decision = { ...f.decision, action: 'cancel', updatedAt: current.request.updatedAt, decisionKey: randomUUID() };
    expect((await request(f.path, decision, await createSession(env, 'professional'))).status).toBe(403);
    expect((await request(f.path, { ...decision, currentPassword: 'wrong' }, f.staff)).status).toBe(400);
    db.sqlite.exec("UPDATE appointments SET starts_at='2000-01-01T12:00:00.000Z'");
    expect((await request(f.path, decision, f.staff)).status).toBe(200);
  });
  it('rechecks customer sessions and staff MFA at the final cancellation write', async () => {
    const f = await fixture(); const original = db.batch.bind(db);
    const revokeCustomer = vi.spyOn(db, 'batch').mockImplementation(async <T>(statements: Statement[]) => {
      db.sqlite.exec("UPDATE sessions SET revoked_at='2000-01-01' WHERE user_id='alice'");
      return original<T>(statements);
    });
    expect((await request(f.cancellationPath, { updatedAt: f.updatedAt }, f.alice)).status).toBe(409);
    revokeCustomer.mockRestore();
    const fresh = await createSession(env, 'alice');
    expect((await request(f.cancellationPath, { updatedAt: f.updatedAt }, fresh)).status).toBe(200);
    const current = await (await request(f.path, undefined, f.staff)).json();
    const revokeStaff = vi.spyOn(db, 'batch').mockImplementation(async <T>(statements: Statement[]) => {
      db.sqlite.exec("UPDATE sessions SET mfa_until=NULL WHERE user_id='professional'");
      return original<T>(statements);
    });
    expect((await request(f.path, { ...f.decision, action: 'cancel', updatedAt: current.request.updatedAt, decisionKey: randomUUID() }, f.staff)).status).toBe(409);
    revokeStaff.mockRestore();
    expect(db.sqlite.prepare('SELECT status,cancellation_state FROM appointments').get()).toEqual({ status: 'confirmed', cancellation_state: 'pending' });
  });
  it('rolls back both customer request and staff cancellation when audit insertion fails', async () => {
    const f = await fixture();
    db.sqlite.exec("CREATE TRIGGER fail_cancel BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'test'); END;");
    expect((await request(f.cancellationPath, { updatedAt: f.updatedAt }, f.alice)).status).toBe(500);
    expect(db.sqlite.prepare('SELECT cancellation_state FROM appointments').get()!.cancellation_state).toBeNull();
    db.sqlite.exec('DROP TRIGGER fail_cancel');
    expect((await request(f.cancellationPath, { updatedAt: f.updatedAt }, f.alice)).status).toBe(200);
    const current = await (await request(f.path, undefined, f.staff)).json();
    db.sqlite.exec("CREATE TRIGGER fail_cancel BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'test'); END;");
    expect((await request(f.path, { ...f.decision, action: 'cancel', updatedAt: current.request.updatedAt, decisionKey: randomUUID() }, f.staff)).status).toBe(500);
    expect(db.sqlite.prepare('SELECT status,cancellation_state FROM appointments').get()).toEqual({ status: 'confirmed', cancellation_state: 'pending' });
  });
});
describe('staff multi-factor verification', () => {
  it('blocks customers, fails closed without the encryption key, and reveals no secrets in status', async () => {
    const customer = await seed('alice');
    expect((await request('/me/mfa', undefined, customer)).status).toBe(403);
    expect((await request('/me/mfa/enroll/start', { currentPassword: password }, customer)).status).toBe(400);
    const staff = await seed('staff', 'staff');
    expect(await (await request('/me/mfa', undefined, staff)).json()).toEqual({ configured: true, enrolled: false, unlockedUntil: null });
    delete env.MFA_ENCRYPTION_KEY;
    expect((await request('/me/mfa/enroll/start', { currentPassword: password }, staff)).status).toBe(503);
    expect((await (await request('/me/mfa', undefined, staff)).json()).configured).toBe(false);
  });
  it('binds pending setup to its session, expires it, and allows five code attempts', async () => {
    const staff = await seed('staff', 'staff'); const other = await createSession(env, 'staff');
    const setup = await (await request('/me/mfa/enroll/start', { currentPassword: password }, staff)).json();
    const proof = { enrollmentId: setup.enrollmentId, code: totp(setup.setupKey, Math.floor(Date.now() / 30000)) };
    expect((await request('/me/mfa/enroll/confirm', proof, other)).status).toBe(400);
    expect(db.sqlite.prepare('SELECT attempts FROM staff_mfa_enrollments').get()!.attempts).toBe(0);
    for (let attempt = 0; attempt < 5; attempt++) expect((await request('/me/mfa/enroll/confirm', { ...proof, code: 'badbad' }, staff)).status).toBe(400);
    expect((await request('/me/mfa/enroll/confirm', proof, staff)).status).toBe(400);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM staff_authenticators').get()!.n).toBe(0);
    db.sqlite.exec("DELETE FROM auth_rate_limits; UPDATE staff_mfa_enrollments SET expires_at='2000-01-01',attempts=0");
    expect((await request('/me/mfa/enroll/confirm', proof, staff)).status).toBe(400);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM staff_mfa_enrollments').get()!.n).toBe(0);
  });
  it('stores encrypted seeds and hashed recovery codes, rejects replays, and unlocks only one session', async () => {
    const staff = await seed('staff', 'staff'); const other = await createSession(env, 'staff');
    const setup = await enrollMfa(staff);
    const stored = JSON.stringify(db.sqlite.prepare('SELECT * FROM staff_authenticators').all());
    expect(stored).not.toContain(setup.setupKey);
    const codes = JSON.stringify(db.sqlite.prepare('SELECT * FROM staff_mfa_recovery_codes').all());
    expect(setup.recoveryCodes).toHaveLength(8);
    for (const code of setup.recoveryCodes) expect(codes).not.toContain(code.replaceAll('-', ''));
    expect((await (await request('/me/mfa', undefined, other)).json()).unlockedUntil).toBeNull();
    expect((await request('/me/mfa/unlock', { currentPassword: password, code: totp(setup.setupKey, Math.floor(Date.now() / 30000)) }, other)).status).toBe(400);
    const proof = { currentPassword: password, code: setup.recoveryCodes[0] };
    expect((await request('/me/mfa/unlock', proof, other)).status).toBe(200);
    expect((await request('/me/mfa/unlock', proof, staff)).status).toBe(400);
    expect((await request('/me/mfa/lock', {}, other)).status).toBe(200);
    expect((await (await request('/me/mfa', undefined, other)).json()).unlockedUntil).toBeNull();
    expect((await (await request('/me/mfa', undefined, staff)).json()).unlockedUntil).not.toBeNull();
  });
  it('accepts a fresh authenticator code once and rejects a wrong password without consuming it', async () => {
    const staff = await seed('staff', 'staff'); const setup = await enrollMfa(staff);
    // Advance only the stored replay floor; the next proof still uses real time.
    db.sqlite.exec('UPDATE staff_authenticators SET last_counter=last_counter-1');
    const code = totp(setup.setupKey, Math.floor(Date.now() / 30000));
    expect((await request('/me/mfa/unlock', { currentPassword: 'wrong', code }, staff)).status).toBe(400);
    expect((await request('/me/mfa/unlock', { currentPassword: password, code }, staff)).status).toBe(200);
    expect((await request('/me/mfa/unlock', { currentPassword: password, code }, staff)).status).toBe(400);
  });
  it('requires a fresh staff grant for replacement and invalidates other grants and all old recovery codes', async () => {
    const staff = await seed('staff', 'staff'); const other = await createSession(env, 'staff');
    const original = await enrollMfa(staff);
    expect((await request('/me/mfa/enroll/start', { currentPassword: password }, other)).status).toBe(403);
    expect((await request('/me/mfa/unlock', { currentPassword: password, code: original.recoveryCodes[0] }, other)).status).toBe(200);
    const replacement = await enrollMfa(other);
    expect((await (await request('/me/mfa', undefined, staff)).json()).unlockedUntil).toBeNull();
    db.sqlite.exec('DELETE FROM auth_rate_limits');
    expect((await request('/me/mfa/unlock', { currentPassword: password, code: original.recoveryCodes[1] }, staff)).status).toBe(400);
    expect((await request('/me/mfa/unlock', { currentPassword: password, code: replacement.recoveryCodes[0] }, staff)).status).toBe(200);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM staff_mfa_enrollments').get()!.n).toBe(0);
  });
  it('keeps the current authenticator until replacement confirmation and blocks expired replacement grants', async () => {
    const staff = await seed('staff', 'staff'); await enrollMfa(staff);
    const original = db.sqlite.prepare('SELECT version FROM staff_authenticators').get()!.version;
    const setup = await (await request('/me/mfa/enroll/start', { currentPassword: password }, staff)).json();
    expect(db.sqlite.prepare('SELECT version FROM staff_authenticators').get()!.version).toBe(original);
    db.sqlite.exec("UPDATE sessions SET mfa_until='2000-01-01'");
    expect((await request('/me/mfa/enroll/confirm', { enrollmentId: setup.enrollmentId, code: totp(setup.setupKey, Math.floor(Date.now() / 30000)) }, staff)).status).toBe(409);
    expect(db.sqlite.prepare('SELECT version FROM staff_authenticators').get()!.version).toBe(original);
  });
  it('blocks staff reads and decisions with no grant, an expired grant, a missing key, or a changed role', async () => {
    const { staff, path, decision } = await staffFixture();
    const other = await createSession(env, 'professional');
    for (const endpoint of [path, '/me/professional/requests']) expect((await request(endpoint, undefined, other)).status).toBe(403);
    expect((await request(path, decision, other)).status).toBe(403);
    delete env.MFA_ENCRYPTION_KEY;
    expect((await request(path, undefined, staff)).status).toBe(503); env.MFA_ENCRYPTION_KEY = '12'.repeat(32);
    db.sqlite.exec("UPDATE sessions SET mfa_until='2000-01-01'");
    expect((await request(path, undefined, staff)).status).toBe(403);
    expect((await request(path, decision, staff)).status).toBe(403);
    db.sqlite.exec("UPDATE users SET role='manager' WHERE id='professional'; UPDATE users SET role='staff' WHERE id='professional'");
    expect(db.sqlite.prepare("SELECT mfa_version FROM sessions WHERE user_id='professional' AND mfa_version IS NOT NULL").get()).toBeUndefined();
  });
  it('rechecks the staff grant at the final appointment write', async () => {
    const { staff, path, decision } = await staffFixture();
    const original = db.batch.bind(db); let first = true;
    const spy = vi.spyOn(db, 'batch').mockImplementation(async <T>(statements: Statement[]) => {
      const result = await original<T>(statements);
      if (first) { first = false; db.sqlite.exec("UPDATE sessions SET mfa_until='2000-01-01'"); }
      return result;
    });
    expect((await request(path, decision, staff)).status).toBe(409); spy.mockRestore();
    expect(db.sqlite.prepare('SELECT status FROM appointments').get()!.status).toBe('requested');
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM appointment_events').get()!.n).toBe(1);
  });
  it('rechecks verification at the customer-data query after the early access check', async () => {
    const { staff, path } = await staffFixture();
    const original = db.prepare.bind(db);
    const spy = vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      if (sql.includes('FROM appointments a JOIN users u')) db.sqlite.exec("UPDATE sessions SET mfa_until=NULL");
      return original(sql);
    });
    const response = await request(path, undefined, staff); spy.mockRestore();
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain('customerName');
  });
  it('rolls back authenticator activation if recovery-code storage fails', async () => {
    const staff = await seed('staff', 'staff');
    const setup = await (await request('/me/mfa/enroll/start', { currentPassword: password }, staff)).json();
    db.sqlite.exec("CREATE TRIGGER fail_recovery BEFORE INSERT ON staff_mfa_recovery_codes BEGIN SELECT RAISE(ABORT,'test'); END;");
    expect((await request('/me/mfa/enroll/confirm', { enrollmentId: setup.enrollmentId, code: totp(setup.setupKey, Math.floor(Date.now() / 30000)) }, staff)).status).toBe(500);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM staff_authenticators').get()!.n).toBe(0);
    expect(db.sqlite.prepare('SELECT mfa_version FROM sessions').get()!.mfa_version).toBeNull();
    expect(db.sqlite.prepare('SELECT consumed_receipt FROM staff_mfa_enrollments').get()!.consumed_receipt).toBeNull();
  });
  it('does not remove the authenticator after password recovery or accept a stale enrollment credential', async () => {
    const staff = await seed('staff', 'staff'); await enrollMfa(staff);
    const reset = await sendChallenge(env, { id: 'staff', email: 'staff@example.test' }, 'reset_password');
    expect((await request('/auth/reset', { challengeId: reset, code: latestCode(), password: 'My changed passphrase 2026' })).status).toBe(200);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM staff_authenticators').get()!.n).toBe(1);
    expect((await request('/me/mfa', undefined, staff)).status).toBe(401);
    const second = await seed('second', 'staff');
    const setup = await (await request('/me/mfa/enroll/start', { currentPassword: password }, second)).json();
    db.sqlite.prepare("UPDATE account_credentials SET password_hash='changed' WHERE user_id='second'").run();
    expect((await request('/me/mfa/enroll/confirm', { enrollmentId: setup.enrollmentId, code: totp(setup.setupKey, Math.floor(Date.now() / 30000)) }, second)).status).toBe(409);
    expect(db.sqlite.prepare("SELECT * FROM staff_authenticators WHERE user_id='second'").get()).toBeUndefined();
  });
});
async function setupFixture() {
  const booking = await seedBooking(); env.STAFF_SETUP_ENABLED = 'true';
  const applicant = await seed('applicant', 'staff'); const owner = await seed('reviewer', 'owner');
  await enrollMfa(applicant); await enrollMfa(owner);
  const profile = { action: 'submit', version: 0, professionalName: 'Test Applicant', bio: 'Cuts and conversation.\nWelcome to my chair.', locationIds: [booking.locationId], serviceIds: ['book-service'] };
  const submit = async () => {
    expect((await request('/me/professional/setup', profile, applicant)).status).toBe(200);
    const own = await (await request('/me/professional/setup', undefined, applicant)).json();
    const path = `/me/professional/reviews/${own.submission.id}`;
    const review = await (await request(path, undefined, owner)).json();
    return { path, review, decision: { action: 'approve', version: review.submission.version, revision: review.revision, reviewNote: '', currentPassword: password } };
  };
  return { ...booking, applicant, owner, profile, submit };
}
describe('professional onboarding and owner review', () => {
  it('saves a draft, submits it, returns feedback, resubmits, and approves without opening hours or changing roles', async () => {
    const { applicant, owner, profile } = await setupFixture();
    expect((await request('/me/professional/setup', { ...profile, action: 'save', professionalName: '', serviceIds: [] }, applicant)).status).toBe(200);
    const draft = await (await request('/me/professional/setup', undefined, applicant)).json(); expect(draft.submission.status).toBe('draft');
    expect((await request('/me/professional/setup', { ...profile, version: 1 }, applicant)).status).toBe(200);
    const page = await (await request('/me/professional/setup', undefined, applicant)).json(); expect(page.editable).toBe(false);
    const path = `/me/professional/reviews/${page.submission.id}`;
    const review = await (await request(path, undefined, owner)).json();
    expect((await request(path, { action: 'return', version: 2, revision: review.revision, reviewNote: 'Please confirm your introduction.', currentPassword: password }, owner)).status).toBe(200);
    const returned = await (await request('/me/professional/setup', undefined, applicant)).json(); expect(returned.editable).toBe(true); expect(returned.submission.reviewNote).toContain('introduction');
    expect((await request('/me/professional/setup', { ...profile, version: 3 }, applicant)).status).toBe(200);
    const next = await (await request(path, undefined, owner)).json();
    expect((await request(path, { action: 'approve', version: 4, revision: next.revision, reviewNote: 'Approved.', currentPassword: password }, owner)).status).toBe(200);
    const sp = db.sqlite.prepare("SELECT * FROM staff_profiles WHERE user_id='applicant'").get()!;
    expect(sp.setup_status).toBe('approved'); expect(sp.public_bio).toBe(profile.bio);
    expect(db.sqlite.prepare('SELECT custom_price_cents FROM staff_services WHERE staff_id=?').get(sp.id as string)!.custom_price_cents).toBeNull();
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM weekly_availability WHERE staff_id=?').get(sp.id as string)!.n).toBe(0);
    expect(db.sqlite.prepare("SELECT role FROM users WHERE id='applicant'").get()!.role).toBe('staff');
    expect((await request('/me/professional/setup', { ...profile, version: 5 }, applicant)).status).toBe(409);
    expect(deliveries).toHaveLength(0);
  });
  it('requires the feature gate, MFA, and owner capability without requiring an owner barber profile', async () => {
    const { applicant, owner, alice, profile } = await setupFixture();
    env.STAFF_SETUP_ENABLED = 'false'; expect((await request('/me/professional/setup', undefined, applicant)).status).toBe(503); env.STAFF_SETUP_ENABLED = 'true';
    expect((await request('/me/professional/setup', profile, alice)).status).toBe(403);
    const fresh = await createSession(env, 'applicant'); expect((await request('/me/professional/setup', undefined, fresh)).status).toBe(403);
    expect((await request('/me/professional/reviews', undefined, applicant)).status).toBe(403);
    const manager = await seed('manager', 'manager'); await enrollMfa(manager);
    expect((await request('/me/professional/reviews', undefined, manager)).status).toBe(403);
    expect((await request('/me/professional/reviews', undefined, owner)).status).toBe(200);
    expect(db.sqlite.prepare("SELECT * FROM staff_profiles WHERE user_id='reviewer'").get()).toBeUndefined();
  });
  it('rejects identity/role injection, incomplete selections, duplicates, and stale saves', async () => {
    const { applicant, profile } = await setupFixture();
    for (const extra of [{ role: 'owner' }, { setupStatus: 'approved' }, { userId: 'reviewer' }, { priceCents: 1 }]) expect((await request('/me/professional/setup', { ...profile, ...extra }, applicant)).status).toBe(400);
    for (const serviceIds of [[], ['missing'], ['book-service', 'book-service']]) expect([400, 409]).toContain((await request('/me/professional/setup', { ...profile, serviceIds }, applicant)).status);
    expect((await request('/me/professional/setup', { ...profile, action: 'save' }, applicant)).status).toBe(200);
    expect((await request('/me/professional/setup', profile, applicant)).status).toBe(409);
    expect(db.sqlite.prepare('SELECT version FROM professional_submissions').get()!.version).toBe(1);
  });
  it('freezes submissions, prevents self approval, and returns identical missing/foreign details to ordinary staff', async () => {
    const { applicant, owner, profile, submit } = await setupFixture(); const { path } = await submit();
    expect((await request('/me/professional/setup', { ...profile, version: 1 }, applicant)).status).toBe(409);
    expect((await request(path, undefined, applicant)).status).toBe(403);
    expect((await request('/me/professional/setup', profile, owner)).status).toBe(200);
    const own = await (await request('/me/professional/setup', undefined, owner)).json();
    const ownPath = `/me/professional/reviews/${own.submission.id}`;
    expect((await request(ownPath, undefined, owner)).status).toBe(404);
    const queue = await (await request('/me/professional/reviews', undefined, owner)).json(); expect(queue.items).toHaveLength(1);
    expect((await request(ownPath, { action: 'approve', version: 1, revision: own.revision, reviewNote: '', currentPassword: password }, owner)).status).toBe(409);
  });
  it('requires fresh review of catalog changes and accepts a decision only once', async () => {
    const { owner, submit } = await setupFixture(); const { path, decision } = await submit();
    expect((await request(path, { ...decision, currentPassword: 'wrong' }, owner)).status).toBe(400);
    db.sqlite.exec("UPDATE services SET price_cents=4000 WHERE id='book-service'");
    expect((await request(path, decision, owner)).status).toBe(409);
    const refreshed = await (await request(path, undefined, owner)).json();
    expect((await request(path, { ...decision, revision: refreshed.revision }, owner)).status).toBe(200);
    expect((await request(path, { ...decision, revision: refreshed.revision }, owner)).status).toBe(409);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM audit_events WHERE action='professional_setup_approved'").get()!.n).toBe(1);
  });
  it('paginates review submissions without account contact fields and excludes ineligible targets', async () => {
    const { owner, locationId } = await setupFixture();
    const now = new Date().toISOString();
    for (let i = 0; i < 28; i++) {
      const id = randomUUID();
      db.sqlite.prepare("INSERT INTO users(id,email,display_name,role,email_verified_at,created_at,updated_at) VALUES (?,?,'Private name','staff',?,?,?)").run(id, `staff-${i}@example.test`, now, now, now);
      db.sqlite.prepare("INSERT INTO professional_submissions(id,user_id,professional_name,bio,location_ids,service_ids,status,submitted_at,updated_at,last_receipt) VALUES (?,?,'Public professional','Public bio',?,'[\"book-service\"]','submitted',?,?,?)").run(randomUUID(), id, JSON.stringify([locationId]), now, now, randomUUID());
      if (i === 27) db.sqlite.prepare("UPDATE users SET status='disabled' WHERE id=?").run(id);
    }
    const first = await (await request('/me/professional/reviews', undefined, owner)).json(); expect(first.items).toHaveLength(25);
    expect(JSON.stringify(first)).not.toMatch(/example.test|Private name|user_id|Public bio/);
    const second = await (await request(`/me/professional/reviews?after=${first.nextCursor}`, undefined, owner)).json(); expect(second.items).toHaveLength(2);
    expect(new Set([...first.items, ...second.items].map((item: { id: string }) => item.id)).size).toBe(27);
    expect((await request('/me/professional/reviews?after=invalid', undefined, owner)).status).toBe(400);
  });
  it('refuses approval of unavailable selections but still lets the owner return feedback', async () => {
    const { owner, applicant, submit } = await setupFixture(); const { path, decision } = await submit();
    expect((await (await request('/me/professional', undefined, applicant)).json()).state).toBe('pending_review');
    db.sqlite.exec("UPDATE services SET active=0 WHERE id='book-service'");
    const page = await (await request(path, undefined, owner)).json();
    expect((await request(path, { ...decision, revision: page.revision }, owner)).status).toBe(409);
    expect((await request(path, { ...decision, action: 'return', revision: page.revision, reviewNote: 'Select an available service.' }, owner)).status).toBe(200);
    expect((await (await request('/me/professional', undefined, applicant)).json()).state).toBe('setup_required');
  });
  it('blocks disabled targets and preserves legacy schedules instead of silently approving them', async () => {
    const { applicant, owner, submit, locationId } = await setupFixture(); const { path, decision } = await submit();
    const now = new Date().toISOString();
    db.sqlite.prepare("INSERT INTO staff_profiles(id,user_id,professional_name,public_slug,setup_status,created_at,updated_at) VALUES ('legacy','applicant','Legacy','legacy','draft',?,?)").run(now, now);
    db.sqlite.prepare("INSERT INTO weekly_availability(id,staff_id,location_id,weekday,start_time,end_time,created_at,updated_at) VALUES ('legacy-hours','legacy',?,1,'09:00','17:00',?,?)").run(locationId, now, now);
    const refreshed = await (await request(path, undefined, owner)).json();
    expect((await request(path, { ...decision, revision: refreshed.revision }, owner)).status).toBe(409);
    expect(db.sqlite.prepare("SELECT active FROM weekly_availability WHERE id='legacy-hours'").get()!.active).toBe(1);
    db.sqlite.exec("UPDATE staff_profiles SET setup_status='disabled' WHERE id='legacy'");
    expect((await request(path, undefined, owner)).status).toBe(404);
    expect((await (await request('/me/professional/setup', undefined, applicant)).json()).editable).toBe(false);
  });
  it('rechecks the owner grant at the final transaction and rolls back failed audit writes', async () => {
    const { owner, submit } = await setupFixture(); const { path, decision } = await submit();
    const original = db.batch.bind(db);
    const spy = vi.spyOn(db, 'batch').mockImplementation(async <T>(statements: Statement[]) => {
      db.sqlite.exec("UPDATE sessions SET mfa_until=NULL WHERE user_id='reviewer'"); return original<T>(statements);
    });
    expect((await request(path, decision, owner)).status).toBe(409); spy.mockRestore();
    expect(db.sqlite.prepare("SELECT * FROM staff_profiles WHERE user_id='applicant'").get()).toBeUndefined();
    db.sqlite.prepare("UPDATE sessions SET mfa_until=? WHERE user_id='reviewer'").run(new Date(Date.now() + 60000).toISOString());
    db.sqlite.exec("CREATE TRIGGER fail_setup_audit BEFORE INSERT ON audit_events WHEN NEW.action='professional_setup_approved' BEGIN SELECT RAISE(ABORT,'test'); END;");
    expect((await request(path, decision, owner)).status).toBe(500);
    expect(db.sqlite.prepare("SELECT * FROM staff_profiles WHERE user_id='applicant'").get()).toBeUndefined();
    expect(db.sqlite.prepare('SELECT status FROM professional_submissions').get()!.status).toBe('submitted');
  });
});
describe('professional availability management', () => {
  const path = '/me/professional/schedule';
  it('adds and removes own weekly windows and time off with revision and audit updates', async () => {
    const { staff, locationId, date } = await staffFixture();
    const read = async () => (await request(path, undefined, staff)).json();
    const initial = await read();
    const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 1) % 7;
    expect((await request(path, { action: 'add_hours', revision: initial.revision, locationId, weekday, startTime: '09:00', endTime: '17:00' }, staff)).status).toBe(200);
    const added = await read(); expect(added.hours).toHaveLength(2); expect(added.revision).toBeGreaterThan(initial.revision);
    const id = added.hours.find((item: { weekday: number }) => item.weekday === weekday).id;
    expect((await request(path, { action: 'remove_hours', revision: added.revision, id }, staff)).status).toBe(200);
    expect((await request(path, { action: 'add_time_off', revision: (await read()).revision, locationId, date, startTime: '18:00', endTime: '19:00' }, staff)).status).toBe(200);
    const off = await read(); expect(off.timeOff).toHaveLength(1);
    expect((await request(path, { action: 'remove_time_off', revision: off.revision, id: off.timeOff[0].id }, staff)).status).toBe(200);
    expect((await read()).timeOff).toHaveLength(0);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM audit_events WHERE entity_type='staff_schedule'").get()!.n).toBe(4);
  });
  it('protects existing requests, cleanup time, and weekly hours used by appointments', async () => {
    const { staff, locationId, date } = await staffFixture();
    const page = await (await request(path, undefined, staff)).json();
    const off = { action: 'add_time_off', revision: page.revision, locationId, date, startTime: '09:00', endTime: '10:00' };
    expect((await request(path, off, staff)).status).toBe(409);
    expect((await request(path, { ...off, startTime: '09:45', endTime: '09:55' }, staff)).status).toBe(409);
    expect((await request(path, { action: 'remove_hours', revision: page.revision, id: 'book-hours' }, staff)).status).toBe(409);
    expect(db.sqlite.prepare('SELECT status FROM appointments').get()!.status).toBe('requested');
    expect(db.sqlite.prepare("SELECT active FROM weekly_availability WHERE id='book-hours'").get()!.active).toBe(1);
  });
  it('rejects stale writes, overlapping hours, unauthorized locations and foreign IDs', async () => {
    const { staff, locationId, date, alice } = await staffFixture();
    const page = await (await request(path, undefined, staff)).json();
    const body = { action: 'add_hours', revision: page.revision, locationId, weekday: new Date(`${date}T00:00:00Z`).getUTCDay(), startTime: '10:00', endTime: '11:00' };
    expect((await request(path, body, staff)).status).toBe(409);
    expect((await request(path, { ...body, locationId: 'foreign' }, staff)).status).toBe(400);
    expect((await request(path, { ...body, revision: page.revision - 1 }, staff)).status).toBe(409);
    expect((await request(path, { action: 'remove_hours', revision: page.revision, id: 'foreign' }, staff)).status).toBe(404);
    expect((await request(path, undefined, alice)).status).toBe(403);
    expect((await request(path, { ...body, staffId: 'other' }, staff)).status).toBe(400);
    const fresh = await createSession(env, 'professional'); expect((await request(path, undefined, fresh)).status).toBe(403);
    expect(JSON.stringify(page)).not.toMatch(/customerName|customerId|customerNote|password|alice@example/);
    const span = wallWindow(date, '18:00', '19:00', 'America/New_York')!; const now = new Date().toISOString();
    db.sqlite.prepare("INSERT INTO schedule_exceptions(id,staff_id,starts_at,ends_at,exception_type,created_by_user_id,created_at,updated_at) VALUES ('shop-time-off','book-staff',?,?,'time_off','alice',?,?)")
      .run(new Date(span.start).toISOString(), new Date(span.end).toISOString(), now, now);
    const updated = await (await request(path, undefined, staff)).json(); expect(updated.timeOff[0].canRemove).toBe(false);
    expect((await request(path, { action: 'remove_time_off', revision: updated.revision, id: 'shop-time-off' }, staff)).status).toBe(404);
  });
  it('fails closed for malformed appointment reservations and clock-change dates', async () => {
    const { staff, locationId, date } = await staffFixture();
    db.sqlite.exec("UPDATE appointments SET reserved_until='invalid'");
    const page = await (await request(path, undefined, staff)).json();
    const body = { action: 'add_time_off', revision: page.revision, locationId, date, startTime: '18:00', endTime: '19:00' };
    expect((await request(path, body, staff)).status).toBe(409);
    let year = new Date().getUTCFullYear();
    const fallDate = (value: number) => new Date(Date.UTC(value, 10, 1 + (7 - new Date(Date.UTC(value, 10, 1)).getUTCDay()) % 7)).toISOString().slice(0, 10);
    if (Date.parse(fallDate(year)) < Date.now()) year++;
    expect((await request(path, { ...body, date: fallDate(year), startTime: '01:00', endTime: '02:00' }, staff)).status).toBe(400);
  });
  it('rechecks revision and MFA inside the schedule transaction', async () => {
    const { staff, locationId, date } = await staffFixture();
    const page = await (await request(path, undefined, staff)).json();
    const original = db.batch.bind(db); let calls = 0;
    const spy = vi.spyOn(db, 'batch').mockImplementation(async <T>(statements: Statement[]) => {
      calls++; if (calls === 2) db.sqlite.exec("UPDATE sessions SET mfa_until=NULL WHERE user_id='professional'");
      return original<T>(statements);
    });
    expect((await request(path, { action: 'add_time_off', revision: page.revision, locationId, date, startTime: '18:00', endTime: '19:00' }, staff)).status).toBe(409);
    spy.mockRestore(); expect(db.sqlite.prepare('SELECT count(*) AS n FROM schedule_exceptions').get()!.n).toBe(0);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM audit_events WHERE entity_type='staff_schedule'").get()!.n).toBe(0);
  });
  it('protects proposed appointment times and active holds', async () => {
    const { staff, locationId, date } = await staffFixture();
    const range = wallWindow(date, '18:00', '19:00', 'America/New_York')!;
    db.sqlite.prepare('UPDATE appointments SET proposed_starts_at=?,proposed_ends_at=?').run(new Date(range.start).toISOString(), new Date(range.end).toISOString());
    const read = async () => (await (await request(path, undefined, staff)).json()).revision;
    const body = { action: 'add_time_off', locationId, date, startTime: '18:00', endTime: '19:00' };
    expect((await request(path, { ...body, revision: await read() }, staff)).status).toBe(409);
    db.sqlite.exec('UPDATE appointments SET proposed_starts_at=NULL,proposed_ends_at=NULL');
    const now = new Date().toISOString();
    db.sqlite.prepare("INSERT INTO appointment_holds(id,staff_id,service_id,location_id,starts_at,ends_at,expires_at,created_at) VALUES ('schedule-hold','book-staff','book-service',?,?,?,?,?)")
      .run(locationId, new Date(range.start).toISOString(), new Date(range.end).toISOString(), new Date(Date.now() + 60000).toISOString(), now);
    expect((await request(path, { ...body, revision: await read() }, staff)).status).toBe(409);
  });
  it('rolls back the audit receipt when a schedule mutation fails', async () => {
    const { staff, locationId, date } = await staffFixture();
    const page = await (await request(path, undefined, staff)).json();
    db.sqlite.exec("CREATE TRIGGER reject_time_off BEFORE INSERT ON schedule_exceptions BEGIN SELECT RAISE(ABORT,'test'); END;");
    expect((await request(path, { action: 'add_time_off', revision: page.revision, locationId, date, startTime: '18:00', endTime: '19:00' }, staff)).status).toBe(500);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM audit_events WHERE entity_type='staff_schedule'").get()!.n).toBe(0);
  });
  it('does not return a former profile’s schedule if profile ownership changes during the read', async () => {
    const { staff } = await staffFixture(); await seed('replacement-user', 'staff');
    const original = db.batch.bind(db);
    const spy = vi.spyOn(db, 'batch').mockImplementation(async <T>(statements: Statement[]) => {
      const result = await original<T>(statements); const now = new Date().toISOString();
      db.sqlite.exec("UPDATE staff_profiles SET user_id='replacement-user' WHERE id='book-staff'");
      db.sqlite.prepare("INSERT INTO staff_profiles(id,user_id,professional_name,public_slug,setup_status,created_at,updated_at) VALUES ('replacement-profile','professional','Replacement','replacement','approved',?,?)").run(now, now);
      return result;
    });
    const response = await request(path, undefined, staff); spy.mockRestore();
    expect(response.status).toBe(403); expect(await response.text()).not.toContain('book-hours');
  });
});
describe('assigned professional visits', () => {
  const path = '/me/professional/visits';
  it('lists accepted website visits and reveals the customer note only in the scoped detail', async () => {
    const fixture = await staffFixture();
    expect((await request(fixture.path, fixture.decision, fixture.staff)).status).toBe(200);
    const page = await (await request(path, undefined, fixture.staff)).json(); expect(page.items).toHaveLength(1); expect(page.needsTimeReview).toBe(0);
    expect(JSON.stringify(page)).not.toMatch(/customerNote|priceCents|sortAt|alice@example|password|internal_note/);
    const detail = await (await request(`${path}/${fixture.id}`, undefined, fixture.staff)).json();
    expect(detail.visit.customerNote).toBe('A test note'); expect(detail.visit.priceCents).toBe(3200);
    expect(JSON.stringify(detail)).not.toMatch(/alice@example|customer_user_id|password|internal_note/);
    expect((await request(`${path}/${fixture.id}`, {}, fixture.staff)).status).toBe(400);
    db.sqlite.exec("UPDATE appointments SET source='migration'");
    expect((await request(`${path}/${fixture.id}`, undefined, fixture.staff)).status).toBe(404);
  });
  it('retains overdue active visits, separates completed history, and flags invalid times', async () => {
    const { staff, locationId } = await staffFixture(); const now = new Date().toISOString();
    const future = new Date(Date.now() + 86400000).toISOString(); const end = new Date(Date.now() + 90000000).toISOString();
    for (const [id, state, start, finish, assigned] of [
      ['future', 'confirmed', future, end, 'book-staff'], ['old-active', 'in_service', '2000-01-01T09:00:00Z', '2000-01-01T10:00:00Z', 'book-staff'],
      ['past', 'confirmed', '2000-01-01T09:00:00Z', '2000-01-01T10:00:00Z', 'book-staff'], ['completed', 'completed', future, end, 'book-staff'],
      ['unassigned', 'confirmed', future, end, null], ['invalid', 'confirmed', null, null, 'book-staff'],
    ] as const) db.sqlite.prepare("INSERT INTO appointments(id,customer_user_id,requested_staff_id,assigned_staff_id,service_id,location_id,price_cents,status,starts_at,ends_at,created_at,updated_at) VALUES (?,'alice','book-staff',?,'book-service',?,3200,?,?,?,?,?)").run(id, assigned, locationId, state, start, finish, now, now);
    const page = await (await request(path, undefined, staff)).json(); expect(page.items.map((item: { id: string }) => item.id)).toEqual(['old-active', 'past', 'future']); expect(page.needsTimeReview).toBe(1);
    expect((await request(`${path}/completed`, undefined, staff)).status).toBe(200);
  });
  it('paginates equal-time visits by ID and binds the cursor to the professional', async () => {
    const { staff, locationId } = await staffFixture(); const now = new Date().toISOString();
    const start = new Date(Date.now() + 86400000).toISOString(); const end = new Date(Date.now() + 90000000).toISOString();
    for (let i = 0; i < 30; i++) db.sqlite.prepare("INSERT INTO appointments(id,customer_user_id,assigned_staff_id,service_id,location_id,price_cents,status,starts_at,ends_at,created_at,updated_at) VALUES (?,'alice','book-staff','book-service',?,3200,'confirmed',?,?,?,?)").run(`visit-${String(i).padStart(2, '0')}`, locationId, start, end, now, now);
    const first = await (await request(path, undefined, staff)).json(); expect(first.items).toHaveLength(25);
    const second = await (await request(`${path}?cursor=${first.nextCursor}`, undefined, staff)).json(); expect(second.items).toHaveLength(5); expect(second.nextCursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map((item: { id: string }) => item.id)).size).toBe(30);
    expect((await request(`${path}?cursor=${first.nextCursor}bad`, undefined, staff)).status).toBe(400);
    const other = await seed('other-visitor', 'owner'); await enrollMfa(other);
    db.sqlite.prepare("INSERT INTO staff_profiles(id,user_id,professional_name,public_slug,setup_status,created_at,updated_at) VALUES ('other-chair','other-visitor','Other','other-visits','approved',?,?)").run(now, now);
    expect((await request(`${path}?cursor=${first.nextCursor}`, undefined, other)).status).toBe(400);
    const foreign = await request(`${path}/visit-00`, undefined, other); const absent = await request(`${path}/missing`, undefined, other);
    expect(foreign.status).toBe(404); expect(await foreign.text()).toBe(await absent.text());
    db.sqlite.exec("UPDATE appointments SET assigned_staff_id='other-chair',requested_staff_id='book-staff' WHERE id='visit-00'");
    expect((await request(`${path}/visit-00`, undefined, staff)).status).toBe(404);
  });
  it('enforces the operations gate, current MFA, and final query authorization', async () => {
    const fixture = await staffFixture(); expect((await request(fixture.path, fixture.decision, fixture.staff)).status).toBe(200);
    const fresh = await createSession(env, 'professional');
    expect((await request(path, undefined, fresh)).status).toBe(403);
    expect((await request(path, undefined, fixture.alice)).status).toBe(403);
    env.STAFF_OPERATIONS_ENABLED = 'false'; expect((await request(path, undefined, fixture.staff)).status).toBe(503); env.STAFF_OPERATIONS_ENABLED = 'true';
    const original = db.batch.bind(db);
    const spy = vi.spyOn(db, 'batch').mockImplementation(async <T>(statements: Statement[]) => {
      db.sqlite.exec("UPDATE sessions SET mfa_until=NULL WHERE user_id='professional'"); return original<T>(statements);
    });
    const result = await (await request(path, undefined, fixture.staff)).json(); spy.mockRestore();
    expect(result.items).toEqual([]); expect(result.needsTimeReview).toBe(0);
    expect((await request(`${path}/${fixture.id}`, undefined, fixture.staff)).status).toBe(403);
  });
});
describe('professional appointment decisions', () => {
  it('distinguishes disabled access, setup and approval while preventing cross-role data access', async () => {
    const { alice, staff, path } = await staffFixture();
    expect((await request(path, undefined, alice)).status).toBe(403);
    const owner = await seed('owner', 'owner');
    expect((await (await request('/me/professional', undefined, owner)).json()).state).toBe('setup_required');
    expect((await request(path, undefined, owner)).status).toBe(403);
    const now = new Date().toISOString();
    db.sqlite.prepare("INSERT INTO staff_profiles(id,user_id,professional_name,public_slug,setup_status,created_at,updated_at) VALUES ('owner-chair','owner','Owner','owner','approved',?,?)").run(now, now);
    await enrollMfa(owner);
    const foreign = await request(path, undefined, owner); const missing = await request('/me/professional/requests/missing', undefined, owner);
    expect(foreign.status).toBe(404); expect(await foreign.text()).toBe(await missing.text());
    for (const state of ['pending_review', 'disabled']) {
      db.sqlite.prepare("UPDATE staff_profiles SET setup_status=? WHERE id='book-staff'").run(state);
      expect((await (await request('/me/professional', undefined, staff)).json()).state).toBe(state);
      expect((await request(path, undefined, staff)).status).toBe(403);
    }
    env.STAFF_OPERATIONS_ENABLED = 'false';
    expect((await request('/me/professional/requests', undefined, staff)).status).toBe(503);
  });
  it('confirms once after reauthentication and leaves one transactional notification per recipient', async () => {
    const { staff, path, decision, id } = await staffFixture();
    expect((await request(path, { ...decision, currentPassword: 'wrong' }, staff)).status).toBe(400);
    expect((await request(path, { ...decision, assignedStaffId: 'other' }, staff)).status).toBe(400);
    const confirmed = await request(path, decision, staff); expect(confirmed.status).toBe(200);
    expect((await confirmed.json()).request.status).toBe('confirmed');
    expect((await request(path, decision, staff)).status).toBe(200);
    expect((await request(path, { ...decision, action: 'decline', decisionKey: randomUUID() }, staff)).status).toBe(409);
    expect(db.sqlite.prepare('SELECT assigned_staff_id FROM appointments WHERE id=?').get(id)!.assigned_staff_id).toBe('book-staff');
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM appointment_events WHERE event_type='professional_confirmed'").get()!.n).toBe(1);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM appointment_notifications').get()!.n).toBe(4);
    expect(deliveries).toHaveLength(0);
  });
  it('blocks stale decisions and conflicts while allowing a declined request to release its time', async () => {
    const { staff, path, decision, available, payload, locationId } = await staffFixture();
    expect((await request(path, { ...decision, updatedAt: 'stale' }, staff)).status).toBe(409);
    const now = new Date().toISOString();
    db.sqlite.prepare(`INSERT INTO schedule_exceptions(id,staff_id,location_id,starts_at,ends_at,exception_type,created_by_user_id,created_at,updated_at)
      VALUES ('late-block','book-staff',?,?,?,'blocked','professional',?,?)`).run(locationId, payload.startsAt, new Date(Date.parse(payload.startsAt) + 3600000).toISOString(), now, now);
    expect((await request(path, decision, staff)).status).toBe(409);
    expect((await request(path, { ...decision, action: 'decline' }, staff)).status).toBe(200);
    db.sqlite.exec("DELETE FROM schedule_exceptions WHERE id='late-block'");
    expect((await available()).slots.some((slot: { startsAt: string }) => slot.startsAt === payload.startsAt)).toBe(true);
  });
  it('rejects authorization removal between schedule validation and the decision write', async () => {
    const { staff, path, decision } = await staffFixture();
    const original = db.batch.bind(db); let first = true;
    const spy = vi.spyOn(db, 'batch').mockImplementation(async <T>(statements: Statement[]) => {
      const result = await original<T>(statements);
      if (first) { first = false; db.sqlite.exec("UPDATE users SET role='customer' WHERE id='professional'"); }
      return result;
    });
    expect((await request(path, decision, staff)).status).toBe(409); spy.mockRestore();
    expect(db.sqlite.prepare('SELECT status FROM appointments').get()!.status).toBe('requested');
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM appointment_notifications').get()!.n).toBe(2);
  });
  it('paginates only this professional’s requests and ties cursors to the account', async () => {
    const { staff, locationId } = await staffFixture();
    const now = new Date().toISOString();
    for (let index = 0; index < 30; index++) db.sqlite.prepare(`INSERT INTO appointments(id,customer_user_id,requested_staff_id,service_id,location_id,price_cents,status,created_at,updated_at)
      VALUES (?,'alice','book-staff','book-service',?,3200,'requested',?,?)`).run(`queue-${index}`, locationId, now, now);
    const first = await (await request('/me/professional/requests', undefined, staff)).json(); expect(first.items).toHaveLength(25);
    expect(JSON.stringify(first)).not.toMatch(/alice@example|password_hash|internal_note|customer_user_id/);
    const second = await (await request(`/me/professional/requests?cursor=${first.nextCursor}`, undefined, staff)).json(); expect(second.items).toHaveLength(6);
    expect(new Set([...first.items, ...second.items].map((item: { id: string }) => item.id)).size).toBe(31);
    expect((await request(`/me/professional/requests?cursor=${first.nextCursor}bad`, undefined, staff)).status).toBe(400);
    const other = await seed('other-professional', 'staff');
    db.sqlite.prepare("INSERT INTO staff_profiles(id,user_id,professional_name,public_slug,setup_status,created_at,updated_at) VALUES ('other-chair','other-professional','Other','other','approved',?,?)").run(now, now);
    await enrollMfa(other);
    expect((await request(`/me/professional/requests?cursor=${first.nextCursor}`, undefined, other)).status).toBe(400);
    expect((await (await request('/me/professional/requests', undefined, other)).json()).items).toEqual([]);
  });
  it('rolls back the decision when its notification cannot be queued', async () => {
    const { staff, path, decision } = await staffFixture();
    db.sqlite.exec("CREATE TRIGGER fail_notice BEFORE INSERT ON appointment_notifications BEGIN SELECT RAISE(ABORT,'test'); END;");
    expect((await request(path, decision, staff)).status).toBe(500);
    expect(db.sqlite.prepare('SELECT status FROM appointments').get()!.status).toBe('requested');
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM appointment_events WHERE event_type='professional_confirmed'").get()!.n).toBe(0);
  });
});
describe('appointment email outbox', () => {
  it('does nothing while disabled and records provider acceptance without leaking appointment details', async () => {
    await staffFixture();
    await deliverAppointmentNotifications(env); expect(deliveries).toHaveLength(0);
    env.APPOINTMENT_EMAIL_ENABLED = 'true';
    const stats = await deliverAppointmentNotifications(env); expect(stats.accepted).toBe(2);
    expect(deliveries).toHaveLength(2);
    expect(JSON.stringify(deliveries)).not.toMatch(/A test note|Test cut|Customer alice|3200/);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM appointment_notifications WHERE status='accepted' AND payload_json IS NULL AND recipient_email IS NULL").get()!.n).toBe(2);
    await deliverAppointmentNotifications(env); expect(deliveries).toHaveLength(2);
  });
  it('freezes the provider key and payload across uncertain retries, then stops outside its safe window', async () => {
    await staffFixture(); env.APPOINTMENT_EMAIL_ENABLED = 'true';
    db.sqlite.exec("DELETE FROM appointment_notifications WHERE audience='professional'");
    const attempts: { key: string | null; body: string }[] = [];
    vi.mocked(fetch).mockImplementation(async (_url, init) => { attempts.push({ key: new Headers(init!.headers).get('Idempotency-Key'), body: String(init!.body) }); throw new Error('Timeout after acceptance'); });
    expect((await deliverAppointmentNotifications(env)).retried).toBe(1);
    db.sqlite.exec("UPDATE appointment_notifications SET next_attempt_at='2000-01-01T00:00:00Z'");
    env.MAIL_FROM = 'Changed Sender <changed@example.test>';
    expect((await deliverAppointmentNotifications(env)).retried).toBe(1);
    expect(attempts[0]).toEqual(attempts[1]);
    db.sqlite.exec("UPDATE appointment_notifications SET next_attempt_at='2000-01-01T00:00:00Z',first_attempt_at='2000-01-01T00:00:00Z'");
    expect((await deliverAppointmentNotifications(env)).failed).toBe(1); expect(attempts).toHaveLength(2);
  });
  it('uses the current verified recipient initially and suppresses changed recipients or removed professionals on retry', async () => {
    await staffFixture(); env.APPOINTMENT_EMAIL_ENABLED = 'true';
    db.sqlite.exec("UPDATE users SET email='new-alice@example.test' WHERE id='alice'; UPDATE staff_profiles SET setup_status='disabled'");
    vi.mocked(fetch).mockRejectedValue(new Error('Uncertain response'));
    const first = await deliverAppointmentNotifications(env); expect(first.retried).toBe(1); expect(first.suppressed).toBe(1);
    expect(db.sqlite.prepare("SELECT recipient_email FROM appointment_notifications WHERE audience='customer'").get()!.recipient_email).toBe('new-alice@example.test');
    db.sqlite.exec("UPDATE users SET email='changed-again@example.test' WHERE id='alice'; UPDATE appointment_notifications SET next_attempt_at='2000-01-01T00:00:00Z' WHERE status='retry'");
    expect((await deliverAppointmentNotifications(env)).suppressed).toBe(1);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
  it('recovers expired leases and stops retrying permanent provider rejections', async () => {
    await staffFixture(); env.APPOINTMENT_EMAIL_ENABLED = 'true';
    db.sqlite.exec("DELETE FROM appointment_notifications WHERE audience='professional'; UPDATE appointment_notifications SET status='sending',lease_token='abandoned',lease_until='2000-01-01T00:00:00Z'");
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 422 }));
    expect((await deliverAppointmentNotifications(env)).failed).toBe(1);
    expect(db.sqlite.prepare('SELECT status,last_error_code FROM appointment_notifications').get()).toEqual({ status: 'failed', last_error_code: 'provider_rejected' });
    await deliverAppointmentNotifications(env); expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
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

describe('finalized sales and cash receipts', () => {
  async function fixture() {
    env.STAFF_OPERATIONS_ENABLED = 'true'; env.CASH_SALES_ENABLED = 'true'; env.COMMERCE_ENABLED = 'true';
    const owner = await seed('cash-owner', 'owner'); await enrollMfa(owner);
    const alice = await seed('alice'); const bob = await seed('bob'); const now = seedRecords();
    db.sqlite.prepare("INSERT INTO register_operations(id,register_id,actor_user_id,request_key,fingerprint,kind,amount_cents,reason,created_at) VALUES ('opening-test','cash-register-test','cash-owner','opening-key','test-only','open',10000,'Test float',?)").run(now);
    db.sqlite.prepare("INSERT INTO cash_register_sessions(id,opening_operation_id,opening_cents,created_at) VALUES ('cash-register-test','opening-test',10000,?)").run(now);
    db.sqlite.exec("UPDATE appointments SET status='completed';");
    db.sqlite.prepare("INSERT INTO staff_profiles(id,user_id,professional_name,public_slug,created_at,updated_at) VALUES ('cash-professional','cash-owner','Cash Barber','cash-barber',?,?)").run(now,now);
    db.sqlite.exec("UPDATE appointments SET assigned_staff_id='cash-professional'");
    const input: EstimateInput = { appointmentId: 'detail-appointment', orderId: null, discountCents: 101, discountReason: 'Loyalty', taxCents: 0, shippingCents: 0, chargeNote: 'Test zero charge confirmed' };
    const estimate = async (data = input) => {
      const preview = await request('/me/sales/preview', data, owner); expect(preview.status, await preview.clone().text()).toBe(200);
      const saved = await request('/me/sales', { ...data, token: (await preview.json()).token, requestKey: randomUUID(), currentPassword: password }, owner);
      expect(saved.status,await saved.clone().text()).toBe(200); return (await saved.json()).estimateId as string;
    };
    const finalize = async (savedId?: string) => {
      const estimateId = savedId ?? await estimate();
      const response = await request('/me/counter', { estimateId, currentPassword: password }, owner);
      expect(response.status,await response.clone().text()).toBe(200); return (await response.json()).saleId as string;
    };
    const action = (kind = 'payment', overrides = {}) => ({ action: kind, cashReceivedCents: kind === 'payment' ? 3000 : 0, tipCents: kind === 'payment' ? 201 : 0, reason: kind === 'payment' ? '' : 'Test correction', requestKey: randomUUID(), currentPassword: password, registerId:kind==='void'?'':'cash-register-test', ...overrides });
    return { owner, alice, bob, input, estimate, finalize, action, now };
  }
  it('finalizes exact amounts, records cash/change/tips once, and preserves private immutable receipt snapshots', async () => {
    const f = await fixture(); db.sqlite.exec("UPDATE services SET name='<script>bad()</script>'");
    const estimateId = await f.estimate(); const saleId = await f.finalize(estimateId); expect(await f.finalize(estimateId)).toBe(saleId);
    const path = `/me/counter/${saleId}`; const body = f.action();
    const paid = await request(path, body, f.owner); expect(paid.status,await paid.clone().text()).toBe(200); const result = await paid.json();
    expect(await (await request(path, body, f.owner)).json()).toEqual(result);
    expect((await request(path, {...body,tipCents:202},f.owner)).status).toBe(409);
    const sale = (await (await request(path,undefined,f.owner)).json()).sale;
    expect(sale).toMatchObject({state:'paid',totalCents:2399});
    expect(sale.receipts[0]).toMatchObject({amountCents:2600,tipCents:201,cashReceivedCents:3000,changeCents:400});
    const documentPath = `/me/receipts/${result.receiptId}/document`;
    for (const other of [f.bob,f.owner]) expect((await request(documentPath,undefined,other)).status).toBe(404);
    const document = await request(documentPath,undefined,f.alice); const html = await document.text();
    expect(html).toContain('Cash payment receipt'); expect(html).toContain('$26.00'); expect(html).toContain('&lt;script&gt;');
    expect(html).not.toMatch(/<script>|SECRET|cash-owner|fingerprint|request_key/);
    expect(document.headers.get('Cache-Control')).toContain('no-store'); expect(document.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    db.sqlite.exec("UPDATE services SET name='Changed',price_cents=7777; UPDATE users SET display_name='Changed' WHERE id='alice'");
    expect(await (await request(documentPath,undefined,f.alice)).text()).toBe(html);
    expect((await (await request('/me/receipts',undefined,f.alice)).json()).items).toHaveLength(1);
    expect((await (await request('/me/receipts',undefined,f.bob)).json()).items).toHaveLength(0);
    expect(() => db.sqlite.exec('DELETE FROM finalized_sales')).toThrow(/retention/);
    expect(() => db.sqlite.exec('UPDATE cash_sale_events SET amount_cents=0')).toThrow(/immutable/);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM audit_events WHERE action='cash_payment_recorded'").get()!.n).toBe(1);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM earning_entries').get()!.n).toBe(0);
  });
  it('requires current manager authorization, enabled cash, known charges and completed native services', async () => {
    const f = await fixture(); const id = await f.estimate(); const body = {estimateId:id,currentPassword:password};
    const staff = await seed('cash-staff','staff'); await enrollMfa(staff);
    for (const session of [f.alice,staff]) expect((await request('/me/counter',body,session)).status).toBe(403);
    expect((await request('/me/counter',{...body,currentPassword:'wrong'},f.owner)).status).toBe(400);
    env.CASH_SALES_ENABLED='false'; expect((await request('/me/counter',body,f.owner)).status).toBe(503); env.CASH_SALES_ENABLED='true';
    db.sqlite.exec("UPDATE appointments SET status='confirmed'"); expect((await request('/me/counter',body,f.owner)).status).toBe(409);
    db.sqlite.exec("UPDATE appointments SET status='completed'");
    const unknown=await f.estimate({...f.input,taxCents:null}); expect((await request('/me/counter',{...body,estimateId:unknown},f.owner)).status).toBe(409);
    db.sqlite.exec("UPDATE appointments SET price_cents=2800"); expect((await request('/me/counter',body,f.owner)).status).toBe(409);
    db.sqlite.exec("UPDATE sessions SET mfa_until=NULL WHERE user_id='cash-owner'"); expect((await request('/me/counter',body,f.owner)).status).toBe(403);
  });
  it('rejects underpayment, arbitrary amounts, duplicate charges, voids after payment, and double refunds', async () => {
    const f=await fixture(); const saleId=await f.finalize(); const path=`/me/counter/${saleId}`;
    expect((await request(path,f.action('refund'),f.owner)).status).toBe(409);
    for (const overrides of [{cashReceivedCents:2599},{tipCents:1.1},{cashReceivedCents:-1},{amountCents:1}]) expect((await request(path,f.action('payment',overrides),f.owner)).status).toBe(400);
    expect((await request(path,f.action(),f.owner)).status).toBe(200);
    expect((await request(path,f.action(),f.owner)).status).toBe(409);
    expect((await request(path,f.action('void'),f.owner)).status).toBe(409);
    const refund=f.action('refund'); const first=await request(path,refund,f.owner); expect(first.status).toBe(200);
    expect(await (await request(path,refund,f.owner)).json()).toEqual(await first.json());
    expect((await request(path,f.action('refund'),f.owner)).status).toBe(409);
    const sale=(await (await request(path,undefined,f.owner)).json()).sale;
    expect(sale.state).toBe('refunded'); expect(sale.receipts.find((r:{kind:string})=>r.kind==='refund')).toMatchObject({amountCents:2600,tipCents:201,originalReceiptId:sale.receipts.find((r:{kind:string})=>r.kind==='payment').id});
    expect(db.sqlite.prepare('SELECT status FROM appointments').get()!.status).toBe('completed');
    const replacement=await f.estimate(); expect((await request('/me/counter',{estimateId:replacement,currentPassword:password},f.owner)).status).toBe(409);
  });
  it('allows corrected estimates after an unpaid void, never a second live sale for the same source', async () => {
    const f=await fixture(); const id=await f.estimate(); const sale=await f.finalize(id); const second=await f.estimate();
    expect((await request('/me/counter',{estimateId:second,currentPassword:password},f.owner)).status).toBe(409);
    expect((await request(`/me/counter/${sale}`,f.action('void'),f.owner)).status).toBe(200);
    expect(await f.finalize(id)).toBe(sale); expect(await f.finalize(second)).not.toBe(sale);
    expect((await request(`/me/counter/${sale}`,f.action(),f.owner)).status).toBe(409);
    expect((await (await request('/me/receipts',undefined,f.alice)).json()).items).toHaveLength(0);
  });
  it.each([
    "UPDATE users SET role='customer' WHERE id='cash-owner'",
    "UPDATE sessions SET mfa_until=NULL WHERE user_id='cash-owner'",
    "DELETE FROM sessions WHERE user_id='cash-owner'",
    "UPDATE account_credentials SET password_hash='changed' WHERE user_id='cash-owner'",
  ])('rejects a cash write when access changes immediately before commit: %s',async sql=>{
    const f=await fixture();const sale=await f.finalize();const batch=env.DB.batch.bind(env.DB);let once=true;
    const spy=vi.spyOn(env.DB,'batch').mockImplementation(async statements=>{if(once&&statements.length===3){once=false;db.sqlite.exec(sql);}return batch(statements);});
    expect((await request(`/me/counter/${sale}`,f.action(),f.owner)).status).toBe(409);spy.mockRestore();
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM cash_sale_events').get()!.n).toBe(0);
  });
  it('rolls back cash events if the audit write fails and recovers the same request on retry', async()=>{
    const f=await fixture(); const sale=await f.finalize();const body=f.action();
    db.sqlite.exec("CREATE TRIGGER fail_cash_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'test audit failure'); END;");
    expect((await request(`/me/counter/${sale}`,body,f.owner)).status).toBe(500);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM cash_sale_events').get()!.n).toBe(0);
    db.sqlite.exec('DROP TRIGGER fail_cash_audit');expect((await request(`/me/counter/${sale}`,body,f.owner)).status).toBe(200);
  });
  it.each([
    "UPDATE account_credentials SET password_hash='changed' WHERE user_id='cash-owner'",
    "UPDATE appointments SET price_cents=9999",
    "UPDATE appointments SET status='cancelled'",
  ])('blocks finalization when credentials or source records change during commit: %s',async sql=>{
    const f=await fixture();const estimateId=await f.estimate();const batch=env.DB.batch.bind(env.DB);let once=true;
    const spy=vi.spyOn(env.DB,'batch').mockImplementation(async statements=>{if(once&&statements.length===2){once=false;db.sqlite.exec(sql);}return batch(statements);});
    expect((await request('/me/counter',{estimateId,currentPassword:password},f.owner)).status).toBe(409);spy.mockRestore();
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM finalized_sales').get()!.n).toBe(0);
  });
  it('issues guest receipts only through the authorized counter and retains history when cash entry is paused',async()=>{
    const f=await fixture();db.sqlite.exec("UPDATE appointments SET customer_user_id=NULL,guest_name='Walk-in guest'");
    const sale=await f.finalize();const response=await request(`/me/counter/${sale}`,f.action(),f.owner);expect(response.status).toBe(200);
    const id=(await response.json()).receiptId;
    expect((await request(`/me/receipts/${id}/document`,undefined,f.alice)).status).toBe(404);
    expect((await request(`/me/cash-receipts/${id}/document`,undefined,f.alice)).status).toBe(403);
    env.CASH_SALES_ENABLED='false';
    expect((await request(`/me/cash-receipts/${id}/document`,undefined,f.owner)).status).toBe(200);
    expect((await request(`/me/counter/${sale}`,f.action('refund'),f.owner)).status).toBe(503);
  });
  it('paginates receipt and counter history with actor-bound cursors',async()=>{
    const f=await fixture();const sale=await f.finalize();expect((await request(`/me/counter/${sale}`,f.action(),f.owner)).status).toBe(200);
    const original=db.sqlite.prepare('SELECT * FROM finalized_sales').get()!;const event=db.sqlite.prepare('SELECT * FROM cash_sale_events').get()!;
    for(let i=0;i<26;i++){
      const id=`history-sale-${i.toString().padStart(2,'0')}`;const receiptId=`history-receipt-${i.toString().padStart(2,'0')}`;
      db.sqlite.prepare('INSERT INTO finalized_sales(id,estimate_id,actor_user_id,customer_user_id,snapshot_json,total_cents,created_at) VALUES (?,?,?,?,?,?,?)').run(id,`history-estimate-${i}`,'cash-owner','alice',original.snapshot_json!,original.total_cents!,original.created_at!);
      const snapshot={...JSON.parse(String(event.snapshot_json)),id:receiptId,saleId:id};
      db.sqlite.prepare("INSERT INTO cash_sale_events(id,sale_id,actor_user_id,request_key,fingerprint,kind,amount_cents,tip_cents,snapshot_json,created_at) VALUES (?,?,?,?,?,'payment',?,?,?,?)").run(receiptId,id,'cash-owner',randomUUID(),'test-only',event.amount_cents!,event.tip_cents!,JSON.stringify(snapshot),event.created_at!);
    }
    for(const [path,session,other] of [['/me/receipts',f.alice,f.bob],['/me/counter',f.owner,await seed('other-manager','manager')]] as const){
      if(path==='/me/counter')await enrollMfa(other);
      const first=await (await request(path,undefined,session)).json();expect(first.items).toHaveLength(25);
      const second=await (await request(`${path}?cursor=${encodeURIComponent(first.nextCursor)}`,undefined,session)).json();expect(second.items).toHaveLength(2);expect(second.nextCursor).toBeNull();
      expect(new Set([...first.items,...second.items].map((item:{id:string})=>item.id)).size).toBe(27);
      expect((await request(`${path}?cursor=${encodeURIComponent(first.nextCursor)}`,undefined,other)).status).toBe(400);
    }
  });
  it('requires accepted pickup orders and refund/void before cancellation, preserving stock until fulfillment', async()=>{
    const f=await fixture();
    db.sqlite.prepare("INSERT INTO products(id,name,slug,category,description,base_sku,created_at,updated_at) VALUES ('cash-product','Product','cash-product','test','','CASH',?,?)").run(f.now,f.now);
    db.sqlite.prepare("INSERT INTO product_variants(id,product_id,name,sku,price_cents,stock_on_hand,stock_reserved,created_at,updated_at) VALUES ('cash-variant','cash-product','Standard','CASH-1',2500,10,1,?,?)").run(f.now,f.now);
    db.sqlite.prepare("INSERT INTO order_items(id,order_id,variant_id,product_name,variant_name,sku,quantity,unit_price_cents,created_at) VALUES ('cash-item','detail-order','cash-variant','Product','Standard','CASH-1',1,2500,?)").run(f.now);
    db.sqlite.exec("UPDATE orders SET request_key='native-cash',status='accepted'");
    const input={...f.input,appointmentId:null,orderId:'detail-order'};
    const shippingEstimate=await f.estimate(input);expect((await request('/me/counter',{estimateId:shippingEstimate,currentPassword:password},f.owner)).status).toBe(409);
    db.sqlite.exec("UPDATE orders SET fulfillment_type='pickup',status='submitted'");
    const estimate=await f.estimate(input);expect((await request('/me/counter',{estimateId:estimate,currentPassword:password},f.owner)).status).toBe(409);
    db.sqlite.exec("UPDATE orders SET status='accepted'");const sale=await f.finalize(estimate);
    const cancel=async()=>request('/me/commerce/orders/detail-order',{status:'cancelled',revision:Number(db.sqlite.prepare('SELECT value FROM commerce_revision').get()!.value),trackingNumber:''},f.owner);
    expect((await cancel()).status).toBe(409);
    expect((await request(`/me/counter/${sale}`,f.action(),f.owner)).status).toBe(400); // A merchandise sale cannot receive a service tip.
    expect((await request(`/me/counter/${sale}`,f.action('payment',{tipCents:0}),f.owner)).status).toBe(200);
    const managed=(await (await request('/me/commerce/orders',undefined,f.owner)).json()).orders.find((order:{id:string})=>order.id==='detail-order');
    expect(managed).toMatchObject({saleId:sale,financialState:'paid',status:'accepted'});
    expect((await cancel()).status).toBe(409);
    expect((await request(`/me/counter/${sale}`,f.action('refund'),f.owner)).status).toBe(200);
    expect(db.sqlite.prepare('SELECT stock_on_hand,stock_reserved FROM product_variants').get()).toEqual({stock_on_hand:10,stock_reserved:1});
    expect((await cancel()).status).toBe(200);
    expect(db.sqlite.prepare('SELECT stock_on_hand,stock_reserved FROM product_variants').get()).toEqual({stock_on_hand:10,stock_reserved:0});
  });
  it('reconciles cash, tips, refunds and physical adjustments, then freezes a counted closing snapshot',async()=>{
    const f=await fixture();const sale=await f.finalize();const payment=f.action();
    expect((await request(`/me/counter/${sale}`,payment,f.owner)).status).toBe(200);
    const movement=(action:string,amountCents:number)=>({action,amountCents,registerId:'cash-register-test',reason:'Test movement',token:'',requestKey:randomUUID(),currentPassword:password});
    for(const [action,amount] of [['deposit',1000],['paid_out',600],['paid_in',200]] as const){
      const body=movement(action,amount);const first=await request('/me/register',body,f.owner);expect(first.status).toBe(200);
      expect(await (await request('/me/register',body,f.owner)).json()).toEqual(await first.json());
    }
    expect((await request(`/me/counter/${sale}`,f.action('refund'),f.owner)).status).toBe(200);
    const page=await (await request('/me/register',undefined,f.owner)).json();
    expect(page.open.totals).toEqual({openingCents:10000,paymentsCents:2600,refundsCents:2600,paidInCents:200,paidOutCents:600,depositsCents:1000,entryCount:5,expectedCents:8600});
    const closing={...movement('close',8550),token:page.open.closeToken,reason:'Counted $0.50 short'};
    const first=await request('/me/register',closing,f.owner);expect(first.status).toBe(200);
    expect(await (await request('/me/register',closing,f.owner)).json()).toEqual(await first.json());
    // A cash retry still recovers its original receipt after the shift closes.
    expect((await request(`/me/counter/${sale}`,payment,f.owner)).status).toBe(200);
    const history=await (await request('/me/register',undefined,f.owner)).json();expect(history.open).toBeNull();
    expect(history.items[0].close).toMatchObject({countedCents:8550,varianceCents:-50,totals:page.open.totals});
    expect((await request('/me/register',movement('paid_in',100),f.owner)).status).toBe(409);
    const ledger=await (await request('/me/register/cash-register-test/entries',undefined,f.owner)).json();expect(ledger.items).toHaveLength(5);
    expect(ledger.items.filter((item:{receiptId:string|null})=>item.receiptId)).toHaveLength(2);
    expect(()=>db.sqlite.exec('UPDATE cash_register_entries SET amount_cents=1')).toThrow(/immutable/);
    expect(()=>db.sqlite.exec('DELETE FROM cash_register_closures')).toThrow(/retention/);
  });
  it('pins new cash to its reviewed register and stops a refund when drawer cash was removed',async()=>{
    const f=await fixture();const sale=await f.finalize();const payment=f.action();
    const open=await (await request('/me/register',undefined,f.owner)).json();
    expect((await request('/me/register',{action:'close',registerId:'cash-register-test',amountCents:10000,reason:'',token:open.open.closeToken,requestKey:randomUUID(),currentPassword:password},f.owner)).status).toBe(200);
    const next=await request('/me/register',{action:'open',registerId:'',amountCents:0,reason:'New drawer count',token:'',requestKey:randomUUID(),currentPassword:password},f.owner);expect(next.status).toBe(200);
    const registerId=(await next.json()).registerId;
    expect((await request(`/me/counter/${sale}`,payment,f.owner)).status).toBe(409);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM cash_sale_events').get()!.n).toBe(0);
    expect((await request(`/me/counter/${sale}`,{...payment,registerId,requestKey:randomUUID()},f.owner)).status).toBe(200);
    const deposit={action:'deposit',registerId,amountCents:2600,reason:'Removed for deposit',token:'',requestKey:randomUUID(),currentPassword:password};
    expect((await request('/me/register',deposit,f.owner)).status).toBe(200);
    expect((await request(`/me/counter/${sale}`,f.action('refund',{registerId}),f.owner)).status).toBe(409);
    expect((await (await request('/me/register',undefined,f.owner)).json()).open.totals.expectedCents).toBe(0);
    expect((await (await request(`/me/counter/${sale}`,undefined,f.owner)).json()).sale.state).toBe('paid');
  });
  it('recovers pre-register cash requests without silently assigning historical cash to a drawer',async()=>{
    const f=await fixture();const sale=await f.finalize();const original=f.action();const {registerId:unused,...body}=original;void unused;
    const fingerprint=secretHash(env,JSON.stringify({id:sale,action:'payment',received:3000,tip:201,reason:''}));
    const estimate=(await (await request(`/me/counter/${sale}`,undefined,f.owner)).json()).sale.estimate;
    const snapshot={id:'legacy-paid',saleId:sale,createdAt:f.now,kind:'payment',sale:estimate,amountCents:2600,tipCents:201,cashReceivedCents:3000,changeCents:400,reason:'',originalReceiptId:null,sellerName:'The Kut Shoppe',sellerAddress:'518 Main Street'};
    db.sqlite.prepare("INSERT INTO cash_sale_events(id,sale_id,actor_user_id,request_key,fingerprint,kind,amount_cents,tip_cents,snapshot_json,created_at) VALUES ('legacy-paid',?,'cash-owner',?,?,'payment',2600,201,?,?)").run(sale,body.requestKey,fingerprint,JSON.stringify(snapshot),f.now);
    expect(await (await request(`/me/counter/${sale}`,body,f.owner)).json()).toEqual({receiptId:'legacy-paid'});
    expect((await request(`/me/counter/${sale}`,{...body,tipCents:200},f.owner)).status).toBe(409);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM cash_register_entries').get()!.n).toBe(0);
  });
  it('rechecks sale protection inside cancellation even when a caller predicts the next commerce revision',async()=>{
    const f=await fixture();db.sqlite.exec("UPDATE orders SET request_key='native-cash-race',status='accepted',fulfillment_type='pickup'");
    const revision=Number(db.sqlite.prepare('SELECT value FROM commerce_revision').get()!.value);
    const batch=env.DB.batch.bind(env.DB);let once=true;
    const spy=vi.spyOn(env.DB,'batch').mockImplementation(async statements=>{
      if(once&&statements.length===3){once=false;
        // Model another transaction finalizing this order after the early read.
        db.sqlite.prepare("INSERT INTO finalized_sales(id,estimate_id,actor_user_id,customer_user_id,order_id,snapshot_json,total_cents,created_at) VALUES ('race-sale','race-estimate','cash-owner','alice','detail-order','{}',2500,?)").run(f.now);
      }
      return batch(statements);
    });
    const response=await request('/me/commerce/orders/detail-order',{status:'cancelled',revision:revision+1,trackingNumber:''},f.owner);
    spy.mockRestore();expect(response.status).toBe(409);expect(once).toBe(false);
    expect(db.sqlite.prepare('SELECT status FROM orders').get()!.status).toBe('accepted');
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM audit_events WHERE action='order_processed'").get()!.n).toBe(0);
  });
});

describe('cash register controls',()=>{
  async function fixture(){
    env.STAFF_OPERATIONS_ENABLED='true';env.CASH_SALES_ENABLED='true';
    const owner=await seed('register-owner','owner');await enrollMfa(owner);const other=await seed('register-customer');
    const body=(action='open',amountCents=5000,registerId='',token='')=>({action,amountCents,registerId,token,reason:'Test count',requestKey:randomUUID(),currentPassword:password});
    const openBody=body();const result=await request('/me/register',openBody,owner);expect(result.status,await result.clone().text()).toBe(200);
    return{owner,other,body,openBody,id:(await result.json()).registerId as string};
  }
  it('opens once, binds retries, rejects insufficient cash and keeps customer accounts out',async()=>{
    const f=await fixture();expect((await (await request('/me/register',f.openBody,f.owner)).json()).registerId).toBe(f.id);
    expect((await request('/me/register',{...f.openBody,amountCents:4000},f.owner)).status).toBe(409);
    expect((await request('/me/register',f.body(),f.owner)).status).toBe(409);
    for(const path of ['/me/register',`/me/register/${f.id}`,`/me/register/${f.id}/entries`])expect((await request(path,undefined,f.other)).status).toBe(403);
    expect((await request('/me/register',f.body('paid_out',5001,f.id),f.owner)).status).toBe(409);
    expect((await request('/me/register',{...f.body('paid_in',100,f.id),currentPassword:'wrong'},f.owner)).status).toBe(400);
    expect((await request('/me/register',{...f.body('paid_in',100,f.id),reason:''},f.owner)).status).toBe(400);
  });
  it('invalidates a closing review on balanced intervening movements, enforces variance notes and session binding',async()=>{
    const f=await fixture();const page=await (await request('/me/register',undefined,f.owner)).json();
    expect((await request('/me/register',{...f.body('close',4999,f.id,page.open.closeToken),reason:''},f.owner)).status).toBe(400);
    const manager=await seed('register-manager','manager');await enrollMfa(manager);
    expect((await request('/me/register',f.body('close',5000,f.id,page.open.closeToken),manager)).status).toBe(400);
    for(const kind of ['paid_in','paid_out'])expect((await request('/me/register',f.body(kind,100,f.id),f.owner)).status).toBe(200);
    expect((await request('/me/register',f.body('close',5000,f.id,page.open.closeToken),f.owner)).status).toBe(409);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM cash_register_closures').get()!.n).toBe(0);
  });
  it.each([
    "UPDATE sessions SET mfa_until=NULL WHERE user_id='register-owner'",
    "UPDATE users SET role='customer' WHERE id='register-owner'",
    "UPDATE account_credentials SET password_hash='changed' WHERE user_id='register-owner'",
  ])('rechecks movement authorization at commit: %s',async sql=>{
    const f=await fixture();const batch=env.DB.batch.bind(env.DB);let once=true;
    const spy=vi.spyOn(env.DB,'batch').mockImplementation(async statements=>{if(once&&statements.length===3){once=false;db.sqlite.exec(sql);}return batch(statements);});
    expect((await request('/me/register',f.body('paid_in',100,f.id),f.owner)).status).toBe(409);spy.mockRestore();
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM cash_register_entries').get()!.n).toBe(0);
  });
  it('rolls back a movement and its operation if auditing fails',async()=>{
    const f=await fixture();const body=f.body('paid_in',100,f.id);
    db.sqlite.exec("CREATE TRIGGER fail_register_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'test audit'); END;");
    expect((await request('/me/register',body,f.owner)).status).toBe(500);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM cash_register_entries').get()!.n).toBe(0);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM register_operations').get()!.n).toBe(1);
    db.sqlite.exec('DROP TRIGGER fail_register_audit');expect((await request('/me/register',body,f.owner)).status).toBe(200);
  });
  it('checks closing freshness again inside the commit',async()=>{
    const f=await fixture();const page=await (await request('/me/register',undefined,f.owner)).json();
    const batch=env.DB.batch.bind(env.DB);let once=true;
    const spy=vi.spyOn(env.DB,'batch').mockImplementation(async statements=>{
      if(once&&statements.length===3){once=false;
        db.sqlite.prepare("INSERT INTO register_operations(id,register_id,actor_user_id,request_key,fingerprint,kind,amount_cents,reason,created_at) VALUES ('race-in',?,'register-owner','race-in','test','paid_in',100,'Concurrent cash',?)").run(f.id,new Date().toISOString());
        db.sqlite.prepare("INSERT INTO cash_register_entries(id,register_id,operation_id,kind,amount_cents,reason,created_at) VALUES ('race-entry',?,'race-in','paid_in',100,'Concurrent cash',?)").run(f.id,new Date().toISOString());
      }return batch(statements);
    });
    expect((await request('/me/register',f.body('close',5000,f.id,page.open.closeToken),f.owner)).status).toBe(409);spy.mockRestore();
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM cash_register_closures').get()!.n).toBe(0);
  });
  it('paginates register activity and binds cursors to the viewing account and register',async()=>{
    const f=await fixture();const now=new Date().toISOString();
    for(let i=0;i<27;i++){
      const id=`history-${String(i).padStart(2,'0')}`;
      db.sqlite.prepare("INSERT INTO register_operations(id,register_id,actor_user_id,request_key,fingerprint,kind,amount_cents,reason,created_at) VALUES (?,?,'register-owner',?,'test','paid_in',100,'Test cash',?)").run(id,f.id,id,now);
      db.sqlite.prepare("INSERT INTO cash_register_entries(id,register_id,operation_id,kind,amount_cents,reason,created_at) VALUES (?,?,?,'paid_in',100,'Test cash',?)").run(id,f.id,id,now);
    }
    const path=`/me/register/${f.id}/entries`;const first=await (await request(path,undefined,f.owner)).json();expect(first.items).toHaveLength(25);
    const next=await (await request(`${path}?cursor=${encodeURIComponent(first.nextCursor)}`,undefined,f.owner)).json();expect(next.items).toHaveLength(2);expect(next.nextCursor).toBeNull();
    expect(new Set([...first.items,...next.items].map((item:{id:string})=>item.id)).size).toBe(27);
    const manager=await seed('history-manager','manager');await enrollMfa(manager);
    expect((await request(`${path}?cursor=${encodeURIComponent(first.nextCursor)}`,undefined,manager)).status).toBe(400);
    expect((await (await request('/me/register',undefined,f.owner)).json()).open.totals.expectedCents).toBe(7700);
  });
});

describe('shared sale estimates', () => {
  async function fixture() {
    env.STAFF_OPERATIONS_ENABLED = 'true'; env.COMMERCE_ENABLED = 'true';
    const owner = await seed('sale-owner', 'owner'); await enrollMfa(owner);
    const alice = await seed('alice'); const bob = await seed('bob');
    const now = seedRecords();
    db.sqlite.exec("UPDATE appointments SET status='confirmed';");
    db.sqlite.prepare("INSERT INTO products(id,name,slug,category,description,base_sku,created_at,updated_at) VALUES ('sale-product','Test product','sale-product','test','Test description','SALE',?,?)").run(now, now);
    db.sqlite.prepare("INSERT INTO product_variants(id,product_id,name,sku,price_cents,stock_on_hand,created_at,updated_at) VALUES ('sale-variant','sale-product','Standard','SALE-1',9999,10,?,?)").run(now, now);
    db.sqlite.prepare("INSERT INTO order_items(id,order_id,variant_id,product_name,variant_name,sku,quantity,unit_price_cents,created_at) VALUES ('sale-item','detail-order','sale-variant','Original product','Standard','SALE-1',1,2500,?)").run(now);
    const input: EstimateInput = { appointmentId: 'detail-appointment', orderId: 'detail-order', discountCents: 501, discountReason: 'Customer discount', taxCents: null, shippingCents: null, chargeNote: '' };
    const preview = async (body = input) => { const response = await request('/me/sales/preview', body, owner); expect(response.status).toBe(200); return response.json(); };
    const save = (token: string, body = input, key = randomUUID()) => ({ ...body, token, requestKey: key, currentPassword: password });
    return { owner, alice, bob, input, preview, save };
  }
  it('prepares recorded service and order prices, preserves unknown charges and saves exactly once without payment side effects', async () => {
    const f = await fixture(); const page = await f.preview();
    expect(page.estimate).toMatchObject({ subtotalCents: 5000, discountCents: 501, netCents: 4499, totalCents: null, taxCents: null, shippingCents: null });
    expect(page.estimate.lines.map((line: { unitPriceCents: number }) => line.unitPriceCents)).toEqual([2500, 2500]);
    const body = f.save(page.token); const response = await request('/me/sales', body, f.owner); expect(response.status).toBe(200);
    const saved = await response.json();
    expect(await (await request('/me/sales', body, f.owner)).json()).toEqual(saved);
    expect(await (await request('/me/sales', { ...body, requestKey: randomUUID() }, f.owner)).json()).toEqual(saved);
    expect((await request('/me/sales', { ...body, discountCents: 100 }, f.owner)).status).toBe(409);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM sale_estimates').get()!.n).toBe(1);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM audit_events WHERE action='sale_estimate_issued'").get()!.n).toBe(1);
    expect(db.sqlite.prepare('SELECT status FROM appointments').get()!.status).toBe('confirmed');
    expect(db.sqlite.prepare('SELECT status FROM orders').get()!.status).toBe('submitted');
    expect(db.sqlite.prepare('SELECT stock_on_hand,stock_reserved FROM product_variants').get()).toEqual({ stock_on_hand: 10, stock_reserved: 0 });
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM earning_entries').get()!.n).toBe(0);
    const copy = await request(`/me/estimates/${saved.estimateId}/document`, undefined, f.alice); expect(copy.status).toBe(200);
    expect(await copy.text()).toContain('not an invoice or payment receipt');
  });
  it('enforces customer ownership, staff roles, MFA and safe immutable document snapshots', async () => {
    const f = await fixture();
    const staff = await seed('sale-staff', 'staff'); await enrollMfa(staff);
    for (const session of [f.alice, staff]) expect((await request('/me/sales/preview', f.input, session)).status).toBe(403);
    db.sqlite.exec("UPDATE services SET name='<script>bad()</script>'; UPDATE users SET display_name='<img src=x onerror=bad()>' WHERE id='alice';");
    const page = await f.preview(); const response = await request('/me/sales', f.save(page.token), f.owner); expect(response.status).toBe(200);
    const { estimateId } = await response.json();
    const path = `/me/estimates/${estimateId}/document`;
    expect((await request(path, undefined, f.bob)).status).toBe(404);
    expect((await request(path, undefined, f.owner)).status).toBe(404);
    expect((await request(path)).status).toBe(401);
    const before = await request(path, undefined, f.alice); const html = await before.text();
    expect(html).toContain('&lt;script&gt;'); expect(html).not.toMatch(/<script>|<img |SECRET|password|sale-owner|request_fingerprint/);
    expect(before.headers.get('Cache-Control')).toContain('no-store'); expect(before.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    db.sqlite.exec("UPDATE services SET name='New name'; UPDATE users SET display_name='Changed name' WHERE id='alice'; UPDATE order_items SET unit_price_cents=9000;");
    expect(await (await request(path, undefined, f.alice)).text()).toBe(html);
    expect(() => db.sqlite.exec("UPDATE sale_estimates SET snapshot_json='{}'")).toThrow(/cannot be changed/);
    expect(() => db.sqlite.exec('DELETE FROM sale_estimates')).toThrow(/retention/);
    expect((await (await request('/me/estimates', undefined, f.bob)).json()).items).toEqual([]);
    db.sqlite.exec("UPDATE sessions SET mfa_until=NULL WHERE user_id='sale-owner'");
    expect((await request(`/me/sales/${estimateId}/document`, undefined, f.owner)).status).toBe(403);
  });
  it('rejects changed input, source changes, mismatched customers, unsupported records and incomplete amounts', async () => {
    const f = await fixture(); const page = await f.preview();
    expect((await request('/me/sales', f.save(page.token, { ...f.input, discountCents: 1 }), f.owner)).status).toBe(409);
    expect((await request('/me/sales/preview', { ...f.input, taxCents: 0 }, f.owner)).status).toBe(400);
    expect((await request('/me/sales/preview', { ...f.input, paid: true }, f.owner)).status).toBe(400);
    db.sqlite.exec("UPDATE appointments SET customer_user_id='bob'");
    expect((await request('/me/sales/preview', f.input, f.owner)).status).toBe(409);
    db.sqlite.exec("UPDATE appointments SET customer_user_id='alice',status='cancelled'");
    expect((await request('/me/sales', f.save(page.token), f.owner)).status).toBe(409);
    db.sqlite.exec("UPDATE appointments SET status='confirmed'; UPDATE order_items SET quantity=2;");
    expect((await request('/me/sales/preview', f.input, f.owner)).status).toBe(409);
    db.sqlite.exec("UPDATE order_items SET quantity=1; UPDATE appointments SET price_cents=3000;");
    expect((await request('/me/sales', f.save(page.token), f.owner)).status).toBe(409);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM sale_estimates').get()!.n).toBe(0);
    const determined = { ...f.input, taxCents: 300, shippingCents: 500, chargeNote: 'Confirmed charge estimate' };
    expect((await f.preview(determined)).estimate.totalCents).toBe(5799);
  });
  it('supports account-free guest estimates without allowing guest records to be attached to another customer', async () => {
    const f = await fixture(); db.sqlite.exec("UPDATE appointments SET customer_user_id=NULL,guest_name='Walk-in customer',source='walk_in'");
    expect((await request('/me/sales/preview', f.input, f.owner)).status).toBe(409);
    const input = { ...f.input, orderId: null };
    const preview = await request('/me/sales/preview', input, f.owner); expect(preview.status).toBe(200); const page = await preview.json();
    expect(page.estimate).toMatchObject({ customerName: 'Walk-in customer', shippingCents: 0, totalCents: null });
    const result = await request('/me/sales', { ...input, token: page.token, requestKey: randomUUID(), currentPassword: password }, f.owner); expect(result.status).toBe(200);
    const saved = await result.json();
    expect(db.sqlite.prepare('SELECT customer_user_id FROM sale_estimates').get()!.customer_user_id).toBeNull();
    expect((await request(`/me/estimates/${saved.estimateId}`, undefined, f.alice)).status).toBe(404);
    expect((await request(`/me/sales/${saved.estimateId}/document`, undefined, f.owner)).status).toBe(200);
  });
  it.each([
    "UPDATE sessions SET mfa_until=NULL WHERE user_id='sale-owner'",
    "UPDATE users SET role='customer' WHERE id='sale-owner'",
    "UPDATE account_credentials SET password_hash='changed' WHERE user_id='sale-owner'",
    "UPDATE appointments SET price_cents=1",
    "UPDATE orders SET status='cancelled'",
  ])('rechecks final-write access and source revisions: %s', async sql => {
    const f = await fixture(); const page = await f.preview();
    const batch = env.DB.batch.bind(env.DB); let once = true;
    const spy = vi.spyOn(env.DB, 'batch').mockImplementation(async statements => {
      if (once && statements.length === 2) { once = false; db.sqlite.exec(sql); }
      return batch(statements);
    });
    expect((await request('/me/sales', f.save(page.token), f.owner)).status).toBe(409); spy.mockRestore();
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM sale_estimates').get()!.n).toBe(0);
  });
  it('rolls back on audit failure and preserves replay after source changes or review expiry', async () => {
    const f = await fixture(); const page = await f.preview(); const body = f.save(page.token);
    db.sqlite.exec("CREATE TRIGGER fail_sale_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'test'); END;");
    expect((await request('/me/sales', body, f.owner)).status).toBe(500);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM sale_estimates').get()!.n).toBe(0);
    db.sqlite.exec('DROP TRIGGER fail_sale_audit');
    const saved = await (await request('/me/sales', body, f.owner)).json();
    const unsaved = await f.preview();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(page.expiresAt) + 60_000);
    expect((await request('/me/sales', f.save(unsaved.token), f.owner)).status).toBe(409);
    expect(await (await request('/me/sales', body, f.owner)).json()).toEqual(saved); clock.mockRestore();
    db.sqlite.exec("UPDATE orders SET status='cancelled'");
    expect(await (await request('/me/sales', body, f.owner)).json()).toEqual(saved);
  });
  it('paginates customer-scoped history and source choices without leaking operational fields', async () => {
    const f = await fixture(); const page = await f.preview(); await request('/me/sales', f.save(page.token), f.owner);
    const original = db.sqlite.prepare('SELECT * FROM sale_estimates').get()!;
    for (let index = 0; index < 30; index++) {
      const id = `estimate-${index.toString().padStart(3, '0')}`;
      const snapshot = { ...JSON.parse(String(original.snapshot_json)), id };
      db.sqlite.prepare('INSERT INTO sale_estimates(id,actor_user_id,customer_user_id,appointment_id,request_key,request_fingerprint,review_key,snapshot_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(id, 'sale-owner', 'alice', 'detail-appointment', id, id, id, JSON.stringify(snapshot), String(original.created_at));
    }
    const first = await (await request('/me/estimates', undefined, f.alice)).json(); expect(first.items).toHaveLength(25);
    const second = await (await request(`/me/estimates?cursor=${encodeURIComponent(first.nextCursor)}`, undefined, f.alice)).json(); expect(second.items).toHaveLength(6); expect(second.nextCursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map(item => item.id)).size).toBe(31);
    expect((await request(`/me/estimates?cursor=${encodeURIComponent(first.nextCursor)}`, undefined, f.bob)).status).toBe(400);
    expect((await request('/me/sales?customerId=alice', undefined, f.owner)).status).toBe(400);
    expect((await request('/me/sales/sources?kind=order&kind=appointment', undefined, f.owner)).status).toBe(400);
    const sources = await request('/me/sales/sources?kind=appointment', undefined, f.owner); expect(sources.status).toBe(200);
    expect(await sources.text()).not.toMatch(/SECRET|note|email|password/);
  });
});

describe('server commerce requests', () => {
  const product = { id:'pomade',name:'Matte pomade',slug:'matte-pomade',category:'Grooming',description:'Matte finish',baseSku:'POM',status:'published',pickupEnabled:true,shippingEnabled:true,imageUrl:'',imageAlt:'',variants:[{id:'matte',name:'Matte',sku:'POM-M',priceCents:1500,stockOnHand:2,active:true}] };
  const order = () => ({requestKey:randomUUID(),items:[{variantId:'matte',quantity:1,unitPriceCents:1500}],fulfillment:'pickup',customer:{name:'Test customer',phone:'5551234567'},shippingAddress:null});
  async function fixture() {
    env.COMMERCE_ENABLED='true';
    const owner=await seed('shop-owner','owner');await enrollMfa(owner);
    const alice=await seed('shop-alice');const bob=await seed('shop-bob');
    const revision=(await (await request('/me/commerce/products',undefined,owner)).json()).revision;
    const saved=await request('/me/commerce/products',{product,revision},owner);
    expect(saved.status).toBe(200);
    return {owner,alice,bob};
  }
  it('publishes a catalog without requiring customer login, and protects management by role and MFA',async()=>{
    const {alice,owner}=await fixture();
    expect((await request('/me/commerce/products',undefined,alice)).status).toBe(403);
    const unverifiedSession=await createSession(env,'shop-owner');
    expect((await request('/me/commerce/products',undefined,unverifiedSession)).status).toBe(403);
    const data=await (await request('/me/commerce/products',undefined,owner)).json();
    expect((await request('/me/commerce/products',{product:{...product,id:'hidden',slug:'hidden',baseSku:'H',status:'draft',variants:[{...product.variants[0],id:'hidden-v',sku:'H-V'}]},revision:data.revision},owner)).status).toBe(200);
    env.ACCOUNTS_ENABLED='false';
    const catalog=await (await request('/catalog')).json();
    expect(catalog.products.map((p:{id:string})=>p.id)).toEqual(['pomade']);
    expect(catalog.products[0].variants[0].stockOnHand).toBe(2);
    expect(JSON.stringify(catalog)).not.toContain('shop-alice');
  });
  it('reserves stock once across retries and enforces ownership, price and quantity',async()=>{
    const {alice,bob}=await fixture();const input=order();
    expect((await request('/me/orders/request',{...input,items:[null]},alice)).status).toBe(400);
    expect((await request('/me/orders/request',{...input,customer:{...input.customer,phone:'not-a-phone'}},alice)).status).toBe(400);
    expect((await request('/me/orders/request',{...input,items:[{...input.items[0],unitPriceCents:1}]},alice)).status).toBe(409);
    expect((await request('/me/orders/request',input)).status).toBe(401);
    const first=await request('/me/orders/request',input,alice);expect(first.status).toBe(200);const result=await first.json();
    expect(await (await request('/me/orders/request',input,alice)).json()).toEqual(result);
    expect((await request('/me/orders/request',{...input,customer:{...input.customer,name:'Different'}},alice)).status).toBe(409);
    expect((await request(`/me/orders/${result.orderId}`,undefined,bob)).status).toBe(404);
    expect((await request(`/me/orders/${result.orderId}`,undefined,alice)).status).toBe(200);
    expect((await request('/me/orders/request',{...order(),items:[{...input.items[0],quantity:2}]},bob)).status).toBe(409);
    expect(db.sqlite.prepare("SELECT stock_reserved FROM product_variants WHERE id='matte'").get()!.stock_reserved).toBe(1);
    expect((await (await request('/catalog')).json()).products[0].variants[0].stockOnHand).toBe(1);
  });
  it('processes pickup requests with revision checks and consumes inventory exactly once',async()=>{
    const {alice,owner}=await fixture();const {orderId}=await (await request('/me/orders/request',order(),alice)).json();
    let stale=0;
    for(const status of ['accepted','preparing','ready-for-pickup','completed']) {
      const data=await (await request('/me/commerce/orders',undefined,owner)).json();stale=data.revision;
      expect(data.orders[0].customer.email).toBe('shop-alice@example.test');
      expect((await request(`/me/commerce/orders/${orderId}`,{status,revision:data.revision,trackingNumber:''},owner)).status).toBe(200);
    }
    expect((await request(`/me/commerce/orders/${orderId}`,{status:'completed',revision:stale,trackingNumber:''},owner)).status).toBe(400);
    expect(db.sqlite.prepare("SELECT stock_on_hand,stock_reserved FROM product_variants WHERE id='matte'").get()).toMatchObject({stock_on_hand:1,stock_reserved:0});
  });
  it('releases cancelled requests and rejects stale inventory edits',async()=>{
    const {alice,owner}=await fixture();const before=await (await request('/me/commerce/products',undefined,owner)).json();
    const {orderId}=await (await request('/me/orders/request',order(),alice)).json();
    expect((await request('/me/commerce/products',{product,revision:before.revision},owner)).status).toBe(409);
    const data=await (await request('/me/commerce/orders',undefined,owner)).json();
    expect((await request(`/me/commerce/orders/${orderId}`,{status:'cancelled',revision:data.revision,trackingNumber:''},owner)).status).toBe(200);
    expect(db.sqlite.prepare("SELECT stock_on_hand,stock_reserved FROM product_variants WHERE id='matte'").get()).toMatchObject({stock_on_hand:2,stock_reserved:0});
  });
  it('lets customers withdraw only their own unaccepted request and releases stock exactly once', async () => {
    const { alice, bob } = await fixture(); const { orderId } = await (await request('/me/orders/request', order(), alice)).json();
    const detail = await (await request(`/me/orders/${orderId}`, undefined, alice)).json();
    expect(detail.order.canWithdraw).toBe(true); const body = { updatedAt: detail.order.updatedAt }; const path = `/me/orders/${orderId}/withdraw`;
    expect((await request(path, body, bob)).status).toBe(404);
    expect((await request(path, { updatedAt: 'stale' }, alice)).status).toBe(409);
    expect((await request(path, body, alice)).status).toBe(200);
    expect((await request(path, body, alice)).status).toBe(200);
    expect((await (await request(`/me/orders/${orderId}`, undefined, alice)).json()).order).toMatchObject({ status: 'cancelled', canWithdraw: false });
    expect(db.sqlite.prepare("SELECT stock_on_hand,stock_reserved FROM product_variants WHERE id='matte'").get()).toMatchObject({ stock_on_hand: 2, stock_reserved: 0 });
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM audit_events WHERE action='customer_order_withdrawn'").get()!.n).toBe(1);
  });
  it('blocks withdrawal after acceptance and does not release another order reservation', async () => {
    const { alice, owner } = await fixture(); const { orderId } = await (await request('/me/orders/request', order(), alice)).json();
    const detail = await (await request(`/me/orders/${orderId}`, undefined, alice)).json();
    const { revision } = await (await request('/me/commerce/orders', undefined, owner)).json();
    expect((await request(`/me/commerce/orders/${orderId}`, { status: 'accepted', revision, trackingNumber: '' }, owner)).status).toBe(200);
    expect((await request(`/me/orders/${orderId}/withdraw`, { updatedAt: detail.order.updatedAt }, alice)).status).toBe(409);
    expect(db.sqlite.prepare("SELECT stock_reserved FROM product_variants WHERE id='matte'").get()!.stock_reserved).toBe(1);
  });
  it('rolls back withdrawal and stock changes together if audit fails', async () => {
    const { alice } = await fixture(); const { orderId } = await (await request('/me/orders/request', order(), alice)).json();
    const detail = await (await request(`/me/orders/${orderId}`, undefined, alice)).json();
    db.sqlite.exec("CREATE TRIGGER fail_withdrawal BEFORE INSERT ON audit_events WHEN NEW.action='customer_order_withdrawn' BEGIN SELECT RAISE(ABORT,'test'); END");
    expect((await request(`/me/orders/${orderId}/withdraw`, { updatedAt: detail.order.updatedAt }, alice)).status).toBe(500);
    expect(db.sqlite.prepare('SELECT status FROM orders WHERE id=?').get(orderId)!.status).toBe('submitted');
    expect(db.sqlite.prepare("SELECT stock_reserved FROM product_variants WHERE id='matte'").get()!.stock_reserved).toBe(1);
  });
  it.each(['acceptance','session'])('rejects a concurrent %s change at withdrawal commit', async kind => {
    const { alice } = await fixture(); const { orderId } = await (await request('/me/orders/request', order(), alice)).json();
    const detail = await (await request(`/me/orders/${orderId}`, undefined, alice)).json();
    const batch = env.DB.batch.bind(env.DB);
    const spy = vi.spyOn(env.DB, 'batch').mockImplementation(async statements => {
      if (statements.length === 4) {
        if (kind === 'acceptance') db.sqlite.prepare("UPDATE orders SET status='accepted' WHERE id=?").run(orderId);
        else db.sqlite.exec("UPDATE sessions SET revoked_at='2026-01-01' WHERE user_id='shop-alice'");
      }
      return batch(statements);
    });
    expect((await request(`/me/orders/${orderId}/withdraw`, { updatedAt: detail.order.updatedAt }, alice)).status).toBe(409); spy.mockRestore();
    expect(db.sqlite.prepare("SELECT stock_reserved FROM product_variants WHERE id='matte'").get()!.stock_reserved).toBe(1);
  });
});

describe('customer account security boundary', () => {
  it('fails closed when disabled or missing a secret, with no prototype fallback', async () => {
    env.ACCOUNTS_ENABLED = 'false';
    expect(await (await request('/config')).json()).toEqual({ enabled: false, turnstileSiteKey: '', bookingEnabled: false });
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
