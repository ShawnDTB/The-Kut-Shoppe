export type PlatformRole = 'customer' | 'barber' | 'manager' | 'owner' | 'developer';

export type PlatformCapability =
  | 'manage-own-appointments'
  | 'manage-shop-appointments'
  | 'manage-products'
  | 'manage-orders'
  | 'manage-staff'
  | 'manage-roles'
  | 'manage-platform';

export interface PlatformAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  role: PlatformRole;
  developerAccess: boolean;
  emailVerified: boolean;
  staffProfileId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformSession {
  accountId: string;
  createdAt: string;
}

const storageKeys = {
  accounts: 'kut-shoppe.accounts.v3',
  session: 'kut-shoppe.session.v3',
} as const;

const authEvent = 'kut-shoppe-auth-v3-change';
const encoder = new TextEncoder();

export const developmentMasterCredentials = {
  email: import.meta.env.VITE_DEV_MASTER_EMAIL || 'owner@thekutshoppe.local',
  password: import.meta.env.VITE_DEV_MASTER_PASSWORD || 'KutShoppeOwner!2026',
} as const;

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
  window.dispatchEvent(new CustomEvent(authEvent));
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

export function validatePassword(value: string) {
  if (value.length < 10) return 'Use at least 10 characters for this preview account.';
  if (value.length > 128) return 'Use no more than 128 characters.';
  return '';
}

export function readPlatformAccounts() {
  return readJson<PlatformAccount[]>(storageKeys.accounts, []);
}

export function findPlatformAccount(email: string) {
  const normalized = normalizeEmail(email);
  return readPlatformAccounts().find((account) => account.email === normalized) ?? null;
}

function savePlatformAccount(account: PlatformAccount) {
  const accounts = readPlatformAccounts();
  writeJson(storageKeys.accounts, [...accounts.filter((item) => item.id !== account.id), account]);
  return account;
}

export async function createPlatformAccount(input: {
  name: string;
  email: string;
  password: string;
  role?: PlatformRole;
  developerAccess?: boolean;
  emailVerified?: boolean;
}) {
  const email = normalizeEmail(input.email);
  if (input.name.trim().length < 2) throw new Error('Enter your name.');
  if (!isValidEmail(email)) throw new Error('Enter a valid email address.');
  const passwordError = validatePassword(input.password);
  if (passwordError) throw new Error(passwordError);
  if (findPlatformAccount(email)) throw new Error('An account already uses that email address.');

  const salt = createSalt();
  const now = new Date().toISOString();
  return savePlatformAccount({
    id: createId('account'),
    name: input.name.trim(),
    email,
    passwordHash: await hashPassword(input.password, salt),
    passwordSalt: salt,
    role: input.role ?? 'customer',
    developerAccess: input.developerAccess ?? false,
    emailVerified: input.emailVerified ?? false,
    staffProfileId: null,
    createdAt: now,
    updatedAt: now,
  });
}

export async function ensureDevelopmentMasterAccount() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const existing = findPlatformAccount(developmentMasterCredentials.email);
  if (existing) return existing;
  return createPlatformAccount({
    name: 'Kut Shoppe Platform Owner',
    email: developmentMasterCredentials.email,
    password: developmentMasterCredentials.password,
    role: 'owner',
    developerAccess: true,
    emailVerified: true,
  });
}

export async function authenticatePlatformAccount(email: string, password: string) {
  await ensureDevelopmentMasterAccount();
  const account = findPlatformAccount(email);
  if (!account) return null;
  const candidate = await hashPassword(password, account.passwordSalt);
  return candidate === account.passwordHash ? account : null;
}

export function startPlatformSession(account: PlatformAccount) {
  const session: PlatformSession = { accountId: account.id, createdAt: new Date().toISOString() };
  writeJson(storageKeys.session, session);
  return session;
}

export function readPlatformSession() {
  return readJson<PlatformSession | null>(storageKeys.session, null);
}

export function getPlatformSessionAccount() {
  const session = readPlatformSession();
  if (!session) return null;
  return readPlatformAccounts().find((account) => account.id === session.accountId) ?? null;
}

export function endPlatformSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKeys.session);
  window.dispatchEvent(new CustomEvent(authEvent));
}

export function subscribeToPlatformAuth(callback: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(authEvent, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(authEvent, callback);
    window.removeEventListener('storage', callback);
  };
}

const capabilityMap: Record<PlatformRole, PlatformCapability[]> = {
  customer: ['manage-own-appointments'],
  barber: ['manage-own-appointments'],
  manager: ['manage-own-appointments', 'manage-shop-appointments', 'manage-products', 'manage-orders', 'manage-staff'],
  owner: ['manage-own-appointments', 'manage-shop-appointments', 'manage-products', 'manage-orders', 'manage-staff', 'manage-roles', 'manage-platform'],
  developer: ['manage-own-appointments', 'manage-shop-appointments', 'manage-products', 'manage-orders', 'manage-staff', 'manage-roles', 'manage-platform'],
};

export function hasPlatformCapability(account: PlatformAccount | null, capability: PlatformCapability) {
  if (!account) return false;
  return capabilityMap[account.role].includes(capability) || (account.developerAccess && capability === 'manage-platform');
}

export function updatePlatformRole(actor: PlatformAccount, accountId: string, role: PlatformRole) {
  const target = readPlatformAccounts().find((account) => account.id === accountId);
  if (!target) throw new Error('Account not found.');

  const actorCanAssignElevated = actor.role === 'owner' || actor.role === 'developer';
  const actorCanManageStaff = actorCanAssignElevated || actor.role === 'manager';
  if (!actorCanManageStaff) throw new Error('This account cannot change roles.');
  if ((role === 'owner' || role === 'developer') && !actorCanAssignElevated) {
    throw new Error('Only an Owner or Developer can assign elevated access.');
  }
  if (target.id === actor.id && role === 'customer') throw new Error('You cannot remove your own access from this preview.');

  return savePlatformAccount({
    ...target,
    role,
    developerAccess: role === 'developer' ? true : target.developerAccess,
    updatedAt: new Date().toISOString(),
  });
}
