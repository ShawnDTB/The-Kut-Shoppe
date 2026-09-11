// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { authenticatorSecret, decryptSecret, encryptSecret, matchingCounter, totp } from './totp';
import type { Env } from './types';

describe('staff authenticator cryptography', () => {
  // RFC 6238 Appendix B, SHA-1 key "12345678901234567890" encoded as Base32.
  const key = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  it.each([[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130']])('matches the RFC vector at %i', (seconds, expected) => {
    expect(totp(key, Math.floor(Number(seconds) / 30), 8)).toBe(expected);
  });
  it('accepts only a six-digit fresh code in the adjacent time windows', () => {
    expect(matchingCounter(key, totp(key, 100), 99, 3000000)).toBe(100);
    expect(matchingCounter(key, totp(key, 100), 100, 3000000)).toBeNull();
    expect(matchingCounter(key, totp(key, 98), -1, 3000000)).toBeNull();
    expect(matchingCounter(key, '1234567', -1, 3000000)).toBeNull();
  });
  it('encrypts each seed with a fresh nonce and authenticates its user binding', () => {
    const env = { MFA_ENCRYPTION_KEY: '12'.repeat(32) } as Env;
    const secret = authenticatorSecret(); expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    const sealed = encryptSecret(env, 'alice', secret);
    expect(sealed).not.toContain(secret); expect(encryptSecret(env, 'alice', secret)).not.toBe(sealed);
    expect(decryptSecret(env, 'alice', sealed)).toBe(secret);
    expect(() => decryptSecret(env, 'bob', sealed)).toThrow();
    expect(() => decryptSecret(env, 'alice', `${sealed.slice(0, -1)}${sealed.endsWith('0') ? '1' : '0'}`)).toThrow();
    expect(() => decryptSecret({ MFA_ENCRYPTION_KEY: '34'.repeat(32) } as Env, 'alice', sealed)).toThrow();
    expect(() => encryptSecret({} as Env, 'alice', secret)).toThrow();
  });
});
