export interface StaffVisitSummary {
  id: string; customerName: string; serviceName: string; locationName: string; timeZone: string;
  startsAt: string | null; endsAt: string | null; status: string;
}
export interface StaffVisit extends StaffVisitSummary {
  priceCents: number; customerNote: string | null; proposedStartsAt: string | null; proposedEndsAt: string | null;
}
export interface StaffVisitsPage { items: StaffVisitSummary[]; nextCursor: string | null; needsTimeReview: number }
