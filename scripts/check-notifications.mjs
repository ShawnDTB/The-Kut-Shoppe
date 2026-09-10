import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { build } from 'vite';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { migrationStatements } from './migration-statements.mjs';

await build({ configFile: false, logLevel: 'warn', build: { ssr: 'server/notification-worker.ts', target: 'es2022', outDir: '.wrangler/notification-worker', emptyOutDir: true, rollupOptions: { output: { entryFileNames: 'notification-worker.js' } } } });
const calls = [];
const runtime = new Miniflare(convertV4MiniflareOptions({ cf: false, modules: true,
  scriptPath: '.wrangler/notification-worker/notification-worker.js', compatibilityDate: '2026-09-09', compatibilityFlags: ['nodejs_compat'],
  d1Databases: ['DB'], bindings: { APP_ORIGIN: 'https://notifications.example.test', APPOINTMENT_EMAIL_ENABLED: 'true', RESEND_API_KEY: 'test-only', MAIL_FROM: 'test@example.test' },
  outboundService: async (request) => { assert.equal(request.url, 'https://api.resend.com/emails'); calls.push({ key: request.headers.get('Idempotency-Key'), payload: await request.json() }); return globalThis.Response.json({ id: 'test-email' }); },
}));
try {
  const db = await runtime.getD1Database('DB');
  for (const file of (await readdir('migrations')).filter((name) => name.endsWith('.sql')).sort()) {
    for (const sql of migrationStatements(await readFile(`migrations/${file}`, 'utf8'))) await db.prepare(sql).run();
  }
  const now = new Date().toISOString();
  const location = await db.prepare('SELECT id FROM locations LIMIT 1').first();
  await db.prepare("INSERT INTO users(id,email,display_name,role,email_verified_at,created_at,updated_at) VALUES ('c','recipient@example.test','Private Name','customer',?,?,?)").bind(now, now, now).run();
  await db.prepare("INSERT INTO services(id,name,category,duration_minutes,price_cents,created_at,updated_at) VALUES ('s','Private service','test',30,2500,?,?)").bind(now, now).run();
  await db.prepare("INSERT INTO appointments(id,customer_user_id,service_id,location_id,price_cents,status,customer_note,created_at,updated_at) VALUES ('a','c','s',?,2500,'requested','PRIVATE NOTE',?,?)").bind(location.id, now, now).run();
  await db.prepare("INSERT INTO appointment_events(id,appointment_id,event_type,created_at) VALUES ('e','a','customer_requested_appointment',?)").bind(now).run();
  await db.prepare("INSERT INTO appointment_notifications(id,event_id,recipient_user_id,audience,next_attempt_at,created_at) VALUES ('n','e','c','customer',?,?)").bind(now, now).run();
  const worker = await runtime.getWorker();
  const runs = await Promise.all([worker.scheduled({ cron: '* * * * *' }), worker.scheduled({ cron: '* * * * *' })]);
  for (const result of runs) assert.equal(result.outcome, 'ok');
  assert.equal(calls.length, 1, 'Concurrent scheduled dispatch sent duplicate mail');
  assert.equal(calls[0].key, 'appointment-notice/n');
  assert.doesNotMatch(JSON.stringify(calls[0].payload), /PRIVATE NOTE|Private service|Private Name/);
  assert.equal((await db.prepare("SELECT status FROM appointment_notifications WHERE id='n'").first()).status, 'accepted');
  assert.equal((await runtime.dispatchFetch('https://notifications.example.test/')).status, 404);
  console.log('Notification Worker passed: scheduled handler, D1 lease competition, generic private message, provider acceptance, and no public dispatch endpoint.');
} finally { await runtime.dispose(); }
