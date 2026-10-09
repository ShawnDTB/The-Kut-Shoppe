# Payment launch plan — October 9, 2026

## Confirmed direction

Implementation follow-up: the [Stripe sandbox milestone](stripe-sandbox-milestone.md) now implements the first durable checkout/verified-event foundation and protected counter controls. Real Stripe acceptance, booking payment holds, Terminal, card refunds, earnings and payroll remain outstanding. The research-only checkpoint below describes this plan's original state.

The user confirmed that customers pay the shop and the shop pays barbers their share. No payment processor or card reader is established; Kash can purchase suitable hardware later. Earlier project instructions identify the barbers as employees. Monthly card volume, average ticket, actual compensation agreements and payroll provider remain unknown.

Use one merchant account owned by The Kut Shoppe. Record each professional's service and merchandise attribution internally. Customer payments, processor deposits to the shop bank, employee gross earnings and completed net payroll are separate records. Stripe Connect accounts are not needed merely to calculate employee commissions.

## Recommendation and cost comparison

Recommend Stripe Payments plus Terminal as the first sandbox implementation candidate for this custom website. This is a conditional technical recommendation, not a claim that Stripe has the lowest possible processing cost or a merchant agreement. Square remains a strong alternative if its packaged POS/payroll operations reduce total ongoing work. An interchange-plus quote from Helcim is worth comparing before committing to hardware, especially if minimizing processing cost is the overriding priority. Do not build multiple live processors at once.

Published US standard rates checked October 9, 2026:

| Payment route | Stripe | Square Free / custom API |
| --- | --- | --- |
| Domestic card online | 2.9% + $0.30 | 2.9% + $0.30 through Payments API |
| Card-present reader | 2.7% + $0.05 | 2.6% + $0.15 |
| Example $50 online payment | $1.75 | $1.75 |
| Example $50 reader payment | $1.40 | $1.45 |

Square's own Free-plan hosted online/invoice rate is 3.3% + $0.30; it is different from the custom API rate. Compare the payment path actually implemented, not a headline price.

Illustrative month, not a shop forecast: 800 reader sales of $50 plus 200 online sales of $50, $50,000 gross card volume. Stripe processing is $1,470; Square Free reader plus API processing is $1,510. Difference: $40/month. These calculations exclude hardware, payroll, subscriptions, refunds, disputes, international cards and optional features. On the listed reader rates alone, Stripe costs less below a $100 ticket; Square costs less above it. Amount includes whatever tax/tip is charged to the card.

Helcim publishes underlying interchange plus 0.40% + $0.08 in person and interchange plus 0.50% + $0.25 online in its $0–$50K monthly credit-card tier. These are markups, not all-in rates. Actual savings require the card mix and an integration/device review; do not substitute its marketing average for a guaranteed shop rate.

Sources: [Stripe pricing](https://stripe.com/pricing), [Square fees](https://squareup.com/us/en/payments/our-fees), [Helcim pricing](https://www.helcim.com/pricing/).

## Keep recurring expense low

- Start with one shared counter reader; buy after a simulated checkout succeeds and a compatible device is selected.
- Use ordinary scheduled processor deposits rather than optional instant transfers. Stripe standard deposits are free; instant transfers cost 1.5% with a $0.50 minimum under standard pricing.
- Use included checkout and ordinary receipts. Do not enable optional subscriptions, paid invoicing, custom checkout domains, financing or premium fraud tools without a demonstrated need.
- Preserve cash checkout/register functionality. In-person card entry should use the reader, rather than a keyed online form.
- Do not add a second charged transaction to every appointment by default. Booking deposits may reduce no-shows, but deposit plus balance adds a fixed transaction fee and mixed-tender/refund complexity. Kash must choose the deposit and cancellation policy.
- Do not use consumer money transfers or automatic card-fee deductions as employee payroll. Keep staff tips separate and do not silently subtract refunds/fees from employee compensation.
- Avoid duplicate booking/POS subscriptions once the native system is ready; transition Booksy/GlossGenius deliberately so appointments are not sold twice.

## Counter hardware

The proposed browser front desk can call Stripe Terminal through the server-driven API. Suitable smart readers include S700/S710; published hardware price is $299 before any tax/accessories. The cheaper M2 mobile reader is not supported by this integration, and phone Tap to Pay has different integration needs and an additional $0.10 authorization fee. Test one shared Wi-Fi reader before buying more. Server-driven Terminal requires connectivity and does not support offline collection; retain the existing cash fallback.

Source: [Terminal integration](https://docs.stripe.com/terminal/payments/setup-integration?terminal-sdk-platform=server-driven), [Stripe hardware and fees](https://stripe.com/pricing).

## Employee pay

The website should show earned service share, retail commission, tips, reviewed adjustments and pay-period statements. Statements must not call gross commission take-home pay. A payroll provider handles applicable withholding, filings and direct deposit; its completed result is reconciled to the pay period. Rates and pay schedule remain unset until Kash confirms them.

As a budgeting reference, Square Payroll lists $35/month plus $6 per person paid: $59/month for four people. This is separate from processing and excludes wages, employer taxes and optional benefits. Choose an existing payroll arrangement if one exists before adding a new subscription. A CSV export is the first practical integration; do not promise an automatic payroll API until the provider supports it and its mapping is tested.

Sources: [Square Payroll pricing](https://squareup.com/us/en/payroll/pricing), [IRS employment taxes](https://www.irs.gov/businesses/small-businesses-self-employed/understanding-employment-taxes).

## Current code and implementation order

The project already has immutable sale estimates, finalized cash sales, full cash refunds/voids, private receipts and cash-register reconciliation. Appointment confirmation and an unpaid order request correctly remain separate from payment. Production feature gates are closed. Electronic payment attempts, verified processor events, card refunds, earnings accrual and payroll reconciliation are still to be implemented; prototype payout tables are not evidence that actual disbursements work.

1. **Payment foundation and online sandbox:** additive D1 migrations for durable attempts, payment allocations and verified event inbox. Freeze seller, currency and server-priced sale amounts. Use provider-hosted card collection; store no full card data. Signed/replayed/out-of-order events must not create duplicate captures or fulfillments. Recover unknown network results by the same payment identity. A success redirect is not payment evidence. Keep new electronic-payment gates disabled by default.
2. **Booking and product payment journeys:** hold appointment capacity/stock while checkout is pending; expiration releases the hold. Late payment requires explicit recovery/refund if the hold is lost. Confirmation and fulfillment stay separate. Decide request-first versus immediate booking before collecting funds. Do not assume Booksy/GlossGenius calendar synchronization.
3. **Counter card checkout:** send the frozen sale total and chosen tip to a simulated reader, then the selected actual device. Handle cancellation, retries, unknown outcomes and reader conflicts. Retain cash and a clear tender-aware sale history.
4. **Refunds and reconciliation:** implement partial/full card refunds, allocation limits and authoritative refund outcomes. Reconcile gross captures, processor fees, bank settlements, cash and stock returns separately. Receipts remain immutable with linked corrections.
5. **Barber earnings:** effective-dated service/retail rates, per-line attribution, separate tips and append-only earnings entries. Missing rates surface as configuration exceptions. Refund effects on compensation require the approved agreement, rather than automatic deductions. Barber access is limited to their own statements.
6. **Payroll handoff and launch:** reviewed pay periods, duplicate-export guards, provider-specific export, returned payroll references and confirmed net-pay status. Complete tax/shipping configuration, actual reader acceptance, owner approvals and provider onboarding before enabling hosted features.

Required business inputs before activation: legal merchant/bank ownership in the processor's own secure onboarding; service/retail rates and recognition rules; payroll provider/pay schedule and applicable timekeeping; booking deposit/cancellation policy; tax and shipping rules; external-calendar cutover. Do not collect bank details, identity documents or API secrets in chat.

## Scope of this checkpoint

Research and implementation planning only. No processor account, hardware purchase, payment integration, live charge or employee payout was created. This plan updates the September proposal with current fees and the user's current collection decision. Development can begin with the payment foundation and simulated processor/reader workflows; purchasing hardware is not a prerequisite.
