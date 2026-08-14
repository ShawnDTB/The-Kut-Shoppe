// Tests for the src/data/session.ts facade -- the single place components
// are supposed to go for "who is signed in" / permission checks instead of
// importing auth.ts or auth-v2.ts directly (see the module's own header
// comment, and the "Two parallel, incompatible auth data models" section of
// CLAUDE.md). These mostly re-confirm auth-v2.ts's own behavior through the
// facade's names, which is the point: components trust these names, so they
// need to be proven correct independent of which underlying store answers.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  can,
  endSessionEverywhere,
  getCurrentAccount,
  isManagement,
  isStaff,
} from './session';
import { createPlatformAccount, startPlatformSession, type PlatformAccount, type PlatformRole } from './auth-v2';
import { startSession as startLegacySession, readSession as readLegacySession } from './auth';

beforeEach(() => {
  localStorage.clear();
});

describe('isStaff / isManagement', () => {
  const roleExpectations: Array<[PlatformRole, boolean, boolean]> = [
    // [role, isStaff, isManagement]
    ['customer', false, false],
    ['barber', true, false],
    ['manager', true, true],
    ['owner', true, true],
    ['developer', true, true],
  ];

  it.each(roleExpectations)('role "%s" -> isStaff=%s, isManagement=%s', (role, expectStaff, expectManagement) => {
    const account = { role } as PlatformAccount;
    expect(isStaff(account)).toBe(expectStaff);
    expect(isManagement(account)).toBe(expectManagement);
  });

  it('treats no account as neither staff nor management', () => {
    expect(isStaff(null)).toBe(false);
    expect(isManagement(null)).toBe(false);
  });
});

describe('can()', () => {
  it('delegates to the same capability rules as auth-v2', () => {
    // developerAccess must be explicit -- see the equivalent note in
    // auth-v2.test.ts's hasPlatformCapability tests.
    expect(can({ role: 'manager', developerAccess: false } as PlatformAccount, 'manage-products')).toBe(true);
    expect(can({ role: 'customer', developerAccess: false } as PlatformAccount, 'manage-products')).toBe(false);
    expect(can(null, 'manage-products')).toBe(false);
  });
});

describe('getCurrentAccount', () => {
  it('reflects the account backing the active auth-v2 session', async () => {
    expect(getCurrentAccount()).toBeNull();
    const account = await createPlatformAccount({ name: 'Sam Barber', email: 'sam@example.com', password: 'a-fine-password-1', role: 'barber' });
    startPlatformSession(account);
    expect(getCurrentAccount()?.email).toBe('sam@example.com');
  });
});

describe('endSessionEverywhere', () => {
  it('clears both the auth-v2 session and any legacy auth.ts session', async () => {
    const account = await createPlatformAccount({ name: 'Sam Barber', email: 'sam@example.com', password: 'a-fine-password-1', role: 'barber' });
    startPlatformSession(account);
    startLegacySession({
      id: account.id,
      name: account.name,
      email: account.email,
      phone: '5705551234',
      phoneVerified: true,
      role: 'staff',
      staffProfileId: null,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    });

    expect(getCurrentAccount()).not.toBeNull();
    expect(readLegacySession()).not.toBeNull();

    endSessionEverywhere();

    expect(getCurrentAccount()).toBeNull();
    expect(readLegacySession()).toBeNull();
  });
});
