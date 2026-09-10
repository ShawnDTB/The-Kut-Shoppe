export interface StaffRequest {
  id: string; customerName: string; serviceName: string; locationName: string; timeZone: string;
  startsAt: string | null; endsAt: string | null; createdAt: string; updatedAt: string;
  status: string; priceCents: number; customerNote: string | null;
}
export interface StaffQueue { items: StaffRequest[]; nextCursor: string | null }
export interface ProfessionalAccess { enabled: boolean; state: 'not_eligible' | 'setup_required' | 'pending_review' | 'disabled' | 'approved'; professionalName?: string }
