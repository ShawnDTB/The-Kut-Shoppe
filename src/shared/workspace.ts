import type { ProfessionalAccess } from './staff';
export interface WorkspaceDashboard {
  scope: 'chair' | 'shop'; access: ProfessionalAccess;
  counts: { pending: number; upcoming: number; active: number; orders: number | null; reviews: number | null };
  visits: Array<{ id: string; customerName: string; serviceName: string; professionalName: string; startsAt: string; timeZone: string; status: string }>;
}
