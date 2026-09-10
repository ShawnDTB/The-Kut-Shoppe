# Customer booking requests

Follow-up: the [professional queue and appointment notices](professional-requests-notifications.md) are implemented in migration 0006 behind disabled flags. That handoff supersedes the missing queue/outbox statements below; stronger staff authentication, real delivery acceptance, and public launch remain open gates.

Implemented on `dev-branch`, 2026-09-10. This is an opt-in staging feature, not a production cutover. The public `/book` page continues to use Booksy and GlossGenius. Existing provider appointments do not sync automatically, so a partial imported schedule must never be presented as complete live availability.

## Customer journey

When both account access and `CUSTOMER_BOOKING_ENABLED=true` are configured, Account → Appointments offers Request an appointment. The customer selects a service/professional/location and date, checks openings, chooses a time, adds an optional note, reviews the saved service price and duration, and submits. A successful request appears immediately in the customer's existing appointment detail/history views as `requested`. It is not confirmed and no payment is collected. The existing withdrawal action releases its opening.

The form does not hold a slot while the customer reviews it. Only a successfully committed pending request occupies it. Active holds created by another supported workflow are respected, but this slice does not create temporary holds or promise a countdown. Expiring holds are a separate workflow if later checkout or business requirements need them.

An uncertain network/server response preserves the submission key and payload while the form remains mounted. Retry checks the same request rather than creating another. Reloading or leaving the form does not preserve a draft or submission key in browser storage; check appointment history before starting another request. A successful saved request remains in D1 across devices.

## Protected API

All routes require the existing verified account/session, private no-store responses, and the independent booking flag. Mutations also use the existing origin, JSON, request-header, and body-size checks.

| Endpoint | Result |
|---|---|
| `GET /api/v1/me/booking/options` | Eligible public professional/service/location combinations with effective duration and price |
| `GET /api/v1/me/booking/availability` | One selected date's opening instants, public option details, and a signed quote |
| `POST /api/v1/me/booking/requests` | One owned pending appointment with an idempotent receipt |

Availability requires exactly `staffId`, `serviceId`, `locationId`, and a real `YYYY-MM-DD` date. Submission adds a selected canonical UTC `startsAt`, optional-content `note` string (up to 500 characters), UUID-v4 `requestKey`, and the quote. Extra fields such as customer ID, role, status, price, and duration are rejected. The server calculates duration, end, buffer, price, and ownership. The signed quote requires a new review if relevant service/policy details change.

No customer identities, appointment IDs belonging to others, internal notes, hold contacts, or blocked-time reasons are included in availability responses. Returning-client eligibility uses a completed appointment linked to the immutable customer ID and the selected professional; an editable email or phone is not proof.

## Availability rules in this version

- Professionals must have an active, verified staff/manager/owner/admin account and an approved professional profile. Services, staff-service links, locations, and staff-location links must be active. Custom service duration/price override the catalog values.
- A professional declining new clients is offered only to customers with an owned completed visit with that professional. There is no automatic Any Available assignment yet.
- Weekly hours use the location's IANA time zone. Same-day windows are supported, with `24:00` allowed for closing; overnight windows must be split by weekday. Start slots use a fifteen-minute grid. Service plus cleanup buffer must fit in the available window.
- Explicit added availability opens only its specified location. Time off, breaks, and blocks prevent booking the person across all locations. Existing assigned/requested appointments and active holds also block across locations.
- Requested, confirmed, reschedule-proposed, checked-in, and in-service appointments occupy time. Reschedule proposals protect both original and proposed windows. Waitlist entries do not reserve time. Cancelled/declined/completed/no-show records do not occupy future availability.
- New requests save `reserved_until` to preserve their cleanup allowance. Existing appointments conservatively use at least the professional's current buffer. Expired holds are ignored; malformed active intervals stop availability for review rather than inventing openings.
- Minimum notice and the professional's configured date window are enforced on the server. Supported configuration bounds are duration 1–480 minutes, buffer 0–120 minutes, notice 0–2160 hours, and booking window 1–90 days. Unsupported configurations are not bookable.
- Missing DST wall-time boundaries produce no weekly window. Ambiguous boundaries use the later opening and earlier closing conservatively. Displayed slots include a time-zone abbreviation/offset; stored instants are UTC. Explicit exception intervals can represent approved unusual hours.
- At most three requests/waitlist/proposal records may await a response for one customer. Pending requests do not auto-confirm or auto-expire. Staff must resolve old pending records; customer withdrawal remains limited to future/untimed unconfirmed requests.

These limits are staging defaults to review with the shop, not newly asserted business policies. Query results are bounded (500 options, 100 daily weekly windows, and 1,000 records in each schedule input set); exceeding a bound stops the request rather than silently omitting blockers.

## Concurrency and migrations

Apply migrations through `0005_customer_booking_requests.sql`. This adds request keys/fingerprints, the stored reservation end, a unique customer/request-key index, and a singleton schedule revision maintained by SQL triggers on relevant tables. It deletes no history and enables no accounts, booking flag, services, or staff.

A D1 read batch captures schedule inputs and revision together. The final insert requires that exact revision plus a still-active verified session, current notice, and the pending-request limit. The appointment insert itself increments the revision. Two requests reading the same opening cannot both commit: the first changes the revision; the second must refresh. Appointment and audit events are inserted in that same transaction and roll back with it.

The implementation uses [D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch) and [SQLite triggers](https://www.sqlite.org/lang_createtrigger.html). The runtime test applies complete trigger statements using explicit SQL comment delimiters. Standard Wrangler migrations consume the file as ordinary SQL.

The revision is intentionally global for this shop-scale first implementation: an unrelated relevant edit can cause a safe retry. Measure contention in staging before considering scoped revisions. Future staff APIs must preserve the triggers and independently validate their own transitions; these triggers invalidate customer snapshots, but do not authorize or validate arbitrary staff SQL writes. Never bypass them in an importer while booking is enabled. New schedule-affecting tables require inclusion in the revision model.

## Validation and rollout

The local check covers 97 tests: 58 retained adapter tests, 36 API tests, and three wall-time tests. Booking coverage includes eligibility, overrides, buffers, exceptions, holds, notice/windows, returning clients, cross-location conflicts, malformed intervals, quote changes, input spoofing, idempotency, rollback, pending limits, and edits/session revocation between read and write. Workers/D1 checks two different customers competing for one opening, duplicate simultaneous submission, and record isolation for the losing customer. No real emails are sent by these tests.

For restricted staging, apply all migrations, configure the existing account service, and use test-only approved professional/service/location/schedule data. Set `CUSTOMER_BOOKING_ENABLED=true` only in that isolated environment. The repository default stays false and the production check enforces it. No staff setup/admin mutation endpoints or automatic production seed have been added. `server/api.test.ts` and `scripts/check-worker.mjs` contain reproducible synthetic fixtures; they are not real business data.

Browser acceptance is still required: keyboard/radio navigation, mobile form/zoom behavior, time-zone labels, changed-price review, lost-response retry, Back/Refresh history, expired sessions, and the disabled-flag transition. Measure API latency, D1 reads/writes, global-revision contention, and the growing schedule limits using representative data. No browser testing or hosted deployment was performed in this slice.

Do not enable public requests until the following next slice is accepted:

1. **Barber request queue and approval.** Reuse the customer identity and detail patterns; add approved-professional guards and assigned/requested-professional ownership. Implement atomic confirm/decline transitions, stale-state checks, audit events, and stronger authentication for operational access. Test cross-barber reads, role/setup removal, and confirmation racing withdrawal.
2. **Notification delivery.** Add a transactional outbox and retrying delivery for request, confirmation, decline, and withdrawal; distinguish saved events from delivered messages. Verify real provider delivery and failures. This slice writes appointment/audit events only and sends no appointment notifications.
3. **Operational policies and complete schedules.** Approve notice/buffer/window rules, pending limits/expiry, cancellation/rescheduling rules, and the provider handover/import. Demonstrate that all real commitments are represented before using native availability.

Manager/owner dashboards can then extend the same account shell with separately authorized shop-wide actions, audit review, and settings. Commerce/payment operations remain separate.

To stop new requests, set `CUSTOMER_BOOKING_ENABLED=false`; existing account history/details and allowed withdrawals continue. Do not erase saved requests during rollback. Earlier releases can read the additive schema, but disabling the flag or rolling back code does not notify customers or clear pending commitments. Reconcile those with the shop before cutover.
