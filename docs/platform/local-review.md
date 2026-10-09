# Working local review

October 9: [Stripe sandbox checkout](stripe-sandbox-milestone.md) adds optional test-only card checkout for finalized bills in isolated named workspaces. It requires explicit opt-in and private test credentials; the default runner still makes no Stripe requests. Migrations now include 0018.

October 4: [account and dashboard review](accounts-review-2026-10-04.md) adds separate client, barber and management dashboards, staff account search/role changes, and individual session revocation. After MFA, managers/owners can open **Staff access** and grant a verified existing account professional access; professional profile approval remains a separate step.

Latest: the [original booking page](booking-page-restoration.md) restores the Barber/Loctician gateway, service rows, staged panels and weekly calendar on the current backend. Open `/book` with no query string. The [shop and booking recovery](restored-commerce-and-booking.md) also restores catalog, product, cart, unpaid checkout requests and protected product/order management. `/account` opens the dashboard overview.

```sh
git switch dev-branch
git pull origin dev-branch
npm ci
npm run review
```

Use Node 22.13 or newer. Open **http://localhost:8788/account** in Chrome or Edge. Use `localhost`, not a LAN address or `127.0.0.1`. Keep the terminal running and port 8788 free. The command builds the site before starting the real Pages API in the local Cloudflare runtime; restart it after code changes. `npm run dev` remains the frontend-only Vite command.

The terminal prints the local inbox URL and the generated credentials file: `.wrangler/review/accounts.json`. Open that file locally for the random passwords for `customer@example.test`, `staff@example.test`, and `owner@example.test`. These identities exist only in the review database. No shared password is committed.

## Reproducible review accounts and MFA

To preserve an older review database and start an isolated fixture, use a named workspace in PowerShell:

```powershell
$env:REVIEW_WORKSPACE = 'cohesion-2026-10-06'
npm run review
```

The name accepts 1–48 lowercase letters, digits, or hyphens. The runner stores its database, encryption keys, passwords, and authenticator setup keys under `.wrangler/review-cohesion-2026-10-06/`. The original `.wrangler/review/` is preserved. Reusing the name reuses the fixture; choose another name for a fresh dataset. Clear the environment variable to return to the default workspace.

New workspaces include customer, staff (barber), manager, and owner accounts. Open `accounts.json` locally for passwords. Named workspaces enroll staff MFA through the real API and save `authenticators.json` locally. Use its setup key in an authenticator, or one unused recovery code with the account password at the unlock form. Recovery codes work once; mark consumed codes in your review notes. Enrollment and unlock still use the normal production checks. Previously enrolled accounts without saved review keys are preserved; choose a new workspace instead of disabling their MFA.

These files contain **local test credentials only** and are ignored by Git. Keep the folder private to your Windows account, never upload it, and preserve its database and keys together. The runner does not print passwords or MFA secrets, expose them through the site, or change hosted accounts. A fresh browser session may be needed when switching workspaces at the same localhost origin.

## Review the implemented flows

| Area | Steps |
| --- | --- |
| Registration and recovery | Register using test information. Refresh the inbox URL printed in the terminal and enter the emailed code. |
| Profile and security | Edit contact details, change password/email, and revoke sessions. Email changes still require both inbox codes. |
| Customer booking | Choose the review professional and haircut, then request a future opening. Slots come from stored weekly hours. |
| Staff decisions and visits | Sign in as staff in another browser profile. Enroll an authenticator under account security, confirm the customer's request, and open Your visits. |
| Availability | Edit staff weekly hours and time off. Appointment conflict checks remain enforced. |
| Professional setup | The owner can submit a professional profile and review eligible submissions after MFA. The seeded staff account is already approved so booking can be tested immediately. |
| Shop and history | Choose a sample pomade variant, submit a pickup/shipping request, then inspect account order details. The owner processes it through `/admin/orders` after MFA. |

Use separate browser profiles for simultaneous customer/staff sessions. Staff MFA is not bypassed; save the local recovery codes when enrolling. The review haircut and daily 09:00–17:00 hours are test fixtures, not published shop prices or working hours. Changes are retained across restarts.

## Local services and persistence

The runner enables accounts, commerce requests, native booking requests, staff setup, and staff operations. It applies all repository migrations in order (currently 0001–0015) to a dedicated persistent local D1 database and generates separate authentication and MFA encryption keys. Application ownership checks, password hashing, secure cookies, MFA, and transaction safeguards are unchanged.

Account emails go to an in-memory inbox; no messages leave the computer. The inbox keeps at most 100 messages, clears on restart, and uses a fresh random access URL each run. Content is escaped instead of rendering provider HTML. Host/Origin checks and a loopback listener restrict access. Do not expose this runner through a tunnel or use real customer information.

The browser uses Cloudflare's [official development Turnstile site key](https://developers.cloudflare.com/turnstile/troubleshooting/testing/); loading its widget needs internet access. The runner simulates server-side anti-bot verification. This exercises the account flow, not real anti-bot enforcement or email delivery. These substitutions exist only in `scripts/review.mjs`, which is not a deployed entrypoint or public-bundle module.

The already ignored `.wrangler/review/` folder holds the database, keys, and generated credentials. Preserve them together. On Windows, protect the folder with your user-account permissions. To start over, stop the runner and remove that directory only when its test data is no longer needed. Nothing resets automatically.

## Outstanding before hosted activation or main release

- Isolated hosting/D1 resources, a trusted HTTPS origin, server secrets, configured Turnstile, and a verified email sender. Changing a placeholder database ID does not create a database.
- Verified owner/staff provisioning in that environment. The local bootstrap is never a production role-grant mechanism.
- Appointment email Worker deployment/scheduling and provider testing. This review inbox captures account mail only.
- Hosted acceptance of the implemented cancellation/rescheduling requests and staff review, with approved shop policies.
- Online payments, automated order email, tax/shipping quotes and refunds. Unpaid order requests and inventory reservations are implemented; these do not prove payment.
- Browser/mobile acceptance and the deployment runbook's release checks. Local API checks do not establish production readiness.

Running this review does not change `main` or the live Cloudflare site. This is a working local environment for implemented features, not a claim that every planned feature is finished.
