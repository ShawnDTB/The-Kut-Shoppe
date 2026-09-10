import { randomUUID } from 'node:crypto';
import type { Env } from './types';

// Call inside the same transaction as the event. Recipients are established
// from immutable relationships, never a submitted email or phone number.
export function queueAppointmentNotifications(env: Env, eventId: string) {
  return (['customer', 'professional'] as const).map((audience) => env.DB.prepare(`INSERT INTO appointment_notifications
    (id,event_id,recipient_user_id,audience,next_attempt_at,created_at)
    SELECT ?,e.id,${audience === 'customer' ? 'a.customer_user_id' : 'sp.user_id'},?,e.created_at,e.created_at
    FROM appointment_events e JOIN appointments a ON a.id=e.appointment_id
    LEFT JOIN staff_profiles sp ON sp.id=COALESCE(a.assigned_staff_id,a.requested_staff_id)
    WHERE e.id=? AND ${audience === 'customer' ? 'a.customer_user_id' : 'sp.user_id'} IS NOT NULL
      ${audience === 'professional' ? 'AND sp.user_id IS NOT a.customer_user_id' : ''}
    ON CONFLICT(event_id,recipient_user_id,audience) DO NOTHING`).bind(randomUUID(), audience, eventId));
}

interface DeliveryRow {
  id: string; status: string; audience: string; attempts: number; first_attempt_at: string | null;
  recipient_email: string | null; payload_json: string | null; currentEmail: string | null; eligible: number;
}
const eligible = `u.status='active' AND u.email_verified_at IS NOT NULL AND
  ((n.audience='customer' AND a.customer_user_id=u.id) OR
   (n.audience='professional' AND sp.user_id=u.id AND sp.setup_status='approved' AND u.role IN ('staff','manager','owner','admin')))`;
const deliverySelect = `SELECT n.id,n.status,n.audience,n.attempts,n.first_attempt_at,n.recipient_email,n.payload_json,u.email AS currentEmail,
  CASE WHEN ${eligible} THEN 1 ELSE 0 END AS eligible
  FROM appointment_notifications n JOIN users u ON u.id=n.recipient_user_id
  JOIN appointment_events e ON e.id=n.event_id JOIN appointments a ON a.id=e.appointment_id
  LEFT JOIN staff_profiles sp ON sp.id=COALESCE(a.assigned_staff_id,a.requested_staff_id)`;

export async function deliverAppointmentNotifications(env: Env) {
  const stats = { accepted: 0, retried: 0, failed: 0, suppressed: 0 };
  if (env.APPOINTMENT_EMAIL_ENABLED !== 'true') return stats;
  const origin = new URL(env.APP_ORIGIN);
  if (origin.protocol !== 'https:' || origin.origin !== env.APP_ORIGIN || origin.hostname.endsWith('.invalid') || !env.RESEND_API_KEY || !env.MAIL_FROM) throw new Error('Notification service configuration is incomplete');
  const now = new Date().toISOString();
  const { results } = await env.DB.prepare(`SELECT id FROM appointment_notifications
    WHERE (status IN ('queued','retry') AND next_attempt_at<=?) OR (status='sending' AND lease_until<=?)
    ORDER BY next_attempt_at,id LIMIT 10`).bind(now, now).all<{ id: string }>();
  for (const candidate of results) {
    const token = randomUUID(); const claimTime = new Date().toISOString();
    const claimed = await env.DB.prepare(`UPDATE appointment_notifications SET status='sending',lease_token=?,lease_until=?
      WHERE id=? AND ((status IN ('queued','retry') AND next_attempt_at<=?) OR (status='sending' AND lease_until<=?))`)
      .bind(token, new Date(Date.now() + 120000).toISOString(), candidate.id, claimTime, claimTime).run();
    if (claimed.meta.changes !== 1) continue;
    const row = await env.DB.prepare(`${deliverySelect} WHERE n.id=? AND n.lease_token=?`).bind(candidate.id, token).first<DeliveryRow>();
    if (!row) continue;
    const finish = (status: string, code: string | null) => env.DB.prepare(`UPDATE appointment_notifications SET status=?,last_error_code=?,lease_token=NULL,lease_until=NULL,
      payload_json=CASE WHEN ?='suppressed' THEN NULL ELSE payload_json END,recipient_email=CASE WHEN ?='suppressed' THEN NULL ELSE recipient_email END
      WHERE id=? AND lease_token=?`).bind(status, code, status, status, row.id, token).run();
    if (!row.eligible || !row.currentEmail || (row.recipient_email !== null && row.recipient_email !== row.currentEmail)) {
      await finish('suppressed', 'recipient_changed'); stats.suppressed++; continue;
    }
    // Resend retains idempotency keys for 24 hours. Never retry an uncertain
    // attempt after that window; a failed row needs explicit operational review.
    if (row.attempts >= 8 || (row.first_attempt_at && Date.now() - Date.parse(row.first_attempt_at) >= 20 * 3600000)) {
      await finish('failed', 'retry_window_closed'); stats.failed++; continue;
    }
    const payload = row.payload_json ?? JSON.stringify({ from: env.MAIL_FROM, to: [row.currentEmail],
      subject: 'Kut Shoppe appointment update',
      text: `There is an appointment update in your Kut Shoppe account. Sign in to check the latest status: ${env.APP_ORIGIN}/account?view=${row.audience === 'professional' ? 'professional' : 'appointments'}\n\nAn email notice does not confirm an appointment. Your account shows the current status.` });
    // Freeze the payload before the first external side effect so a timeout or
    // crash retries the same provider key AND exactly the same message.
    const prepared = await env.DB.prepare(`UPDATE appointment_notifications SET payload_json=COALESCE(payload_json,?),
      recipient_email=COALESCE(recipient_email,?),first_attempt_at=COALESCE(first_attempt_at,?),attempts=attempts+1
      WHERE id=? AND lease_token=? AND lease_until>?
        AND EXISTS (SELECT 1 FROM (${deliverySelect}) checked WHERE checked.id=appointment_notifications.id AND checked.currentEmail=? AND checked.eligible=1)`)
      .bind(payload, row.currentEmail, claimTime, row.id, token, new Date().toISOString(), row.currentEmail).run();
    if (prepared.meta.changes !== 1) { await finish('suppressed', 'recipient_changed'); stats.suppressed++; continue; }
    try {
      const response = await fetch('https://api.resend.com/emails', { method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `appointment-notice/${row.id}` },
        body: payload, signal: AbortSignal.timeout(10000) });
      if (response.ok) {
        await env.DB.prepare(`UPDATE appointment_notifications SET status='accepted',accepted_at=?,last_error_code=NULL,lease_token=NULL,lease_until=NULL,payload_json=NULL,recipient_email=NULL
          WHERE id=? AND lease_token=?`).bind(new Date().toISOString(), row.id, token).run();
        stats.accepted++;
      } else if (response.status === 429 || response.status >= 500 || response.status === 409) throw new Error('Retryable provider response');
      else { await finish('failed', 'provider_rejected'); stats.failed++; }
    } catch {
      const retryAt = new Date(Date.now() + Math.min(60, 2 ** row.attempts) * 60000).toISOString();
      await env.DB.prepare(`UPDATE appointment_notifications SET status='retry',next_attempt_at=?,last_error_code='delivery_uncertain',lease_token=NULL,lease_until=NULL
        WHERE id=? AND lease_token=?`).bind(retryAt, row.id, token).run();
      stats.retried++;
    }
  }
  return stats;
}
