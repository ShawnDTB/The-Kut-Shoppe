import type { CustomerAppointment, CustomerOrder } from './customer';

export interface CustomerDashboard {
  counts: { upcoming: number; pending: number; completed: number; orders: number };
  nextVisit: CustomerAppointment | null;
  recentAppointments: CustomerAppointment[];
  recentOrders: CustomerOrder[];
}
