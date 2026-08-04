import { normalizePhone } from './auth';
import {
  getPlatformSessionAccount,
  normalizeEmail,
  readPlatformAccounts,
  startPlatformSession,
  type PlatformAccount,
} from './auth-v2';
import { readAppointments, saveAppointment } from './platform';
import { readOrders, saveOrder } from './storefront';

export interface CustomerAddressV5 {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface CustomerProfileV5 {
  accountId: string;
  phone: string;
  phoneVerified: boolean;
  address: CustomerAddressV5;
  updatedAt: string;
}

export type IdentityChannelV5 = 'email' | 'phone';

export interface IdentityChallengeV5 {
  id: string;
  accountId: string;
  channel: IdentityChannelV5;
  value: string;
  code: string;
  expiresAt: string;
  verified: boolean;
  createdAt: string;
}

const accountsKey = 'kut-shoppe.accounts.v3';
const profilesKey = 'kut-shoppe.customer-profiles.v5';
const challengesKey = 'kut-shoppe.identity-challenges.v5';

const emptyAddress: CustomerAddressV5 = {
  line1: '',
  line2: '',
  city: '',
  state: 'PA',
  postalCode: '',
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function dispatchChanges() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('kut-shoppe-auth-v3-change'));
  window.dispatchEvent(new CustomEvent('kut-shoppe-platform-change'));
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createCode() {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return String(100000 + ((values[0] ?? 0) % 900000));
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

function saveAccounts(accounts: PlatformAccount[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(accountsKey, JSON.stringify(accounts));
  dispatchChanges();
}

export function readCustomerProfilesV5() {
  return readJson<CustomerProfileV5[]>(profilesKey, []);
}

export function getCustomerProfileV5(account: PlatformAccount | null) {
  if (!account) return null;
  const existing = readCustomerProfilesV5().find((profile) => profile.accountId === account.id);
  return existing ?? {
    accountId: account.id,
    phone: '',
    phoneVerified: false,
    address: { ...emptyAddress },
    updatedAt: account.updatedAt,
  };
}

export function saveCustomerProfileV5(profile: CustomerProfileV5) {
  const normalized: CustomerProfileV5 = {
    ...profile,
    phone: normalizePhone(profile.phone),
    address: {
      line1: profile.address.line1.trim(),
      line2: profile.address.line2.trim(),
      city: profile.address.city.trim(),
      state: profile.address.state.trim().toUpperCase(),
      postalCode: profile.address.postalCode.trim(),
    },
    updatedAt: new Date().toISOString(),
  };
  const profiles = readCustomerProfilesV5();
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(profilesKey, JSON.stringify([
      ...profiles.filter((item) => item.accountId !== normalized.accountId),
      normalized,
    ]));
    dispatchChanges();
  }
  return normalized;
}

export function updateAccountName(account: PlatformAccount, name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2) throw new Error('Enter your full name.');
  const updated: PlatformAccount = { ...account, name: trimmed, updatedAt: new Date().toISOString() };
  saveAccounts(readPlatformAccounts().map((item) => item.id === account.id ? updated : item));
  startPlatformSession(updated);
  for (const appointment of readAppointments().filter((item) => item.customerEmail === account.email)) {
    saveAppointment({ ...appointment, customerName: trimmed, updatedAt: new Date().toISOString() });
  }
  for (const order of readOrders().filter((item) => item.customer.email === account.email)) {
    saveOrder({ ...order, customer: { ...order.customer, name: trimmed } });
  }
  return updated;
}

export function readIdentityChallengesV5() {
  return readJson<IdentityChallengeV5[]>(challengesKey, []);
}

export function requestIdentityChallengeV5(accountId: string, channel: IdentityChannelV5, rawValue: string) {
  const value = channel === 'email' ? normalizeEmail(rawValue) : normalizePhone(rawValue);
  const now = new Date();
  const challenge: IdentityChallengeV5 = {
    id: createId('verify'),
    accountId,
    channel,
    value,
    code: createCode(),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
    verified: false,
  };
  const active = readIdentityChallengesV5().filter((item) => !(item.accountId === accountId && item.channel === channel && !item.verified));
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(challengesKey, JSON.stringify([...active, challenge]));
    dispatchChanges();
  }
  return challenge;
}

export function getActiveIdentityChallengeV5(accountId: string, channel: IdentityChannelV5) {
  return readIdentityChallengesV5()
    .filter((item) => item.accountId === accountId && item.channel === channel && !item.verified)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

function propagateEmail(oldEmail: string, newEmail: string) {
  for (const appointment of readAppointments().filter((item) => item.customerEmail === oldEmail)) {
    saveAppointment({ ...appointment, customerEmail: newEmail, updatedAt: new Date().toISOString() });
  }
  for (const order of readOrders().filter((item) => item.customer.email === oldEmail)) {
    saveOrder({ ...order, customer: { ...order.customer, email: newEmail } });
  }
}

function propagatePhone(accountEmail: string, phone: string) {
  for (const appointment of readAppointments().filter((item) => item.customerEmail === accountEmail)) {
    saveAppointment({ ...appointment, customerPhone: phone, phoneVerified: true, updatedAt: new Date().toISOString() });
  }
  for (const order of readOrders().filter((item) => item.customer.email === accountEmail)) {
    saveOrder({ ...order, customer: { ...order.customer, phone } });
  }
}

export function verifyIdentityChallengeV5(challengeId: string, code: string) {
  const challenges = readIdentityChallengesV5();
  const challenge = challenges.find((item) => item.id === challengeId);
  if (!challenge) throw new Error('Request a new verification code.');
  if (new Date(challenge.expiresAt).getTime() < Date.now()) throw new Error('That verification code expired. Request a new one.');
  if (challenge.code !== code.trim()) throw new Error('The verification code is incorrect.');

  const account = readPlatformAccounts().find((item) => item.id === challenge.accountId);
  if (!account) throw new Error('Account not found.');

  let updatedAccount = account;
  if (challenge.channel === 'email') {
    const existing = readPlatformAccounts().find((item) => item.id !== account.id && item.email === challenge.value);
    if (existing) throw new Error('Another account already uses that email address.');
    updatedAccount = { ...account, email: challenge.value, emailVerified: true, updatedAt: new Date().toISOString() };
    saveAccounts(readPlatformAccounts().map((item) => item.id === account.id ? updatedAccount : item));
    propagateEmail(account.email, updatedAccount.email);
  } else {
    const profile = getCustomerProfileV5(account);
    if (!profile) throw new Error('Customer profile not found.');
    saveCustomerProfileV5({ ...profile, phone: challenge.value, phoneVerified: true });
    propagatePhone(account.email, challenge.value);
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(challengesKey, JSON.stringify(challenges.map((item) => item.id === challenge.id ? { ...item, verified: true } : item)));
    dispatchChanges();
  }
  if (getPlatformSessionAccount()?.id === updatedAccount.id) startPlatformSession(updatedAccount);
  return { account: updatedAccount, challenge: { ...challenge, verified: true } };
}

export function initializeSignupProfileV5(account: PlatformAccount, phone: string) {
  const profile = saveCustomerProfileV5({
    accountId: account.id,
    phone,
    phoneVerified: false,
    address: { ...emptyAddress },
    updatedAt: new Date().toISOString(),
  });
  return {
    profile,
    emailChallenge: requestIdentityChallengeV5(account.id, 'email', account.email),
    phoneChallenge: requestIdentityChallengeV5(account.id, 'phone', phone),
  };
}
