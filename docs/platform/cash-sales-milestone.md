# Finalized sales, cash collection and receipts

September 24, 2026. Additive migration **0016**. This completes the first cash
transaction journey; it does not connect a processor, bank account or payroll.
Cloudflare setup remains paused. Preserve the existing booking/provider and shop
flows while testing these changes.

## What works

- Account → Sales preparation creates a reviewed, immutable estimate from a
  native appointment, a native product order, or both for the same account.
- A saved estimate links to Account → Sales & cash. Finalization requires
  determined tax/shipping, a completed service and/or an accepted pickup order.
  Price, description, customer and professional details must still match the
  estimate. Missing tax remains unknown; this system does not calculate tax.
- Finalization freezes a separate unpaid sale. The same estimate returns the
  same sale on retry. Each appointment/order can belong to only one live sale.
- A manager/owner with MFA and their current password can record the full cash
  payment, an optional service tip, tender received and change. Merchandise-only
  sales do not accept service tips. Tips here mean cash collected by the shop,
  not cash handed directly to an employee.
- A payment creates one immutable paid receipt. Customers see receipts belonging
  to their account. Authorized managers can download/print guest copies without
  creating a customer account. Private HTML downloads can be printed to PDF.
- A full cash refund includes the original tip, requires a reason and produces a
  separate receipt linked to the payment. An unpaid sale can instead be voided.
  Neither operation silently changes an appointment, fulfillment or inventory.
- A void permits a newly issued corrected estimate for the same source. A paid
  or refunded source cannot be billed again by making another estimate.
- Owner order management displays financial state separately from fulfillment
  and links to the relevant sale. Cancel/decline is blocked until an existing
  unpaid sale is voided or a paid sale is fully refunded. Cancellation releases
  reserved stock; fulfillment consumes stock. A refund does not restock goods.

Cash entry records an action already performed at the counter. It cannot verify
physical notes, give change or return money. Coordinate between cashiers before
handling money. After an uncertain response, retry the same reviewed action or
refresh receipts; do not collect or return cash a second time.

## Review locally

Run `npm ci` then `npm run review`. Use the owner/customer credentials file named
in the terminal output and test information only. Enroll the owner authenticator.

1. Complete a test visit through the front desk or its assigned professional.
2. In Sales preparation, select that visit and enter determined test charges
   (including an explanation). Review, save, then open the saved estimate.
3. Choose **Review and finalize sale**. Review the unchanged amounts, enter the
   owner password and finalize. Confirm the sale is **unpaid**.
4. Enter cash received and a service tip, review change, then confirm the cash
   record. Confirm **paid**, download the receipt and view it as the customer.
5. Refund it in full with a reason. Confirm **refunded** and separate original
   payment/refund receipts. The completed visit remains completed.
6. For merchandise, submit a pickup request and accept it as the owner. Create
   its estimate and sale. Try cancellation before/after cash collection; both
   require an explicit void/refund first. Confirm stock is handled once.
7. Test an unpaid void, a guest receipt, retry after a lost response and attempts
   from another customer or an ordinary employee account.

No real money moves during local review. The review runner enables
`CASH_SALES_ENABLED=true`; committed hosting/development templates keep it false.
All migrations through 0016 are required even if cash entry is disabled, because
order management now reads financial state. The release preflight requires an
explicit cash flag and staff operations when cash is enabled. Pausing cash entry
does not hide historical receipts from otherwise authorized accounts.

## Integrity and access

Verification, September 25: 249 application tests and 12 release-environment
tests passed, including cash authorization races, cancellation/finalization
conflicts, immutable private receipts, pagination and lost-response UI retries.
Typecheck, lint, build, bundle budgets and production artifact checks passed.
Real local Workers/D1 checks also passed, including concurrent finalization,
duplicate payments/refunds, competing payment/void actions and notifications.
The API integration suite retains real password hashing and has a 15-second
per-test budget for slower CI hosts; application/security timeouts are unchanged.

`finalized_sales` and `cash_sale_events` are append-only. Financial writes and
their audit entries commit together. The transaction checks current role, active
verified account, session, MFA and password hash; finalization also checks source
revisions/eligibility and prior billing. Cash events require valid state at the
write boundary. Idempotency keys bind the actor and complete action; altered
replays conflict. Concurrent payment/void/refund attempts cannot both win.

Receipt snapshots retain original amounts and identity even after catalog/profile
edits. Downloads escape user text, set restrictive CSP and private no-store
headers, and require account ownership or front-desk authority. Signed history
cursors bind to the actor. Financial records intentionally have no cascading
customer deletion; approved retention and privacy-request handling still need
operational procedures. Do not remove rows to implement a routine correction.

## Next work, in order

| Work | Concrete remaining requirements |
| --- | --- |
| Cash reconciliation | Register/opening float, paid-in/out, deposit, counted close, variance and day totals; reconcile physical cash to these events. |
| Counter merchandise | Manager-created guest retail carts and attribution; currently merchandise must originate in an existing accepted native pickup order. Combining guest visit/order records remains unavailable. |
| Electronic payments | Confirm processor/seller/location, establish the merchant account, sandbox checkout and terminal pairing, durable attempts, signed webhook inbox, retries/reconciliation, refunds and confirmed payment receipts. Square is proposed, not selected or integrated. |
| Employee earnings | Approved effective service/retail commission policies, line attribution, separate shop-held/direct tips, append-only source events, refund review, private statements and payroll exports/reconciliation. No invented rates or automatic wage deductions. |
| Receipt/financial operations | Partial refunds, split tender/deposits if required, email/guest delivery, approved seller details and retention, shipping checkout, reconciliation/report exports and exception handling. |

The existing `earning_entries`/payout tables remain untouched historical scaffolding.
Cash receipt totals are shop transactions, **not employee take-home pay**. No
commissions, payroll liabilities, bank settlements or employee withdrawals are
created by this milestone. Processor credentials and owner-approved compensation
rules are required for activation of those later workflows.
