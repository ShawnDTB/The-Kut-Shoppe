# Sale preparation and immutable estimates

September 14, 2026, after `39c5142` on `dev-branch`.

## Working increment

Owners/managers can prepare a shared itemized estimate from an existing native appointment, a merchandise order, or both for the same customer account. The customer can retrieve their own issued copies. Guest estimates remain available to authorized shop staff for download/printing without creating an account.

| Entry | Working action |
| --- | --- |
| Account → Sales preparation | Choose saved records, enter any discount and determined charges, review server-calculated amounts, then save with current password and MFA. |
| Front desk → Visit → Prepare sale estimate | Opens preparation with that guest appointment selected. |
| Manage orders → Prepare sale estimate | Opens preparation with that order selected. |
| Account → Estimates | Read personal estimate history and download a printable HTML copy. |
| Sales preparation → Saved estimates | Review/download all shop-issued estimates; load older records through paginated history. |

The form uses recorded appointment prices and order-item snapshots, even when the current catalog price has changed. Discounts require a customer-visible explanation and are allocated to lines with exact integer-cent arithmetic. Estimated tax and shipping entered by an authorized operator require a customer-visible explanation; this is not an automated tax calculation. Blank tax remains unknown. Blank shipping on a shipping order remains unknown. A visit/pickup has no shipping charge. A final estimate total appears only when every relevant charge has been determined.

Do not use these estimates as invoices, payment demands, tax invoices or paid receipts. There is no amount-due balance, payment collection or earnings accrual in this increment. Appointment and fulfillment statuses continue to describe their existing workflows.

## Review locally

1. Pull `dev-branch`, install dependencies with `npm ci` if needed, then run `npm run review`. Restart an already running review server so migration `0013_sale_estimates.sql` is applied automatically to its local review database.
2. Sign in with the generated local owner test account and enroll/unlock its authenticator. Use test data only.
3. Create a walk-in in Front desk or confirm a customer booking. In the customer account, request a sample product order if testing merchandise.
4. Open Sales preparation directly or use the visit/order link. Combined records must belong to the same customer account; a guest visit cannot be silently assigned to a registered customer's order.
5. Leave tax blank to confirm that the total stays unresolved. For a fully determined test estimate, enter explicit test charges and an explanation. Review and save.
6. Open Saved estimates, download the copy and use the browser Print command to print or save as PDF. For registered-customer sources, sign into that customer's account and open Estimates.
7. Change a product name/price, customer display name or appointment afterward. The saved estimate retains its original details. New estimates can be prepared separately; old copies are not overwritten or automatically superseded.

Review links expire after ten minutes. If the reviewed records or relevant shop revisions change before saving, the operator must review again. An uncertain save retains its retry identity; retrying it recovers the already-issued copy. Saved history is independently refreshable. No email is sent when an estimate is issued.

## Data and authorization

`sale_estimates` contains an immutable amount/source snapshot, customer account reference, issuer reference, timestamp, request fingerprint and unique review/request identities. Snapshots deliberately exclude emails, phone numbers, addresses, private notes, passwords and payment credentials. Source identifiers are durable references without cascading updates/deletes. Update/delete triggers protect issued records; implement a controlled retention/redaction process before production deployment rather than bypassing these triggers in normal application routes.

Creation requires owner/manager/admin access, staff MFA, the current password, a session-bound signed review and fresh source revisions. Save and audit commit together. Final SQL guards recheck session/MFA/role/password, expiration and booking/commerce revisions. All private endpoints use no-store/noindex headers. Printable copies escape content and use a restrictive content policy.

Customer history and downloads are filtered to the customer account recorded at issue. Staff access to the entire shop history requires the front-desk authorization path. Ordinary professionals cannot browse everyone else's estimates. Front desk and sale creation use `STAFF_OPERATIONS_ENABLED`; merchandise preparation also requires `COMMERCE_ENABLED`. Existing issued customer copies remain readable when creation is disabled.

The estimate payload has no paid flag or manual payment-state override. Saving cannot alter order stock, appointment status or employee earnings. Existing unpaid order records are not treated as paid, and no historical financial records are fabricated.

## Employee payroll decision

The user confirmed that the barbers are employees. Future service earnings, retail commissions and reported tips should feed employee payroll. Show gross compensation separately from payroll withholding and confirmed net pay; a dashboard commission subtotal is not a withdrawable bank balance. Final compensation rates, payroll provider, schedule, earning codes and applicable timekeeping/base/overtime inputs remain business configuration. Keep processor-to-bank settlements separate from employee payroll results. [IRS employment taxes](https://www.irs.gov/businesses/small-businesses-self-employed/employment-taxes).

## Verification and remaining work

`npm run check` passed: **207 tests across 16 files**, TypeScript, ESLint, production/SSR builds, bundle checks, production guards and Cloudflare runtime/notification checks. The D1 runtime check confirms that simultaneous duplicate estimate saves create one snapshot and one audit record, while private downloads remain account-scoped.

New tests cover exact-cent allocation, large totals, rounding ties, unknown versus zero charges, saved prices, unsupported/mixed-customer sources, immutable documents, escaping, permissions, stale sources, final-write revocation, audit rollback, expired reviews, retry recovery and customer pagination. Component tests cover explicit review, exact decimal input, unknown totals, lost-response retries and private download recovery.

The managed browser rejected localhost with `ERR_BLOCKED_BY_CLIENT`, so real-browser layout, keyboard/screen-reader and print acceptance remain open. Automated checks do not validate real card hardware, tax calculation or payroll.

Next: verified business identity/settings, final sale and payment allocation records, cash register/tender/receipt/refund workflow, Square sandbox integration, then employee commission policies and payroll statements. This increment does not implement merchant onboarding, cash/card collection, financial receipts, automatic tax/shipping, stock holds, deposits, product-referral credits, pay runs or employee withdrawals. Global booking/commerce revisions currently invalidate reviews conservatively, including some unrelated shop edits; refine this if busy-counter acceptance demonstrates a need.

Main, hosted databases and production configuration remain unchanged.
