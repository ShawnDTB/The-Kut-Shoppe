# Cash register reconciliation

September 25, 2026. Migration **0017** extends the finalized-sale and cash-receipt
workflow in 0016. One shared register represents the physical Main Street drawer.
No processor account, bank transfer or employee payroll is connected by this work.

## Working journey

1. An owner/manager opens Account → **Cash register**, counts the cash physically
   in the drawer and records its opening balance. All cashiers share this register.
2. Cash payments and refunds in **Sales & cash** are attached to the register
   reviewed by that cashier. Net payment equals cash received minus change and
   includes shop-collected service tips. An unpaid void never changes the drawer.
3. **Add cash**, **Remove cash** and **Record deposit removal** each require an
   amount, explanation, review, current password and MFA. A deposit here means
   cash removed from the drawer for deposit; it does not confirm bank receipt.
4. The owner coordinates with cashiers, resolves uncertain transactions and counts
   the remaining cash. Closing compares that count to the expected balance.
   A variance requires an explanation and remains visible in the closing record.
5. Closed registers and their activity remain available through private, paginated
   history. Payment/refund entries link to their original sale and receipt.

Expected cash = opening balance + cash sales + cash added − cash refunds − cash
removed − deposits removed. Refunds and outflows cannot exceed recorded available
cash. If a refund needs cash from another source, first record that cash being
added. Do not classify payroll, tips handed directly to a barber or a bank transfer
as a new customer sale.

Closed sessions cannot be edited or reopened. Count the actual cash to open the
next session; an opening is never automatically copied from an old expected
balance. Explain later correcting cash movements explicitly. Receipt refunds and
employee compensation adjustments remain separate processes.

## Concurrency, retries and access

- Opening, adjustment and closing operations use actor-bound request identities.
  Retrying an identical operation returns its original result; changing its
  amount, register or action with that identity conflicts.
- Cash payment/refund requests include the reviewed register ID in their request
  fingerprint. A request for a closed register cannot move to a new shift on retry.
  Completed cash requests still recover their receipts after register closing.
- A signed closing review binds the manager/session, register, entry count,
  expected balance and ten-minute expiry. Any new entry invalidates it, including
  offsetting movements that leave the expected balance unchanged. The final
  transaction rechecks the review, access and password before closing.
- Register operations, sessions, entries and closing snapshots are append-only.
  Cash events and their register entries are committed with the audit record.
  A failed audit rolls the transaction back. Database triggers reject late entries
  and cash entries whose amount or kind differs from the linked receipt.
- Only front-desk managers/owners/admins with current MFA can view these reports.
  Customer and ordinary employee sessions do not have access. History cursors are
  bound to the viewing account and, for activity, the specific register.

A network timeout cannot prove whether a cashier physically moved money. Retry
the same reviewed request or inspect activity; do not move money twice. Closing
should wait until every cashier has reconciled outstanding requests. No automatic
adjustment conceals a difference between actual cash and recorded cash.

## Migration and local review

Apply all migrations through **0017** before serving this code. `npm run review`
does this automatically for local test data. The existing `CASH_SALES_ENABLED`
gate controls register writes; no additional feature flag or live configuration
change is required. The local runner enables cash; committed hosting defaults
remain unactivated templates.

Historical cash events from 0016 are not backfilled into invented registers.
Their private receipts and exact original retries still work. Count the cash
physically present for the first opening; historical receipts are not added again.
Finish or reconcile outstanding requests before upgrading a live installation.

Use test data to open with $100, collect a $26 payment including its service tip,
remove $10 for deposit, remove $6 for an expense, add $2 and refund $26. Expected
cash is $86. A count of $85.50 must show a −$0.50 variance and require a reason.
After closing, verify that a new movement for that register is rejected and its
activity/closing totals remain unchanged.

## Verification

`npm run check` passed with 262 application tests and 12 release-environment
tests, plus type checking, lint, production builds, bundle limits and production
gates. The Worker/D1 checks exercise competing register openings, closing versus
cash movement, concurrent payments/refunds, private receipts and retries after
closing. Notification runtime checks also passed. These automated checks do not
replace the physical cash-counting and shop acceptance exercise above.

## Remaining financial work

- Manager-created guest merchandise carts, retail referral attribution and stock
  return adjustments; current cash merchandise sales use accepted pickup orders.
- Processor onboarding, sandbox/terminal checkout, signed webhook handling,
  uncertain payment reconciliation, electronic refunds and bank reconciliation.
- Approved effective commission rules, an employee earnings ledger, separate tip
  handling, staff statements and payroll handoff. Sales totals are not wages.
- Multiple drawers/locations, denomination counting, cash-handling approval
  thresholds, bank deposit verification and accounting exports if required.

The one-drawer workflow and recorded variances are functional. Real devices,
physical cash-handling procedures, business policies and hosted deployment still
require shop acceptance; Cloudflare setup remains paused.
