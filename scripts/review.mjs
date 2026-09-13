// Loopback-only review of the real API. This file is never a deployed entrypoint.
import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import { resolve, sep, extname } from 'node:path';
import { readFile, readdir, mkdir, writeFile, realpath } from 'node:fs/promises';
import { build } from 'vite';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { migrationStatements } from './migration-statements.mjs';

const origin = 'http://localhost:8788';
const root = '.wrangler/review';
const inboxToken = randomBytes(32).toString('hex');
const deliveries = [];
await mkdir(root, { recursive: true, mode: 0o700 });
let secrets;
try { secrets = JSON.parse(await readFile(`${root}/secrets.json`, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  secrets = { auth: randomBytes(32).toString('hex'), mfa: randomBytes(32).toString('hex') };
  await writeFile(`${root}/secrets.json`, JSON.stringify(secrets), { mode: 0o600, flag: 'wx' });
}
if (!/^[a-f0-9]{64}$/.test(secrets.auth) || !/^[a-f0-9]{64}$/.test(secrets.mfa)) throw new Error('Invalid local review keys. Restore the review keys with their database.');
await writeFile(`${root}/entry.ts`, "import { onRequest } from '../../functions/api/[[path]]';\nexport default { fetch(request, env) { return onRequest({ request, env }); } };\n");
await build({ configFile: false, logLevel: 'warn', build: { ssr: `${root}/entry.ts`, target: 'es2022', outDir: `${root}/worker`, emptyOutDir: true, rollupOptions: { output: { entryFileNames: 'worker.js' } } } });
const worker = new Miniflare(convertV4MiniflareOptions({ cf: false, host: '127.0.0.1', port: 0,
  modules: true, scriptPath: `${root}/worker/worker.js`, compatibilityDate: '2026-09-09', compatibilityFlags: ['nodejs_compat'],
  d1Databases: ['DB'], resourcePersistencePath: `${root}/database`,
  bindings: { APP_ORIGIN: origin, ACCOUNTS_ENABLED: 'true', CUSTOMER_BOOKING_ENABLED: 'true', STAFF_OPERATIONS_ENABLED: 'true', STAFF_SETUP_ENABLED: 'true', COMMERCE_ENABLED: 'true',
    AUTH_SECRET: secrets.auth, MFA_ENCRYPTION_KEY: secrets.mfa, TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: 'local-review', RESEND_API_KEY: 'local-inbox', MAIL_FROM: 'review@example.test' },
  outboundService: async (request) => {
    if (request.url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') return globalThis.Response.json({ success: true, hostname: 'localhost', action: 'account' });
    if (request.url === 'https://api.resend.com/emails') {
      deliveries.push({ ...(await request.json()), receivedAt: new Date().toISOString() });
      if (deliveries.length > 100) deliveries.shift();
      return globalThis.Response.json({ id: randomUUID() });
    }
    throw new Error('External delivery is disabled in local review.');
  },
}));
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let server;
try {
  const db = await worker.getD1Database('DB');
  await db.prepare('CREATE TABLE IF NOT EXISTS local_review_migrations (name TEXT PRIMARY KEY)').run();
  for (const name of (await readdir('migrations')).filter((file) => file.endsWith('.sql')).sort()) {
    if (await db.prepare('SELECT name FROM local_review_migrations WHERE name=?').bind(name).first()) continue;
    const statements = migrationStatements(await readFile(`migrations/${name}`, 'utf8')).filter((sql) => !/^PRAGMA\s+foreign_keys/i.test(sql));
    await db.batch([...statements.map((sql) => db.prepare(sql)), db.prepare('INSERT INTO local_review_migrations(name) VALUES (?)').bind(name)]);
  }
  // Bootstrap only this dedicated local database. No application role-grant route.
  const call = (path, body) => worker.dispatchFetch(`${origin}/api/v1${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Kut-Request': '1', 'CF-Connecting-IP': '127.0.0.1' }, body: JSON.stringify(body) });
  let accounts;
  try { accounts = JSON.parse(await readFile(`${root}/accounts.json`, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    accounts = ['customer', 'staff', 'owner'].map((role) => ({ role, email: `${role}@example.test`, password: randomBytes(24).toString('base64url') }));
    await writeFile(`${root}/accounts.json`, JSON.stringify(accounts, null, 2), { mode: 0o600, flag: 'wx' });
  }
  for (const account of accounts) {
    if (await db.prepare('SELECT id FROM users WHERE email=?').bind(account.email).first()) continue;
    const registered = await call('/auth/register', { name: `Review ${account.role}`, email: account.email, password: account.password, turnstileToken: 'local-review' });
    if (registered.status !== 202) throw new Error(`Review registration failed: ${registered.status}`);
    const { challengeId } = await registered.json();
    const code = deliveries.at(-1)?.text.match(/code is (\d{8})/)?.[1];
    const verified = await call('/auth/verify', { challengeId, code });
    if (verified.status !== 200) throw new Error(`Review verification failed: ${verified.status}`);
    await db.prepare('UPDATE users SET role=? WHERE email=?').bind(account.role, account.email).run();
  }
  if (!(await db.prepare("SELECT id FROM services WHERE id='local-review-cut'").first())) {
    const now = new Date().toISOString();
    const staff = await db.prepare("SELECT id FROM users WHERE email='staff@example.test'").first();
    const location = await db.prepare('SELECT id FROM locations WHERE active=1 ORDER BY id LIMIT 1').first();
    await db.batch([
      db.prepare("INSERT INTO services(id,name,category,duration_minutes,price_cents,created_at,updated_at) VALUES ('local-review-cut','Review haircut','Haircuts',30,3000,?,?)").bind(now, now),
      db.prepare("INSERT INTO staff_profiles(id,user_id,professional_name,public_slug,setup_status,created_at,updated_at) VALUES ('local-review-staff',?,'Review professional','local-review-professional','approved',?,?)").bind(staff.id, now, now),
      db.prepare("INSERT INTO staff_locations(staff_id,location_id,created_at) VALUES ('local-review-staff',?,?)").bind(location.id, now),
      db.prepare("INSERT INTO staff_services(staff_id,service_id,created_at,updated_at) VALUES ('local-review-staff','local-review-cut',?,?)").bind(now, now),
      ...Array.from({ length: 7 }, (_, day) => db.prepare("INSERT INTO weekly_availability(id,staff_id,location_id,weekday,start_time,end_time,created_at,updated_at) VALUES (?,'local-review-staff',?,?,'09:00','17:00',?,?)").bind(`local-review-hours-${day}`, location.id, day, now, now)),
    ]);
  }
  if (!(await db.prepare("SELECT id FROM products WHERE id='local-review-pomade'").first())) {
    const now = new Date().toISOString();
    await db.batch([
      db.prepare("INSERT INTO products(id,name,slug,category,description,base_sku,status,pickup_enabled,shipping_enabled,created_at,updated_at) VALUES ('local-review-pomade','Review pomade','review-pomade','Grooming','Sample product for local review only.','REVIEW-POM','published',1,1,?,?)").bind(now,now),
      ...['Matte','Shine'].map((name,index)=>db.prepare("INSERT INTO product_variants(id,product_id,name,sku,price_cents,stock_on_hand,active,created_at,updated_at) VALUES (?,'local-review-pomade',?,?,1500,10,1,?,?)").bind(`local-review-pomade-${index}`,name,`REVIEW-POM-${index}`,now,now)),
    ]);
  }
  deliveries.length = 0;
  const dist = await realpath('dist');
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.txt': 'text/plain' };
  server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    // Prevent DNS rebinding and cross-origin access to the review inbox/API.
    if (req.headers.host !== 'localhost:8788' || req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && req.headers.origin !== origin)) { res.writeHead(403); res.end('Local review only. Open http://localhost:8788.'); return; }
    try {
      const url = new URL(req.url, origin);
      if (url.pathname === '/__review/inbox') {
        if (req.method !== 'GET' || url.searchParams.get('token') !== inboxToken) { res.writeHead(404); res.end(); return; }
        res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<!doctype html><title>Local review inbox</title><h1>Local review inbox</h1><p>No email leaves this computer. Refresh to see new verification and recovery messages. Messages clear when the server restarts.</p>${deliveries.slice().reverse().map((mail) => `<article><h2>${escape(mail.subject)}</h2><p>To: ${escape(mail.to)} · ${escape(mail.receivedAt)}</p><pre>${escape(mail.text)}</pre></article>`).join('')}`); return;
      }
      if (url.pathname.startsWith('/api/')) {
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 8192) { res.writeHead(413); res.end(); return; } chunks.push(chunk); }
        const headers = new globalThis.Headers();
        for (const [name, value] of Object.entries(req.headers)) if (value && !['host', 'content-length', 'connection', 'transfer-encoding', 'cf-connecting-ip'].includes(name)) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
        headers.set('CF-Connecting-IP', '127.0.0.1');
        const response = await worker.dispatchFetch(url.href, { method: req.method, headers, ...(!['GET', 'HEAD'].includes(req.method) ? { body: Buffer.concat(chunks) } : {}) });
        for (const [name, value] of response.headers) res.setHeader(name, value);
        res.writeHead(response.status); res.end(Buffer.from(await response.arrayBuffer())); return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
      const path = decodeURIComponent(url.pathname);
      // Product slugs are database records, so they cannot all be prerendered.
      // Match the hosted shop rewrite while preserving the requested browser URL.
      let file = /^\/shop\/[A-Za-z0-9_-]+\/?$/.test(path) ? resolve(dist,'shop/index.html') : resolve(dist, `.${path}`, extname(path) ? '' : 'index.html');
      try { file = await realpath(file); } catch { res.writeHead(404); res.end('Page not found'); return; }
      if (!file.startsWith(`${dist}${sep}`)) { res.writeHead(404); res.end(); return; }
      res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
      const body = await readFile(file);
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(500); res.end('Local review request failed.'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(8788, '127.0.0.1', resolve); });
  console.log(`\nLocal review: ${origin}/account\nEmail inbox: ${origin}/__review/inbox?token=${inboxToken}\nSign-in credentials: ${root}/accounts.json\n\nPersistent local data; use test information only. Customer, staff, and owner sign-ins are available. Staff MFA enrollment is required. External email and anti-bot verification are simulated only in this local runner. Shop requests: /shop. Owner products/orders: /admin/products and /admin/orders. A sample pomade is available for local review. Rescheduling: open a confirmed appointment in the account. Guest walk-ins: /account?view=front-desk (owner/manager). Printable booking/order documents are available in record details. Requests are unpaid; cash/card collection and financial receipts are not activated.\n`);
  const stop = async () => { server.close(); await worker.dispose(); process.exit(0); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
} catch (error) {
  server?.close(); await worker.dispose(); throw error;
}
