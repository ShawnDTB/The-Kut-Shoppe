# Professional requests and appointment notices

Implemented on `dev-branch`, 2026-09-10. Apply additive migration `0006_staff_requests_notifications.sql` after 0005. No deployment, real email, role assignment, or provider cutover was performed.

## Shared account experience

Staff/manager/owner/admin accounts have a Professional requests section beside their personal account sections. The server independently checks the current role, active verified account, and approved professional profile. Missing/draft setup, pending approval, disabled profiles, and ineligible accounts have distinct states. Setup directs the person to the shop; self-service professional onboarding is not implemented yet.

Approved professionals can page through their own pending website requests, oldest first, review the customer name, requested time, service, location, recorded price, and customer note, and confirm or decline. The API excludes customer email/address/phone, internal notes, payment references, and authentication fields. Guest/provider/staff-created appointments are outside this queue. Manager/owner/developer roles do not grant shop-wide authority through these endpoints: they need their own approved professional profile and can act only on its records.

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/me/professional` | Current setup/access state |
| `GET /api/v1/me/professional/requests` | Own queue, 25 records per page, signed account/profile-bound cursor |
| `GET /api/v1/me/professional/requests/:id` | Own website request detail, including its resolved state |
| `POST /api/v1/me/professional/requests/:id` | Confirm or decline after a fresh password check |

## Decision boundary

Every decision requires the current password, record `updatedAt`, UUID-v4 `decisionKey`, and an allowlisted action. Passwords are cleared after each attempt and never stored in browser storage. Repeating the same key/action returns the saved result; contradictory or stale decisions are rejected.

Confirmation reuses server scheduling, excluding only the request itself from conflict checks. The start/end must still fit current availability, service duration, and buffer. Notice is not reapplied to an existing request, but its start must remain in the future. Recorded price is preserved. Changed duration, reduced saved cleanup allowance, invalid times, unavailable eligibility, or new conflicts require schedule review; the API does not silently move or reprice the visit. Decline can resolve an old/untimed pending request without reserving time.

The final transaction rechecks schedule revision for confirmation, appointment scope/status/version, current professional approval/role, active verified session, and the credential hash just verified. It saves assignment/status/receipt, appointment and audit events, and recipient notifications together. Notification insertion failure rolls back the decision. Confirmation racing customer withdrawal permits one transition.

`STAFF_OPERATIONS_ENABLED=false` remains the committed default. Fresh-password checks are defense in depth for restricted staging, **not MFA**. Public operational access still requires stronger staff authentication. No browser role editor, owner bootstrap, or shop-wide mutation API was added.

## Appointment notices

New requests, withdrawals, confirmations, and declines queue notices for the linked customer and professional, avoiding duplicate recipients when they are the same user. The new `appointment_notifications` table is separate from the legacy prototype `notification_outbox`; prototype messages are never dispatched.

Emails contain a general appointment-update notice and a trusted sign-in link to the relevant account section. They exclude customer name, appointment notes/date/service/price, and record IDs. They do not announce a specific appointment status; the account shows the current state even when emails are delayed or reordered.

The dispatcher resolves the current verified email on first attempt and checks the current customer/professional relationship. It freezes the payload and recipient before contacting Resend. Changed recipients or removed professional eligibility suppress retries for operational review. A change can still occur between the last database check and external provider acceptance; generic email content limits exposure during this unavoidable interval. Email supplements account history.

`server/notification-worker.ts` is a separate scheduled Worker using the same D1 database. `wrangler.notifications.toml` has placeholder bindings, `workers_dev=false`, and `APPOINTMENT_EMAIL_ENABLED=false`. There is no public HTTP dispatch endpoint. The account API only queues notices.

Each run considers ten due rows. Two-minute leases prevent concurrent claims and expire after a crash. Retries use the same [Resend idempotency key and frozen payload](https://resend.com/docs/dashboard/emails/idempotency-keys), backoff, at most eight attempts, and a twenty-hour first-attempt cutoff. The provider retains keys for twenty-four hours; automatic retry stops earlier rather than risking a duplicate outside that window. Permanent rejections become failed rows; rate limits, timeouts, and transient failures retry within the bound.

States: `queued`, `sending`, `retry`, `accepted`, `failed`, `suppressed`. **Accepted means provider API acceptance, not inbox delivery.** Delivery/bounce webhooks remain outstanding. Accepted/suppressed rows discard destination/payload; failed rows retain these for controlled review. Define retention and incident ownership before production. Never blindly reset failed rows or mint new keys for uncertain deliveries.

## Restricted staging and rollback

1. Apply migrations through 0006, configure the account service, and use synthetic customers with explicitly approved test professionals. The migration seeds no real staff, appointments, or notifications.
2. Enable `STAFF_OPERATIONS_ENABLED` only in restricted staging. `CUSTOMER_BOOKING_ENABLED` separately controls new requests. Public staff access must wait for stronger authentication.
3. Configure the notification Worker's DB binding to the same isolated database, a trusted HTTPS `APP_ORIGIN`, approved `MAIL_FROM`, and server-only `RESEND_API_KEY`. It needs no customer authentication secret. Enable `APPOINTMENT_EMAIL_ENABLED` only for approved test recipients/sender.
4. Deploy the scheduled Worker separately when authorized. A Pages deploy does not deploy this Worker. Verify its [Cron Trigger](https://developers.cloudflare.com/workers/configuration/cron-triggers/), monitor redacted batch counters and queue backlog/status, and test real delivery, rejection, delay, recipient changes, and failure review. Hosting/secrets were not provisioned here.

Disabling staff operations stops professional reads/decisions, not customer history. Disabling email dispatch leaves queued events and saved appointment states intact. Disabling account access alone does not stop the scheduled Worker. During an incident, disable each affected flag and preserve decisions/receipts. There is no historical-notification backfill or automatic schema rollback.

## Validation and next work

Current suite: 107 tests (58 retained adapter, 46 API, three wall-time). New coverage checks setup/access states, cross-professional/owner isolation, password/field guards, stale/conflicting decisions, role removal during a write, pagination, transactional notification failure, disabled dispatch, frozen retries, recipient changes, expired leases, permanent rejection, and the retry cutoff.

Runtime tests bundle the actual Pages `onRequest` handler and scheduled Worker offline with the existing Vite dependency, then use the pinned Workers/Miniflare runtime and real D1. No cloud deployment CLI is invoked. Tests cover confirmation versus withdrawal, duplicate decisions, transactional recipients, and competing scheduled runs; provider delivery is mocked. Production Pages packaging and hosted bindings remain staging checks.

Browser acceptance remains outstanding for mobile/keyboard navigation, pagination, password managers, expired access, uncertain decisions, and refresh. No visual/browser testing was performed.

Next: stronger staff authentication and approved professional onboarding/schedule management, followed by separately authorized manager/owner operations. Before public native booking, finish real sender/delivery acceptance, schedule completeness, business policies, and monitoring. Payments, refunds, and rescheduling remain separate workflows.
