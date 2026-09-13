export interface WalkInVisit {
  id: string; name: string; serviceName: string; professionalName: string;
  status: string; startsAt: string; endsAt: string; timeZone: string;
  priceCents: number; updatedAt: string;
}
export interface FrontDeskPage { items: WalkInVisit[]; more: boolean }
