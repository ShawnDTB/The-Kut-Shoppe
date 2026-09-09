# Customer deployment runbook

Status: review implementation, not deployed. The live WordPress site and production domain have not been changed. `ACCOUNTS_ENABLED=false` is the committed default.

## Local validation

Use Node 22.13 or newer; `.nvmrc` selects Node 22. Install with `npm ci`, then run `npm run check`.

The check runs TypeScript, ESLint, the original 58 browser-adapter tests plus 16 new API integration tests, static prerendering, the existing bundle budgets, production output checks, and a real local Cloudflare Workers/D1 runtime test. The runtime test replaces only outbound Turnstile/email delivery with test responses; no real email is sent, and no cloud database is created. It exercises native scrypt, signup, one-use verification, login, profile persistence, private history, and session revocation. It uses the same Miniflare version pinned by Wrangler.

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
2. Review and apply `migrations/0001_unified_platform.sql` followed by `0002_customer_accounts.sql` to that empty database. The repository explicitly described 0001 as unapplied; this branch changes `users.phone` from NOT NULL to nullable in that baseline. **If any environment has already applied the old baseline, do not treat this as an upgrade migration:** prepare a separately tested table-rebuild migration and backup/restore plan. Do not drop customer tables to make it fit.
3. Set `APP_ORIGIN` to the exact HTTPS origin, without a path. Do not derive trusted origin from a browser-supplied host header. Stage behind an access restriction and prevent indexing.
4. Configure the values below separately for preview and production. Use Cloudflare secrets for private values. Do not copy `.dev.vars` to an artifact or commit it.
5. Enable `ACCOUNTS_ENABLED=true` only after the database, origin, keys, and mail sender are correct and the staging release gates below are satisfied. Keep it false in the public production environment until release approval.

| Variable/binding | Where it belongs | Purpose |
|---|---|---|
| `DB` | D1 binding | Account, session, profile, history, throttling, and audit tables |
| `APP_ORIGIN` | Server environment | Exact browser/API origin and allowed HTTPS host |
| `ACCOUNTS_ENABLED` | Server environment | Explicit operational account gate |
| `AUTH_SECRET` | Server secret, random and at least 32 characters | HMACs for session tokens, challenge codes, and throttle keys; generate with a cryptographic random source |
| `TURNSTILE_SITE_KEY` | Server environment, intentionally returned by `/api/v1/config` | Public widget key for the configured hostname |
| `TURNSTILE_SECRET_KEY` | Server secret | Validates widget tokens with Cloudflare |
| `RESEND_API_KEY` | Server secret, email-send scope | Transactional verification and recovery delivery |
| `MAIL_FROM` | Server environment | Approved sender on a verified domain |

The API exposes the site key only. It never returns private keys, token hashes, password hashes, or codes. `VITE_*` variables are public browser configuration; they are not a secret store.

The deployment target remains the established Cloudflare Pages + Functions + D1 architecture. `public/_routes.json` sends only `/api/*` into Functions. Static pages are prerendered into `dist`. No new Sites deployment or other cloud vendor was created by this work. Email is implemented through Resend; switching providers should replace the server mail adapter, without changing customer identity.

## Implemented security controls

| Boundary | Current implementation |
|---|---|
| Passwords | Server-only native scrypt, N=32768, r=8, p=3, random 16-byte salt, 64-byte result, timing-safe comparison; 15–128-character new passwords; no client hashes accepted |
| Session | Cryptographically random 256-bit token; only HMAC stored in D1; `__Host-` cookie with Secure, HttpOnly, SameSite=Lax, Path=/; no Domain attribute |
| Lifetime | Seven-day absolute expiry; 12-hour customer idle expiry; 30-minute elevated-role idle expiry; account status and role re-read on authenticated requests |
| Recovery | Eight-digit cryptographically random email code; challenge-specific HMAC; ten-minute expiry; five failed attempts; atomic one-time claim; reset revokes previous sessions and requires a new login |
| Mutations | Exact Origin check, custom request header, JSON content type, bounded streaming request body, strict field allowlists, parameterized SQL |
| Abuse | Turnstile verified server-side including hostname and action; per-IP and per-email throttles before credential hashing; additional password/code limits |
| Data isolation | `/me` derives immutable user ID from the session; profile writes and history reads are scoped to that ID; no client-selected customer ID, no automatic email/phone claims |
| Response minimization | Explicit returned fields; no staff/internal notes, guest contact details, payment references, credential fields, or raw SQL errors |
| Caching | Private/no-store API responses; account/staff/admin cache and indexing headers; no public source maps |
| Audit | Sign-in, verification, recovery, password changes, profile changes, and session revocation events; no password/code payloads in logs |
| Prototype separation | Old account/booking/commerce UI is an explicit development-only import; production output check rejects legacy browser auth keys |

The password choice follows one of [OWASP's scrypt profiles](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Cloudflare's [native crypto documentation](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/) excludes native Argon2, so this implementation uses supported native scrypt rather than adding a WASM password library. Runtime CPU/memory must still be measured under staging concurrency before opening signup. The initial proposal's Argon2id requirement is superseded by this specific reviewed choice.

Session design follows the relevant [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html). Atomic code consumption and password/session changes use [D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/). Turnstile is checked using its [server-side validation API](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/). Email uses the [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email).

## Release gates that remain open

- **Real provider delivery:** verify sender identity, SPF/DKIM/DMARC, deliverability, failed/slow delivery, resend behavior, and Turnstile with the actual staging hostname. Local tests do not prove these integrations are configured.
- **Browser acceptance:** complete signup, recovery, phone/address edits, sign-out, and two-device sessions on desktop and mobile. Check 320/375/390/430/768/1024px and desktop; keyboard order, zoom, password-manager autofill, error feedback, expired sessions, and Turnstile loading under the real CSP. Browser/visual QA was not performed in this turn.
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

The API removes expired throttle entries and expired/revoked sessions during account traffic. Expired challenges are removed after a further day. Account/credential/profile rows and audit events are retained until an approved operational policy is implemented. Unverified account cleanup and any email-provider retention controls still need a scheduled policy before launch. Turning off account access is not data deletion.

Rotating `AUTH_SECRET` invalidates existing session tokens and challenge hashes; plan a forced re-login, and do not describe it as a seamless rotation. Password recovery invalidates older challenges for that user. Successful password changes and “sign out on every device” revoke sessions server-side.

Current history reads return at most 100 linked appointments and 100 orders. Add pagination before this limit becomes a customer-facing constraint. A guest booking belongs to no account until a server-verified claim establishes ownership. Never infer a claim from an editable email or phone alone.

## Rollout and rollback

Start with a restricted staging environment using test accounts. Review the source changes, migrate staging, complete the acceptance gates, then create an explicit production configuration with its own D1 database and service credentials. Preserve the current WordPress/provider-booking operation until a concrete cutover is approved.

For an account-service incident, set `ACCOUNTS_ENABLED=false`, revoke affected sessions if needed, and keep public booking directed to the existing providers. Deploy the last known good compatible build. Database migrations require their own recovery plan; rolling back JavaScript does not reverse a schema change. Do not point an old browser-prototype build at a real customer database.
