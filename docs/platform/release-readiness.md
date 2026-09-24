# Release readiness — September 22, 2026

This is the current release entry point. Older milestone documents describe their
historical state, not the current migration level or test count. A push to `main`
publishes source; it does not prove that the live site or its services are ready.

Validation on September 22: `npm run check` passed (207 application tests and 12
release-environment tests, typecheck, lint, build, bundle/output gates and local
Workers/D1 checks). Running `npm run releasecheck` without production settings
failed as intended. Hosted/browser acceptance was not performed. Publication was
blocked by a GitHub integration error and unavailable Git write authentication;
no remote branch, hosting configuration or database was changed during this pass.

## Scope and remaining work

| Area | Implemented in this release | Required before public activation |
|---|---|---|
| Public website | Restored Barber / Loctician booking entry, provider links, mobile navigation, static pages | Owner content approval, real-device acceptance, image hosting continuity |
| Customer accounts | Server sessions, verification/recovery, profile/security, scoped history | D1, secrets, real Turnstile and verified email, browser/security acceptance |
| Native booking | Availability, requests, staff decisions, cancellation and rescheduling | Approved schedules/policies, staff MFA, notification worker, Booksy migration/cutover |
| Staff operations | Professional setup, schedules, assigned visits, guest walk-ins | Verified owner bootstrap and employee access, actual shop-device acceptance |
| Store | Catalog, inventory reservations, unpaid order requests and fulfillment | Verified products/stock, shipping/tax policies, payment and refund integration |
| Documents | Booking/order acknowledgements and immutable sale estimates | These are **not paid receipts**; payment reconciliation and financial receipts remain unfinished |
| Employee compensation | Design only | Approved commission policies, earnings ledger and payroll integration; no employee withdrawals |

Do not switch off Booksy while simultaneously opening an unsynchronized native
calendar. The two systems do not share appointment availability. Employees are
paid through a reviewed payroll process, not a contractor marketplace payout flow.

## Reproducible code verification

Use Node 22.13+ and the committed lockfile:

```sh
npm ci
npm run check
```

`check` validates source, tests, static output, bundle budgets, production artifact
safety, and local Workers/D1 behavior. `productioncheck` checks the **built code**
and deliberately disabled committed defaults; it does not approve a live release.
`npm run review` runs the implemented workflows with isolated local data and
simulated mail/bot verification. Never use real customer data in that runner.

## Hosting preflight

The checked-in `wrangler.toml` is a safe local/staging template, **not production
configuration**: it contains localhost and an all-zero D1 ID. The notification
worker template also has an invalid example origin. Do not deploy either as-is.

1. Confirm the Cloudflare Pages project, production branch, build command/output,
   domain, and whether a push to `main` triggers a deployment. The repository's
   Quality workflow validates code; it does not deploy or migrate a database.
2. Provision isolated staging and production D1 databases. Back up existing data
   first; rehearse restore. Apply **all migrations through 0013**, in filename
   order, using the correct target environment. For existing installations, verify
   the baseline compatibility warning in the customer deployment runbook.
3. Configure Pages' `DB` binding and actual HTTPS `APP_ORIGIN`. Set private keys
   using the hosting secret store, never `VITE_*`, client code, a committed config,
   or a public build log. Use independent, cryptographically random authentication
   and MFA keys. Preserve encrypted MFA-key recovery access.
4. Configure the separate notification worker with the **same** database, origin,
   sender and email-provider configuration as Pages. Verify scheduled delivery and
   retries before enabling native booking.
5. Run the offline preflight with the intended release settings supplied securely
   as process environment variables:

   ```sh
   npm run releasecheck
   ```

   It reads `APP_ORIGIN`, all six feature flags from the templates (including
   `APPOINTMENT_EMAIL_ENABLED`), `AUTH_SECRET`, `MFA_ENCRYPTION_KEY`,
   `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, and `MAIL_FROM`.
   Also supply `D1_DATABASE_ID` and `NOTIFICATIONS_D1_DATABASE_ID` as preflight-only
   values copied from the intended bindings. These two variables **do not create
   or configure bindings**. The command prints field names/errors, never values.
   Do not paste secrets into chat. It does not read `.env` files automatically.
6. A passing preflight proves only basic shape/dependency checks. Independently
   verify the deployed bindings, applied migrations, real keys, provider hostname
   authorization, sender delivery, secure cookies, CSP, HTTPS and private caching.
   Local test credentials must never become production credentials.

The preflight does not change flags or remove features. Explicit false flags are
supported for an intentionally limited release. Such a release must be described
as limited, not a complete online booking/payment product.

## Acceptance and promotion

- Test customer registration, verification, recovery, profile changes, sessions,
  booking/cancellation/rescheduling and record ownership with separate accounts.
- Test owner and employee MFA, role boundaries, simultaneous appointment requests,
  walk-in transitions, stock conflicts, estimate retries and document printing.
- Test mobile navigation, keyboard use, zoom, errors and actual shop devices.
- Verify backup recovery, notification failures, redacted alerts, incident owner,
  customer privacy requests and approved retention rules (including immutable
  estimates). Have the owner approve business/legal content.
- Promote the exact tested commit without force-pushing. Respect branch protection
  and required checks. Retain the prior commit and database backup as rollback
  references. Deploy only after the target configuration has passed acceptance.
- Smoke-test `/`, `/book`, `/shop`, `/account`, `/api/v1/config` and authenticated
  flows on the real domain. A successful build or HTTP 200 alone is not acceptance.

On an incident, use the scoped operational flags and last compatible code release.
Code rollback does not undo migrations or customer transactions. Do not restore the
old browser-only authentication prototype over a real customer database.

## Decisions still needed for a finished financial product

Kash must approve and onboard a merchant processor, connect the business bank,
approve tax/shipping/refund rules and employee commission/payroll policies. Square
has been proposed, not selected or connected. Until payment, cash reconciliation,
refunds and verified payment webhooks are implemented and tested, do not label
estimates or unpaid order acknowledgements as receipts or mark orders paid.
