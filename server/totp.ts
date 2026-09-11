import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ApiError, type Env } from './types';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function authenticatorSecret() {
  const bytes = randomBytes(20);
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  return bits.match(/.{5}/g)!.map((part) => alphabet[parseInt(part, 2)]).join('');
}
export function totp(secret: string, counter: number, digits = 6) {
  if (!/^[A-Z2-7]+$/.test(secret) || !Number.isSafeInteger(counter) || counter < 0 || ![6, 8].includes(digits)) throw new Error('Invalid authenticator input');
  const bits = [...secret].map((part) => alphabet.indexOf(part).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from(bits.match(/.{8}/g)!.map((part) => parseInt(part, 2)));
  const moving = Buffer.alloc(8); moving.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', key).update(moving).digest();
  const offset = digest[digest.length - 1]! & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits).padStart(digits, '0');
}
export function matchingCounter(secret: string, code: string, lastCounter: number, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null;
  const step = Math.floor(now / 30000);
  for (const counter of [step, step - 1, step + 1]) {
    if (counter > lastCounter && timingSafeEqual(Buffer.from(totp(secret, counter)), Buffer.from(code))) return counter;
  }
  return null;
}
export const mfaConfigured = (env: Env) => /^[a-f0-9]{64}$/i.test(env.MFA_ENCRYPTION_KEY ?? '');
function key(env: Env) {
  if (!mfaConfigured(env)) throw new ApiError(503, 'Staff verification is temporarily unavailable.');
  return Buffer.from(env.MFA_ENCRYPTION_KEY!, 'hex');
}
export function encryptSecret(env: Env, userId: string, secret: string) {
  const nonce = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key(env), nonce);
  cipher.setAAD(Buffer.from(`kut-staff-totp-v1:${userId}`));
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return ['v1', nonce.toString('hex'), ciphertext.toString('hex'), cipher.getAuthTag().toString('hex')].join(':');
}
export function decryptSecret(env: Env, userId: string, value: string) {
  const encryptionKey = key(env);
  try {
    if (!/^v1:[a-f0-9]{24}:[a-f0-9]{64}:[a-f0-9]{32}$/.test(value)) throw new Error();
    const [, nonce, ciphertext, tag] = value.split(':') as [string, string, string, string];
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(nonce, 'hex'));
    decipher.setAAD(Buffer.from(`kut-staff-totp-v1:${userId}`)); decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'hex')), decipher.final()]).toString('utf8');
  } catch { throw new ApiError(503, 'Staff verification is temporarily unavailable.'); }
}
