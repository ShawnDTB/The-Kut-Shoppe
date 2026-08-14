// Data-layer tests for the primary account/role system. These exercise the
// real localStorage-backed functions in jsdom (see vite.config.ts's `test`
// block) rather than mocking them, since the whole point is to prove the
// actual persistence + authorization logic behaves correctly -- mocking it
// away would just test the mocks.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createPlatformAccount,
  authenticatePlatformAccount,
  findPlatformAccount,
  hasPlatformCapability,
  updatePlatformRole,
  type PlatformAccount,
  type PlatformRole,
} from './auth-v2';
import { findAccount as findLegacyAccount, saveAccount as saveLegacyAccount } from './auth';

const PASSWORD = 'a-fine-password-1';

async function makeAccount(email: string, role: PlatformRole = 'customer', name = 'Test User') {
  return createPlatformAccount({ name, email, password: PASSWORD, role, emailVerified: true });
}

beforeEach(() => {
  localStorage.clear();
});

describe('createPlatformAccount validation', () => {
  it('rejects a name shorter than 2 characters', async () => {
    await expect(createPlatformAccount({ name: 'A', email: 'a@example.com', password: PASSWORD }))
      .rejects.toThrow(/name/i);
  });

  it('rejects an invalid email address', async () => {
    await expect(createPlatformAccount({ name: 'Jordan Visitor', email: 'not-an-email', password: PASSWORD }))
      .rejects.toThrow(/email/i);
  });

  it('rejects a password shorter than 10 characters', async () => {
    await expect(createPlatformAccount({ name: 'Jordan Visitor', email: 'jordan@example.com', password: 'short' }))
      .rejects.toThrow(/characters/i);
  });

  it('rejects a duplicate email, case-insensitively', async () => {
    await makeAccount('jordan@example.com');
    await expect(makeAccount('Jordan@Example.com')).rejects.toThrow(/already/i);
  });
});

describe('authenticatePlatformAccount', () => {
  it('authenticates with the correct password and rejects the wrong one', async () => {
    await makeAccount('jordan@example.com');
    const good = await authenticatePlatformAccount('jordan@example.com', PASSWORD);
    const bad = await authenticatePlatformAccount('jordan@example.com', 'wrong-password-here');
    expect(good?.email).toBe('jordan@example.com');
    expect(bad).toBeNull();
  });

  it('returns null for an email that has no account', async () => {
    const result = await authenticatePlatformAccount('nobody@example.com', PASSWORD);
    expect(result).toBeNull();
  });
});

describe('hasPlatformCapability per role', () => {
  const capabilityCases: Array<[PlatformRole, boolean, boolean]> = [
    // [role, canManageShopAppointments, canManageRoles]
    ['customer', false, false],
    ['barber', false, false],
    ['manager', true, false],
    ['owner', true, true],
    ['developer', true, true],
  ];

  it.each(capabilityCases)('role "%s" -> manage-shop-appointments=%s, manage-roles=%s', (role, canManageShop, canManageRoles) => {
    // developerAccess must be an explicit boolean, not left undefined: real
    // PlatformAccount records always set it (createPlatformAccount defaults
    // it to false), and hasPlatformCapability's `... || (account.developerAccess && ...)`
    // returns `undefined` rather than `false` if it's missing entirely.
    const account = { role, developerAccess: false } as PlatformAccount;
    expect(hasPlatformCapability(account, 'manage-shop-appointments')).toBe(canManageShop);
    expect(hasPlatformCapability(account, 'manage-roles')).toBe(canManageRoles);
  });

  it('every role can manage its own appointments, including a null account cannot', () => {
    (['customer', 'barber', 'manager', 'owner', 'developer'] as PlatformRole[]).forEach((role) => {
      expect(hasPlatformCapability({ role, developerAccess: false } as PlatformAccount, 'manage-own-appointments')).toBe(true);
    });
    expect(hasPlatformCapability(null, 'manage-own-appointments')).toBe(false);
  });
});

describe('updatePlatformRole authorization', () => {
  async function seedActors() {
    const owner = await makeAccount('owner@example.com', 'owner', 'Owner Account');
    const manager = await makeAccount('manager@example.com', 'manager', 'Manager Account');
    const customer = await makeAccount('customer@example.com', 'customer', 'Customer Account');
    const developer = await makeAccount('dev@example.com', 'developer', 'Developer Account');
    return { owner, manager, customer, developer };
  }

  it('lets a Manager promote a customer to barber or manager', async () => {
    const { manager, customer } = await seedActors();
    const updated = updatePlatformRole(manager, customer.id, 'manager');
    expect(updated.role).toBe('manager');
  });

  it('blocks a Manager from assigning an Owner or Developer role', async () => {
    const { manager, customer } = await seedActors();
    expect(() => updatePlatformRole(manager, customer.id, 'owner')).toThrow(/Owner or Developer/i);
    expect(() => updatePlatformRole(manager, customer.id, 'developer')).toThrow(/Owner or Developer/i);
  });

  // Regression test for the privilege-descalation bug found and fixed this
  // session: a Manager could reassign an *existing* Owner/Developer account
  // to a lower role (including 'customer'), fully removing their access,
  // because the original guard only checked the requested target role, not
  // the account's current role. Verified exploitable end-to-end in the
  // browser before this fix; see the "fix: prevent Managers from modifying
  // Owner/Developer account roles" commit.
  it('blocks a Manager from modifying an existing Owner account at all, even to a lower role', async () => {
    const { manager, owner } = await seedActors();
    expect(() => updatePlatformRole(manager, owner.id, 'customer')).toThrow(/Only an Owner or Developer/i);
    expect(() => updatePlatformRole(manager, owner.id, 'manager')).toThrow(/Only an Owner or Developer/i);
    const stillOwner = findPlatformAccount('owner@example.com');
    expect(stillOwner?.role).toBe('owner');
  });

  it('blocks a Manager from modifying an existing Developer account', async () => {
    const { manager, developer } = await seedActors();
    expect(() => updatePlatformRole(manager, developer.id, 'customer')).toThrow(/Only an Owner or Developer/i);
  });

  it('lets an Owner change another Owner or Developer account', async () => {
    const { owner, developer } = await seedActors();
    const updated = updatePlatformRole(owner, developer.id, 'manager');
    expect(updated.role).toBe('manager');
  });

  it('blocks a customer or barber account from changing anyone\'s role', async () => {
    const { customer } = await seedActors();
    const otherCustomer = await makeAccount('other@example.com', 'customer');
    expect(() => updatePlatformRole(customer, otherCustomer.id, 'manager')).toThrow(/cannot change roles/i);
  });

  it('blocks an actor from demoting themselves to customer', async () => {
    const { owner } = await seedActors();
    expect(() => updatePlatformRole(owner, owner.id, 'customer')).toThrow(/cannot remove your own access/i);
  });

  it('grants developerAccess when assigning the developer role', async () => {
    const { owner, customer } = await seedActors();
    const updated = updatePlatformRole(owner, customer.id, 'developer');
    expect(updated.developerAccess).toBe(true);
  });

  it('keeps a matching legacy auth.ts record in sync immediately on role change', async () => {
    const { owner, customer } = await seedActors();
    // Simulate the dual-write bridge (AccountAccessV5/StaffOnboardingV5-V6)
    // having already created a legacy record for this email at some earlier
    // login, which is the real-world precondition for this sync to matter.
    saveLegacyAccount({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: '5705551234',
      phoneVerified: false,
      role: 'customer',
      staffProfileId: null,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    });

    updatePlatformRole(owner, customer.id, 'manager');
    expect(findLegacyAccount(customer.email)?.role).toBe('manager');

    updatePlatformRole(owner, customer.id, 'barber');
    expect(findLegacyAccount(customer.email)?.role).toBe('staff');

    updatePlatformRole(owner, customer.id, 'developer');
    // auth.ts's AccountRole has no 'developer' value -- developers are
    // legacy-mapped onto 'owner' so /staff/* pages (still auth.ts-gated in
    // the one place they haven't migrated to session.ts) don't lock out a
    // developer account.
    expect(findLegacyAccount(customer.email)?.role).toBe('owner');
  });

  it('does not create a legacy record where none existed before', async () => {
    const { owner, customer } = await seedActors();
    updatePlatformRole(owner, customer.id, 'manager');
    // findAccount is Array.prototype.find under the hood -> undefined, not
    // null, when nothing matches.
    expect(findLegacyAccount(customer.email)).toBeUndefined();
  });
});
