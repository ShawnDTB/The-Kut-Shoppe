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
export interface CustomerAppointmentDetail extends CustomerAppointment {
  endsAt: string | null;
  proposedStartsAt: string | null;
  proposedEndsAt: string | null;
  priceCents: number;
  customerNote: string | null;
  createdAt: string;
  updatedAt: string;
  location: { name: string; address: CustomerProfile['address']; timeZone: string };
  canWithdraw: boolean;
  withdrawnByCustomer: boolean;
  canDownloadCalendar: boolean;
  canRequestCancellation?: boolean;
  reschedulingEnabled?: boolean;
  changeVersion?: number;
  cancellationState?: 'pending' | 'approved' | 'declined' | null;
}
export interface CustomerOrderItem {
  id: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPriceCents: number;
}
export interface CustomerOrderDetail extends CustomerOrder {
  updatedAt: string;
  canWithdraw: boolean;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  shippingAddress: CustomerProfile['address'] | null;
  trackingNumber: string | null;
  items: CustomerOrderItem[];
  itemsComplete: boolean;
}
export interface CustomerOverview {
  appointments: CustomerAppointment[];
  orders: CustomerOrder[];
}
export interface CustomerPage<T> { items: T[]; nextCursor: string | null }
export interface AccountConfig { enabled: boolean; turnstileSiteKey: string; bookingEnabled?: boolean }
