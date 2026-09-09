// Public API contract. Password material and operational notes never belong here.
export type AccountRole = 'customer' | 'barber' | 'manager' | 'owner' | 'developer';
export interface CustomerProfile {
  name: string;
  phone: string;
  address: { line1: string; line2: string; city: string; state: string; postalCode: string };
}
export interface CustomerAccount {
  id: string;
  email: string;
  role: AccountRole;
  emailVerified: boolean;
  profile: CustomerProfile;
}
export interface CustomerAppointment {
  id: string;
  serviceName: string;
  barberName: string | null;
  startsAt: string | null;
  status: string;
}
export interface CustomerOrder {
  id: string;
  status: string;
  fulfillment: string;
  totalCents: number;
  createdAt: string;
}
export interface CustomerOverview {
  appointments: CustomerAppointment[];
  orders: CustomerOrder[];
}
export interface AccountConfig { enabled: boolean; turnstileSiteKey: string }
