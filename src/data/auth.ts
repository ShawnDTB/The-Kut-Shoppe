import { queueNotification, subscribeToPlatformChanges } from './notifications';

export type AccountRole = 'customer' | 'staff' | 'manager' | 'owner';
export type StaffProfileRole = Exclude<AccountRole, 'customer'> | 'barber';

export interface CustomerAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
  phoneVerified: boolean;
  role: AccountRole;
  staffProfileId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountSession {
  accountId: string;
  role: AccountRole;
  staffProfileId: string | null;
  createdAt: string;
}

export interface VerificationChallenge {
  id: string;
  phone: string;
  code: string;
  expiresAt: string;
  verifiedAt: string | null;
  attempts: number;
  createdAt: string;
}

const storageKeys = {
  accounts: 'kut-shoppe.accounts.v2',
  session: 'kut-shoppe.session.v2',
  challenges: 'kut-shoppe.verification-challenges.v2',
} as const;

const platformChangeEvent = 'kut-shoppe-platform-change';

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createVerificationCode() {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    const value = values[0] ?? 0;
    return String(100000 + (value % 900000));
  }

  return String(100000 + Math.floor(Math.random() * 900000));
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(platformChangeEvent));
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return national.slice(0, 10);
}

export function isValidPhone(value: string) {
  return normalizePhone(value).length === 10;
}

export function formatPhone(value: string) {
  const phone = normalizePhone(value);
  if (phone.length !== 10) return value;
  return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
}

export function readAccounts() {
  return readJson<CustomerAccount[]>(storageKeys.accounts, []);
}

export function findAccount(email: string, phone?: string) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = phone ? normalizePhone(phone) : '';

  return readAccounts().find((account) => (
    account.email === normalizedEmail
    && (!normalizedPhone || normalizePhone(account.phone) === normalizedPhone)
  ));
}

export function saveAccount(account: CustomerAccount) {
  const accounts = readAccounts();
  const next = [...accounts.filter((item) => item.id !== account.id), account];
  writeJson(storageKeys.accounts, next);
  return account;
}

export function createOrUpdateCustomerAccount(input: {
  name: string;
  email: string;
  phone: string;
  phoneVerified: boolean;
}) {
  const existing = findAccount(input.email, input.phone);
  const now = new Date().toISOString();
  const account: CustomerAccount = existing
    ? {
        ...existing,
        name: input.name.trim(),
        phone: normalizePhone(input.phone),
        phoneVerified: existing.phoneVerified || input.phoneVerified,
        updatedAt: now,
      }
    : {
        id: createId('account'),
        name: input.name.trim(),
        email: normalizeEmail(input.email),
        phone: normalizePhone(input.phone),
        phoneVerified: input.phoneVerified,
        role: 'customer',
        staffProfileId: null,
        createdAt: now,
        updatedAt: now,
      };

  return saveAccount(account);
}

export function createOrUpdateStaffAccount(input: {
  name: string;
  email: string;
  phone: string;
  role: StaffProfileRole;
  staffProfileId: string;
  phoneVerified: boolean;
}) {
  const existing = findAccount(input.email, input.phone);
  const now = new Date().toISOString();
  const accountRole: Exclude<AccountRole, 'customer'> = input.role === 'barber' ? 'staff' : input.role;
  const account: CustomerAccount = existing
    ? {
        ...existing,
        name: input.name.trim(),
        phone: normalizePhone(input.phone),
        role: accountRole,
        staffProfileId: input.staffProfileId,
        phoneVerified: existing.phoneVerified || input.phoneVerified,
        updatedAt: now,
      }
    : {
        id: createId('account'),
        name: input.name.trim(),
        email: normalizeEmail(input.email),
        phone: normalizePhone(input.phone),
        phoneVerified: input.phoneVerified,
        role: accountRole,
        staffProfileId: input.staffProfileId,
        createdAt: now,
        updatedAt: now,
      };

  return saveAccount(account);
}

export function readSession() {
  return readJson<AccountSession | null>(storageKeys.session, null);
}

export function startSession(account: CustomerAccount) {
  const session: AccountSession = {
    accountId: account.id,
    role: account.role,
    staffProfileId: account.staffProfileId,
    createdAt: new Date().toISOString(),
  };
  writeJson(storageKeys.session, session);
  return session;
}

export function endSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKeys.session);
  window.dispatchEvent(new CustomEvent(platformChangeEvent));
}

export function getSessionAccount() {
  const session = readSession();
  if (!session) return null;
  return readAccounts().find((account) => account.id === session.accountId) ?? null;
}

export function readVerificationChallenges() {
  return readJson<VerificationChallenge[]>(storageKeys.challenges, []);
}

export function requestPhoneVerification(phoneValue: string) {
  const phone = normalizePhone(phoneValue);
  if (!isValidPhone(phone)) {
    throw new Error('Enter a valid 10-digit phone number.');
  }

  const now = new Date();
  const challenge: VerificationChallenge = {
    id: createId('verification'),
    phone,
    code: createVerificationCode(),
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
    verifiedAt: null,
    attempts: 0,
    createdAt: now.toISOString(),
  };

  const retained = readVerificationChallenges().filter((item) => (
    item.phone !== phone && new Date(item.expiresAt).getTime() > now.getTime()
  ));
  writeJson(storageKeys.challenges, [...retained, challenge]);

  queueNotification({
    channel: 'sms',
    template: 'phone-verification',
    recipient: phone,
    subject: 'The Kut Shoppe verification code',
    message: `Your The Kut Shoppe verification code is ${challenge.code}. It expires in 10 minutes.`,
    relatedType: 'verification',
    relatedId: challenge.id,
  });

  return {
    challengeId: challenge.id,
    expiresAt: challenge.expiresAt,
    developmentCode: challenge.code,
  };
}

export function verifyPhoneChallenge(challengeId: string, code: string) {
  const challenges = readVerificationChallenges();
  const challenge = challenges.find((item) => item.id === challengeId);
  if (!challenge) return { valid: false, reason: 'Verification request not found.' } as const;
  if (challenge.verifiedAt) return { valid: true, phone: challenge.phone } as const;
  if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
    return { valid: false, reason: 'That verification code has expired.' } as const;
  }
  if (challenge.attempts >= 5) {
    return { valid: false, reason: 'Too many attempts. Request a new code.' } as const;
  }

  if (challenge.code !== code.trim()) {
    const next = challenges.map((item) => (
      item.id === challengeId ? { ...item, attempts: item.attempts + 1 } : item
    ));
    writeJson(storageKeys.challenges, next);
    return { valid: false, reason: 'That code does not match.' } as const;
  }

  const verifiedAt = new Date().toISOString();
  const next = challenges.map((item) => (
    item.id === challengeId ? { ...item, verifiedAt } : item
  ));
  writeJson(storageKeys.challenges, next);
  return { valid: true, phone: challenge.phone } as const;
}

export function subscribeToAuthChanges(callback: () => void) {
  return subscribeToPlatformChanges(callback);
}

export const authStorageKeys = storageKeys;
