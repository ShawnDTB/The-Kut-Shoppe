import { timingSafeEqual } from 'node:crypto';
import type { CustomerAppointment, CustomerOrder, CustomerPage } from '../src/shared/customer';
import { ApiError, type Env } from './types';
import { secretHash } from './security';

type HistoryKind = 'appointments' | 'orders';
const pageSize = 25;
type Cursor = { at: string; id: string };
function cursorHash(env: Env, userId: string, kind: HistoryKind, payload: string) {
  return secretHash(env, `history-v1:${userId}:${kind}:${payload}`);
}
function parseCursor(env: Env, userId: string, kind: HistoryKind, value: string | null): Cursor | null {
  if (value === null) return null;
  try {
    if (value.length > 1024 || !/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(value)) throw new Error();
    const [payload, signature] = value.split('.') as [string, string];
    if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(cursorHash(env, userId, kind, payload), 'hex'))) throw new Error();
    const cursor = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Cursor;
    if (!cursor || typeof cursor.at !== 'string' || cursor.at.length > 64 || typeof cursor.id !== 'string' || !cursor.id || cursor.id.length > 128) throw new Error();
    return cursor;
  } catch { throw new ApiError(400, 'This history link is no longer valid. Refresh your history and try again.'); }
}
export async function historyPage(env: Env, userId: string, kind: HistoryKind, cursorValue: string | null): Promise<CustomerPage<CustomerAppointment | CustomerOrder>> {
  const cursor = parseCursor(env, userId, kind, cursorValue);
  // These SQL fragments are server constants, never supplied by a browser.
  const appointments = kind === 'appointments';
  const time = appointments ? "COALESCE(a.starts_at, '')" : 'a.created_at';
  const select = appointments
    ? `SELECT a.id, s.name AS serviceName, sp.professional_name AS barberName, a.starts_at AS startsAt, a.status
       FROM appointments a JOIN services s ON s.id = a.service_id LEFT JOIN staff_profiles sp ON sp.id = COALESCE(a.assigned_staff_id,a.requested_staff_id)`
    : `SELECT a.id, a.status, a.fulfillment_type AS fulfillment, a.total_cents AS totalCents, a.created_at AS createdAt FROM orders a`;
  const query = env.DB.prepare(`${select} WHERE a.customer_user_id = ? ${cursor ? `AND (${time}, a.id) < (?, ?)` : ''}
    ORDER BY ${time} DESC, a.id DESC LIMIT ?`);
  const result = await query.bind(userId, ...(cursor ? [cursor.at, cursor.id] : []), pageSize + 1).all<CustomerAppointment | CustomerOrder>();
  const items = result.results.slice(0, pageSize);
  const last = items.at(-1);
  let nextCursor: string | null = null;
  if (result.results.length > pageSize && last) {
    const payload = Buffer.from(JSON.stringify({ at: 'startsAt' in last ? last.startsAt ?? '' : last.createdAt, id: last.id })).toString('base64url');
    nextCursor = `${payload}.${cursorHash(env, userId, kind, payload)}`;
  }
  return { items, nextCursor };
}
