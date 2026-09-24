# Customer deployment runbook

**Current release:** start with [release readiness](release-readiness.md). Apply
all migrations through **0013**. The milestone updates and test totals below are
historical; they do not override the current release checklist. The detailed
security, baseline compatibility and provider-acceptance guidance still applies.

Latest milestone: apply migrations through **0010** and read [appointment cancellation requests](appointment-cancellation.md). Existing confirmed website visits can now accept customer cancellation requests for assigned-professional review. Local review applies the migration automatically; no hosted resources have been changed.

Current recovery: apply migrations through **0009** and read [shop and booking recovery](restored-commerce-and-booking.md). Commerce request APIs use the independent `COMMERCE_ENABLED` setting, enabled automatically for local review and false in committed hosted defaults. Historical test counts and migration notes below describe earlier milestones; `npm run check` is the current verification gate.

For immediate end-to-end local review, use [working local review](local-review.md): `npm run review` enables the implemented account/booking/staff features against isolated persistent local D1, with generated local sign-ins and an account-email inbox. Hosted service provisioning remains separate.

Latest follow-up: [Assigned professional visits](staff-visits.md) adds protected upcoming/active lists and visit details using the existing staff-operations/MFA gates. No migration after 0008 is needed. Current coverage is 147 tests plus real local Workers/D1 checks; hosted browser acceptance and deployment remain outstanding.

Latest scheduling follow-up: [Professional availability management](professional-scheduling.md) adds weekly windows/time off behind the existing staff-operations and MFA gates. No migration after 0008 is required. Current coverage is 143 tests plus real local Workers/D1 concurrency checks, including time off racing a customer booking. Saved availability remains effective if staff editing is disabled; disable native booking separately to stop new requests.

Latest follow-up: apply `0008_professional_setup.sql` after 0007 before running this version. Read [Professional setup and owner review](professional-onboarding.md) for submission/approval, the independent `STAFF_SETUP_ENABLED=false` gate, and rollback behavior. [Staff authenticator verification](staff-authentication.md) covers the required `MFA_ENCRYPTION_KEY` server secret. The current 135-test check also exercises MFA, onboarding, staff decision, and scheduled notification races with offline compilation; real provider and browser acceptance remain outstanding.

Status: review implementation, not deployed. The live WordPress site and production domain have not been changed. `ACCOUNTS_ENABLED=false` is the committed default.

## Local validation

Use Node 22.13 or newer; `.nvmrc` selects Node 22. Install with `npm ci`, then run `npm run check`.

The check runs TypeScript, ESLint, 58 browser-adapter tests, 66 API integration tests, three wall-time tests, and eight authenticator tests (135 total), static prerendering, bundle budgets, production output checks, and real local Cloudflare Workers/D1 runtime tests. External Turnstile/email delivery is replaced with test responses; no real email is sent and no cloud database is created. Coverage includes the account/MFA lifecycle, professional submission/approval races, customer records, booking/staff decisions, and scheduled notices. It uses the same Miniflare version pinned by Wrangler.

For the static site plus local Pages API:

```bash
npm run build
npm run db:local
npm run dev:api
```

Open `http://localhost:8788`. Without service configuration, the account page explains that access is not open. This is intentional. An API failure must never silently authenticate through localStorage.

For disposable review of the older booking/commerce/staff designs, copy `.env.example` to `.env.local`, set `VITE_LOCAL_PLATFORM_PREVIEW=true`, and run `npm run dev`. The preview displays a warning and uses made-up data only. The flag has no effect on a production build. There is no supported path for uploading browser account records, password hashes, roles, or verification flags into production.

For real local account testing, copy `.dev.vars.example` to `.dev.vars` and configure actual domain-authorized service keys for localhost and a verified sender. The primary local runtime uses `APP_ORIGIN=http://localhost:8788`. The optional Vite `/api` proxy requires `APP_ORIGIN=http://localhost:5173` and an accompanying Pages runtime; verify its origin/cookie behavior before relying on that development arrangement.

## Staging configuration

Complete and review these steps before enabling customer accounts:

1. Create a distinct Cloudflare Pages project or preview environment and an isolated staging D1 database. Replace the all-zero `database_id` placeholder in `wrangler.toml` with the staging database ID. The placeholder is not an existing resource.
2. Review and apply the migrations in order: `0001_unified_platform.sql`, `0002_customer_accounts.sql`, `0003_customer_account_controls.sql`, then `0004_customer_record_details.sql`. The repository explicitly described 0001 as unapplied; the foundation changed `users.phone` from NOT NULL to nullable in that baseline. **If any environment has already applied the old baseline, do not treat this as an upgrade migration:** prepare a separately tested table-rebuild migration and backup/restore plan. Do not drop customer tables to make it fit. An environment already running the updated 0001 and 0002 needs additive 0003 and 0004; one running through 0003 needs only 0004. Back up first and apply outstanding migrations before deploying this code. Existing pending verification/recovery codes become invalid after 0003 because they lack an email snapshot; request new codes. Accounts and history are preserved.
3. Set `APP_ORIGIN` to the exact HTTPS origin, without a path. Do not derive trusted origin from a browser-supplied host header. Stage behind an access restriction and prevent indexing.
4. Configure the values below separately for preview and production. Use Cloudflare secrets for private values. Do not copy `.dev.vars` to an artifact or commit it.
5. Enable `ACCOUNTS_ENABLED=true` only after the database, origin, keys, and mail sender are correct and the staging release gates below are satisfied. Keep it false in the public production environment until release approval.

| Variable/binding | Where it belongs | Purpose |
|---|---|---|
| `DB` | D1 binding | Account, session, profile, history, throttling, and audit tables |
| `APP_ORIGIN` | Server environment | Exact browser/API origin and allowed HTTPS host |
| `ACCOUNTS_ENABLED` | Server environment | Explicit operational account gate |
| `AUTH_SECRET` | Server secret, random and at least 32 characters | HMACs for session tokens, challenge codes, and throttle keys; generate with a cryptographic random source |
| `MFA_ENCRYPTION_KEY` | Separate Pages server secret, 32 random bytes encoded as 64 hex characters | Encrypts staff authenticator seeds; required before MFA setup or staff access; preserve restricted backups |
| `TURNSTILE_SITE_KEY` | Server environment, intentionally returned by `/api/v1/config` | Public widget key for the configured hostname |
| `TURNSTILE_SECRET_KEY` | Server secret | Validates widget tokens with Cloudflare |
| `RESEND_API_KEY` | Server secret, email-send scope | Transactional verification and recovery delivery |
| `MAIL_FROM` | Server environment | Approved sender on a verified domain |

Public configuration exposes only the intended public settings/site key. It never returns server secrets, token hashes, or password hashes. Protected MFA setup deliberately returns the user's setup seed and, after confirmation, recovery codes once in no-store responses. `VITE_*` variables are public browser configuration; they are not a secret store.

The deployment target remains the established Cloudflare Pages + Functions + D1 architecture. `public/_routes.json` sends only `/api/*` into Functions. Static pages are prerendered into `dist`. No new Sites deployment or other cloud vendor was created by this work. Email is implemented through Resend; switching providers should replace the server mail adapter, without changing customer identity.

## Implemented security controls

| Boundary | Current implementation |
|---|---|
| Passwords | Server-only native scrypt, N=32768, r=8, p=3, random 16-byte salt, 64-byte result, timing-safe comparison; 15–128-character new passwords; no client hashes accepted |
| Session | Cryptographically random 256-bit token; only HMAC stored in D1; `__Host-` cookie with Secure, HttpOnly, SameSite=Lax, Path=/; no Domain attribute |
| Lifetime | Seven-day absolute expiry; 12-hour customer idle expiry; 30-minute elevated-role idle expiry; account status and role re-read on authenticated requests |
| Staff MFA | Encrypted TOTP, one-use recovery codes, 15-minute session grants, database-enforced role/version/expiry checks; password recovery preserves enrollment |
| Recovery | Eight-digit cryptographically random email code; challenge-specific HMAC; ten-minute expiry; five failed attempts; atomic one-time claim; reset revokes previous sessions and requires a new login |
| Email changes | Current password plus distinct codes sent to both current/new inboxes; ten-minute expiry; five failed attempts; initiating-session binding; atomic address update and revocation of all sessions and old recovery codes |
| Mutations | Exact Origin check, custom request header, JSON content type, bounded streaming request body, strict field allowlists, parameterized SQL |
| Abuse | Turnstile verified server-side including hostname and action; per-IP and per-email throttles before credential hashing; additional password/code limits |
| Data isolation | `/me` derives immutable user ID from the session; profile writes and history reads are scoped to that ID; no client-selected customer ID, no automatic email/phone claims |
| Response minimization | Explicit returned fields; no staff/internal notes, guest contact details, payment references, credential fields, or raw SQL errors |
| Caching | Private/no-store API responses; account/staff/admin cache and indexing headers; no public source maps |
| Audit | Sign-in, verification, recovery, password/email changes, profile changes, and session revocation events; no password/code payloads in logs |
| Prototype separation | Old account/booking/commerce UI is an explicit development-only import; production output check rejects legacy browser auth keys |

The password choice follows one of [OWASP's scrypt profiles](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Cloudflare's [native crypto documentation](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/) excludes native Argon2, so this implementation uses supported native scrypt rather than adding a WASM password library. Runtime CPU/memory must still be measured under staging concurrency before opening signup. The initial proposal's Argon2id requirement is superseded by this specific reviewed choice.

Session design follows the relevant [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html). Atomic code consumption and password/session changes use [D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/). Turnstile is checked using its [server-side validation API](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/). Email uses the [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email).

## Customer controls added on dev-branch (2026-09-10)

The customer foundation is carried forward from `codex/customer-foundation`, followed by the email-change/history work directly on `dev-branch`. `main`, the WordPress site, domain settings, and hosted databases are unchanged.

### Email change acceptance

Open Account → Security → Change sign-in email. Supply a new address and the current password. Stay on the same signed-in device and page while checking both inboxes; this UI deliberately does not persist passwords, codes, or challenge IDs in browser storage. Navigation/reload requires starting a new request. Cancel invalidates the pending request; sending a new request replaces earlier codes.

This follows the current-password and dual-inbox confirmation principle in [OWASP's non-MFA email-change guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#changing-a-users-registered-email-address). It is not an MFA implementation or a security certification. Losing the old inbox still requires a separately verified support process; phone/profile data cannot bypass proof of ownership.

The API changes the email only after both codes succeed in one transaction. The immutable user ID remains the same, preserving linked history. It revokes every session and invalidates old verification/recovery codes. Password changes, recovery, and all-device sign-out also invalidate pending email changes. Login/session issuance and new recovery challenges reject stale email/credential snapshots. Confirmation is bound to the initiating session; another signed-in device cannot complete it. Delivery failure leaves no usable change request. Destination collisions leave the losing account unchanged.

Automated coverage checks these boundaries, swapped/incorrect/expired codes, cancellation, replacement, replay, cross-account and cross-session attempts, and two concurrent confirmations in the real Workers runtime. Staging must still verify actual delivery to both inboxes, delayed/failed delivery, mobile email-app switching, password-manager behavior, session expiry mid-flow, and support handling for a lost inbox.

### History acceptance

The customer dashboard now reads `GET /api/v1/me/appointments` and `GET /api/v1/me/orders`, 25 records per page, with Load more and Refresh history controls. Each list has independent loading/error state; a failed next page retains previously loaded records. Sign-out failures are visible from every account section.

Cursor signatures are tied to the authenticated customer and list type. The server still applies `customer_user_id` to every query; a cursor is not an authorization credential. Deterministic date/ID ordering handles equal dates and untimed appointments. Matching SQL indexes are verified with query plans. Tests retrieve 110 owned records without duplicates and exclude another customer and a guest whose email matches. The runtime test verifies that history remains available after changing email. This is live keyset pagination, not a frozen snapshot: if appointment times change while paging, Refresh history starts a fresh list.

The original `/me/overview` endpoint remains a compatibility read capped at 100 per list. New dashboard code does not use it. Do not build new full-history views against that endpoint. Booksy/GlossGenius still do not sync automatically; native changes and guest claims remain future server workflows.

### Appointment and order details

Apply additive migration `0004_customer_record_details.sql` before serving this version. It adds a withdrawal receipt and an order-item index without deleting history. The prior release can run against this additive schema; JavaScript rollback does not undo recorded withdrawals.

Appointments and Orders now link to private detail views with direct URLs and Back/Refresh controls. Record IDs are navigation identifiers, never access credentials. Even an owner-role session can use these `/me` endpoints only for its own records. Unknown, guest, and other-customer records return the same 404 response.

Customers can withdraw a future or untimed, unconfirmed website request or waitlist entry after an explicit confirmation. A transaction checks ownership, source, status, record version, and active verified session, then records the cancellation, appointment event, and audit event together. Repeated submissions produce one transition and one event. Confirmed appointments, proposals, past requests, staff/walk-in/migration records, and provider bookings cannot be cancelled through this action. No appointment email or staff notification is sent by this slice; operational notification delivery remains part of the native booking milestone.

Confirmed visits with valid offset-qualified start/end times can be downloaded as a static `.ics` calendar copy. UTC timestamps preserve the actual instant through daylight-saving transitions. Text is escaped and folded by UTF-8 byte length. The file excludes customer notes, contact details, and credentials. The UI explains that downloaded copies do not update and a calendar provider may store them. Validate import on the intended mobile/desktop calendar apps during browser acceptance.

Order details expose saved line-item names, quantities, prices, totals, fulfillment, allowlisted shipping address fields, and a plain tracking number. They exclude internal notes, payment references, and arbitrary stored JSON. Up to 100 line items are shown with an explicit completeness notice; totals remain the whole order's recorded totals. This is not a checkout, refund processor, or proof that payment succeeded.

Current validation: 87 tests (58 existing adapter tests and 29 API tests), including record isolation, stale and invalid withdrawals, transaction rollback, calendar injection/DST handling, historical item snapshots, and bounded shipping disclosure. Workers/D1 also checks concurrent withdrawal idempotency and calendar/detail responses. Browser acceptance and real staging integration remain outstanding.

### Server availability and customer requests

The next customer slice is implemented behind `CUSTOMER_BOOKING_ENABLED=false`. Apply migration `0005_customer_booking_requests.sql` after 0004 before testing it. An environment already through 0004 only needs additive 0005. See [Customer booking requests](customer-booking-engine.md) for the API, schedule rules, retry/transaction model, staging setup, and rollback. The current check covers 97 tests plus real Workers/D1 booking races.

Keep the flag disabled publicly until approved staff can respond to requests, appointment notifications are delivered reliably, operational authentication is accepted, and the native schedule includes all real provider commitments. No appointment notification is sent yet. Browser acceptance remains outstanding. Disabling requests does not erase existing requests or disable account history.

## Release gates that remain open

- **Real provider delivery:** verify sender identity, SPF/DKIM/DMARC, deliverability, failed/slow delivery, resend behavior, and Turnstile with the actual staging hostname. Local tests do not prove these integrations are configured.
- **Browser acceptance:** complete signup, recovery, phone/address edits, dual-inbox email changes, history pagination/retries, sign-out, and two-device sessions on desktop and mobile. Check 320/375/390/430/768/1024px and desktop; keyboard order, zoom, password-manager autofill, error feedback, expired sessions, and Turnstile loading under the real CSP. Browser/visual QA has not been performed for these customer changes.
- **Independent security review:** threat-model and review custom account endpoints, authentication enumeration/timing behavior, concurrent code consumption, replay, cookie handling, throttling at distributed scale, and direct attempts to reach staff/admin APIs. Unit/runtime tests are evidence, not a security certification.
- **Edge configuration and capacity:** verify forced HTTPS, TLS, origin mapping, public caching behavior, edge rate limits, appropriate Workers CPU allowance, and load/memory behavior for password hashing. Application throttling alone is not a distributed-abuse control.
- **Privileged access:** do not activate operational staff/admin endpoints before MFA or equivalent step-up authentication, server capability checks, approved staff setup, owner bootstrap, and role-change audit/revocation are implemented. Browser role changes are never authoritative.
- **Privacy operations:** appoint the person handling access/deletion requests, define identity verification for those requests, document retention periods and legal exceptions, and demonstrate the process. The UI currently directs customers to the shop; there is no automated export/deletion system or unattended promise that a request was processed.
- **Backup and recovery:** create a staging backup, restore it into a fresh isolated database, reconcile row counts and ownership, and rehearse rollback. Confirm access controls and retention for backups themselves.
- **Business content:** approve hours, service prices, staff participation, legal pages, provider disclosures, and final booking/commerce policy. Existing content verification markers remain authoritative.
- **Assets and external dependencies:** migrate approved WordPress-hosted images before retiring WordPress; choose a final social preview; review external font/map requests and privacy disclosures.
- **Actual booking and commerce:** finish the separately authorized server workflows before enabling native appointment or order submissions. The history API cannot manufacture integration with Booksy or GlossGenius.
- **Dependencies and monitoring:** review the locked dependency inventory/advisories, configure failure alerts with redacted logs, and establish an accountable incident response contact.

## Data retention and recovery notes

The API removes expired throttle entries and expired/revoked sessions during account traffic. Expired verification/recovery challenges are removed after a further day; expired or completed email-change requests are removed during the next account request. Their current/new addresses are retained until that cleanup; cancellation and password recovery/change remove pending email-change records immediately. Account/credential/profile rows and audit events are retained until an approved operational policy is implemented. Unverified account cleanup and any email-provider retention controls still need a scheduled policy before launch. Turning off account access is not data deletion.

Rotating `AUTH_SECRET` invalidates existing session tokens and challenge hashes; plan a forced re-login, and do not describe it as a seamless rotation. Password recovery invalidates older challenges for that user. Successful password changes and “sign out on every device” revoke sessions server-side.

Customer-facing history reads are paginated; the original overview endpoint is a bounded compatibility read. A guest booking belongs to no account until a server-verified claim establishes ownership. Never infer a claim from an editable email or phone alone.

## Rollout and rollback

Start with a restricted staging environment using test accounts. Review the source changes, migrate staging, complete the acceptance gates, then create an explicit production configuration with its own D1 database and service credentials. Preserve the current WordPress/provider-booking operation until a concrete cutover is approved.

For an account-service incident, set `ACCOUNTS_ENABLED=false`, revoke affected sessions if needed, and keep public booking directed to the existing providers. Deploy the last known good compatible build. Database migrations require their own recovery plan; rolling back JavaScript does not reverse a schema change. Do not point an old browser-prototype build at a real customer database.
