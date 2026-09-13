import type { Env } from './types';
import type { CustomerDashboard, DashboardAppointment } from '../src/shared/dashboard';
import type { CustomerOrder } from '../src/shared/customer';

export async function customerDashboard(env: Env, userId: string): Promise<CustomerDashboard> {
  const upcoming = "status IN ('confirmed','reschedule_proposed','checked_in','in_service') AND (julianday(ends_at)>julianday('now') OR status IN ('checked_in','in_service'))";
  const pending = "(status IN ('requested','waitlisted','reschedule_proposed') OR (status='confirmed' AND cancellation_state='pending'))";
  const appointment = `SELECT a.id,s.name AS serviceName,sp.professional_name AS barberName,a.starts_at AS startsAt,a.status,
    a.cancellation_state AS cancellationState,l.timezone AS timeZone
    FROM appointments a JOIN services s ON s.id=a.service_id JOIN locations l ON l.id=a.location_id
    LEFT JOIN staff_profiles sp ON sp.id=COALESCE(a.assigned_staff_id,a.requested_staff_id)`;
  const order = 'SELECT id,status,fulfillment_type AS fulfillment,total_cents AS totalCents,created_at AS createdAt FROM orders';
  // Every statement is scoped to the authenticated immutable customer ID,
  // including owner/staff accounts. Counts do not depend on history page limits.
  const result = await env.DB.batch<{ results: Record<string, unknown>[] }>([
    env.DB.prepare(`SELECT COALESCE(SUM(${upcoming}),0) AS upcoming,
      COALESCE(SUM(${pending}),0) AS pending,
      COALESCE(SUM(status='completed'),0) AS completed,
      (SELECT count(*) FROM orders WHERE customer_user_id=?) AS orders FROM appointments WHERE customer_user_id=?`).bind(userId, userId),
    env.DB.prepare(`${appointment} WHERE a.customer_user_id=? AND ${upcoming}
      ORDER BY CASE WHEN status IN ('checked_in','in_service') THEN 0 ELSE 1 END,julianday(starts_at),a.id LIMIT 1`).bind(userId),
    env.DB.prepare(`${appointment} WHERE a.customer_user_id=? ORDER BY a.updated_at DESC,a.id DESC LIMIT 4`).bind(userId),
    env.DB.prepare(`${order} WHERE customer_user_id=? ORDER BY updated_at DESC,id DESC LIMIT 3`).bind(userId),
    env.DB.prepare(`${appointment} WHERE a.customer_user_id=? AND ${pending} ORDER BY a.updated_at DESC,a.id DESC LIMIT 4`).bind(userId),
    env.DB.prepare(`${order} WHERE customer_user_id=? AND status='ready_for_pickup' AND fulfillment_type='pickup' ORDER BY updated_at DESC,id DESC LIMIT 3`).bind(userId),
    env.DB.prepare("SELECT count(*) AS count FROM orders WHERE customer_user_id=? AND status='ready_for_pickup' AND fulfillment_type='pickup'").bind(userId),
  ]);
  return { counts: result[0]!.results[0] as unknown as CustomerDashboard['counts'],
    nextVisit: (result[1]!.results[0] ?? null) as DashboardAppointment | null,
    recentAppointments: result[2]!.results as unknown as DashboardAppointment[],
    recentOrders: result[3]!.results as unknown as CustomerOrder[],
    pendingAppointments: result[4]!.results as unknown as DashboardAppointment[],
    readyOrders: result[5]!.results as unknown as CustomerOrder[],
    readyOrderCount: Number(result[6]!.results[0]!.count) };
}
