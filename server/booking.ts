import { randomUUID } from 'node:crypto';
import type { BookingAvailability, BookingOption } from '../src/shared/booking';
import { ApiError, type Env } from './types';
import { allowFields, secretHash, stringField } from './security';
import { DAY, MINUTE, localDate, mergeWindows, overlaps, validDate, wallWindow, type Interval } from './booking-time';
import { queueAppointmentNotifications } from './appointment-notifications';

interface Policy extends BookingOption { bufferMinutes: number; noticeHours: number; windowDays: number }
interface Selection { staffId: string; serviceId: string; locationId: string; date: string }
const eligibleOptions = `SELECT sp.id AS staffId, sp.professional_name AS professionalName,
  s.id AS serviceId, s.name AS serviceName, l.id AS locationId, l.name AS locationName, l.timezone AS timeZone,
  COALESCE(ss.custom_duration_minutes,s.duration_minutes) AS durationMinutes,
  COALESCE(ss.custom_price_cents,s.price_cents) AS priceCents,
  sp.booking_buffer_minutes AS bufferMinutes, sp.minimum_notice_hours AS noticeHours, sp.booking_window_days AS windowDays
  FROM staff_profiles sp JOIN users u ON u.id=sp.user_id
  JOIN staff_services ss ON ss.staff_id=sp.id JOIN services s ON s.id=ss.service_id
  JOIN staff_locations sl ON sl.staff_id=sp.id JOIN locations l ON l.id=sl.location_id
  WHERE sp.setup_status='approved' AND u.status='active' AND u.email_verified_at IS NOT NULL
    AND u.role IN ('staff','manager','owner','admin') AND ss.active=1 AND s.active=1 AND sl.active=1 AND l.active=1
    AND (sp.accepts_new_clients=1 OR EXISTS (SELECT 1 FROM appointments a WHERE a.customer_user_id=?
      AND a.status='completed' AND COALESCE(a.assigned_staff_id,a.requested_staff_id)=sp.id))`;

export function requireBooking(env: Env) {
  if (env.CUSTOMER_BOOKING_ENABLED !== 'true') throw new ApiError(503, 'Website appointment requests are not open. Please use the existing booking options.');
}
function publicOption(row: Policy): BookingOption {
  return { staffId: row.staffId, professionalName: row.professionalName, serviceId: row.serviceId, serviceName: row.serviceName,
    locationId: row.locationId, locationName: row.locationName, timeZone: row.timeZone, durationMinutes: row.durationMinutes, priceCents: row.priceCents };
}
function supported(row: Policy) {
  return Number.isSafeInteger(row.priceCents) && row.priceCents >= 0
    && Number.isInteger(row.durationMinutes) && row.durationMinutes > 0 && row.durationMinutes <= 480
    && Number.isInteger(row.bufferMinutes) && row.bufferMinutes >= 0 && row.bufferMinutes <= 120
    && Number.isFinite(row.noticeHours) && row.noticeHours >= 0 && row.noticeHours <= 2160
    && Number.isInteger(row.windowDays) && row.windowDays > 0 && row.windowDays <= 90;
}
export async function bookingOptions(env: Env, userId: string) {
  const { results } = await env.DB.prepare(`${eligibleOptions} ORDER BY s.name, sp.professional_name, l.name, sp.id, s.id, l.id LIMIT 501`).bind(userId).all<Policy>();
  if (results.length > 500) throw new ApiError(503, 'Please contact the shop to request an appointment.');
  return { options: results.filter(supported).map(publicOption) };
}
export function bookingSelection(input: Record<string, unknown>): Selection {
  const id = (key: string) => {
    const value = stringField(input, key, 128, 1);
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new ApiError(400, 'Choose a service, professional, and location.');
    return value;
  };
  const date = stringField(input, 'date', 10, 10);
  if (!validDate(date)) throw new ApiError(400, 'Choose a valid appointment date.');
  return { staffId: id('staffId'), serviceId: id('serviceId'), locationId: id('locationId'), date };
}
type Busy = { startsAt: string | null; endsAt: string | null; proposedStartsAt: string | null; proposedEndsAt: string | null; reservedUntil: string | null };
type Exception = { startsAt: string; endsAt: string; kind: string; locationId: string | null };
const parseInstant = (value: string | null) => value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;
function interval(start: string | null, end: string | null): Interval {
  const first = parseInstant(start); const last = parseInstant(end);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last <= first) throw new ApiError(409, 'The shop needs to review this schedule before it can accept requests.');
  return { start: first, end: last };
}
async function schedule(env: Env, userId: string, selection: Selection, now: number, confirmingId: string | null = null) {
  const { staffId, serviceId, locationId, date } = selection;
  const day = Date.parse(`${date}T00:00:00Z`);
  if (day < now - 2 * DAY || day > now + 92 * DAY) throw new ApiError(400, 'Choose a date within the next 90 days.');
  // D1 batch supplies one consistent read snapshot. The revision is rechecked
  // inside the eventual INSERT, so every intervening relevant write fails closed.
  const result = await env.DB.batch<{ results: unknown[] }>([
    env.DB.prepare('SELECT version FROM booking_revision WHERE id=1'),
    env.DB.prepare(`${eligibleOptions} AND sp.id=? AND s.id=? AND l.id=?`).bind(userId, staffId, serviceId, locationId),
    env.DB.prepare('SELECT start_time AS startTime, end_time AS endTime FROM weekly_availability WHERE staff_id=? AND location_id=? AND weekday=? AND active=1 LIMIT 101').bind(staffId, locationId, new Date(day).getUTCDay()),
    env.DB.prepare(`SELECT starts_at AS startsAt, ends_at AS endsAt, exception_type AS kind, location_id AS locationId
      FROM schedule_exceptions WHERE staff_id=? AND (julianday(ends_at)>=julianday(?) OR julianday(ends_at) IS NULL) LIMIT 1001`).bind(staffId, new Date(day - DAY).toISOString()),
    env.DB.prepare(`SELECT starts_at AS startsAt, ends_at AS endsAt, proposed_starts_at AS proposedStartsAt,
      proposed_ends_at AS proposedEndsAt, reserved_until AS reservedUntil FROM appointments
      WHERE (assigned_staff_id=? OR (assigned_staff_id IS NULL AND requested_staff_id=?)) AND (? IS NULL OR id!=?)
        AND status IN ('requested','confirmed','reschedule_proposed','checked_in','in_service')
        AND (ends_at IS NULL OR julianday(ends_at) IS NULL OR julianday(ends_at)>=julianday(?)
          OR julianday(proposed_ends_at)>=julianday(?)
          OR (proposed_starts_at IS NOT NULL AND (proposed_ends_at IS NULL OR julianday(proposed_ends_at) IS NULL))) LIMIT 1001`).bind(staffId, staffId, confirmingId, confirmingId, new Date(day - DAY).toISOString(), new Date(day - DAY).toISOString()),
    env.DB.prepare('SELECT starts_at AS startsAt, ends_at AS endsAt FROM appointment_holds WHERE staff_id=? AND (julianday(expires_at)>julianday(?) OR julianday(expires_at) IS NULL) LIMIT 1001').bind(staffId, new Date(now).toISOString()),
  ]);
  const revision = (result[0]?.results[0] as { version: number } | undefined)?.version;
  const policy = result[1]?.results[0] as Policy | undefined;
  if (revision === undefined) throw new ApiError(503, 'Website appointment requests are temporarily unavailable.');
  if (!policy || !supported(policy)) throw new ApiError(404, 'This appointment option is not available.');
  if (result.slice(2).some((entry, index) => entry.results.length > (index === 0 ? 100 : 1000))) throw new ApiError(503, 'Please contact the shop to request an appointment.');
  const today = localDate(now, policy.timeZone);
  const lastDate = new Date(Date.parse(`${today}T00:00:00Z`) + policy.windowDays * DAY).toISOString().slice(0, 10);
  if (date < today || date > lastDate) throw new ApiError(400, 'This date is outside the professional’s booking window.');
  const weekly = result[2]!.results as { startTime: string; endTime: string }[];
  const windows = weekly.map((row) => wallWindow(date, row.startTime, row.endTime, policy.timeZone)).filter((value): value is Interval => Boolean(value));
  const blocked: Interval[] = [];
  for (const row of result[3]!.results as Exception[]) {
    const span = interval(row.startsAt, row.endsAt);
    if (row.kind === 'added_availability') {
      if (row.locationId === locationId) windows.push(span);
    } else blocked.push(span); // Time off/breaks block the person across locations.
  }
  for (const row of result[4]!.results as Busy[]) {
    if (row.startsAt !== null) {
      const span = interval(row.startsAt, row.endsAt);
      span.end = Math.max(span.end + policy.bufferMinutes * MINUTE, row.reservedUntil ? interval(row.startsAt, row.reservedUntil).end : 0);
      blocked.push(span);
    } else if (row.endsAt !== null) interval(row.startsAt, row.endsAt); // malformed timed record
    if (row.proposedStartsAt !== null || row.proposedEndsAt !== null) {
      const span = interval(row.proposedStartsAt, row.proposedEndsAt); span.end += policy.bufferMinutes * MINUTE; blocked.push(span);
    }
  }
  for (const row of result[5]!.results as { startsAt: string; endsAt: string }[]) {
    const span = interval(row.startsAt, row.endsAt); span.end += policy.bufferMinutes * MINUTE; blocked.push(span);
  }
  const slots: BookingAvailability['slots'] = [];
  const duration = policy.durationMinutes * MINUTE;
  const buffer = policy.bufferMinutes * MINUTE;
  for (const window of mergeWindows(windows)) {
    const lower = Math.max(window.start, day - DAY, now + (confirmingId ? 0 : policy.noticeHours) * 3_600_000);
    // Fifteen-minute UTC grid remains unambiguous through DST's repeated hour.
    for (let start = Math.ceil(lower / (15 * MINUTE)) * 15 * MINUTE; start + duration + buffer <= Math.min(window.end, day + 2 * DAY); start += 15 * MINUTE) {
      if (localDate(start, policy.timeZone) !== date || blocked.some((span) => overlaps({ start, end: start + duration + buffer }, span))) continue;
      slots.push({ startsAt: new Date(start).toISOString(), endsAt: new Date(start + duration).toISOString() });
    }
  }
  return { revision, policy, slots };
}
export async function bookingAvailability(env: Env, userId: string, selection: Selection): Promise<BookingAvailability> {
  const snapshot = await schedule(env, userId, selection, Date.now());
  return { option: publicOption(snapshot.policy), date: selection.date, slots: snapshot.slots, quote: secretHash(env, JSON.stringify(snapshot.policy)) };
}
export async function confirmationSchedule(env: Env, userId: string, selection: Selection, id: string, startsAt: string, endsAt: string) {
  const snapshot = await schedule(env, userId, selection, Date.now(), id);
  if (!snapshot.slots.some((slot) => slot.startsAt === startsAt && slot.endsAt === endsAt)) throw new ApiError(409, 'The requested time no longer fits the schedule. Refresh this request before responding.');
  return { revision: snapshot.revision, reservedUntil: new Date(Date.parse(endsAt) + snapshot.policy.bufferMinutes * MINUTE).toISOString() };
}
export async function requestAppointment(env: Env, userId: string, sessionHash: string, body: Record<string, unknown>) {
  allowFields(body, ['staffId', 'serviceId', 'locationId', 'date', 'startsAt', 'note', 'requestKey', 'quote']);
  const selection = bookingSelection(body);
  const startsAt = stringField(body, 'startsAt', 24, 24);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(startsAt) || !Number.isFinite(Date.parse(startsAt))) throw new ApiError(400, 'Choose an available time.');
  const note = stringField(body, 'note', 500);
  const quote = stringField(body, 'quote', 128, 1);
  const requestKey = stringField(body, 'requestKey', 36, 36);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(requestKey)) throw new ApiError(400, 'Start a new appointment request.');
  const fingerprint = secretHash(env, JSON.stringify({ ...selection, startsAt, note, quote }));
  const existing = () => env.DB.prepare('SELECT id, client_request_hash AS fingerprint FROM appointments WHERE customer_user_id=? AND client_request_key=?').bind(userId, requestKey).first<{ id: string; fingerprint: string }>();
  const response = (row: { id: string; fingerprint: string }) => {
    if (row.fingerprint !== fingerprint) throw new ApiError(409, 'This request was already used for another selection. Start a new request.');
    return { appointmentId: row.id, message: 'Your request is saved. Check its current status in your appointments.' };
  };
  const prior = await existing(); if (prior) return response(prior);
  const now = Date.now();
  const snapshot = await schedule(env, userId, selection, now);
  // A concurrent retry may have committed between the first lookup and this
  // snapshot, removing its own slot from availability. Return its receipt first.
  const concurrent = await existing(); if (concurrent) return response(concurrent);
  if (quote !== secretHash(env, JSON.stringify(snapshot.policy))) throw new ApiError(409, 'The service details changed. Check available times and review the updated details.');
  const slot = snapshot.slots.find((candidate) => candidate.startsAt === startsAt);
  if (!slot) throw new ApiError(409, 'This time is no longer available. Refresh the available times.');
  const id = randomUUID(); const timestamp = new Date().toISOString();
  const eventId = randomUUID();
  const reservedUntil = new Date(Date.parse(slot.endsAt) + snapshot.policy.bufferMinutes * MINUTE).toISOString();
  // No temporary reservation is promised in the review form. The pending
  // request itself occupies the slot only after this atomic commit succeeds.
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO appointments(id,customer_user_id,requested_staff_id,service_id,location_id,starts_at,ends_at,
      reserved_until,price_cents,status,source,customer_note,client_request_key,client_request_hash,created_at,updated_at)
      SELECT ?,?,?,?,?,?,?,?,?,'requested','website',?,?,?,?,?
      WHERE (SELECT version FROM booking_revision WHERE id=1)=?
        AND EXISTS (SELECT 1 FROM users u JOIN sessions s ON s.user_id=u.id WHERE u.id=? AND u.status='active'
          AND u.email_verified_at IS NOT NULL AND s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>?)
        AND (SELECT count(*) FROM appointments WHERE customer_user_id=? AND status IN ('requested','waitlisted','reschedule_proposed'))<3
        AND julianday(?)>=julianday(?) + ? / 24.0
      ON CONFLICT(customer_user_id,client_request_key) WHERE client_request_key IS NOT NULL DO NOTHING`)
      .bind(id, userId, selection.staffId, selection.serviceId, selection.locationId, slot.startsAt, slot.endsAt,
        reservedUntil, snapshot.policy.priceCents, note || null, requestKey, fingerprint, timestamp, timestamp,
        snapshot.revision, userId, sessionHash, timestamp, userId, slot.startsAt, timestamp, snapshot.policy.noticeHours),
    env.DB.prepare(`INSERT INTO appointment_events(id,appointment_id,actor_user_id,event_type,created_at)
      SELECT ?,id,?,'customer_requested_appointment',? FROM appointments WHERE id=?`).bind(eventId, userId, timestamp, id),
    env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,action,entity_type,entity_id,created_at)
      SELECT ?,?,'customer_requested_appointment','appointment',id,? FROM appointments WHERE id=?`).bind(randomUUID(), userId, timestamp, id),
    ...queueAppointmentNotifications(env, eventId),
  ]);
  const saved = await existing();
  if (!saved) throw new ApiError(409, 'The schedule changed or you have three requests awaiting a response. Check your appointments, then refresh the available times.');
  return response(saved);
}
