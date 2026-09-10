import { randomUUID } from 'node:crypto';
import type { CustomerAppointmentDetail, CustomerOrderDetail, CustomerOrderItem, CustomerProfile } from '../src/shared/customer';
import { ApiError, type Env } from './types';

interface AppointmentRow {
  id: string; serviceName: string; barberName: string | null; status: string; source: string;
  startsAt: string | null; endsAt: string | null; proposedStartsAt: string | null; proposedEndsAt: string | null;
  priceCents: number; customerNote: string | null; createdAt: string; updatedAt: string; withdrawalId: string | null;
  locationName: string; line1: string; line2: string | null; city: string; state: string; postalCode: string; timeZone: string;
}

export async function appointmentDetail(env: Env, userId: string, id: string): Promise<CustomerAppointmentDetail> {
  const row = await env.DB.prepare(`SELECT a.id, s.name AS serviceName, sp.professional_name AS barberName,
    a.status, a.source, a.starts_at AS startsAt, a.ends_at AS endsAt,
    a.proposed_starts_at AS proposedStartsAt, a.proposed_ends_at AS proposedEndsAt, a.price_cents AS priceCents,
    a.customer_note AS customerNote, a.created_at AS createdAt, a.updated_at AS updatedAt,
    a.customer_withdrawal_id AS withdrawalId, l.name AS locationName,
    l.address_line_1 AS line1, l.address_line_2 AS line2, l.city, l.state, l.postal_code AS postalCode, l.timezone AS timeZone
    FROM appointments a JOIN services s ON s.id = a.service_id JOIN locations l ON l.id = a.location_id
    LEFT JOIN staff_profiles sp ON sp.id = COALESCE(a.assigned_staff_id, a.requested_staff_id)
    WHERE a.id = ? AND a.customer_user_id = ?`).bind(id, userId).first<AppointmentRow>();
  // Unknown, guest, and other-customer records are indistinguishable to callers.
  if (!row) throw new ApiError(404, 'This appointment is not available in your account.');
  // Require an explicit offset; local/date-only values are ambiguous at DST.
  const instant = (value: string | null) => value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;
  const starts = instant(row.startsAt);
  const ends = instant(row.endsAt);
  return {
    id: row.id, serviceName: row.serviceName, barberName: row.barberName, status: row.status,
    startsAt: row.startsAt, endsAt: row.endsAt, proposedStartsAt: row.proposedStartsAt, proposedEndsAt: row.proposedEndsAt,
    priceCents: row.priceCents, customerNote: row.customerNote, createdAt: row.createdAt, updatedAt: row.updatedAt,
    location: { name: row.locationName, address: { line1: row.line1, line2: row.line2 ?? '', city: row.city, state: row.state, postalCode: row.postalCode }, timeZone: row.timeZone },
    canWithdraw: row.source === 'website' && !row.withdrawalId && ['requested', 'waitlisted'].includes(row.status)
      && (row.startsAt === null || starts > Date.now()),
    withdrawnByCustomer: row.status === 'cancelled' && Boolean(row.withdrawalId),
    canDownloadCalendar: row.status === 'confirmed' && Number.isFinite(starts) && Number.isFinite(ends) && ends > starts,
  };
}

export async function withdrawAppointment(env: Env, userId: string, sessionHash: string, id: string, updatedAt: string) {
  // Fetch first to enforce the same not-found response and support safe retries.
  const current = await appointmentDetail(env, userId, id);
  if (current.withdrawnByCustomer) return { appointment: current, message: 'This request has already been withdrawn.' };
  if (!current.canWithdraw) throw new ApiError(409, 'This request cannot be withdrawn online. Refresh the details or contact the shop.');
  const receipt = randomUUID();
  const now = new Date().toISOString();
  const changed = 'SELECT id FROM appointments WHERE id = ? AND customer_user_id = ? AND customer_withdrawal_id = ?';
  const results = await env.DB.batch<{ meta: { changes: number } }>([
    env.DB.prepare(`UPDATE appointments SET status = 'cancelled', cancelled_at = ?, updated_at = ?,
      cancellation_reason = 'Withdrawn by customer before confirmation', customer_withdrawal_id = ?
      WHERE id = ? AND customer_user_id = ? AND source = 'website' AND status IN ('requested', 'waitlisted')
        AND customer_withdrawal_id IS NULL AND updated_at = ?
        AND (starts_at IS NULL OR julianday(starts_at) > julianday(?))
        AND EXISTS (SELECT 1 FROM users u JOIN sessions s ON s.user_id = u.id WHERE u.id = ?
          AND u.status = 'active' AND u.email_verified_at IS NOT NULL AND s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?)`)
      .bind(now, now, receipt, id, userId, updatedAt, now, userId, sessionHash, now),
    env.DB.prepare(`INSERT INTO appointment_events(id, appointment_id, actor_user_id, event_type, created_at)
      SELECT ?, id, ?, 'customer_withdrew_request', ? FROM appointments WHERE id IN (${changed})`)
      .bind(receipt, userId, now, id, userId, receipt),
    env.DB.prepare(`INSERT INTO audit_events(id, actor_user_id, action, entity_type, entity_id, created_at)
      SELECT ?, ?, 'customer_withdrew_request', 'appointment', id, ? FROM appointments WHERE id IN (${changed})`)
      .bind(randomUUID(), userId, now, id, userId, receipt),
  ]);
  const appointment = await appointmentDetail(env, userId, id);
  if (results[0]?.meta.changes !== 1 && !appointment.withdrawnByCustomer) {
    throw new ApiError(409, 'The appointment changed while you were viewing it. Refresh its details before trying again.');
  }
  return { appointment, message: 'Your unconfirmed request has been withdrawn. No confirmed appointment was cancelled.' };
}

function shippingAddress(raw: string | null): CustomerProfile['address'] | null {
  if (!raw || raw.length > 8192) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const input = value as Record<string, unknown>;
    const safe = (key: string, max: number) => typeof input[key] === 'string' ? input[key].slice(0, max) : '';
    // Never send an arbitrary stored JSON object to the browser.
    return { line1: safe('line1', 150), line2: safe('line2', 100), city: safe('city', 100), state: safe('state', 2), postalCode: safe('postalCode', 10) };
  } catch { return null; }
}
export async function orderDetail(env: Env, userId: string, id: string): Promise<CustomerOrderDetail> {
  const results = await env.DB.batch<{ results: unknown[] }>([
    env.DB.prepare(`SELECT id, status, fulfillment_type AS fulfillment, total_cents AS totalCents, created_at AS createdAt,
      subtotal_cents AS subtotalCents, shipping_cents AS shippingCents, tax_cents AS taxCents,
      shipping_address_json AS addressJson, tracking_number AS trackingNumber FROM orders WHERE id = ? AND customer_user_id = ?`).bind(id, userId),
    env.DB.prepare(`SELECT i.id, i.product_name AS productName, i.variant_name AS variantName, i.quantity, i.unit_price_cents AS unitPriceCents
      FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.id = ? AND o.customer_user_id = ?
      ORDER BY i.created_at, i.id LIMIT 101`).bind(id, userId),
  ]);
  const row = results[0]?.results[0] as (Omit<CustomerOrderDetail, 'shippingAddress' | 'items' | 'itemsComplete'> & { addressJson: string | null }) | undefined;
  if (!row) throw new ApiError(404, 'This order is not available in your account.');
  const items = results[1]!.results as CustomerOrderItem[];
  const { addressJson, ...summary } = row;
  return { ...summary, shippingAddress: row.fulfillment === 'shipping' ? shippingAddress(addressJson) : null,
    items: items.slice(0, 100), itemsComplete: items.length <= 100 };
}
