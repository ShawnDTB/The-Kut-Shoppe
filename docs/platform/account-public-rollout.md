# Account-only public rollout — October 9, 2026

The user authorized opening accounts on main while booking, payments and shopping continue in development. Public accounts expose registration, email verification, sign-in, password recovery, profile, email/password changes and session controls. `/dashboard` uses the same limited shell. Operational deep links do not reveal staff, customer records, sales or payment screens. External Booksy and GlossGenius bookings remain clearly separate from website accounts.

`AccountBasics.tsx` shares the existing API-backed authentication, profile and security controls with the development workspace. `LiveAccounts.tsx` supplies only Overview, Profile and Security. The public build excludes the full workspace and commerce chunks. Header/footer labels and account metadata describe the current release; account pages remain noindex.

## Hosting and email

- Pages production forwards `/api` to the existing Worker. Preview deployments remain isolated from the production API.
- Only `ACCOUNTS_ENABLED=true`; all other hosted operational flags stay false.
- Resend's existing ShawnDTB account now has verified `thekutshoppe.com`. `Kut Shoppe accounts` has Sending access restricted to that domain. The credential is stored as the Worker's `RESEND_API_KEY`, never a browser/build variable.
- Sender: `The Kut Shoppe <admin@thekutshoppe.com>`. A provider delivery test to the user-approved `shawn@dtbsolutions.tech` reported Delivered. This establishes outbound delivery, not a functioning inbound admin mailbox.
- Added TXT `resend._domainkey` and DNS-only CNAMEs `rsend` and `send`, using the exact Resend-provided values. Existing mail DNS records are preserved; no plan upgrade was accepted.
- D1 was exported privately before applying additive migration `0018_payment_foundation.sql`. Existing records were preserved. Payment tables do not activate payments; the sandbox gate remains false and live keys remain rejected.

## Checks and acceptance

The full check passed with 314 application tests, 13 release-environment tests, bundle budgets, production-output checks, real Workers/D1 races and notification runtime checks. New account-shell coverage checks disabled/error states, signed-out access, logout, navigation, provider links and owner-role operational isolation. Final deployed browser acceptance and the user's own live signup/recovery walkthrough are recorded separately after deployment.

For rollback, restore a prior Pages/Worker deployment or set `ACCOUNTS_ENABLED=false` and redeploy. Preserve the production database, email keys and account records. Do not undo migrations or reset MFA to troubleshoot account access.

## Next releases

Owner bootstrap requires a verified real account and the established authorization process. Do not promote a test account automatically. Staff dashboards, appointments, shop, checkout, cash collection, Stripe processing and barber payouts require their own readiness checks and activation. Nothing in this release authorizes automatic payment or payout activation.
