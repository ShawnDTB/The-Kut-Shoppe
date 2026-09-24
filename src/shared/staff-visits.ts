import type { VisitAction } from './visit-actions';
export interface StaffVisitSummary {
  id: string; customerName: string; serviceName: string; locationName: string; timeZone: string;
  startsAt: string | null; endsAt: string | null; status: string;
  source?: string;
}
export interface StaffVisit extends StaffVisitSummary {
  priceCents: number; customerNote: string | null; proposedStartsAt: string | null; proposedEndsAt: string | null;
  updatedAt: string; cancellationPending: boolean; changePending: boolean; actions: VisitAction[];
}
export interface StaffVisitsPage { items: StaffVisitSummary[]; nextCursor: string | null; needsTimeReview: number }
