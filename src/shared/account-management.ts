import type { AccountRole } from './customer';

export interface ManagedAccount {
  id: string; name: string; email: string; role: AccountRole;
  verified: boolean; updatedAt: string; professionalStatus: string | null;
}
export interface AccountDirectory { items: ManagedAccount[]; more: boolean }
export interface AccountSession { id: string; createdAt: string; lastSeenAt: string; expiresAt: string; current: boolean }
