import assert from 'node:assert/strict';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

await mkdir('.wrangler', { recursive: true });
const built = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'pages', 'functions', 'build',
  '--outdir', '.wrangler/customer-worker', '--compatibility-date', '2026-09-09', '--compatibility-flag', 'nodejs_compat'], { stdio: 'inherit' });
assert.equal(built.status, 0, 'Pages Function compilation failed');
const origin = 'https://account-runtime.example.test';
const deliveries = [];
const workerFile = (await readdir('.wrangler/customer-worker')).find((name) => name.endsWith('.js'));
assert.ok(workerFile, 'No bundled Worker module was produced');
const worker = new Miniflare(convertV4MiniflareOptions({ cf: false,
  modules: true, scriptPath: `.wrangler/customer-worker/${workerFile}`, compatibilityDate: '2026-09-09', compatibilityFlags: ['nodejs_compat'],
  d1Databases: ['DB'], bindings: { APP_ORIGIN: origin, ACCOUNTS_ENABLED: 'true',
    AUTH_SECRET: 'runtime-test-only-secret-with-at-least-32-characters', TURNSTILE_SECRET_KEY: 'runtime-test',
    TURNSTILE_SITE_KEY: 'runtime-test', RESEND_API_KEY: 'runtime-test', MAIL_FROM: 'test@example.test' },
  // No real email is sent. Runtime crypto, routing, D1, and session handling are real.
  outboundService: async (request) => {
    if (request.url.includes('/turnstile/v0/siteverify')) return globalThis.Response.json({ success: true, hostname: 'account-runtime.example.test', action: 'account' });
    if (request.url === 'https://api.resend.com/emails') { deliveries.push(await request.json()); return globalThis.Response.json({ id: 'test-only' }); }
    throw new Error('Unexpected outbound request in runtime test');
  },
}));
try {
  const db = await worker.getD1Database('DB');
  // The repository's migrations contain no semicolons inside SQL values.
  for (const file of (await readdir('migrations')).filter((name) => name.endsWith('.sql')).sort()) {
    const sql = (await readFile(`migrations/${file}`, 'utf8')).replace(/^\s*--.*$/gm, '');
    for (const statement of sql.split(';').map((value) => value.trim()).filter(Boolean)) await db.prepare(statement).run();
  }
  const call = (path, body, cookie, method = body ? 'POST' : 'GET') => worker.dispatchFetch(`${origin}/api/v1${path}`, {
    method, headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Kut-Request': '1', 'CF-Connecting-IP': '192.0.2.25', ...(cookie ? { Cookie: cookie.split(';')[0] } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.equal((await call('/me')).status, 401);
  const registered = await call('/auth/register', { name: 'Runtime Customer', email: 'runtime@example.test', password: 'A runtime test passphrase 2026', turnstileToken: 'test-only' });
  assert.equal(registered.status, 202, `Registration failed in Workers: ${await registered.clone().text()}`);
  const { challengeId } = await registered.json();
  const code = deliveries.at(-1).text.match(/code is (\d{8})/)[1];
  const verified = await call('/auth/verify', { challengeId, code });
  assert.equal(verified.status, 200, 'Email verification failed in Workers');
  const cookie = verified.headers.get('Set-Cookie');
  assert.ok(cookie.includes('HttpOnly') && cookie.includes('Secure'));
  const me = await call('/me', undefined, cookie);
  assert.equal(me.status, 200);
  const profile = { name: 'Updated Customer', phone: '', address: { line1: '', line2: '', city: '', state: '', postalCode: '' } };
  assert.equal((await call('/me/profile', profile, cookie, 'PATCH')).status, 200);
  const overview = await call('/me/overview', undefined, cookie);
  assert.deepEqual(await overview.json(), { appointments: [], orders: [] });
  assert.equal((await call('/auth/verify', { challengeId, code })).status, 400, 'Consumed code replay was accepted');
  const login = await call('/auth/login', { email: 'runtime@example.test', password: 'A runtime test passphrase 2026', turnstileToken: 'test-only' });
  assert.equal(login.status, 200, 'Native scrypt password verification failed in Workers');
  assert.equal((await call('/me/sessions/revoke', {}, cookie)).status, 200);
  assert.equal((await call('/me', undefined, login.headers.get('Set-Cookie'))).status, 401);
  const active = await call('/auth/login', { email: 'runtime@example.test', password: 'A runtime test passphrase 2026', turnstileToken: 'test-only' });
  const activeCookie = active.headers.get('Set-Cookie');
  const { account } = await active.json();
  const now = new Date().toISOString();
  await db.batch(Array.from({ length: 30 }, (_, i) => db.prepare(`INSERT INTO orders
    (id, customer_user_id, status, fulfillment_type, subtotal_cents, total_cents, created_at, updated_at)
    VALUES (?, ?, 'submitted', 'pickup', 2500, 2500, ?, ?)`)
    .bind(`runtime-order-${String(i).padStart(2, '0')}`, account.id, now, now)));
  const firstPage = await (await call('/me/orders', undefined, activeCookie)).json();
  assert.equal(firstPage.items.length, 25);
  const secondPage = await (await call(`/me/orders?cursor=${firstPage.nextCursor}`, undefined, activeCookie)).json();
  assert.equal(secondPage.items.length, 5); assert.equal(secondPage.nextCursor, null);
  assert.equal(new Set([...firstPage.items, ...secondPage.items].map((row) => row.id)).size, 30);
  const change = await call('/me/email/start', { email: 'updated-runtime@example.test', currentPassword: 'A runtime test passphrase 2026' }, activeCookie);
  assert.equal(change.status, 202, await change.clone().text());
  const changeCodes = { challengeId: (await change.json()).challengeId,
    currentCode: deliveries.at(-2).text.match(/code is (\d{8})/)[1], newCode: deliveries.at(-1).text.match(/code is (\d{8})/)[1] };
  // Actual concurrent Workers/D1 requests: only one can commit this change.
  const confirmations = await Promise.all([call('/me/email/confirm', changeCodes, activeCookie), call('/me/email/confirm', changeCodes, activeCookie)]);
  assert.equal(confirmations.filter((response) => response.status === 200).length, 1);
  assert.ok(confirmations.every((response) => [200, 400, 401].includes(response.status)));
  assert.equal((await call('/me', undefined, activeCookie)).status, 401);
  const changedLogin = await call('/auth/login', { email: 'updated-runtime@example.test', password: 'A runtime test passphrase 2026', turnstileToken: 'test-only' });
  assert.equal(changedLogin.status, 200);
  const changedAccount = await changedLogin.json();
  assert.equal(changedAccount.account.id, account.id, 'Email change replaced account identity');
  const retainedHistory = await (await call('/me/orders', undefined, changedLogin.headers.get('Set-Cookie'))).json();
  assert.equal(retainedHistory.items.length, 25, 'Email change lost private history');
  assert.equal((await db.prepare("SELECT count(*) AS n FROM audit_events WHERE action = 'email_changed'").first()).n, 1);
  console.log('Cloudflare runtime passed: D1 migrations, native scrypt, signup, verification, login, profile, paginated history, session revocation, concurrent dual-inbox email change.');
} finally { await worker.dispose(); }
