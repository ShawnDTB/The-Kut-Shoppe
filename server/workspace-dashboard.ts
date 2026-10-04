import type { WorkspaceDashboard } from '../src/shared/workspace';
import { ApiError, type Env } from './types';
import { professionalAccess } from './staff-requests';
import { requireStaffMfa, staffMfaGate } from './staff-mfa';

export async function workspaceDashboard(env: Env, actor: string, session: string): Promise<WorkspaceDashboard> {
  if (env.STAFF_OPERATIONS_ENABLED !== 'true') throw new ApiError(503, 'Staff operations are not open yet.');
  await requireStaffMfa(env, actor, session);
  const identity = await env.DB.prepare("SELECT role FROM users WHERE id=? AND status='active' AND role IN ('staff','manager','owner','admin')").bind(actor).first<{ role: string }>();
  if (!identity) throw new ApiError(403, 'Staff access is required.');
  const shop = identity.role !== 'staff';
  const access = await professionalAccess(env, actor);
  const gate = `EXISTS (SELECT 1 FROM users u JOIN sessions se ON se.user_id=u.id WHERE u.id=? AND se.token_hash=?
    AND u.role=? AND u.status='active' AND u.email_verified_at IS NOT NULL AND ${staffMfaGate()})`;
  const scope = shop ? '1=1' : "EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.id=COALESCE(a.assigned_staff_id,a.requested_staff_id) AND sp.user_id=? AND sp.setup_status='approved')";
  const args = shop ? [] : [actor];
  const visible = `WITH visible AS (SELECT a.* FROM appointments a WHERE a.source IN ('website','walk_in') AND ${scope} AND ${gate})`;
  const pending = "(status IN ('requested','waitlisted','reschedule_proposed') OR cancellation_state='pending' OR EXISTS (SELECT 1 FROM appointment_changes c WHERE c.appointment_id=visible.id AND c.status='pending' AND julianday(c.expires_at)>julianday('now'))) AND status NOT IN ('completed','cancelled','declined','no_show')";
  const queryArgs = [...args, actor, session, identity.role];
  const results = await env.DB.batch<{ results: Record<string, unknown>[] }>([
    env.DB.prepare(`${visible} SELECT COALESCE(SUM(${pending}),0) AS pending,
      COALESCE(SUM(status IN ('confirmed','reschedule_proposed') AND julianday(ends_at)>julianday('now')),0) AS upcoming,
      COALESCE(SUM(status IN ('checked_in','in_service')),0) AS active FROM visible`).bind(...queryArgs),
    env.DB.prepare(`${visible} SELECT a.id,COALESCE(customer.display_name,a.guest_name,'Guest') AS customerName,s.name AS serviceName,
      sp.professional_name AS professionalName,a.starts_at AS startsAt,l.timezone AS timeZone,a.status FROM visible a
      JOIN services s ON s.id=a.service_id JOIN locations l ON l.id=a.location_id
      JOIN staff_profiles sp ON sp.id=COALESCE(a.assigned_staff_id,a.requested_staff_id) LEFT JOIN users customer ON customer.id=a.customer_user_id
      WHERE a.status IN ('checked_in','in_service') OR (a.status IN ('confirmed','reschedule_proposed') AND julianday(a.ends_at)>julianday('now'))
      ORDER BY CASE WHEN a.status IN ('checked_in','in_service') THEN 0 ELSE 1 END,julianday(a.starts_at),a.id LIMIT 5`).bind(...queryArgs),
    env.DB.prepare(`SELECT count(*) AS count FROM orders WHERE ?=1 AND status IN ('submitted','payment_required','accepted','preparing','ready_for_pickup') AND ${gate}`).bind(shop && env.COMMERCE_ENABLED === 'true' ? 1 : 0, actor, session, identity.role),
    env.DB.prepare(`SELECT count(*) AS count FROM professional_submissions WHERE ?=1 AND status='submitted' AND ${gate}`).bind(['owner','admin'].includes(identity.role) && env.STAFF_SETUP_ENABLED === 'true' ? 1 : 0, actor, session, identity.role),
    env.DB.prepare(`SELECT 1 AS valid WHERE ${gate}`).bind(actor, session, identity.role),
  ]);
  if (!results[4]?.results.length) throw new ApiError(403, 'Your staff access changed. Verify your account again.');
  return { scope: shop ? 'shop' : 'chair', access,
    counts: { ...results[0]!.results[0] as WorkspaceDashboard['counts'],
      orders: shop && env.COMMERCE_ENABLED === 'true' ? Number(results[2]!.results[0]!.count) : null,
      reviews: ['owner','admin'].includes(identity.role) && env.STAFF_SETUP_ENABLED === 'true' ? Number(results[3]!.results[0]!.count) : null },
    visits: results[1]!.results as unknown as WorkspaceDashboard['visits'] };
}
