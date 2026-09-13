import type { CustomerAppointment, CustomerOrder } from './customer';

export interface DashboardAppointment extends CustomerAppointment {
  cancellationState: 'pending' | 'approved' | 'declined' | null;
  timeZone: string;
}

export interface CustomerDashboard {
  counts: { upcoming: number; pending: number; completed: number; orders: number };
  nextVisit: DashboardAppointment | null;
  pendingAppointments: DashboardAppointment[];
  readyOrders: CustomerOrder[];
  readyOrderCount: number;
  recentAppointments: DashboardAppointment[];
  recentOrders: CustomerOrder[];
}
