import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkReleaseEnvironment } from './release-environment.mjs';

const valid = () => ({
  APP_ORIGIN: 'https://shop.kutshoppe.net',
  ACCOUNTS_ENABLED: 'true', CUSTOMER_BOOKING_ENABLED: 'true', STAFF_OPERATIONS_ENABLED: 'true',
  STAFF_SETUP_ENABLED: 'true', COMMERCE_ENABLED: 'true', APPOINTMENT_EMAIL_ENABLED: 'true',
  D1_DATABASE_ID: '12345678-1234-1234-1234-123456789abc',
  NOTIFICATIONS_D1_DATABASE_ID: '12345678-1234-1234-1234-123456789abc',
  AUTH_SECRET: 'synthetic-secret-for-offline-validation-123456',
  MFA_ENCRYPTION_KEY: 'abcdef0123456789'.repeat(4),
  TURNSTILE_SITE_KEY: 'synthetic-public-key', TURNSTILE_SECRET_KEY: 'synthetic-private-key',
  RESEND_API_KEY: 're_synthetic', MAIL_FROM: 'The Kut Shoppe <accounts@kutshoppe.net>',
});

test('accepts structurally complete settings without contacting providers', () => assert.deepEqual(checkReleaseEnvironment(valid()), []));
for (const origin of ['http://shop.kutshoppe.net', 'https://localhost', 'https://staging.example.invalid', 'https://shop.kutshoppe.net/', 'https://user:pass@shop.kutshoppe.net', 'https://127.0.0.1']) {
  test(`rejects unsafe origin ${origin}`, () => assert.ok(checkReleaseEnvironment({ ...valid(), APP_ORIGIN: origin }).some(x => x.startsWith('APP_ORIGIN'))));
}
test('requires explicit feature choices', () => assert.ok(checkReleaseEnvironment({ ...valid(), COMMERCE_ENABLED: undefined }).length));
test('rejects dependency mismatches', () => {
  for (const name of ['ACCOUNTS_ENABLED', 'STAFF_OPERATIONS_ENABLED', 'APPOINTMENT_EMAIL_ENABLED']) {
    assert.ok(checkReleaseEnvironment({ ...valid(), [name]: 'false' }).length);
  }
});
test('rejects local database and test credentials without disclosing values', () => {
  for (const [name, value] of Object.entries({ D1_DATABASE_ID: '00000000-0000-0000-0000-000000000000', AUTH_SECRET: 'short-secret', MFA_ENCRYPTION_KEY: '0'.repeat(64), TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: '2x0000000000000000000000000000000AA', RESEND_API_KEY: 're_placeholder', MAIL_FROM: 'sender@example.com' })) {
    const errors = checkReleaseEnvironment({ ...valid(), [name]: value });
    assert.ok(errors.some(x => x.includes(name)), name);
    assert.ok(errors.every(x => !x.includes(value)), 'diagnostics must not print values');
  }
});
test('rejects a notification worker bound to another database', () => assert.ok(checkReleaseEnvironment({ ...valid(), NOTIFICATIONS_D1_DATABASE_ID: 'other' }).length));
test('rejects prototype environment and reused MFA key', () => {
  assert.ok(checkReleaseEnvironment({ ...valid(), VITE_LOCAL_PLATFORM_PREVIEW: 'true' }).length);
  const env = valid();
  assert.ok(checkReleaseEnvironment({ ...env, AUTH_SECRET: env.MFA_ENCRYPTION_KEY }).length);
});
