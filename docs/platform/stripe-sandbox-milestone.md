# Stripe payment foundation — October 9, 2026

Implemented on `dev-branch`. This is a sandbox-only foundation for the [payment launch plan](payment-launch-plan-2026-10-09.md), not a live merchant launch or completion of booking, Terminal, refunds or payroll.

## Working scope

The protected Sales & cash screen can create or recover a Stripe-hosted test checkout for an existing finalized bill. The current finalization rules still require completed native services, accepted native pickup orders, known tax/shipping amounts, management access, MFA and password confirmation. The browser cannot set the charged amount, merchant, currency, provider URL or idempotency identity. Only cards, one complete payment and no new tips are supported in this slice.

Migration `0018_payment_foundation.sql` adds persistent attempts, a minimized signed-event inbox and immutable payment allocations. One attempt per finalized sale reserves the entire bill across cashiers and browser retries. Provider request bodies, amounts, merchant account, currency and identities are frozen. No raw card data, webhook body, API secret, bank details or customer contact information is stored in these tables or sent in checkout metadata.

Cash collection and voiding are blocked while a card attempt is pending, paid or under review, in both the final SQL conditions and database triggers. The UI also locks cash immediately after attempting checkout, including lost replies. Only a verified provider expiry releases the lock. A contradictory late capture remains recorded and puts the attempt under review; it does not confirm appointments, fulfill orders, issue cash receipts or pay employees.

The Stripe integration pins API version `2025-02-24.acacia`, checks the merchant account, rejects live keys and production-shop domains, validates returned Session identity/mode/amount/currency and accepts checkout links only on `https://checkout.stripe.com`. Workers requests use manual redirects and reject non-success statuses; they never forward credentials to a redirect destination. No SDK or card-collection script is added to the customer bundle.

Signed callbacks verify the original bounded body with HMAC and a five-minute timestamp tolerance. Event identity and payload hash are retained without full payloads. Inbox insertion and allocation/state updates are atomic. Duplicate/out-of-order events cannot allocate twice or turn a paid attempt back into expired. Invalid amounts/identities enter review; unverifiable signatures cannot change data. Pausing account access or new checkout creation does not disable correctly configured callback reconciliation.

An uncertain creation retries the exact frozen request and Stripe idempotency key for at most 25 minutes. A known Session can be retrieved afterward. Unknown outcomes outside that window stay locked for investigation; the code never creates another Session after Stripe might have pruned its idempotency key. A browser success or cancel redirect is never payment evidence.

## Routes and access

- `POST /api/v1/me/payments/checkout`: manager/owner/admin with staff MFA, cash-sales gate, current password and sandbox gate; accepts only `saleId` and `currentPassword`.
- `GET /api/v1/me/payments/:id`: immutable customer ownership, or current management access plus MFA. It does not disclose the checkout link or provider secrets to customers.
- `POST /api/v1/me/payments/:id/reconcile`: management plus MFA; retrieves the known original provider Session.
- `POST /api/v1/payments/stripe/webhook`: exact configured origin, signed raw body, no browser session/CSRF requirement. Supports Checkout completed and expired events; other verified events are acknowledged and recorded as ignored.

All public configurations explicitly keep `PAYMENTS_SANDBOX_ENABLED=false`. The public release check rejects enabling the sandbox. Do not apply the new migration to hosted production as part of this development checkpoint.

## Local Stripe acceptance setup

No merchant account, sandbox credentials, hardware or payroll provider was created by this implementation. Automated tests substitute the external Stripe response while using actual application auth, SQLite and Cloudflare Workers/D1. The real Stripe-hosted checkout and Stripe CLI delivery remain acceptance gates.

1. Start a fresh named review workspace such as `payments-2026-10-09` using the [local review guide](local-review.md). Use only synthetic customer and sale records. Keep it separate from any operational data.
2. In Stripe's own dashboard, select the shop's test environment. Complete account ownership/onboarding personally where required. Never paste secrets into chat or commit them.
3. Use Stripe's CLI forwarding to `http://localhost:8788/api/v1/payments/stripe/webhook`, selecting `checkout.session.completed` and `checkout.session.expired`. Retain the CLI's corresponding signing secret privately.
4. Create the ignored local file `.wrangler/review-payments-2026-10-09/stripe-sandbox.json` with exactly `STRIPE_SECRET_KEY`, `STRIPE_ACCOUNT_ID`, and `STRIPE_WEBHOOK_SECRET`. Values must be the test key (`sk_test_…`), that merchant's account ID (`acct_…`) and the forwarding endpoint secret (`whsec_…`). No live-key override exists.
5. Set `REVIEW_WORKSPACE=payments-2026-10-09` and `REVIEW_STRIPE_SANDBOX=true`, then restart `npm run review`. The opt-in runner permits only Stripe account/Checkout API requests; ordinary local email remains simulated. Without the opt-in, Stripe network access and controls stay disabled.
6. Sign in as the local manager/owner and unlock MFA using the saved local fixture credentials. Complete a test visit or accept a test pickup order, prepare its estimate with verified test charges, and finalize the sale in Sales & cash.
7. Create a test checkout, use only Stripe test payment details, return to the counter tab, and check the provider result. Verify cancellation/expiry, duplicate callback/reload recovery, declined cards, wrong-account configuration and access revocation. A returned browser tab itself has no authority to mark paid.

An expired attempt cannot be restarted as a new card attempt in this milestone. After verified expiry, cash or an explicitly voided/reissued bill is possible. Unknown-session recovery after the safe window and review exceptions require investigation; no automatic release/refund tool is implemented yet. All financial UI calls the result a **test** payment, never real income or a paycheck.

## Verification

- API tests cover closed/default/live-key gates, tampered prices, password/MFA/role/ownership, frozen retries after a lost response, safe retry cutoff, signature rejection, wrong amounts, duplicate events, paid/expired ordering, late capture exceptions, cash exclusion and private status access.
- Real Workers/D1 tests cover concurrent checkout creation, concurrent signed callbacks and competing cash/card requests. These found and resolved a Workers-specific redirect-option incompatibility.
- React interaction tests cover immediate cash locking on uncertain creation, clearing password fields, retrying the same sale, checkout-link display and confirmed-test status without offering a cash refund.
- Browser visual fixture reviewed at 320/375/390/430/768/1024/1280 px: no horizontal overflow, 46 px or larger primary controls, labeled password field and visible keyboard focus. Pending/paid/expired/review states were inspected. Fresh-page console had no errors. This is a component layout review, not a claim of authenticated hosted or real Stripe acceptance.
- Full `npm run check` passed: 310 application tests in 26 files, 13 release-environment tests, typecheck/lint/build, output safety and Workers/D1/notification checks. The final review-state refinement also passed all eight focused payment API tests. Public JavaScript remains 74.64 KiB gzip; CSS is 36.14 KiB, both within budget. Public holding pages and feature gates remain intact. Run migration 0018 on any isolated environment before running this backend because counter queries now read the payment-attempt table.

## Next work

Complete real Stripe sandbox acceptance first, then extend the ledger with Terminal payment identities and partial/full card refunds. Booking and online product checkout need reservation expiry/recovery before collecting in advance. Build employee earnings against confirmed payment/fulfillment records only after compensation and recognition policies are supplied; sandbox allocations must never feed wages or payroll. Existing plan requirements for tips, settlement, stock returns and payroll exports still apply.

References: [Checkout Session creation](https://docs.stripe.com/api/checkout/sessions/create), [Webhook signature verification](https://docs.stripe.com/webhooks/signature), [Idempotent requests](https://docs.stripe.com/api/idempotent_requests).
