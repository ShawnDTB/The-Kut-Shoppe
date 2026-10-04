# Feature completion review — September 24, 2026

Deployment is paused while the product's incomplete workflows are addressed.
This inventory distinguishes implemented behavior from unfinished work. It does
not call a screen complete merely because its route renders.

## Completed in this milestone

### Cash register follow-up, September 25

Migration 0017 adds the [shared cash register](cash-register-milestone.md): opening
cash, payment/refund allocation, cash additions/removals, deposit removals,
counted closing with variance, and private activity/closing history. Closing and
cash writes cannot race into a closed shift. Processor integration and employee
earnings are still unfinished.

### Finalized sales and cash follow-up

Migration 0016 and the [cash milestone](cash-sales-milestone.md) add the working
estimate → finalized sale → cash → receipt journey, with full refunds, unpaid
voids, private customer/guest documents and payment-aware order cancellation.
The earlier lifecycle/withdrawal milestone below remains intact. Cash register
reconciliation, processor checkout and employee earnings are still separate work.

### Appointment operations

Previously, website appointments could be requested, confirmed and rescheduled,
but there was no working check-in/service/completion path for their assigned
professional. Only managers could progress guest walk-ins. Overdue confirmed
visits disappeared from the professional list, and completed details were denied.

- Website bookings and walk-ins now share the same protected lifecycle:
  confirmed → checked in → in service → completed.
- Assigned, approved professionals can act on their own visits. Managers/owners
  oversee website visits and walk-ins from the front desk. Customer and unrelated
  professional sessions cannot perform these actions.
- Confirmed visits can be cancelled or marked no-show; checked-in visits can be
  cancelled. No-show is unavailable before the scheduled start. Starting service
  requires the scheduled window and no other open service for that professional.
- An in-service visit can be completed after its scheduled end. Unfinished,
  overdue confirmations remain visible rather than silently becoming no-shows.
- Active/history views have separate, signed pagination cursors. Completed,
  cancelled and no-show details remain available to the assigned professional.
- Pending rescheduling must be resolved first. Expired changes are closed with a
  successful visit update. Pending cancellation blocks check-in, but can be
  approved through Cancel visit. The assigned professional can also resolve a
  pending cancellation in the request queue after the original start time.
- Every mutation requires MFA, current password and the reviewed record version.
  Role/session/assignment/password checks are repeated at the transaction boundary.
  Operation, status, event, audit and notification queue writes are atomic.
  Retrying the same action does not repeat the transition or notices.

These are appointment actions, **not** payments, refunds, wages or fee collection.
Notification messages remain generic account-update notices. Guest visits without
an account do not gain invented email recipients.

### Customer order withdrawal

Previously a customer could submit an unpaid product request but could not undo it
without contacting the shop, even before anyone accepted it.

- Order details now offer a reviewed withdrawal for the customer's own native,
  unpaid `submitted` or `payment_required` request, before shop acceptance.
- Withdrawal cancels the request and releases only its reserved stock in one
  transaction. It does not reduce on-hand inventory or process a refund.
- Retries of the same reviewed version return the saved result. Competing staff
  acceptance, changed inventory/order revision or revoked access prevent the write.
- Accepted, preparing, fulfilled, paid, legacy and other-account records cannot be
  cancelled through this customer action. Customers contact the shop instead.

## Review instructions

Apply additive migrations **0014** through **0017**, after 0013, before serving this
code. `npm run review` applies local migrations automatically; use test data only.
No hosted database or feature flag is changed by this milestone.

1. Request/confirm a website visit. As its assigned professional, open Account →
   Your visits, check it in, start it during its scheduled window, then complete it.
   Confirm the customer sees the updated status and the visit moves to history.
2. Check a guest walk-in from both its assigned professional and manager front desk.
   Retry a saved action after a simulated lost response; verify a single event.
3. Leave a service open past its end. Verify it stays visible and blocks another
   service until completed. Verify future visits cannot be marked no-show early.
4. Review a pending cancellation and a rescheduling request. Confirm conflicting
   visit actions are blocked and expired changes do not permanently trap a visit.
5. Submit a product request as a customer. Open its account order details, withdraw
   it, refresh, and confirm cancelled status and released inventory. Try again
   after manager acceptance; the customer action must no longer be available.

Automated checks cover API ownership, stale versions, transactional authorization
races, audit rollback, history pagination, UI confirmation/uncertain-response
retries, and real local D1 duplicate operations. Browser, screen-reader, actual
device, real email-provider and live financial acceptance remain separate.

Local verification: 230 application tests plus 12 release-preflight tests passed,
along with typecheck, lint, build, bundle/output checks and local Workers/D1.
The prior main CI run exposed an eager response-clone failure in the runtime test
harness on Node 22. The harness now captures each real HTTP body once and uses
that snapshot for diagnostics and assertions; the API itself is not mocked.

## Next implementation order

| Priority | Incomplete journey | Completion target |
|---|---|---|
| 1 | Cash operations follow-through | Register reconciliation now works alongside sales/receipts; add guest retail carts, stock returns and partial refunds |
| 2 | Store request → operational fulfillment | Paginated/filterable owner queue (currently 100), acceptance/pickup/shipping notifications and delivery exceptions, reservation expiry, stock adjustments/returns |
| 3 | Online/in-person card payment | Approved shop merchant processor, hosted/tokenized checkout, durable attempts, signed webhook reconciliation, uncertain outcomes and refunds; actual terminal testing |
| 4 | Employee earnings → payroll statement | Approved effective-dated commission rules, retail attribution, tips, adjustments, gross earnings and payroll export; not self-service employee bank withdrawals |
| 5 | Full front-desk scheduling | Day/week calendar, paginated historical visits (current manager list is capped at 100), unscheduled queue, existing-customer selection, verified guest linking and late-arrival rebooking |
| 6 | Account/privacy and operational support | Verified owner bootstrap, controlled staff provisioning, export/deletion and retention workflow, failed-notification workspace, incident and recovery procedures |
| 7 | End-to-end customer/device acceptance | Booking/cart recovery across reload, mobile/keyboard/zoom flows, real email and private-document printing, approved content and Booksy cutover |

Customer-selected barber/service changes during rescheduling are still outside the
current same-service/same-professional rescheduling flow. A visit cannot start after
its scheduled end; late arrivals need a conflict-checked rebooking path, not an
unchecked bypass of capacity. Untimed legacy visits still require schedule review.

Financial implementation can continue in local/sandbox mode, but live merchant
onboarding, business-bank linking, commission rates, taxes/shipping and refund
policies need the owner's approval. Do not substitute guessed business settings.
