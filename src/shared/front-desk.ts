import type { VisitAction, VisitActionState } from './visit-actions';
export interface WalkInVisit extends VisitActionState {
  id: string; name: string; serviceName: string; professionalName: string;
  status: string; startsAt: string; endsAt: string; timeZone: string;
  priceCents: number; updatedAt: string;
  source: string; actions: VisitAction[];
}
export interface FrontDeskPage { items: WalkInVisit[]; more: boolean }
