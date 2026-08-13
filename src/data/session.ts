// Single facade for "who is signed in" across the whole app.
//
// This codebase has two prototype account/session stores: auth-v2.ts
// (PlatformAccount -- real password hashing, capability-based roles) and
// the older auth.ts (CustomerAccount -- no password, phone-based
// verification). They are not interchangeable and have separate
// localStorage keys. auth-v2.ts is the source of truth; auth.ts is kept
// as a write-only compatibility shim (see endSessionEverywhere below and
// the bridgePrototypeSession-style writes in AccountAccessV5.tsx and
// StaffOnboardingV5/V6.tsx) for any code that hasn't been migrated yet.
//
// Every component should read "current user" and check permissions
// through this module, not by importing auth.ts or auth-v2.ts directly.
// That keeps the two-system split an implementation detail instead of
// something every component has to know about.
import {
  endPlatformSession,
  getPlatformSessionAccount,
  hasPlatformCapability,
  subscribeToPlatformAuth,
  type PlatformAccount,
  type PlatformCapability,
} from './auth-v2';
import { endSession as endLegacySession } from './auth';

export type { PlatformAccount, PlatformCapability } from './auth-v2';

/** The signed-in account, or null. This is the one function every
 * component should call to find out who's using the app right now. */
export function getCurrentAccount(): PlatformAccount | null {
  return getPlatformSessionAccount();
}

/** Subscribe to sign-in/sign-out and role changes. Fires on both this
 * tab's auth events and cross-tab `storage` events. */
export function subscribeToSession(callback: () => void) {
  return subscribeToPlatformAuth(callback);
}

/** Anyone with a role beyond plain customer -- barber, manager, owner, or
 * developer. Roughly "has some staff-side access to something." */
export function isStaff(account: PlatformAccount | null): boolean {
  return account !== null && account.role !== 'customer';
}

/** Manager, owner, or developer -- the roles intended to manage shop-wide
 * operations rather than just their own chair. Barbers are staff but not
 * management. */
export function isManagement(account: PlatformAccount | null): boolean {
  return account !== null && (account.role === 'owner' || account.role === 'manager' || account.role === 'developer');
}

/** Capability check, delegating to auth-v2's role -> capability map.
 * Prefer this over comparing `.role` directly wherever a specific
 * capability (not just "is this role X") is what actually matters. */
export function can(account: PlatformAccount | null, capability: PlatformCapability): boolean {
  return hasPlatformCapability(account, capability);
}

/** Ends the session in both stores. Always use this for logout instead of
 * calling endPlatformSession()/endSession() separately, so a stale
 * session in one store can never outlive the other. */
export function endSessionEverywhere() {
  endPlatformSession();
  endLegacySession();
}
