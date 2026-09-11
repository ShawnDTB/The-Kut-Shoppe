# Professional setup and owner review

Follow-up: [professional availability management](professional-scheduling.md) now lets approved professionals add weekly hours and time off with conflict protection. This supersedes the schedule-management backlog below; current total coverage is 143 tests plus local Workers/D1 runtime checks.

Implemented on `dev-branch`, 2026-09-11. Apply `0008_professional_setup.sql` after 0007. `STAFF_SETUP_ENABLED=false` is a new independent server gate. No live account roles were assigned, no existing operational schedules were changed, and nothing was deployed.

## Complete setup workflow

1. An active, email-verified account already holding a staff, manager, owner, or admin role opens **Professional setup** in the shared account dashboard. The same authenticator verification used by Professional requests is required.
2. The professional saves a private draft with their professional name, customer-facing introduction, and requested services/locations. A submitted profile needs a name and at least one active service and location. Selections are limited to twenty each. The server validates the catalog; clients cannot supply account roles, approval state, prices, profile IDs, or duration overrides.
3. Submission locks the draft. The professional sees its status and can refresh it. There is no automatic role assignment, public page publication, working-hour creation, or appointment confirmation.
4. An owner or admin opens **Setup reviews**, verifies MFA, selects a submission, and reviews its name, introduction, locations/time zones, and catalog prices/durations. The queue pages through twenty-five submissions at a time in stable ID order; it excludes the reviewer's own submission and ineligible accounts. It contains no customer contact, address, or credential fields.
5. The reviewer enters their current password and either approves or returns the submission with feedback. Returning requires at least five characters of feedback. The applicant can edit a returned draft, save it, and resubmit. Submitted drafts cannot change underneath an owner review.
6. Approval atomically records the decision, creates or updates the eligible professional profile, applies the selected service/location assignments, and writes an audit event. Existing approved/disabled profiles cannot be overwritten or re-enabled through onboarding. Duplicate or competing decisions have one winner.

Owners do not need their own bookable professional profile to review another person. Managers and ordinary staff cannot review others. No one can approve their own setup; a sole owner's own professional setup needs a separately controlled bootstrap/reviewer arrangement. The app does not create another owner to bypass this boundary.

## What approval means

Approved services use current catalog prices and durations, with no custom overrides. Booking defaults are a ten-minute cleanup buffer, two hours' notice, a thirty-day booking window, and accepting new clients. The first selected location in sorted ID order becomes the primary location; other selected locations remain active assignments. This administrative primary marker does not allocate hours. Employment/contractor classification remains unchanged and is not established by profile approval.

Approval does **not** set working hours. Profiles with legacy active weekly hours, schedule exceptions, appointments, or holds are rejected for separate migration review. Those records are preserved. Empty eligible draft profiles can be approved, but their prior unselected assignments are deactivated and selected service overrides reset to the stated catalog defaults. Already approved profiles require a future profile-change workflow.

Newly approved professionals can use their protected request section if staff operations are separately enabled. The booking engine has no new weekly hours to offer. Public website team pages remain curated existing content; this workflow does not render a submitted introduction on a public page.

## Authorization and concurrency

All endpoints independently enforce the setup gate, current active/verified role, session validity, and an unexpired authenticator grant. Final reads and writes repeat authorization. Owner decisions also recheck the current credential hash, target eligibility, expected submission version, and immutable submitted status. Approval checks the current booking revision from the review snapshot, active catalog selections, and the absence of legacy operational schedules. Concurrent catalog, role, or scheduling changes invalidate approval and require refresh. Unrelated booking changes may conservatively require refresh too.

Submission mutations use optimistic versions and unique transaction receipts. Decisions are not blindly retried after an uncertain response: refresh the queue/status to see whether they saved. Profile/assignment/audit changes share the decision transaction; an audit failure rolls them all back. Future code must preserve this atomic boundary and the existing database booking-revision triggers.

| Endpoint | Access and behavior |
|---|---|
| `GET /api/v1/me/professional/setup` | Own draft/status plus active setup catalog |
| `POST /api/v1/me/professional/setup` | Own save/submit with expected version |
| `GET /api/v1/me/professional/reviews?after=…` | Owner/admin queue, twenty-five per page |
| `GET /api/v1/me/professional/reviews/:id` | Another eligible person's submitted setup and current catalog snapshot |
| `POST /api/v1/me/professional/reviews/:id` | Owner/admin approve or return with MFA, password, expected version/revision |

Writes retain existing origin/JSON/body-size protections, strict field allowlists, and parameterized SQL. Setup saves are limited to twenty per account per fifteen minutes; reviews to ten. Responses are no-store. Forms keep unsaved content only in component memory. Introductions and feedback are plain text, never trusted HTML. Review feedback is intentionally visible to the applicant; it must not contain internal employment, security, or other people's private information.

## Restricted staging and rollback

- Back up and apply migrations through 0008 before using this code, including when the feature flag stays false. The migration creates only submission storage/indexes and seeds no users or roles.
- Use isolated synthetic staff and owner accounts with verified identity/role assignments from the approved operator process. Configure account services and the existing MFA encryption secret, enroll authenticators, then enable `STAFF_SETUP_ENABLED=true` only in restricted staging. `STAFF_OPERATIONS_ENABLED`, native booking, accounts, and email dispatch remain separate gates.
- Exercise save, refresh, submit, return, resubmit, approve, self-review rejection, stale catalog, lost responses, MFA expiry, role removal, and two-reviewer competition. Verify keyboard/mobile forms and password managers in hosted staging before release. Browser/visual acceptance has not been performed here.
- Disable `STAFF_SETUP_ENABLED` to stop setup/review access. This does not revoke profiles already approved. Disable staff operations/native booking separately if needed during an incident. Preserve submissions and audit records; do not automatically roll back the schema or delete approvals.

No onboarding emails are sent in this slice. Staff check their account for feedback; generic setup-review notification delivery can be added with an appropriate dedicated outbox later. Define submission retention, reviewer ownership, verified bootstrap, lost-MFA recovery, and security alerts before public operation.

## Validation and next work

Full local check: 135 tests (58 adapter, 66 API, three wall-time, eight authenticator), type/lint/build checks, production defaults and bundle budgets, plus offline-compiled real Workers/D1 tests. API coverage includes the complete return/resubmit/approve lifecycle, ownership and capability boundaries, injected fields, stale versions, catalog changes, queue pagination, disabled targets, preserved legacy schedules, final MFA rechecks, and audit rollback. Runtime checks race draft submission and owner approval alongside the existing account, MFA, booking, and notification scenarios. Only external delivery is mocked.

**Next: individual schedule management.** Approved professionals should manage weekly hours and dated exceptions only for their approved locations. Schedule changes must preserve existing appointments, account for cross-location conflicts and time zones/DST, invalidate stale booking quotes through revision triggers, and require MFA plus atomic audit checks. Manager/owner schedule overrides, role grants, approved-profile amendments, and public cutover remain separate capabilities.
