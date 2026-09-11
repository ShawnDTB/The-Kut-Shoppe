# Working local review

Latest: `/book` opens the native booking journey in this environment; after sign-in, select the service, professional, location, date and time. `/account` now opens the dashboard overview. See [functionality restoration](functionality-restoration.md) for the comparison with the earlier UI and the remaining features.

```sh
git switch dev-branch
git pull origin dev-branch
npm ci
npm run review
```

Use Node 22.13 or newer. Open **http://localhost:8788/account** in Chrome or Edge. Use `localhost`, not a LAN address or `127.0.0.1`. Keep the terminal running and port 8788 free. The command builds the site before starting the real Pages API in the local Cloudflare runtime; restart it after code changes. `npm run dev` remains the frontend-only Vite command.

The terminal prints the local inbox URL and the generated credentials file: `.wrangler/review/accounts.json`. Open that file locally for the random passwords for `customer@example.test`, `staff@example.test`, and `owner@example.test`. These identities exist only in the review database. No shared password is committed.

## Review the implemented flows

| Area | Steps |
| --- | --- |
| Registration and recovery | Register using test information. Refresh the inbox URL printed in the terminal and enter the emailed code. |
| Profile and security | Edit contact details, change password/email, and revoke sessions. Email changes still require both inbox codes. |
| Customer booking | Choose the review professional and haircut, then request a future opening. Slots come from stored weekly hours. |
| Staff decisions and visits | Sign in as staff in another browser profile. Enroll an authenticator under account security, confirm the customer's request, and open Your visits. |
| Availability | Edit staff weekly hours and time off. Appointment conflict checks remain enforced. |
| Professional setup | The owner can submit a professional profile and review eligible submissions after MFA. The seeded staff account is already approved so booking can be tested immediately. |
| History | Requests and confirmed visits appear in the customer's history. New order history is empty because checkout is not implemented. |

Use separate browser profiles for simultaneous customer/staff sessions. Staff MFA is not bypassed; save the local recovery codes when enrolling. The review haircut and daily 09:00–17:00 hours are test fixtures, not published shop prices or working hours. Changes are retained across restarts.

## Local services and persistence

The runner enables accounts, native booking requests, staff setup, and staff operations. It applies migrations 0001–0008 to a dedicated persistent local D1 database and generates separate authentication and MFA encryption keys. Application ownership checks, password hashing, secure cookies, MFA, and transaction safeguards are unchanged.

Account emails go to an in-memory inbox; no messages leave the computer. The inbox keeps at most 100 messages, clears on restart, and uses a fresh random access URL each run. Content is escaped instead of rendering provider HTML. Host/Origin checks and a loopback listener restrict access. Do not expose this runner through a tunnel or use real customer information.

The browser uses Cloudflare's [official development Turnstile site key](https://developers.cloudflare.com/turnstile/troubleshooting/testing/); loading its widget needs internet access. The runner simulates server-side anti-bot verification. This exercises the account flow, not real anti-bot enforcement or email delivery. These substitutions exist only in `scripts/review.mjs`, which is not a deployed entrypoint or public-bundle module.

The already ignored `.wrangler/review/` folder holds the database, keys, and generated credentials. Preserve them together. On Windows, protect the folder with your user-account permissions. To start over, stop the runner and remove that directory only when its test data is no longer needed. Nothing resets automatically.

## Outstanding before hosted activation or main release

- Isolated hosting/D1 resources, a trusted HTTPS origin, server secrets, configured Turnstile, and a verified email sender. Changing a placeholder database ID does not create a database.
- Verified owner/staff provisioning in that environment. The local bootstrap is never a production role-grant mechanism.
- Appointment email Worker deployment/scheduling and provider testing. This review inbox captures account mail only.
- Customer cancellation/rescheduling requests with staff review and agreed notice/fee rules.
- Payments, inventory/order creation, refunds, and commerce operations. Checkout remains closed.
- Browser/mobile acceptance and the deployment runbook's release checks. Local API checks do not establish production readiness.

`main` and the live WordPress site remain unchanged. This is a working local environment for implemented features, not a claim that every planned feature is finished.
