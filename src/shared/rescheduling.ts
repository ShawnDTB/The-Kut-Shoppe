export interface AppointmentChange {
  id: string;
  kind: 'customer_request' | 'professional_proposal';
  status: 'pending' | 'approved' | 'declined' | 'withdrawn' | 'expired';
  startsAt: string; endsAt: string; expiresAt: string;
  originalStartsAt: string; originalEndsAt: string;
}
export interface ReschedulePage {
  updatedAt: string; version: number; startsAt: string | null; endsAt: string | null;
  timeZone: string; priceCents: number; canRequest: boolean;
  canResolve: boolean;
  change: AppointmentChange | null;
}
