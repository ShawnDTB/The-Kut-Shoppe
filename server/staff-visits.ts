import { timingSafeEqual } from 'node:crypto';
import { ApiError, type Env } from './types';
import { requireProfessional } from './staff-requests';
import { staffMfaGate } from './staff-mfa';
import { secretHash } from './security';
import type { StaffVisit, StaffVisitSummary, StaffVisitsPage } from '../src/shared/staff-visits';

const fields = `a.id,u.display_name AS customerName,s.name AS serviceName,l.name AS locationName,l.timezone AS timeZone,
  a.starts_at AS startsAt,a.ends_at AS endsAt,a.status`;
// An accepted visit must be assigned to this professional. A requested-staff
// preference does not confer access after assignment to someone else.
const scope = `FROM appointments a JOIN users u ON u.id=a.customer_user_id JOIN services s ON s.id=a.service_id JOIN locations l ON l.id=a.location_id
  WHERE a.source='website' AND a.assigned_staff_id=? AND a.status IN ('confirmed','reschedule_proposed','checked_in','in_service')
  AND EXISTS (SELECT 1 FROM staff_profiles sp JOIN users actor ON actor.id=sp.user_id JOIN sessions se ON se.user_id=actor.id
    WHERE sp.id=a.assigned_staff_id AND actor.id=? AND se.token_hash=? AND sp.setup_status='approved'
      AND actor.status='active' AND actor.email_verified_at IS NOT NULL AND actor.role IN ('staff','manager','owner','admin')
      AND ${staffMfaGate('se', 'actor')})`;
const validTimes = `(julianday(a.starts_at) IS NOT NULL AND julianday(a.ends_at)>julianday(a.starts_at)
  AND a.starts_at GLOB '????-??-??T??:??:*' AND a.ends_at GLOB '????-??-??T??:??:*'
  AND (a.starts_at GLOB '*Z' OR a.starts_at GLOB '*[+-]??:??') AND (a.ends_at GLOB '*Z' OR a.ends_at GLOB '*[+-]??:??'))`;
export async function staffVisits(env: Env, userId: string, session: string, value: string | null): Promise<StaffVisitsPage> {
  const staffId = await requireProfessional(env, userId, session);
  const sign = (payload: string) => secretHash(env, `staff-visits-v1:${userId}:${staffId}:${payload}`);
  let cursor: { at: number; id: string } | null = null;
  if (value !== null) {
    try {
      if (value.length > 1024 || !/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(value)) throw new Error();
      const [payload, signature] = value.split('.') as [string, string];
      if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(sign(payload), 'hex'))) throw new Error();
      cursor = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { at: number; id: string };
      if (!cursor || typeof cursor.at !== 'number' || !Number.isFinite(cursor.at) || typeof cursor.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(cursor.id)) throw new Error();
    } catch { throw new ApiError(400, 'Reload your visits and try again.'); }
  }
  const rows = await env.DB.batch<{ results: unknown[] }>([
    env.DB.prepare(`SELECT ${fields},julianday(a.starts_at) AS sortAt ${scope} AND ${validTimes}
      AND (julianday(a.ends_at)>julianday('now') OR a.status IN ('checked_in','in_service'))
      ${cursor ? 'AND (julianday(a.starts_at),a.id)>(?,?)' : ''} ORDER BY julianday(a.starts_at),a.id LIMIT 26`)
      .bind(staffId, userId, session, ...(cursor ? [cursor.at, cursor.id] : [])),
    env.DB.prepare(`SELECT count(*) AS count ${scope} AND COALESCE(${validTimes},0)=0`).bind(staffId, userId, session),
  ]);
  const selected = rows[0]!.results as (StaffVisitSummary & { sortAt: number })[];
  const last = selected[24]; const payload = selected.length > 25 && last ? Buffer.from(JSON.stringify({ at: last.sortAt, id: last.id })).toString('base64url') : null;
  return { items: selected.slice(0, 25).map((item) => ({ id: item.id, customerName: item.customerName, serviceName: item.serviceName,
    locationName: item.locationName, timeZone: item.timeZone, startsAt: item.startsAt, endsAt: item.endsAt, status: item.status })), nextCursor: payload ? `${payload}.${sign(payload)}` : null,
    needsTimeReview: Number((rows[1]!.results[0] as { count: number }).count) };
}
export async function staffVisit(env: Env, userId: string, session: string, id: string): Promise<StaffVisit> {
  const staffId = await requireProfessional(env, userId, session);
  const row = await env.DB.prepare(`SELECT ${fields},a.price_cents AS priceCents,a.customer_note AS customerNote,
    a.proposed_starts_at AS proposedStartsAt,a.proposed_ends_at AS proposedEndsAt ${scope} AND a.id=?`)
    .bind(staffId, userId, session, id).first<StaffVisit>();
  if (!row) throw new ApiError(404, 'This visit is not available to your professional account.');
  return row;
}
