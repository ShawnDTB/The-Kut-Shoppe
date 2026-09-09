import type { AccountRole } from '../src/shared/customer';

// Shared account identity will be reused by future staff APIs. Until those APIs
// are implemented, they return 404, and prototype access controls grant nothing.
export function canChangeRole(actor: AccountRole, target: AccountRole, next: AccountRole, sameAccount: boolean) {
  if (sameAccount) return false;
  const elevated = actor === 'owner' || actor === 'developer';
  if (!elevated && actor !== 'manager') return false;
  if ([target, next].some((role) => role === 'owner' || role === 'developer')) return elevated;
  return true;
}
