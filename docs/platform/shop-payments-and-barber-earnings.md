# Shop payments and barber earnings

Decision proposal, September 13, 2026. Code inspected at `4d5f8e8` on `dev-branch`. This document defines the next financial implementation; it does not activate payments or establish an approved compensation agreement.

## Direction supplied by the user

The shop currently uses Booksy. The user believes Kash wants customer payments collected by the shop into its business bank account, with barbers receiving their earnings daily or weekly. Product commissions would reward barbers for promoting merchandise in person and online. No separate payment processor is known to be established.

Use a single shop seller as the working design. Kash still needs to confirm the legal selling entity, worker arrangements, compensation rates and payment schedule. A barber login identifies the professional and their earnings; it does not automatically make that barber a separate merchant or give them access to the business bank balance.

## Processor recommendation

Recommend evaluating **Square first** for this physical shop and custom website. Its Web Payments SDK and Payments API support the website payment path; its Terminal API supports a paired Square Terminal for counter checkout. Cash can be recorded through the Payments API. This is an engineering recommendation based on the shop's counter, retail and website requirements, not a completed merchant selection. [Web Payments SDK](https://developer.squareup.com/docs/web-payments/overview), [Terminal API](https://developer.squareup.com/docs/terminal-api/overview), [cash payments](https://developer.squareup.com/docs/payments-api/take-payments/cash-payments).

| Option | Published US standard card pricing checked September 13, 2026 | Fit and qualification |
| --- | --- | --- |
| Square | Online API: 2.9% + 30 cents; entry plan card-present: 2.6% + 15 cents | First choice for evaluating combined counter and website operation. Square-hosted online/invoice pricing differs from Online API pricing. Confirm actual merchant plan and device compatibility. |
| Stripe | Domestic online cards: 2.9% + 30 cents; Terminal: 2.7% + 5 cents | Viable alternative for custom checkout and reader integration. Counter/register operations still need implementation or a compatible POS product. |

These are processing rates, not total ownership costs; hardware, subscriptions, optional services, international cards, disputes and transfer options can change the cost. Check the actual merchant offer before purchase. Sources: [Square fees](https://squareup.com/us/en/payments/our-fees), [Stripe pricing](https://stripe.com/pricing), [Stripe Terminal](https://stripe.com/terminal).

For the proposed custom web front desk, prototype against the **Square Terminal API** before buying hardware. Do not assume a Square Reader, an existing Booksy reader, or any device displaying the Square brand uses the same integration. Terminal checkout does not accept cash; the counter application records cash separately. Test terminal tipping, cancelled/unknown outcomes and receipt printing on the intended device.

Do not introduce separate connected merchant accounts solely to calculate barber commissions. If Kash instead confirms that individual barbers sell their own services as separate businesses, revisit the seller and funds-flow design before charging. Charge configuration affects merchant-of-record identity and responsibilities. [Stripe merchant-of-record documentation](https://docs.stripe.com/connect/merchant-of-record).

## Money flow and accounting boundaries

1. A customer purchases a service, merchandise, or both from the confirmed shop seller. The server freezes item prices, discounts, applicable tax, shipping and voluntary tips.
2. Card funds are collected through the shop's processor account. Processor settlements reach the business bank subject to fees, refunds and settlement timing. Cash is received in a register and reaches the bank only when someone deposits it.
3. Each verified payment is allocated to its sale. Service delivery and merchandise fulfillment have independent statuses. An appointment confirmation, completed haircut, or order marked ready is never evidence of payment.
4. A separate earnings ledger calculates the barber's service share, product commission and allocated tips under a versioned policy. Shop revenue, sales tax, staff liabilities and processor fees remain separate reporting categories.
5. A pay-period statement is reviewed and handed to the appropriate payroll or contractor-payment process. A completed disbursement reference closes the liability. A submitted transfer or exported file alone is not proof that the barber was paid.

Propose **daily reconciliation and a fixed weekly pay run** as the initial operational design, subject to existing agreements and payroll requirements. Barbers can see daily activity even if payment occurs weekly. Processor deposits and staff pay runs are separate schedules. Do not make legally due compensation depend on when a processor releases a deposit or an owner clicks approval.

Centralized collection can simplify reconciliation but does not determine tax treatment. Worker classification must reflect the actual relationship; use the accountant/payroll provider to establish employee versus contractor treatment and required reporting. Keep employee tips separate from the shop commission pool and do not automatically deduct card fees or refunds from wages/tips. Confirm applicable Pennsylvania requirements before configuring compensation. [IRS worker classification](https://www.irs.gov/businesses/small-businesses-self-employed/independent-contractor-self-employed-or-employee), [US Department of Labor tip guidance](https://www.dol.gov/agencies/whd/flsa/tips).

## Proposed commission policy

All rates remain unset until Kash supplies the agreement. A missing policy is a visible configuration exception, not an invented percentage or an implied zero entitlement. Examples below are design rules to approve, not active payroll rules.

| Component | Proposed calculation and attribution |
| --- | --- |
| Service share | Eligible service amount after allocated discounts, excluding tax, shipping and tips, multiplied by the professional's effective rate. Attribute to the professional who delivered the service. Track delivery and payment separately; recognition/payability follows the approved compensation agreement. |
| Product commission | Eligible merchandise line amount after allocated discounts, excluding tax/shipping/tips, multiplied by the effective retail rate. Record the credited professional per line. Decide whether accrual occurs at completed payment or fulfillment before activation. |
| Tips | Record the customer's intended professional allocation separately. Distinguish shop-collected tips from cash already handed directly to a barber so the latter is not paid twice. |
| Returns and disputes | Link adjustments to the original sale line and original policy. A refund changes the sale immediately when confirmed; its effect on staff compensation is a separate reviewed decision under the agreement and applicable rules. Never silently debit wages or tips. |

In store, an authorized cashier selects the credited barber while reviewing the sale. Online, a barber referral link/code can preselect a visible optional attribution field that the customer can change or clear. Start with one credited professional per line; do not build an affiliate marketplace or multi-level commissions. No selection remains unattributed. The haircut barber must not silently receive every merchandise commission.

Snapshot attribution and policy version when the sale is finalized. Rates can change prospectively without rewriting old statements. After finalization, an owner correction creates an audit event and corresponding adjustment, never an untraceable edit. Ordinary barbers cannot claim arbitrary past sales or edit their rates. Decide staff self-purchase eligibility, excluded products, attribution conflicts and any referral expiry before enabling credits. Avoid persistent marketing cookies for the initial referral flow.

Use integer cents and integer rate units. Allocate order discounts deterministically across eligible lines, with stable handling of leftover cents. Partial-return adjustments must refer to the original allocation; cumulative adjustments cannot exceed the original attributable amount. A sequence of partial returns must reconcile exactly to a full return, regardless of rounding or policy changes.

## Existing project and required changes

| Existing foundation | Assessment and implementation consequence |
| --- | --- |
| `server/commerce.ts` and order/item snapshots | Real unpaid order requests and stock reservations exist. Separate fulfillment from financial status before adding checkout. Current zero-default tax/shipping fields are not a tax/shipping calculation and must not become a live quote implicitly. |
| `server/front-desk.ts` and `server/booking.ts` | Guest walk-ins and capacity checks work. Attach sales to existing appointment identity; keep booking/rescheduling accessible while financial work is added. |
| `server/customer-documents.ts` | Current appointment documents and order acknowledgements work. Add separately issued immutable financial receipts rather than relabelling these as proof of payment. |
| `earning_entries` in migration `0001` | Early schema only; no runtime ledger writer was found. It lacks sale-line/payment identity, policy snapshots, event deduplication and explicit reversal links. It is not a production accounting authority. |
| `payout_accounts`, `payouts`, `payout_items` | Early schema only; no runtime disbursement workflow was found. Preserve existing rows and audit migration behavior. The unique earning-entry assignment needs deliberate handling of failed/cancelled runs and retries. |
| `commerce_receipts` | Internal transaction guard. Do not reuse as a financial receipt table. |

Implement additive migrations after `0012`; do not delete or rewrite migration `0001`. Preserve any legacy earnings/payout rows as unverified historical records until their provenance is reconciled. Historical unpaid orders and completed appointments must not automatically generate financial receipts or staff earnings during migration.

The next data model needs immutable sales/lines, payment attempts and tender allocations, verified provider-event inbox, refunds, issued receipts, cash sessions/movements, effective commission policies, line attribution, append-only earnings events, staff statements and disbursement attempts. Keep amounts, currency, seller, location, source sale, external reference and audit actor explicit. The existing payout tables may be extended after migration constraints are reviewed; their existence is not a reason to skip this model.

Enforce these invariants in the server and database:

- Provider event replay, duplicated browser submission and two concurrent cashiers cannot create duplicate payments, commissions, refunds or pay runs. A timeout is an unknown result requiring reconciliation before another charge.
- A captured payment, a processor-to-bank settlement and a barber disbursement are three distinct events. Do not label any one of them as all three.
- Receipt amounts and line descriptions remain fixed after issue; a refund creates a linked document. Booking confirmation remains available before payment.
- A payment arriving after stock or appointment capacity expires creates a visible recovery case and, if necessary, a provider refund. It cannot silently double-book or oversell.
- Cash received minus change equals tender applied. Opening float, sales, refunds, paid-in/out, deposits and counted close reconcile with an explicit variance. A direct cash tip is not register cash unless the shop actually received it.
- Staff statement totals derive from source events. Exporting twice does not allocate the same earnings twice. Failed or uncertain payouts retain recoverable identity and cannot be blindly retried as a new transfer.

## Dashboard and security scope

Customers see payment status, remaining balance, issued receipts and refund progress alongside their existing appointments/orders. Guests can receive a printed receipt without creating an account; digital guest access needs a short-lived secure delivery link, not a guessable receipt number.

Barbers see their own services, credited merchandise, tips, adjustments, pay periods and completed payout history. A sales total must not be labelled money available to withdraw. Start with statements and payout status; add withdrawal requests only if a supported payment rail and business policy are deliberately selected.

Kash sees sales, collected cash/card, tax, refunds, processor fees/settlements, earnings owed, pay-run exceptions and register variances. Cashiers receive explicit sale/tender permissions; commission-rate changes, refunds and pay-run approval have separately scoped permissions and current MFA. Bank connection changes remain in the provider's secure administration initially.

Card entry uses provider-controlled payment components. Keep API secrets and webhook verification on the server; validate seller/location/currency/amount against the saved attempt before posting a payment. Never accept a browser success redirect as payment evidence. Keep full card data, bank numbers and tax identifiers out of this application's forms, logs, repository and customer records. Store provider references and only the display metadata actually needed. Limit receipt, statement and export access by account and role; log financial adjustments without sensitive payloads. Establish retention with the business before launch.

## Booksy transition

Booksy supports its own payment collection and bank payouts. If the shop currently accepts card payments inside Booksy, inspect Business Wallet and the merchant arrangement before assuming there is no processor relationship. The user has not confirmed whether this is enabled. [Booksy payout process](https://support.booksy.com/hc/en-us/articles/16465244778258-Can-you-tell-me-more-about-the-payout-process).

Inventory existing appointments, deposits/prepayments, gift credit, customer contact permissions, products, outstanding refunds and any current barber balances. Confirm supported exports/integration with Booksy; do not assume a public writable API or portable saved cards. Preserve provider references and keep historical payments/refunds under their original provider. Obtain and validate supported exports before importing customer data; never import card credentials.

Set an explicit appointment/calendar cutover or prove supported synchronization before both systems sell the same availability. Keep Booksy operational until the replacement passes a full-day rehearsal. Payment transition can be staged separately from appointment migration, but each sale and each payable must have one source of truth. Reconcile opening balances against actual records instead of manufacturing website payments for historical visits.

## Delivery sequence and acceptance

These are planned features, not newly working UI. Continue shipping reviewable increments to `dev-branch` while preserving the current booking, shop and account journeys.

| Stage | Deliverable | Required evidence before calling it working |
| --- | --- | --- |
| P1 | Sales/line snapshots, financial statuses, source references and commission-policy versions | Migration preserves old data; server quotes and exact-cent allocations tested; fulfillment cannot imply payment; unset policy/tax configuration is explicit. |
| P2 | Cash counter checkout, register sessions, immutable receipts and guest delivery | Walk-in haircut plus product, merchandise-only sale, cash received/change, duplicate submissions, refund and register close reconcile. Confirmed appointments can be paid without recreating them. |
| P3 | Square sandbox website checkout and verified event processing | Success/decline/abandonment, duplicate and out-of-order events, lost responses, expired holds, partial refunds and private receipts tested. Owner has a reconciliation queue. |
| P4 | Paired terminal checkout, counter tips and electronic refunds | Actual device success/cancellation/timeout, staff permissions, repeat-charge prevention, receipt printing and cash/card reconciliation verified. |
| P5 | Service earnings, retail attribution, tips and staff statements | Each amount traces to an approved policy/source; discount/rounding/partial-return cases reconcile; staff isolation and owner correction audit pass. No obligation changes silently on a customer refund. |
| P6 | Pay-run review, payroll/contractor export or supported disbursement adapter | Accountant-approved mapping; repeat export protection; failed/uncertain payment recovery; completion references reconcile. Provider setup and test disbursement evidence precede automation. |
| P7 | Booksy cutover and production acceptance | Opening records reconciled, calendar collision risk resolved, backups restored in rehearsal, mobile/accessibility/email/device journeys accepted, explicit release review completed. |

Implement full-payment cash and card paths first unless Kash requires deposits or split tender at launch. Retain an extensible allocation model, but do not imply deposits, stored cards, recurring charges, split payments or instant barber withdrawals are available before their recovery/refund paths are tested.

## Merchant onboarding packet

Kash can review the proposed seller model, weekly schedule and commission rules now. Before activation, record the confirmed legal business identity and selling location, account owner, existing Booksy payment arrangement, service/retail tax handling, shipping rates, refund/cancellation policy, and worker/payroll arrangements. The current site lists Stroudsburg, Pennsylvania; the business must verify its actual legal and operating details.

After processor selection, Kash or an authorized business representative completes identity verification, business-bank linking and acceptance of processor terms directly with the provider. Do not request identity documents, full banking details or account passwords in chat. The development setup then needs a separate sandbox application/location, server-held credentials, verified webhook endpoint, public application/location identifiers where required, and a tested device route. Confirm access permissions and receipt identity before switching to production credentials.

This planning update changes documentation only. It creates no processor account, chooses no live commission rate, moves no money, changes no hosted configuration and does not merge `main`.
