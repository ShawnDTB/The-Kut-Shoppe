import {
  authenticatePlatformAccount,
  isValidEmail,
  validatePassword,
  type PlatformAccount,
} from './auth-v2';

const accountStorageKey = 'kut-shoppe.accounts.v3';
const customerProfileStorageKey = 'kut-shoppe.customer-profiles.v4';
const appointmentStorageKey = 'kut-shoppe.appointments.v2';
const orderStorageKey = 'kut-shoppe.orders.v2';
const authEvent = 'kut-shoppe-auth-v3-change';
const platformEvent = 'kut-shoppe-platform-change';
const encoder = new TextEncoder();

type CustomerProfileRecord = {
  accountId: string;
  phone: string;
  updatedAt: string;
};

type AppointmentIdentity = {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
};

type OrderIdentity = {
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '').slice(-10);
}

function bytesToBase64(bytes: Uint8Array) {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function base64ToBytes(value: string) {
  const decoded = atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function createSalt() {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return bytesToBase64(salt);
}

async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: base64ToBytes(salt),
    iterations: 180_000,
  }, key, 256);
  return bytesToBase64(new Uint8Array(bits));
}

function notifyChanges() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(authEvent));
  window.dispatchEvent(new CustomEvent(platformEvent));
}

export function getCustomerPhone(account: PlatformAccount) {
  const profiles = readJson<CustomerProfileRecord[]>(customerProfileStorageKey, []);
  const saved = profiles.find((profile) => profile.accountId === account.id)?.phone;
  if (saved) return saved;

  const appointment = readJson<AppointmentIdentity[]>(appointmentStorageKey, [])
    .find((item) => normalizeEmail(item.customerEmail ?? '') === account.email);
  if (appointment?.customerPhone) return normalizePhone(appointment.customerPhone);

  const order = readJson<OrderIdentity[]>(orderStorageKey, [])
    .find((item) => normalizeEmail(item.customer?.email ?? '') === account.email);
  return normalizePhone(order?.customer?.phone ?? '');
}

export function updateCustomerProfile(
  account: PlatformAccount,
  input: { name: string; email: string; phone: string },
) {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  if (name.length < 2) throw new Error('Enter your full name.');
  if (!isValidEmail(email)) throw new Error('Enter a valid email address.');
  if (input.phone.trim() && phone.length !== 10) throw new Error('Enter a valid 10-digit phone number.');

  const accounts = readJson<PlatformAccount[]>(accountStorageKey, []);
  if (accounts.some((candidate) => candidate.id !== account.id && candidate.email === email)) {
    throw new Error('Another account already uses that email address.');
  }

  const updated: PlatformAccount = {
    ...account,
    name,
    email,
    updatedAt: new Date().toISOString(),
  };
  writeJson(accountStorageKey, accounts.map((candidate) => candidate.id === account.id ? updated : candidate));

  const profiles = readJson<CustomerProfileRecord[]>(customerProfileStorageKey, []);
  const profile: CustomerProfileRecord = { accountId: account.id, phone, updatedAt: updated.updatedAt };
  writeJson(customerProfileStorageKey, [...profiles.filter((item) => item.accountId !== account.id), profile]);

  const appointments = readJson<AppointmentIdentity[]>(appointmentStorageKey, []);
  writeJson(appointmentStorageKey, appointments.map((appointment) => (
    normalizeEmail(appointment.customerEmail ?? '') === account.email
      ? { ...appointment, customerName: name, customerEmail: email, customerPhone: phone }
      : appointment
  )));

  const orders = readJson<OrderIdentity[]>(orderStorageKey, []);
  writeJson(orderStorageKey, orders.map((order) => (
    normalizeEmail(order.customer?.email ?? '') === account.email
      ? { ...order, customer: { ...order.customer, name, email, phone } }
      : order
  )));

  notifyChanges();
  return updated;
}

export async function changeCustomerPassword(
  account: PlatformAccount,
  currentPassword: string,
  newPassword: string,
) {
  const authenticated = await authenticatePlatformAccount(account.email, currentPassword);
  if (!authenticated || authenticated.id !== account.id) throw new Error('The current password is incorrect.');
  const passwordProblem = validatePassword(newPassword);
  if (passwordProblem) throw new Error(passwordProblem);

  const salt = createSalt();
  const passwordHash = await hashPassword(newPassword, salt);
  const accounts = readJson<PlatformAccount[]>(accountStorageKey, []);
  const updated: PlatformAccount = {
    ...account,
    passwordHash,
    passwordSalt: salt,
    updatedAt: new Date().toISOString(),
  };
  writeJson(accountStorageKey, accounts.map((candidate) => candidate.id === account.id ? updated : candidate));
  notifyChanges();
  return updated;
}
