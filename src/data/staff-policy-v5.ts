import { subscribeToPlatformChanges } from './notifications';
import type { StaffProfile } from './platform';

export type LateCancellationAction = 'call-shop' | 'manager-review' | 'deposit-forfeited';
export type RefundPolicy = 'manager-review' | 'original-payment' | 'store-credit' | 'nonrefundable';

export interface StaffPolicyV5 {
  profileId: string;
  cancellationNoticeHours: number;
  lateCancellationAction: LateCancellationAction;
  refundPolicy: RefundPolicy;
  policyNote: string;
  updatedAt: string;
}

const storageKey = 'kut-shoppe.staff-policies.v5';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function writePolicies(policies: StaffPolicyV5[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, JSON.stringify(policies));
  window.dispatchEvent(new CustomEvent('kut-shoppe-platform-change'));
}

export function defaultStaffPolicy(profile: StaffProfile): StaffPolicyV5 {
  return {
    profileId: profile.id,
    cancellationNoticeHours: Math.max(0, profile.bookingRules.minimumNoticeHours),
    lateCancellationAction: 'call-shop',
    refundPolicy: 'manager-review',
    policyNote: '',
    updatedAt: new Date().toISOString(),
  };
}

export function readStaffPolicies() {
  return readJson<StaffPolicyV5[]>(storageKey, []);
}

export function getStaffPolicy(profile: StaffProfile | null | undefined) {
  if (!profile) return null;
  return readStaffPolicies().find((policy) => policy.profileId === profile.id) ?? defaultStaffPolicy(profile);
}

export function saveStaffPolicy(policy: StaffPolicyV5) {
  const normalized: StaffPolicyV5 = {
    ...policy,
    cancellationNoticeHours: Math.max(0, Number(policy.cancellationNoticeHours) || 0),
    policyNote: policy.policyNote.trim(),
    updatedAt: new Date().toISOString(),
  };
  writePolicies([
    ...readStaffPolicies().filter((item) => item.profileId !== normalized.profileId),
    normalized,
  ]);
  return normalized;
}

export function formatNoticeWindow(hours: number) {
  if (hours <= 0) return 'the appointment start time';
  if (hours === 1) return '1 hour before the appointment';
  if (hours < 24) return `${hours} hours before the appointment`;
  if (hours === 24) return '24 hours before the appointment';
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `${days} day${days === 1 ? '' : 's'} before the appointment`;
  }
  return `${hours} hours before the appointment`;
}

export function subscribeToStaffPolicies(callback: () => void) {
  return subscribeToPlatformChanges(callback);
}
