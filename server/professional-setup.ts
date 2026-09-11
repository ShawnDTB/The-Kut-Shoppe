import { randomUUID } from 'node:crypto';
import type { ProfessionalSubmission, SetupCatalog, SetupPage, SetupProfile, SetupReviewQueue } from '../src/shared/professional-setup';
import { ApiError, type Env } from './types';
import { allowFields, stringField, verifyPassword } from './security';
import { requireStaffMfa, staffMfaGate } from './staff-mfa';

// Every final read/write repeats identity and MFA checks. Owner review does not
// require a bookable profile and never confers authority to change account roles.
const actorGate = (owner = false) => `EXISTS (SELECT 1 FROM users u JOIN sessions se ON se.user_id=u.id
  WHERE u.id=? AND se.token_hash=? AND u.status='active' AND u.email_verified_at IS NOT NULL
  AND u.role IN (${owner ? "'owner','admin'" : "'staff','manager','owner','admin'"}) AND ${staffMfaGate()})`;
const eligibleTarget = `EXISTS (SELECT 1 FROM users target WHERE target.id=professional_submissions.user_id
  AND target.status='active' AND target.email_verified_at IS NOT NULL AND target.role IN ('staff','manager','owner','admin'))
  AND NOT EXISTS (SELECT 1 FROM staff_profiles existing WHERE existing.user_id=professional_submissions.user_id AND existing.setup_status IN ('approved','disabled'))`;
const fields = `id,professional_name AS professionalName,bio,location_ids AS locationIds,service_ids AS serviceIds,status,version,review_note AS reviewNote,submitted_at AS submittedAt`;
type Stored = Omit<ProfessionalSubmission, 'locationIds' | 'serviceIds'> & { locationIds: string; serviceIds: string };
const unpack = (row: Stored): ProfessionalSubmission => ({ ...row, locationIds: JSON.parse(row.locationIds) as string[], serviceIds: JSON.parse(row.serviceIds) as string[] });
async function access(env: Env, userId: string, session: string, owner = false) {
  if (env.STAFF_SETUP_ENABLED !== 'true') throw new ApiError(503, 'Professional setup is not open yet.');
  await requireStaffMfa(env, userId, session);
  if (!await env.DB.prepare(`SELECT 1 WHERE ${actorGate(owner)}`).bind(userId, session).first()) throw new ApiError(403, 'Owner review access is required.');
}
const locationsSql = "SELECT id,name,timezone AS timeZone FROM locations WHERE active=1 ORDER BY name,id LIMIT 101";
const servicesSql = "SELECT id,name,duration_minutes AS durationMinutes,price_cents AS priceCents FROM services WHERE active=1 AND duration_minutes BETWEEN 1 AND 480 ORDER BY name,id LIMIT 101";
function catalog(results: { results: unknown[] }[]): SetupCatalog {
  if (results[0]!.results.length > 100 || results[1]!.results.length > 100) throw new ApiError(503, 'The shop needs to review its service catalog.');
  return { locations: results[0]!.results as SetupCatalog['locations'], services: results[1]!.results as SetupCatalog['services'] };
}
export async function setupPage(env: Env, userId: string, session: string, reviewId?: string): Promise<SetupPage> {
  await access(env, userId, session, Boolean(reviewId));
  const results = await env.DB.batch<{ results: unknown[] }>([
    env.DB.prepare(`${locationsSql.replace(' ORDER BY', ` AND ${actorGate(Boolean(reviewId))} ORDER BY`)}`).bind(userId, session),
    env.DB.prepare(`${servicesSql.replace(' ORDER BY', ` AND ${actorGate(Boolean(reviewId))} ORDER BY`)}`).bind(userId, session),
    env.DB.prepare(`SELECT ${fields} FROM professional_submissions WHERE ${reviewId ? `id=? AND user_id!=? AND status='submitted' AND ${eligibleTarget}` : 'user_id=?'} AND ${actorGate(Boolean(reviewId))}`)
      .bind(...(reviewId ? [reviewId, userId] : [userId]), userId, session),
    env.DB.prepare(`SELECT version FROM booking_revision WHERE id=1 AND ${actorGate(Boolean(reviewId))}`).bind(userId, session),
    env.DB.prepare(`SELECT 1 FROM staff_profiles WHERE user_id=? AND setup_status IN ('approved','disabled')`).bind(userId),
  ]);
  if (!results[3]?.results.length) throw new ApiError(403, 'Verify staff access again.');
  const row = results[2]?.results[0] as Stored | undefined;
  if (reviewId && !row) throw new ApiError(404, 'This submission is not available for review.');
  return { ...catalog(results), submission: row ? unpack(row) : null, editable: !reviewId && !results[4]!.results.length && (!row || ['draft', 'returned'].includes(row.status)), revision: (results[3]!.results[0] as { version: number }).version };
}
function paragraph(body: Record<string, unknown>, key: string, max: number, min = 0) {
  const value = body[key];
  if (typeof value !== 'string' || value.length > max || value.trim().length < min || [...value].some((char) => char.charCodeAt(0) < 32 && !['\n', '\r'].includes(char))) throw new ApiError(400, `Check the ${key} field.`);
  return value.replaceAll('\r\n', '\n').trim();
}
function parseProfile(body: Record<string, unknown>, submit: boolean): SetupProfile {
  const ids = (key: string) => {
    const value = body[key];
    if (!Array.isArray(value) || value.length > 20 || (submit && !value.length) || value.some((id) => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) || new Set(value).size !== value.length) throw new ApiError(400, 'Choose valid services and locations without duplicates.');
    return [...value].sort() as string[];
  };
  return { professionalName: stringField(body, 'professionalName', 100, submit ? 2 : 0), bio: paragraph(body, 'bio', 1500), locationIds: ids('locationIds'), serviceIds: ids('serviceIds') };
}
const catalogGate = (locations: string, services: string) => `(SELECT count(*) FROM locations WHERE active=1 AND id IN (SELECT value FROM json_each(${locations})))=json_array_length(${locations})
  AND (SELECT count(*) FROM services WHERE active=1 AND duration_minutes BETWEEN 1 AND 480 AND id IN (SELECT value FROM json_each(${services})))=json_array_length(${services})`;
function versionField(body: Record<string, unknown>, key = 'version') {
  const value = body[key]; if (!Number.isSafeInteger(value) || Number(value) < 0) throw new ApiError(400, 'Refresh this form before saving.'); return Number(value);
}
export async function saveSetup(env: Env, userId: string, session: string, body: Record<string, unknown>) {
  await access(env, userId, session);
  allowFields(body, ['action', 'version', 'professionalName', 'bio', 'locationIds', 'serviceIds']);
  if (!['save', 'submit'].includes(String(body.action))) throw new ApiError(400, 'Choose save or submit.');
  const submit = body.action === 'submit'; const profile = parseProfile(body, submit); const version = versionField(body);
  const locations = JSON.stringify(profile.locationIds); const services = JSON.stringify(profile.serviceIds);
  const receipt = randomUUID(); const now = new Date().toISOString();
  const result = await env.DB.batch<{ meta: { changes: number } }>([
    env.DB.prepare(`INSERT INTO professional_submissions(id,user_id,professional_name,bio,location_ids,service_ids,status,version,submitted_at,updated_at,last_receipt)
      SELECT ?,?,?,?,?,?,?,1,?,?,? WHERE ${actorGate()}
      AND NOT EXISTS (SELECT 1 FROM staff_profiles WHERE user_id=? AND setup_status IN ('approved','disabled'))
      AND (?=0 OR EXISTS (SELECT 1 FROM professional_submissions WHERE user_id=? AND version=?))
      AND ${catalogGate('?', '?')}
      ON CONFLICT(user_id) DO UPDATE SET professional_name=excluded.professional_name,bio=excluded.bio,location_ids=excluded.location_ids,service_ids=excluded.service_ids,
        status=excluded.status,version=professional_submissions.version+1,submitted_at=excluded.submitted_at,updated_at=excluded.updated_at,last_receipt=excluded.last_receipt
      WHERE professional_submissions.version=? AND professional_submissions.status IN ('draft','returned')`)
      .bind(randomUUID(), userId, profile.professionalName, profile.bio, locations, services, submit ? 'submitted' : 'draft', submit ? now : null, now, receipt,
        userId, session, userId, version, userId, version, locations, locations, services, services, version),
    env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,action,entity_type,entity_id,created_at)
      SELECT ?,?,?,'professional_submission',id,? FROM professional_submissions WHERE user_id=? AND last_receipt=?`)
      .bind(randomUUID(), userId, submit ? 'professional_setup_submitted' : 'professional_setup_saved', now, userId, receipt),
  ]);
  if (result[0]?.meta.changes !== 1) throw new ApiError(409, 'The setup, catalog, or your access changed. Refresh before saving.');
  return { message: submit ? 'Submitted for shop review. This does not open appointment availability.' : 'Professional draft saved.' };
}
export async function reviewQueue(env: Env, userId: string, session: string, after: string | null): Promise<SetupReviewQueue> {
  await access(env, userId, session, true);
  if (after !== null && !/^[a-f0-9-]{36}$/.test(after)) throw new ApiError(400, 'Refresh the review queue.');
  const { results } = await env.DB.prepare(`SELECT id,professional_name AS professionalName,submitted_at AS submittedAt FROM professional_submissions
    WHERE status='submitted' AND user_id!=? AND id>? AND ${eligibleTarget} AND ${actorGate(true)} ORDER BY id LIMIT 26`)
    .bind(userId, after ?? '', userId, session).all<SetupReviewQueue['items'][number]>();
  return { items: results.slice(0, 25), nextCursor: results.length > 25 ? results[24]!.id : null };
}
export async function reviewSetup(env: Env, userId: string, session: string, id: string, body: Record<string, unknown>) {
  await access(env, userId, session, true);
  allowFields(body, ['action', 'version', 'revision', 'reviewNote', 'currentPassword']);
  const approve = body.action === 'approve'; if (!approve && body.action !== 'return') throw new ApiError(400, 'Choose approve or return for changes.');
  const version = versionField(body); const revision = versionField(body, 'revision'); const note = paragraph(body, 'reviewNote', 1000, approve ? 0 : 5);
  if (typeof body.currentPassword !== 'string' || !body.currentPassword.length || body.currentPassword.length > 128) throw new ApiError(400, 'Enter your current password.');
  const credential = await env.DB.prepare('SELECT password_hash AS hash FROM account_credentials WHERE user_id=?').bind(userId).first<{ hash: string }>();
  if (!credential || !await verifyPassword(body.currentPassword, credential.hash)) throw new ApiError(400, 'The current password is incorrect.');
  const receipt = randomUUID(); const now = new Date().toISOString(); const profileId = randomUUID();
  const proof = `SELECT user_id FROM professional_submissions WHERE id=? AND last_receipt=?`;
  const result = await env.DB.batch<{ meta: { changes: number } }>([
    env.DB.prepare(`UPDATE professional_submissions SET status=?,version=version+1,review_note=?,updated_at=?,last_receipt=?
      WHERE id=? AND user_id!=? AND status='submitted' AND version=? AND ${eligibleTarget} AND ${actorGate(true)}
      AND EXISTS (SELECT 1 FROM account_credentials WHERE user_id=? AND password_hash=?)
      AND (?=0 OR ((SELECT version FROM booking_revision WHERE id=1)=? AND json_array_length(location_ids)>0 AND json_array_length(service_ids)>0
        AND ${catalogGate('location_ids', 'service_ids')}
        AND NOT EXISTS (SELECT 1 FROM staff_profiles legacy WHERE legacy.user_id=professional_submissions.user_id AND (
          EXISTS (SELECT 1 FROM weekly_availability WHERE staff_id=legacy.id AND active=1)
          OR EXISTS (SELECT 1 FROM schedule_exceptions WHERE staff_id=legacy.id)
          OR EXISTS (SELECT 1 FROM appointments WHERE assigned_staff_id=legacy.id OR requested_staff_id=legacy.id)
          OR EXISTS (SELECT 1 FROM appointment_holds WHERE staff_id=legacy.id)))))`)
      .bind(approve ? 'approved' : 'returned', note, now, receipt, id, userId, version, userId, session, userId, credential.hash, approve ? 1 : 0, revision),
    ...(approve ? [
      env.DB.prepare(`INSERT INTO staff_profiles(id,user_id,professional_name,public_slug,public_bio,setup_status,created_at,updated_at)
        SELECT ?,user_id,professional_name,?,bio,'approved',?,? FROM professional_submissions WHERE id=? AND last_receipt=?
        ON CONFLICT(user_id) DO UPDATE SET professional_name=excluded.professional_name,public_bio=excluded.public_bio,setup_status='approved',
          booking_buffer_minutes=10,minimum_notice_hours=2,booking_window_days=30,accepts_new_clients=1,updated_at=excluded.updated_at`)
        .bind(profileId, `professional-${profileId}`, now, now, id, receipt),
      env.DB.prepare(`UPDATE staff_locations SET active=0,is_primary=0 WHERE staff_id IN (SELECT id FROM staff_profiles WHERE user_id IN (${proof}))`).bind(id, receipt),
      env.DB.prepare(`UPDATE staff_services SET active=0 WHERE staff_id IN (SELECT id FROM staff_profiles WHERE user_id IN (${proof}))`).bind(id, receipt),
      // Approval uses catalog prices/durations; no browser-defined overrides.
      env.DB.prepare(`INSERT INTO staff_locations(staff_id,location_id,is_primary,active,created_at)
        SELECT sp.id,j.value,CASE WHEN j.key=0 THEN 1 ELSE 0 END,1,? FROM professional_submissions p JOIN staff_profiles sp ON sp.user_id=p.user_id,json_each(p.location_ids) j
        WHERE p.id=? AND p.last_receipt=? ON CONFLICT(staff_id,location_id) DO UPDATE SET active=1,is_primary=excluded.is_primary`).bind(now, id, receipt),
      env.DB.prepare(`INSERT INTO staff_services(staff_id,service_id,active,created_at,updated_at)
        SELECT sp.id,j.value,1,?,? FROM professional_submissions p JOIN staff_profiles sp ON sp.user_id=p.user_id,json_each(p.service_ids) j
        WHERE p.id=? AND p.last_receipt=? ON CONFLICT(staff_id,service_id) DO UPDATE SET active=1,custom_duration_minutes=NULL,custom_price_cents=NULL,updated_at=excluded.updated_at`).bind(now, now, id, receipt),
    ] : []),
    env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,action,entity_type,entity_id,created_at)
      SELECT ?,?,?,'professional_submission',id,? FROM professional_submissions WHERE id=? AND last_receipt=?`).bind(randomUUID(), userId, approve ? 'professional_setup_approved' : 'professional_setup_returned', now, id, receipt),
  ]);
  if (result[0]?.meta.changes !== 1) throw new ApiError(409, 'The submission, catalog, or account changed. Refresh before reviewing.');
  return { message: approve ? 'Professional approved with the selected services and locations. Availability must be set up separately.' : 'Returned with your feedback. The professional can edit and resubmit.' };
}
