import { URL } from 'node:url';

// Inspect values without logging them. This is an offline preflight, not proof
// that a provider credential, database binding, or domain is provisioned.
export function checkReleaseEnvironment(env) {
  const errors = [];
  const flags = ['ACCOUNTS_ENABLED', 'CUSTOMER_BOOKING_ENABLED', 'STAFF_OPERATIONS_ENABLED', 'STAFF_SETUP_ENABLED', 'COMMERCE_ENABLED', 'APPOINTMENT_EMAIL_ENABLED', 'CASH_SALES_ENABLED'];
  for (const name of flags) {
    if (!['true', 'false'].includes(env[name])) errors.push(`${name} must explicitly be true or false.`);
  }
  const enabled = (name) => env[name] === 'true';
  const example = (value) => !value || /example|placeholder|change.?me|test.only|your[_ -]/i.test(value);
  try {
    const url = new URL(env.APP_ORIGIN);
    const host = url.hostname;
    if (url.protocol !== 'https:' || url.origin !== env.APP_ORIGIN || url.username || url.password ||
        !host.includes('.') || /(^|\.)(localhost|example\.(com|net|org))$|\.(invalid|test|local)$/.test(host) ||
        /^[\d.]+$/.test(host) || host.includes(':')) throw new Error();
  } catch {
    errors.push('APP_ORIGIN must be an exact public HTTPS origin, without a path, credentials, or a placeholder hostname.');
  }
  if (flags.slice(1).some(enabled) && !enabled('ACCOUNTS_ENABLED')) {
    errors.push('Dependent features require ACCOUNTS_ENABLED=true.');
  }
  if (enabled('CUSTOMER_BOOKING_ENABLED') && (!enabled('STAFF_OPERATIONS_ENABLED') || !enabled('APPOINTMENT_EMAIL_ENABLED'))) {
    errors.push('Native booking requires staff operations and appointment email dispatch.');
  }
  if (enabled('CASH_SALES_ENABLED') && !enabled('STAFF_OPERATIONS_ENABLED')) errors.push('Cash sales require staff operations and verified manager access.');
  if (enabled('ACCOUNTS_ENABLED')) {
    if (!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(env.D1_DATABASE_ID ?? '') || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(env.D1_DATABASE_ID)) {
      errors.push('D1_DATABASE_ID must identify the provisioned release database, not the all-zero placeholder.');
    }
    if (example(env.AUTH_SECRET) || env.AUTH_SECRET.length < 32) errors.push('AUTH_SECRET must be a non-placeholder secret of at least 32 characters.');
    for (const name of ['TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY']) {
      if (example(env[name]) || /^[123]x0{8,}/.test(env[name])) errors.push(`${name} must be a real hostname-authorized key, not a Turnstile test key.`);
    }
    if (example(env.RESEND_API_KEY) || !env.RESEND_API_KEY.startsWith('re_')) errors.push('RESEND_API_KEY must be a non-placeholder provider key.');
    if (example(env.MAIL_FROM) || /[\r\n]/.test(env.MAIL_FROM) || !/^[^<>\s]+@[^<>\s]+\.[^<>\s]+$|^[^<>\r\n]+<[^<>\s]+@[^<>\s]+\.[^<>\s]+>$/.test(env.MAIL_FROM)) {
      errors.push('MAIL_FROM must contain an approved sender address. Verify its domain with the email provider.');
    }
    if (['STAFF_OPERATIONS_ENABLED', 'STAFF_SETUP_ENABLED', 'COMMERCE_ENABLED'].some(enabled) &&
        (!/^[a-f\d]{64}$/i.test(env.MFA_ENCRYPTION_KEY ?? '') || /^([a-f\d])\1{63}$/i.test(env.MFA_ENCRYPTION_KEY) || env.MFA_ENCRYPTION_KEY === env.AUTH_SECRET)) {
      errors.push('MFA_ENCRYPTION_KEY must be a separate 32-byte random key encoded as 64 hex characters.');
    }
  }
  if (enabled('APPOINTMENT_EMAIL_ENABLED') && env.NOTIFICATIONS_D1_DATABASE_ID !== env.D1_DATABASE_ID) {
    errors.push('NOTIFICATIONS_D1_DATABASE_ID must match the Pages D1_DATABASE_ID.');
  }
  if (env.VITE_LOCAL_PLATFORM_PREVIEW === 'true') errors.push('Remove VITE_LOCAL_PLATFORM_PREVIEW from the release environment.');
  return errors;
}
