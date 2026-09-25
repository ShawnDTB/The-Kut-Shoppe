import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { URLSearchParams } from 'node:url';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { build } from 'vite';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { migrationStatements } from './migration-statements.mjs';

await mkdir('.wrangler', { recursive: true });
// Offline bundle of the actual Pages handler. No deployment CLI or cloud
// metadata request is needed to exercise this code in the Workers runtime.
await writeFile('.wrangler/customer-runtime-entry.ts', "import { onRequest } from '../functions/api/[[path]]';\nexport default { fetch(request, env) { return onRequest({ request, env }); } };\n");
await build({ configFile: false, logLevel: 'warn', build: { ssr: '.wrangler/customer-runtime-entry.ts', target: 'es2022', outDir: '.wrangler/customer-worker', emptyOutDir: true, rollupOptions: { output: { entryFileNames: 'worker.js' } } } });
const origin = 'https://account-runtime.example.test';
const deliveries = [];
const workerFile = (await readdir('.wrangler/customer-worker')).find((name) => name.endsWith('.js'));
assert.ok(workerFile, 'No bundled Worker module was produced');
const worker = new Miniflare(convertV4MiniflareOptions({ cf: false,
  modules: true, scriptPath: `.wrangler/customer-worker/${workerFile}`, compatibilityDate: '2026-09-09', compatibilityFlags: ['nodejs_compat'],
  d1Databases: ['DB'], bindings: { COMMERCE_ENABLED: 'true', CASH_SALES_ENABLED: 'true', APP_ORIGIN: origin, ACCOUNTS_ENABLED: 'true', CUSTOMER_BOOKING_ENABLED: 'true', STAFF_OPERATIONS_ENABLED: 'true', STAFF_SETUP_ENABLED: 'true',
    AUTH_SECRET: 'runtime-test-only-secret-with-at-least-32-characters', MFA_ENCRYPTION_KEY: '12'.repeat(32), TURNSTILE_SECRET_KEY: 'runtime-test',
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
  // Trigger migrations delimit whole statements explicitly. The earlier simple
  // migrations contain no semicolons inside SQL values or compound statements.
  for (const file of (await readdir('migrations')).filter((name) => name.endsWith('.sql')).sort()) {
    const original = await readFile(`migrations/${file}`, 'utf8');
    for (const statement of migrationStatements(original)) await db.prepare(statement).run();
  }
  const call = async (path, body, cookie, method = body ? 'POST' : 'GET') => {
    const response = await worker.dispatchFetch(`${origin}/api/v1${path}`, {
      method, headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Kut-Request': '1', 'CF-Connecting-IP': '192.0.2.25', ...(cookie ? { Cookie: cookie.split(';')[0] } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    // Capture the real HTTP result once. Assertions and diagnostics can inspect
    // that snapshot without cloning/consuming Miniflare's response stream twice
    // (the previous eager diagnostic clone failed under the Node 22 CI runner).
    const text = await response.text();
    return { status: response.status, headers: response.headers, text: async () => text, json: async () => JSON.parse(text) };
  };
  assert.equal((await call('/me')).status, 401);
  const registered = await call('/auth/register', { name: 'Runtime Customer', email: 'runtime@example.test', password: 'A runtime test passphrase 2026', turnstileToken: 'test-only' });
  assert.equal(registered.status, 202, `Registration failed in Workers: ${await registered.text()}`);
  const { challengeId } = await registered.json();
  const code = deliveries.at(-1).text.match(/code is (\d{8})/)[1];
  const verified = await call('/auth/verify', { challengeId, code });
  assert.equal(verified.status, 200, 'Email verification failed in Workers');
  const cookie = verified.headers.get('Set-Cookie');
  assert.ok(cookie.includes('HttpOnly') && cookie.includes('Secure'));
  const me = await call('/me', undefined, cookie);
  assert.equal(me.status, 200);
  const dashboard = await call('/me/dashboard', undefined, cookie);
  assert.equal(dashboard.status, 200);
  assert.deepEqual((await dashboard.json()).counts, { upcoming: 0, pending: 0, completed: 0, orders: 0 });
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
  assert.equal(change.status, 202, await change.text());
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
  const detailCookie = changedLogin.headers.get('Set-Cookie');
  await db.prepare("INSERT INTO services(id,name,category,duration_minutes,price_cents,created_at,updated_at) VALUES ('runtime-service','Runtime service','test',30,2500,?,?)").bind(now, now).run();
  const location = await db.prepare('SELECT id FROM locations LIMIT 1').first();
  await db.prepare(`INSERT INTO appointments(id,customer_user_id,service_id,location_id,price_cents,status,source,created_at,updated_at)
    VALUES ('runtime-request',?,'runtime-service',?,2500,'requested','website',?,?)`).bind(account.id, location.id, now, now).run();
  const withdrawals = await Promise.all([call('/me/appointments/runtime-request/withdraw', { updatedAt: now }, detailCookie), call('/me/appointments/runtime-request/withdraw', { updatedAt: now }, detailCookie)]);
  for (const response of withdrawals) assert.equal(response.status, 200, await response.text());
  assert.equal((await db.prepare("SELECT count(*) AS n FROM appointment_events WHERE event_type='customer_withdrew_request'").first()).n, 1);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM audit_events WHERE action='customer_withdrew_request'").first()).n, 1);
  const withdrawn = await (await call('/me/appointments/runtime-request', undefined, detailCookie)).json();
  assert.equal(withdrawn.appointment.withdrawnByCustomer, true);
  assert.equal((await call('/me/appointments/runtime-request/calendar', undefined, detailCookie)).status, 409);
  await db.prepare(`INSERT INTO appointments(id,customer_user_id,service_id,location_id,price_cents,status,source,starts_at,ends_at,created_at,updated_at)
    VALUES ('runtime-confirmed',?,'runtime-service',?,2500,'confirmed','website','2027-01-10T15:00:00Z','2027-01-10T15:30:00Z',?,?)`).bind(account.id, location.id, now, now).run();
  assert.equal((await call('/me/appointments/runtime-confirmed/withdraw', { updatedAt: now }, detailCookie)).status, 409);
  const calendar = await call('/me/appointments/runtime-confirmed/calendar', undefined, detailCookie);
  assert.equal(calendar.status, 200); assert.match(await calendar.text(), /DTSTART:20270110T150000Z/);
  const orderDetail = await call('/me/orders/runtime-order-00', undefined, detailCookie);
  assert.equal(orderDetail.status, 200); assert.equal((await orderDetail.json()).order.totalCents, 2500);
  const secondRegistration = await call('/auth/register', { name: 'Second Customer', email: 'second-runtime@example.test', password: 'Another runtime passphrase 2026', turnstileToken: 'test-only' });
  assert.equal(secondRegistration.status, 202);
  const secondVerification = await call('/auth/verify', { challengeId: (await secondRegistration.json()).challengeId, code: deliveries.at(-1).text.match(/code is (\d{8})/)[1] });
  assert.equal(secondVerification.status, 200);
  const secondCookie = secondVerification.headers.get('Set-Cookie');
  await db.prepare("INSERT INTO users(id,email,display_name,role,email_verified_at,created_at,updated_at) VALUES ('runtime-professional','professional@example.test','Professional','staff',?,?,?)").bind(now, now, now).run();
  await db.prepare("INSERT INTO staff_profiles(id,user_id,professional_name,public_slug,setup_status,booking_buffer_minutes,created_at,updated_at) VALUES ('runtime-staff','runtime-professional','Professional','runtime-staff','approved',15,?,?)").bind(now, now).run();
  await db.prepare("INSERT INTO staff_locations(staff_id,location_id,created_at) VALUES ('runtime-staff',?,?)").bind(location.id, now).run();
  await db.prepare("INSERT INTO staff_services(staff_id,service_id,created_at,updated_at) VALUES ('runtime-staff','runtime-service',?,?)").bind(now, now).run();
  await db.prepare("UPDATE locations SET timezone='UTC' WHERE id=?").bind(location.id).run();
  const bookingDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  await db.prepare("INSERT INTO weekly_availability(id,staff_id,location_id,weekday,start_time,end_time,created_at,updated_at) VALUES ('runtime-hours','runtime-staff',?,?,'09:00','17:00',?,?)").bind(location.id, new Date(`${bookingDate}T00:00:00Z`).getUTCDay(), now, now).run();
  const selection = { staffId: 'runtime-staff', serviceId: 'runtime-service', locationId: location.id, date: bookingDate };
  const availabilityPath = `/me/booking/availability?${new URLSearchParams(selection)}`;
  const openings = await call(availabilityPath, undefined, detailCookie);
  assert.equal(openings.status, 200);
  const available = await openings.json(); assert.ok(available.slots.length > 1);
  const firstRequest = { ...selection, startsAt: available.slots[0].startsAt, quote: available.quote, note: '', requestKey: randomUUID() };
  const race = await Promise.all([call('/me/booking/requests', firstRequest, detailCookie), call('/me/booking/requests', { ...firstRequest, requestKey: randomUUID() }, secondCookie)]);
  assert.deepEqual(race.map((response) => response.status).sort(), [200, 409], 'Two customers reserved the same opening');
  const winningIndex = race.findIndex((response) => response.status === 200);
  const winningId = (await race[winningIndex].json()).appointmentId;
  const losingCookie = winningIndex === 0 ? secondCookie : detailCookie;
  assert.equal((await call(`/me/appointments/${winningId}`, undefined, losingCookie)).status, 404);
  const nextAvailable = await (await call(availabilityPath, undefined, detailCookie)).json();
  const retryRequest = { ...firstRequest, startsAt: nextAvailable.slots[0].startsAt, quote: nextAvailable.quote, requestKey: randomUUID() };
  const retries = await Promise.all([call('/me/booking/requests', retryRequest, detailCookie), call('/me/booking/requests', retryRequest, detailCookie)]);
  for (const response of retries) assert.equal(response.status, 200, await response.text());
  const retryId = (await retries[0].json()).appointmentId;
  assert.equal(retryId, (await retries[1].json()).appointmentId);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM appointment_events WHERE event_type='customer_requested_appointment'").first()).n, 2);
  await db.prepare("INSERT INTO customer_profiles(user_id,created_at,updated_at) VALUES ('runtime-professional',?,?)").bind(now, now).run();
  await db.prepare("INSERT INTO account_credentials(user_id,password_hash,updated_at) SELECT 'runtime-professional',password_hash,? FROM account_credentials WHERE user_id=?").bind(now, account.id).run();
  const staffLogin = await call('/auth/login', { email: 'professional@example.test', password: 'A runtime test passphrase 2026', turnstileToken: 'test-only' });
  assert.equal(staffLogin.status, 200); const staffCookie = staffLogin.headers.get('Set-Cookie');
  assert.equal((await call(`/me/professional/requests/${winningId}`, undefined, staffCookie)).status, 403, 'Password alone exposed a customer request');
  const enrollment = await call('/me/mfa/enroll/start', { currentPassword: 'A runtime test passphrase 2026' }, staffCookie);
  assert.equal(enrollment.status, 200); const setup = await enrollment.json();
  // Independent RFC 4226/6238 calculation exercises the Worker's real AES and
  // TOTP validation without exposing a testing bypass in the application.
  const authenticatorCode = (setupKey = setup.setupKey) => {
    const bits = [...setupKey].map((char) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char).toString(2).padStart(5, '0')).join('');
    const secretBytes = Buffer.from(bits.match(/.{8}/g).map((part) => parseInt(part, 2)));
    const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
    const digest = createHmac('sha1', secretBytes).update(counter).digest();
    return String((digest.readUInt32BE(digest.at(-1) & 15) & 0x7fffffff) % 1000000).padStart(6, '0');
  };
  const enrollmentProof = { enrollmentId: setup.enrollmentId, code: authenticatorCode() };
  const enrollmentResults = await Promise.all([call('/me/mfa/enroll/confirm', enrollmentProof, staffCookie), call('/me/mfa/enroll/confirm', enrollmentProof, staffCookie)]);
  assert.equal(enrollmentResults.filter((result) => result.status === 200).length, 1, 'Concurrent enrollment must have only one winner');
  assert.ok(enrollmentResults.every((result) => [200, 400, 409].includes(result.status)));
  const { recoveryCodes } = await enrollmentResults.find((result) => result.status === 200).json();
  assert.equal((await db.prepare('SELECT count(*) AS n FROM staff_mfa_recovery_codes').first()).n, 8);
  const secondStaffLogin = await call('/auth/login', { email: 'professional@example.test', password: 'A runtime test passphrase 2026', turnstileToken: 'test-only' });
  assert.equal(secondStaffLogin.status, 200); const secondStaffCookie = secondStaffLogin.headers.get('Set-Cookie');
  const recoveryProof = { currentPassword: 'A runtime test passphrase 2026', code: recoveryCodes[0] };
  const recoveryResults = await Promise.all([call('/me/mfa/unlock', recoveryProof, staffCookie), call('/me/mfa/unlock', recoveryProof, secondStaffCookie)]);
  assert.deepEqual(recoveryResults.map((result) => result.status).sort(), [200, 400], 'A recovery code must only be consumed once across devices');
  assert.equal((await db.prepare('SELECT count(*) AS n FROM staff_mfa_recovery_codes WHERE used_receipt IS NOT NULL').first()).n, 1);
  await db.prepare('DELETE FROM auth_rate_limits').run();
  await db.prepare('UPDATE staff_authenticators SET last_counter=?').bind(Math.floor(Date.now() / 30000) - 1).run();
  const totpProof = { currentPassword: 'A runtime test passphrase 2026', code: authenticatorCode() };
  const totpResults = await Promise.all([call('/me/mfa/unlock', totpProof, staffCookie), call('/me/mfa/unlock', totpProof, secondStaffCookie)]);
  assert.deepEqual(totpResults.map((result) => result.status).sort(), [200, 400], 'An authenticator code must only be consumed once across devices');
  const staffDetail = await (await call(`/me/professional/requests/${winningId}`, undefined, staffCookie)).json();
  assert.equal(staffDetail.request.status, 'requested');
  const winningCookie = winningIndex === 0 ? detailCookie : secondCookie;
  const decision = { action: 'confirm', updatedAt: staffDetail.request.updatedAt, decisionKey: randomUUID(), currentPassword: 'A runtime test passphrase 2026' };
  const competingActions = await Promise.all([
    call(`/me/professional/requests/${winningId}`, decision, staffCookie),
    call(`/me/appointments/${winningId}/withdraw`, { updatedAt: staffDetail.request.updatedAt }, winningCookie),
  ]);
  assert.deepEqual(competingActions.map((response) => response.status).sort(), [200, 409], 'Confirmation and withdrawal both succeeded');
  assert.equal((await db.prepare("SELECT count(*) AS n FROM appointment_events WHERE appointment_id=? AND event_type IN ('professional_confirmed','customer_withdrew_request')").bind(winningId).first()).n, 1);
  const nextDetail = await (await call(`/me/professional/requests/${retryId}`, undefined, staffCookie)).json();
  const decline = { ...decision, action: 'decline', updatedAt: nextDetail.request.updatedAt, decisionKey: randomUUID() };
  const duplicateDecisions = await Promise.all([call(`/me/professional/requests/${retryId}`, decline, staffCookie), call(`/me/professional/requests/${retryId}`, decline, staffCookie)]);
  for (const response of duplicateDecisions) assert.equal(response.status, 200, await response.text());
  assert.equal((await db.prepare("SELECT count(*) AS n FROM appointment_events WHERE appointment_id=? AND event_type='professional_declined'").bind(retryId).first()).n, 1);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM appointment_notifications n JOIN appointment_events e ON e.id=n.event_id WHERE e.appointment_id=?').bind(retryId).first()).n, 4);
  assert.equal((await call(`/me/professional/requests/${retryId}`, undefined, detailCookie)).status, 403);
  await db.prepare("INSERT INTO users(id,email,display_name,role,email_verified_at,created_at,updated_at) VALUES ('runtime-applicant','applicant@example.test','Applicant','staff',?,?,?)").bind(now, now, now).run();
  await db.prepare("INSERT INTO customer_profiles(user_id,created_at,updated_at) VALUES ('runtime-applicant',?,?)").bind(now, now).run();
  await db.prepare("INSERT INTO account_credentials(user_id,password_hash,updated_at) SELECT 'runtime-applicant',password_hash,? FROM account_credentials WHERE user_id='runtime-professional'").bind(now).run();
  const applicantLogin = await call('/auth/login', { email: 'applicant@example.test', password: 'A runtime test passphrase 2026', turnstileToken: 'test-only' });
  assert.equal(applicantLogin.status, 200); const applicantCookie = applicantLogin.headers.get('Set-Cookie');
  const applicantStart = await call('/me/mfa/enroll/start', { currentPassword: 'A runtime test passphrase 2026' }, applicantCookie);
  assert.equal(applicantStart.status, 200); const applicantSetup = await applicantStart.json();
  assert.equal((await call('/me/mfa/enroll/confirm', { enrollmentId: applicantSetup.enrollmentId, code: authenticatorCode(applicantSetup.setupKey) }, applicantCookie)).status, 200);
  const setupPage = await (await call('/me/professional/setup', undefined, applicantCookie)).json();
  const setupDraft = { action: 'submit', version: 0, professionalName: 'Runtime Applicant', bio: 'Test introduction.', locationIds: [setupPage.locations[0].id], serviceIds: [setupPage.services[0].id] };
  const submissions = await Promise.all([call('/me/professional/setup', setupDraft, applicantCookie), call('/me/professional/setup', setupDraft, applicantCookie)]);
  assert.deepEqual(submissions.map((response) => response.status).sort(), [200, 409], 'Concurrent submission should save once');
  const submission = (await (await call('/me/professional/setup', undefined, applicantCookie)).json()).submission;
  await db.prepare("UPDATE users SET role='owner' WHERE id='runtime-professional'").run();
  assert.equal((await call('/me/mfa/unlock', { currentPassword: 'A runtime test passphrase 2026', code: recoveryCodes[1] }, staffCookie)).status, 200);
  const reviewPath = `/me/professional/reviews/${submission.id}`;
  const reviewPage = await (await call(reviewPath, undefined, staffCookie)).json();
  const reviewDecision = { action: 'approve', version: submission.version, revision: reviewPage.revision, reviewNote: '', currentPassword: 'A runtime test passphrase 2026' };
  const approvals = await Promise.all([call(reviewPath, reviewDecision, staffCookie), call(reviewPath, reviewDecision, staffCookie)]);
  assert.deepEqual(approvals.map((response) => response.status).sort(), [200, 409], 'Concurrent owner approvals must have one winner');
  const approved = await db.prepare("SELECT id,setup_status FROM staff_profiles WHERE user_id='runtime-applicant'").first();
  assert.equal(approved.setup_status, 'approved');
  assert.equal((await db.prepare('SELECT count(*) AS n FROM staff_services WHERE staff_id=? AND active=1').bind(approved.id).first()).n, 1);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM weekly_availability WHERE staff_id=?').bind(approved.id).first()).n, 0);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM audit_events WHERE entity_id=? AND action='professional_setup_approved'").bind(submission.id).first()).n, 1);
  await db.prepare("UPDATE locations SET timezone='UTC' WHERE id=?").bind(setupDraft.locationIds[0]).run();
  const schedulePath = '/me/professional/schedule';
  const schedule = await (await call(schedulePath, undefined, applicantCookie)).json();
  const hours = { action: 'add_hours', revision: schedule.revision, locationId: setupDraft.locationIds[0], weekday: new Date(`${bookingDate}T00:00:00Z`).getUTCDay(), startTime: '09:00', endTime: '17:00' };
  const hoursRace = await Promise.all([call(schedulePath, hours, applicantCookie), call(schedulePath, hours, applicantCookie)]);
  assert.deepEqual(hoursRace.map((response) => response.status).sort(), [200, 409], 'Concurrent weekly updates must save once');
  const newSelection = { staffId: approved.id, locationId: setupDraft.locationIds[0], serviceId: setupDraft.serviceIds[0], date: bookingDate };
  const newAvailable = await (await call(`/me/booking/availability?${new URLSearchParams(newSelection)}`, undefined, detailCookie)).json();
  assert.ok(newAvailable.slots.length, 'Approved weekly hours did not create openings');
  const scheduleRevision = (await (await call(schedulePath, undefined, applicantCookie)).json()).revision;
  const offVsBooking = await Promise.all([
    call(schedulePath, { action: 'add_time_off', revision: scheduleRevision, locationId: newSelection.locationId, date: bookingDate, startTime: '09:00', endTime: '17:00' }, applicantCookie),
    call('/me/booking/requests', { ...newSelection, startsAt: newAvailable.slots[0].startsAt, quote: newAvailable.quote, note: '', requestKey: randomUUID() }, detailCookie),
  ]);
  assert.deepEqual(offVsBooking.map((response) => response.status).sort(), [200, 409], 'Time off and a conflicting booking both saved');
  const offCount = (await db.prepare("SELECT count(*) AS n FROM schedule_exceptions WHERE staff_id=? AND exception_type='time_off'").bind(approved.id).first()).n;
  const visitCount = (await db.prepare('SELECT count(*) AS n FROM appointments WHERE requested_staff_id=?').bind(approved.id).first()).n;
  assert.equal(offCount + visitCount, 1);
  const visitOpening = await (await call(availabilityPath, undefined, detailCookie)).json();
  const visitRequest = await call('/me/booking/requests', { ...firstRequest, startsAt: visitOpening.slots[0].startsAt, quote: visitOpening.quote, requestKey: randomUUID() }, detailCookie);
  assert.equal(visitRequest.status, 200); const visitId = (await visitRequest.json()).appointmentId;
  const visitBefore = await (await call(`/me/professional/requests/${visitId}`, undefined, staffCookie)).json();
  assert.equal((await call(`/me/professional/requests/${visitId}`, { action: 'confirm', updatedAt: visitBefore.request.updatedAt, decisionKey: randomUUID(), currentPassword: 'A runtime test passphrase 2026' }, staffCookie)).status, 200);
  const visitList = await (await call('/me/professional/visits', undefined, staffCookie)).json();
  assert.ok(visitList.items.some((item) => item.id === visitId));
  assert.ok(!JSON.stringify(visitList).includes('customerNote'));
  const visitDetails = await call(`/me/professional/visits/${visitId}`, undefined, staffCookie);
  assert.equal(visitDetails.status, 200); assert.equal((await visitDetails.json()).visit.status, 'confirmed');
  assert.equal((await call(`/me/professional/visits/${visitId}`, undefined, applicantCookie)).status, 404);
  assert.equal((await call('/me/professional/visits', undefined, detailCookie)).status, 403);
  const cancellationPath = `/me/appointments/${visitId}/cancellation`;
  const estimateInput = { appointmentId: visitId, orderId: null, discountCents: 0, discountReason: '', taxCents: null, shippingCents: null, chargeNote: '' };
  const estimatePreviewResponse = await call('/me/sales/preview', estimateInput, staffCookie);
  assert.equal(estimatePreviewResponse.status, 200, await estimatePreviewResponse.text());
  const estimatePreview = await estimatePreviewResponse.json();
  const estimateSave = { ...estimateInput, token: estimatePreview.token, requestKey: randomUUID(), currentPassword: 'A runtime test passphrase 2026' };
  const duplicateEstimates = await Promise.all([call('/me/sales', estimateSave, staffCookie), call('/me/sales', estimateSave, staffCookie)]);
  for (const response of duplicateEstimates) assert.equal(response.status, 200, await response.text());
  const savedEstimate = await duplicateEstimates[0].json();
  assert.equal((await duplicateEstimates[1].json()).estimateId, savedEstimate.estimateId);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM sale_estimates WHERE appointment_id=?').bind(visitId).first()).n, 1);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM audit_events WHERE action='sale_estimate_issued' AND entity_id=?").bind(savedEstimate.estimateId).first()).n, 1);
  assert.equal((await call(`/me/estimates/${savedEstimate.estimateId}/document`, undefined, detailCookie)).status, 200);
  assert.equal((await call(`/me/estimates/${savedEstimate.estimateId}/document`, undefined, applicantCookie)).status, 404);
  assert.equal((await db.prepare('SELECT status FROM appointments WHERE id=?').bind(visitId).first()).status, 'confirmed');
  const reschedulePath = `/me/appointments/${visitId}/reschedule`;
  const changePage = await (await call(reschedulePath, undefined, detailCookie)).json();
  const replacementResponse = await call(`${reschedulePath}?date=${bookingDate}`, undefined, detailCookie);
  assert.equal(replacementResponse.status, 200, await replacementResponse.text());
  const replacement = await replacementResponse.json(); assert.ok(replacement.slots.length);
  const move = { action: 'request', updatedAt: changePage.updatedAt, version: changePage.version, requestKey: randomUUID(),
    date: bookingDate, startsAt: replacement.slots.at(-1).startsAt, quote: replacement.quote };
  const duplicateMoves = await Promise.all([call(reschedulePath, move, detailCookie), call(reschedulePath, move, detailCookie)]);
  for (const response of duplicateMoves) assert.equal(response.status, 200, await response.text());
  assert.equal((await db.prepare('SELECT count(*) AS n FROM appointment_changes WHERE appointment_id=?').bind(visitId).first()).n, 1);
  const pendingMove = await (await call(reschedulePath, undefined, detailCookie)).json();
  assert.equal(pendingMove.startsAt, changePage.startsAt, 'A pending change moved the original reservation');
  const responseBody = { updatedAt: pendingMove.updatedAt, version: pendingMove.version, changeId: pendingMove.change.id, currentPassword: 'A runtime test passphrase 2026' };
  const opposingMoves = await Promise.all([
    call(`/me/professional/requests/${visitId}/reschedule`, { ...responseBody, action: 'approve', requestKey: randomUUID() }, staffCookie),
    call(`/me/professional/requests/${visitId}/reschedule`, { ...responseBody, action: 'decline', requestKey: randomUUID() }, staffCookie),
  ]);
  assert.deepEqual(opposingMoves.map(r => r.status).sort(), [200,409]);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM appointment_change_operations WHERE appointment_id=? AND action IN ('approve','decline')").bind(visitId).first()).n, 1);
  const cancelBefore = await (await call(`/me/appointments/${visitId}`, undefined, detailCookie)).json();
  const duplicateCancellations = await Promise.all([
    call(cancellationPath, { updatedAt: cancelBefore.appointment.updatedAt }, detailCookie),
    call(cancellationPath, { updatedAt: cancelBefore.appointment.updatedAt }, detailCookie),
  ]);
  assert.deepEqual(duplicateCancellations.map(r => r.status), [200, 200]);
  assert.equal((await db.prepare('SELECT status FROM appointments WHERE id=?').bind(visitId).first()).status, 'confirmed');
  const cancelCurrent = await (await call(`/me/professional/requests/${visitId}`, undefined, staffCookie)).json();
  const cancellationDecision = { updatedAt: cancelCurrent.request.updatedAt, currentPassword: 'A runtime test passphrase 2026' };
  const opposingCancellations = await Promise.all([
    call(`/me/professional/requests/${visitId}`, { ...cancellationDecision, action: 'cancel', decisionKey: randomUUID() }, staffCookie),
    call(`/me/professional/requests/${visitId}`, { ...cancellationDecision, action: 'keep', decisionKey: randomUUID() }, staffCookie),
  ]);
  assert.deepEqual(opposingCancellations.map(r => r.status).sort(), [200, 409]);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM appointment_events WHERE appointment_id=? AND event_type IN ('professional_cancellation_approved','professional_cancellation_declined')").bind(visitId).first()).n, 1);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM appointment_events WHERE appointment_id=? AND event_type='customer_requested_cancellation'").bind(visitId).first()).n, 1);
  await db.batch([
    db.prepare("INSERT INTO products(id,name,slug,category,description,base_sku,status,pickup_enabled,shipping_enabled,created_at,updated_at) VALUES ('race-product','Race product','race-product','Grooming','Test','RACE','published',1,1,?,?)").bind(now,now),
    db.prepare("INSERT INTO product_variants(id,product_id,name,sku,price_cents,stock_on_hand,active,created_at,updated_at) VALUES ('race-variant','race-product','Single','RACE-1',100,1,1,?,?)").bind(now,now),
  ]);
  const purchase={requestKey:randomUUID(),items:[{variantId:'race-variant',quantity:1,unitPriceCents:100}],fulfillment:'pickup',customer:{name:'Runtime customer',phone:'5551234567'},shippingAddress:null};
  const purchases=await Promise.all([call('/me/orders/request',purchase,detailCookie),call('/me/orders/request',{...purchase,requestKey:randomUUID()},secondCookie)]);
  assert.deepEqual(purchases.map(r=>r.status).sort(),[200,409],'Two customers reserved the last inventory item');
  assert.equal((await db.prepare("SELECT stock_reserved FROM product_variants WHERE id='race-variant'").first()).stock_reserved,1);
  const winningPurchase = purchases.findIndex(response => response.status === 200);
  const buyerCookie = [detailCookie, secondCookie][winningPurchase];
  const { orderId: withdrawalOrderId } = await purchases[winningPurchase].json();
  const withdrawalDetail = await (await call(`/me/orders/${withdrawalOrderId}`,undefined,buyerCookie)).json();
  const withdrawalBody = { updatedAt: withdrawalDetail.order.updatedAt };
  const duplicateWithdrawals = await Promise.all([
    call(`/me/orders/${withdrawalOrderId}/withdraw`,withdrawalBody,buyerCookie),
    call(`/me/orders/${withdrawalOrderId}/withdraw`,withdrawalBody,buyerCookie),
  ]);
  for (const response of duplicateWithdrawals) assert.equal(response.status,200,await response.text());
  assert.equal((await db.prepare("SELECT stock_reserved FROM product_variants WHERE id='race-variant'").first()).stock_reserved,0);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM audit_events WHERE action='customer_order_withdrawn'").first()).n,1);
  // Run the full visit lifecycle against D1, including competing identical
  // retries. A completed service is not a financial transaction.
  await db.prepare(`INSERT INTO appointments(id,customer_user_id,assigned_staff_id,service_id,location_id,starts_at,ends_at,price_cents,status,source,created_at,updated_at)
    SELECT 'lifecycle-runtime',customer_user_id,assigned_staff_id,service_id,location_id,?,?,price_cents,'confirmed','website',?,? FROM appointments WHERE id=?`)
    .bind(new Date(Date.now()-60000).toISOString(),new Date(Date.now()+3600000).toISOString(),now,now,visitId).run();
  const lifecyclePath = '/me/professional/visits/lifecycle-runtime';
  for (const action of ['checked_in','in_service','completed']) {
    const detail = await (await call(lifecyclePath, undefined, staffCookie)).json();
    const body = { action, updatedAt: detail.visit.updatedAt, requestKey: randomUUID(), currentPassword: 'A runtime test passphrase 2026' };
    const responses = await Promise.all([call(lifecyclePath, body, staffCookie),call(lifecyclePath, body, staffCookie)]);
    for (const response of responses) assert.equal(response.status,200,await response.text());
  }
  assert.equal((await db.prepare("SELECT count(*) AS n FROM visit_operations WHERE appointment_id='lifecycle-runtime'").first()).n,3);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM appointment_events WHERE appointment_id='lifecycle-runtime'").first()).n,3);
  assert.ok((await (await call('/me/professional/visits?view=history',undefined,staffCookie)).json()).items.some(item=>item.id==='lifecycle-runtime'));
  // Real concurrent D1 finalizations, payments and full refunds must produce
  // exactly one sale and one event per action, including recovery of lost replies.
  const cashInput = { ...estimateInput, appointmentId: 'lifecycle-runtime', taxCents: 0, shippingCents: 0, chargeNote: 'Runtime test charge confirmed' };
  const cashPreview = await call('/me/sales/preview',cashInput,staffCookie); assert.equal(cashPreview.status,200,await cashPreview.text());
  const cashEstimate = await call('/me/sales',{...cashInput,token:(await cashPreview.json()).token,requestKey:randomUUID(),currentPassword:'A runtime test passphrase 2026'},staffCookie);
  assert.equal(cashEstimate.status,200,await cashEstimate.text());
  const finalBody = {estimateId:(await cashEstimate.json()).estimateId,currentPassword:'A runtime test passphrase 2026'};
  const finalizations = await Promise.all([call('/me/counter',finalBody,staffCookie),call('/me/counter',finalBody,staffCookie)]);
  for(const response of finalizations) assert.equal(response.status,200,await response.text());
  const saleId=(await finalizations[0].json()).saleId;assert.equal((await finalizations[1].json()).saleId,saleId);
  const salePath=`/me/counter/${saleId}`;
  const cashSale=(await (await call(salePath,undefined,staffCookie)).json()).sale;
  const openBody={action:'open',registerId:'',amountCents:10000,reason:'Test float',token:'',requestKey:randomUUID(),currentPassword:'A runtime test passphrase 2026'};
  const registerOpenings=await Promise.all([call('/me/register',openBody,staffCookie),call('/me/register',openBody,staffCookie)]);
  for(const response of registerOpenings)assert.equal(response.status,200,await response.text());
  const registerId=(await registerOpenings[0].json()).registerId;assert.equal((await registerOpenings[1].json()).registerId,registerId);
  const cashBody={action:'payment',cashReceivedCents:cashSale.totalCents+1000,tipCents:500,reason:'',requestKey:randomUUID(),currentPassword:'A runtime test passphrase 2026',registerId};
  const payments=await Promise.all([call(salePath,cashBody,staffCookie),call(salePath,cashBody,staffCookie)]);
  for(const response of payments)assert.equal(response.status,200,await response.text());
  const receiptId=(await payments[0].json()).receiptId;assert.equal((await payments[1].json()).receiptId,receiptId);
  assert.equal((await call(`/me/receipts/${receiptId}/document`,undefined,detailCookie)).status,200);
  assert.equal((await call(`/me/receipts/${receiptId}/document`,undefined,applicantCookie)).status,404);
  assert.equal((await call(salePath,{...cashBody,requestKey:randomUUID()},staffCookie)).status,409);
  const refundBody={...cashBody,action:'refund',cashReceivedCents:0,tipCents:0,reason:'Runtime full refund',requestKey:randomUUID()};
  const refunds=await Promise.all([call(salePath,refundBody,staffCookie),call(salePath,refundBody,staffCookie)]);
  for(const response of refunds)assert.equal(response.status,200,await response.text());
  assert.equal((await refunds[0].json()).receiptId,(await refunds[1].json()).receiptId);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM cash_sale_events WHERE sale_id=?').bind(saleId).first()).n,2);
  assert.equal((await (await call(salePath,undefined,staffCookie)).json()).sale.state,'refunded');
  await db.prepare(`INSERT INTO appointments(id,customer_user_id,assigned_staff_id,service_id,location_id,price_cents,status,source,created_at,updated_at)
    SELECT 'cash-race-runtime',customer_user_id,assigned_staff_id,service_id,location_id,price_cents,'completed','website',?,? FROM appointments WHERE id=?`).bind(now,now,visitId).run();
  const raceInput={...cashInput,appointmentId:'cash-race-runtime'};
  const racePreview=await call('/me/sales/preview',raceInput,staffCookie);assert.equal(racePreview.status,200,await racePreview.text());
  const raceEstimate=await call('/me/sales',{...raceInput,token:(await racePreview.json()).token,requestKey:randomUUID(),currentPassword:cashBody.currentPassword},staffCookie);assert.equal(raceEstimate.status,200,await raceEstimate.text());
  const raceFinal=await call('/me/counter',{estimateId:(await raceEstimate.json()).estimateId,currentPassword:cashBody.currentPassword},staffCookie);assert.equal(raceFinal.status,200,await raceFinal.text());
  const raceSale=(await raceFinal.json()).saleId;const racePath=`/me/counter/${raceSale}`;
  const competingCash=await Promise.all([
    call(racePath,{...cashBody,requestKey:randomUUID()},staffCookie),
    call(racePath,{...refundBody,action:'void',requestKey:randomUUID()},staffCookie),
  ]);
  assert.deepEqual(competingCash.map(response=>response.status).sort(),[200,409]);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM cash_sale_events WHERE sale_id=?').bind(raceSale).first()).n,1,'Competing payment/void both committed');
  const registerReview=(await (await call('/me/register',undefined,staffCookie)).json()).open;
  const closeBody={action:'close',registerId,amountCents:registerReview.totals.expectedCents,reason:'Counted test drawer',token:registerReview.closeToken,requestKey:randomUUID(),currentPassword:cashBody.currentPassword};
  const registerRace=await Promise.all([
    call('/me/register',closeBody,staffCookie),
    call('/me/register',{...openBody,action:'paid_in',registerId,amountCents:100,reason:'Concurrent cash added',requestKey:randomUUID()},staffCookie),
  ]);
  assert.deepEqual(registerRace.map(response=>response.status).sort(),[200,409],'Closing and a stale cash adjustment both committed');
  if(registerRace[0].status===409){
    const fresh=(await (await call('/me/register',undefined,staffCookie)).json()).open;
    assert.equal(fresh.totals.expectedCents,closeBody.amountCents+100);
    const close=await call('/me/register',{...closeBody,amountCents:fresh.totals.expectedCents,token:fresh.closeToken,requestKey:randomUUID()},staffCookie);assert.equal(close.status,200,await close.text());
  }else assert.equal((await call('/me/register',closeBody,staffCookie)).status,200);
  assert.equal((await (await call('/me/register',undefined,staffCookie)).json()).open,null);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM cash_register_closures WHERE register_id=?').bind(registerId).first()).n,1);
  assert.equal((await call(salePath,cashBody,staffCookie)).status,200,'A receipt retry failed after register closing');
  console.log('Cloudflare runtime passed: account/MFA, onboarding, schedule/booking competition, private documents, rescheduling/cancellation races, visit lifecycle, inventory competition, transactional notifications, concurrent cash sales/refunds and register opening/closing races.');
} finally { await worker.dispose(); }
