import { randomUUID } from 'node:crypto';
import { ApiError, type Env } from './types';
import { allowFields, stringField } from './security';
import { requireProfessional } from './staff-requests';
import { staffMfaGate } from './staff-mfa';
import { localDate, overlaps, validDate, wallWindow } from './booking-time';
import type { SchedulePage } from '../src/shared/professional-schedule';

type Hours = { id: string; locationId: string; weekday: number; startTime: string; endTime: string };
type TimeOff = { id: string; startsAt: string; endsAt: string; canRemove: number };
type Location = { id: string; name: string; timeZone: string };
type Busy = { locationId: string; startsAt: string | null; endsAt: string | null; reservedUntil: string | null; proposedStart: string | null; proposedEnd: string | null };
async function snapshot(env: Env, userId: string, session: string) {
  const staffId = await requireProfessional(env, userId, session);
  const result = await env.DB.batch<{ results: unknown[] }>([
    env.DB.prepare('SELECT version FROM booking_revision WHERE id=1'),
    env.DB.prepare('SELECT booking_buffer_minutes AS buffer FROM staff_profiles WHERE id=?').bind(staffId),
    env.DB.prepare('SELECT l.id,l.name,l.timezone AS timeZone FROM locations l JOIN staff_locations sl ON sl.location_id=l.id WHERE sl.staff_id=? AND sl.active=1 AND l.active=1 ORDER BY l.name LIMIT 101').bind(staffId),
    env.DB.prepare('SELECT id,location_id AS locationId,weekday,start_time AS startTime,end_time AS endTime FROM weekly_availability WHERE staff_id=? AND active=1 ORDER BY weekday,start_time LIMIT 101').bind(staffId),
    env.DB.prepare("SELECT id,starts_at AS startsAt,ends_at AS endsAt,created_by_user_id=? AS canRemove FROM schedule_exceptions WHERE staff_id=? AND exception_type='time_off' AND (julianday(ends_at)>julianday('now') OR julianday(ends_at) IS NULL) ORDER BY starts_at LIMIT 101").bind(userId, staffId),
    env.DB.prepare(`SELECT location_id AS locationId,starts_at AS startsAt,ends_at AS endsAt,reserved_until AS reservedUntil,proposed_starts_at AS proposedStart,proposed_ends_at AS proposedEnd
      FROM appointments WHERE COALESCE(assigned_staff_id,requested_staff_id)=? AND status IN ('requested','confirmed','reschedule_proposed','checked_in','in_service')
      AND (julianday(ends_at)>julianday('now','-120 minutes') OR julianday(reserved_until)>julianday('now')
        OR (reserved_until IS NOT NULL AND julianday(reserved_until) IS NULL) OR julianday(ends_at) IS NULL OR proposed_starts_at IS NOT NULL OR proposed_ends_at IS NOT NULL) LIMIT 1001`).bind(staffId),
    env.DB.prepare(`SELECT location_id AS locationId,starts_at AS startsAt,ends_at AS endsAt,NULL AS reservedUntil,NULL AS proposedStart,NULL AS proposedEnd FROM appointment_holds
      WHERE staff_id=? AND (julianday(expires_at)>julianday('now') OR julianday(expires_at) IS NULL) LIMIT 1001`).bind(staffId),
    env.DB.prepare(`SELECT location_id AS locationId FROM schedule_exceptions WHERE staff_id=? AND exception_type='added_availability'
      AND (julianday(ends_at)>julianday('now') OR julianday(ends_at) IS NULL) LIMIT 1001`).bind(staffId),
  ]);
  if (await requireProfessional(env, userId, session) !== staffId) throw new ApiError(403, 'Your professional profile changed. Reload your account.');
  if (result.slice(2).some((entry, index) => entry.results.length > (index < 3 ? 100 : 1000))) throw new ApiError(409, 'The shop needs to review this schedule before editing.');
  return { staffId, revision: (result[0]!.results[0] as { version: number }).version, buffer: (result[1]!.results[0] as { buffer: number }).buffer,
    locations: result[2]!.results as Location[], hours: result[3]!.results as Hours[], timeOff: result[4]!.results as TimeOff[], busy: [...result[5]!.results, ...result[6]!.results] as Busy[], addedAvailability: result[7]!.results as { locationId: string | null }[] };
}
export async function schedulePage(env: Env, userId: string, session: string): Promise<SchedulePage> {
  const { revision, locations, hours, timeOff } = await snapshot(env, userId, session); return { revision, locations, hours, timeOff: timeOff.map((item) => ({ ...item, canRemove: Boolean(item.canRemove) })) };
}
function occupied(rows: Busy[], buffer: number) {
  if (!Number.isInteger(buffer) || buffer < 0 || buffer > 120) throw new ApiError(409, 'The shop needs to review the cleanup allowance.');
  return rows.flatMap((row) => {
    const parse = (start: string | null, end: string | null, reserved: string | null) => {
      const offset = /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/;
      if (!start || !end || !offset.test(start) || !offset.test(end) || (reserved && !offset.test(reserved))) throw new ApiError(409, 'An unresolved appointment needs shop review before changing availability.');
      const first = Date.parse(start); const last = Date.parse(end); const until = reserved ? Date.parse(reserved) : last + buffer * 60000;
      if (![first, last, until].every(Number.isFinite) || last <= first || until < last) throw new ApiError(409, 'An appointment time needs shop review.');
      return { start: first, end: Math.max(last + buffer * 60000, until), locationId: row.locationId };
    };
    return [parse(row.startsAt, row.endsAt, row.reservedUntil), ...(row.proposedStart || row.proposedEnd ? [parse(row.proposedStart, row.proposedEnd, null)] : [])].filter((item) => item.end > Date.now());
  });
}
export async function changeSchedule(env: Env, userId: string, session: string, body: Record<string, unknown>) {
  const action = body.action;
  if (typeof action !== 'string' || !['add_hours', 'remove_hours', 'add_time_off', 'remove_time_off'].includes(action)) throw new ApiError(400, 'Choose a supported schedule change.');
  allowFields(body, ['action', 'revision', ...(action === 'add_hours' ? ['locationId', 'weekday', 'startTime', 'endTime'] : action === 'add_time_off' ? ['locationId', 'date', 'startTime', 'endTime'] : ['id'])]);
  if (!Number.isSafeInteger(body.revision) || Number(body.revision) < 0) throw new ApiError(400, 'Refresh the schedule before saving.');
  const current = await snapshot(env, userId, session);
  if (current.revision !== body.revision) throw new ApiError(409, 'The schedule changed. Reload before saving.');
  const receipt = randomUUID(); const now = new Date().toISOString();
  const proof = 'EXISTS (SELECT 1 FROM audit_events WHERE id=? AND actor_user_id=?)';
  let mutation;
  if (action === 'add_hours' || action === 'add_time_off') {
    const locationId = stringField(body, 'locationId', 128, 1); const location = current.locations.find((item) => item.id === locationId);
    if (!location) throw new ApiError(400, 'Choose one of your approved locations.');
    const start = stringField(body, 'startTime', 5, 5); const end = stringField(body, 'endTime', 5, 5);
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.test(end) || start >= end) throw new ApiError(400, 'Choose a start and end on the same day.');
    if (action === 'add_hours') {
      if (current.addedAvailability.some((item) => item.locationId !== locationId)) throw new ApiError(409, 'Added availability at another location needs shop review before adding weekly hours.');
      if (!Number.isInteger(body.weekday) || Number(body.weekday) < 0 || Number(body.weekday) > 6) throw new ApiError(400, 'Choose a weekday.');
      if (current.hours.length >= 100) throw new ApiError(409, 'The shop needs to review the number of weekly windows.');
      for (const window of current.hours) {
        if (!Number.isInteger(window.weekday) || window.weekday < 0 || window.weekday > 6 || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(window.startTime)
          || !/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.test(window.endTime) || window.startTime >= window.endTime) throw new ApiError(409, 'Existing weekly hours need shop review.');
        const other = current.locations.find((item) => item.id === window.locationId);
        if (!other || other.timeZone !== location.timeZone) throw new ApiError(409, 'Schedules spanning unavailable locations or different time zones need shop review.');
        if (window.weekday === body.weekday && start < window.endTime && end > window.startTime) throw new ApiError(409, 'These hours overlap an existing window, possibly at another location.');
      }
      mutation = env.DB.prepare(`INSERT INTO weekly_availability(id,staff_id,location_id,weekday,start_time,end_time,created_at,updated_at)
        SELECT ?,?,?,?,?,?,?,? WHERE ${proof} ON CONFLICT(staff_id,location_id,weekday,start_time,end_time) DO UPDATE SET active=1,updated_at=excluded.updated_at`)
        .bind(randomUUID(), current.staffId, locationId, body.weekday, start, end, now, now, receipt, userId);
    } else {
      const date = stringField(body, 'date', 10, 10);
      if (!validDate(date)) throw new ApiError(400, 'Choose a valid date.');
      const range = wallWindow(date, start, end, location.timeZone);
      const fullDay = wallWindow(date, '00:00', '24:00', location.timeZone);
      if (!fullDay || fullDay.end - fullDay.start !== 86400000) throw new ApiError(400, 'Time off on a clock-change day needs shop review.');
      if (!range || range.start <= Date.now() || range.start > Date.now() + 366 * 86400000) throw new ApiError(400, 'Choose a valid future time within the next year.');
      // Time off blocks the professional across all locations. Shrinking an
      // ambiguous DST window could miss intended time off, so reject such days.
      const duration = (Number(end.slice(0, 2)) * 60 + Number(end.slice(3))) - (Number(start.slice(0, 2)) * 60 + Number(start.slice(3)));
      if (range.end - range.start !== duration * 60000) throw new ApiError(400, 'This time crosses a clock change. Ask the shop to review the exact times.');
      if (occupied(current.busy, current.buffer).some((busy) => overlaps(range, busy))) throw new ApiError(409, 'This time off conflicts with an appointment, proposed visit, hold, or cleanup allowance.');
      if (current.timeOff.length >= 100) throw new ApiError(409, 'The shop needs to review existing time off.');
      mutation = env.DB.prepare(`INSERT INTO schedule_exceptions(id,staff_id,starts_at,ends_at,exception_type,created_by_user_id,created_at,updated_at)
        SELECT ?,?,?,?,'time_off',?,?,? WHERE ${proof}`).bind(randomUUID(), current.staffId, new Date(range.start).toISOString(), new Date(range.end).toISOString(), userId, now, now, receipt, userId);
    }
  } else {
    const id = stringField(body, 'id', 128, 1);
    if (action === 'remove_hours') {
      const window = current.hours.find((item) => item.id === id); if (!window) throw new ApiError(404, 'This weekly window is unavailable.');
      const location = current.locations.find((item) => item.id === window.locationId); if (!location) throw new ApiError(409, 'The shop needs to review this location.');
      for (const busy of occupied(current.busy, current.buffer)) {
        if (busy.locationId !== location.id) continue;
        const first = localDate(busy.start, location.timeZone); const last = localDate(busy.end, location.timeZone);
        if (first !== last) throw new ApiError(409, 'An overnight appointment needs shop review before removing hours.');
        if (new Date(`${first}T00:00:00Z`).getUTCDay() === window.weekday) {
          const range = wallWindow(first, window.startTime, window.endTime, location.timeZone);
          if (!range || overlaps(range, busy)) throw new ApiError(409, 'These hours support an appointment or hold. Resolve it with the customer before removing the window.');
        }
      }
      mutation = env.DB.prepare(`UPDATE weekly_availability SET active=0,updated_at=? WHERE id=? AND staff_id=? AND ${proof}`).bind(now, id, current.staffId, receipt, userId);
    } else {
      if (!current.timeOff.some((item) => item.id === id && item.canRemove)) throw new ApiError(404, 'This time-off entry cannot be removed by your account.');
      mutation = env.DB.prepare(`DELETE FROM schedule_exceptions WHERE id=? AND staff_id=? AND created_by_user_id=? AND exception_type='time_off' AND ${proof}`).bind(id, current.staffId, userId, receipt, userId);
    }
  }
  const result = await env.DB.batch<{ meta: { changes: number } }>([
    env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,action,entity_type,entity_id,created_at,metadata_json)
      SELECT ?,?,?,'staff_schedule',?,?,? WHERE (SELECT version FROM booking_revision WHERE id=1)=?
      AND EXISTS (SELECT 1 FROM staff_profiles sp JOIN users u ON u.id=sp.user_id JOIN sessions se ON se.user_id=u.id
        WHERE sp.id=? AND u.id=? AND se.token_hash=? AND sp.setup_status='approved' AND u.status='active' AND u.email_verified_at IS NOT NULL
        AND u.role IN ('staff','manager','owner','admin') AND ${staffMfaGate()})`)
      .bind(receipt, userId, `schedule_${action}`, current.staffId, now, JSON.stringify({ change: body, previous: action === 'remove_hours' ? current.hours.find((item) => item.id === body.id) : action === 'remove_time_off' ? current.timeOff.find((item) => item.id === body.id) : null }), current.revision, current.staffId, userId, session),
    mutation,
  ]);
  if (result[0]?.meta.changes !== 1) throw new ApiError(409, 'The schedule or your access changed. Reload before saving.');
  return { message: 'Schedule change saved. Existing appointments have not been moved or cancelled.' };
}
