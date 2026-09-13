# Rescheduling, walk-ins and printable records

Implementation after `7039563` on `dev-branch`. Main and hosted environments are unchanged.

## Working journeys

| Journey | Entry point | Behavior |
| --- | --- | --- |
| Customer rescheduling | Account → Appointments → Details | Choose a replacement date/time, review and send. The original stays confirmed and reserved. |
| Professional response | Professional requests → Review request | Approve/decline a customer's change or propose an alternative, with MFA and current password. |
| Professional-initiated change | Your visits → Details | Propose a replacement for a confirmed website appointment. |
| Customer response to a proposal | Appointment details | Accept/decline a professional's proposal; acceptance checks availability again and atomically moves the appointment. |
| Withdraw or repeat a change | Appointment details | A proposer can withdraw. Resolved or expired requests permit a new request. |
| Printable appointment document | Appointment details → Download appointment document | Download an HTML document to open and print/save as PDF. Requested bookings are labelled acknowledgements; confirmed bookings are labelled confirmations. |
| Printable order acknowledgement | Order details → Download order acknowledgement | Item snapshots and recorded totals; explicitly not proof of payment. More than 100 items fails closed rather than issuing a partial document. |
| Guest walk-in | Owner/manager account → Front desk | Name, optional phone, service/professional and today's opening. No email or customer account required. |
| In-person visit lifecycle | Front desk → Active walk-ins | Check in, start service, complete, cancel, or mark a confirmed visit no-show. Assigned professionals can see guest visits in their own visit list. |

## Reservation and account guarantees

Rescheduling preserves appointment identity, service, professional, location and recorded price. It does not create a second customer booking, charge a fee or issue a refund. Replacement times are **not held** while awaiting agreement. Acceptance uses the existing schedule engine, ignores only this appointment's own reservation, and rechecks availability, duration, cleanup buffers, holds, time off, booking window and minimum notice. Existing requests and walk-ins compete for the same schedule.

Change requests are separate from appointment status. At most one is unresolved. They expire at the earlier of the original or proposed start; no automatic move occurs. Expired requests can be closed or superseded. Pending changes block a new customer cancellation; the customer first withdraws their change or declines the professional proposal. A pending cancellation blocks rescheduling. The original cancellation workflow remains available.

Every change operation has an actor-bound idempotency key and payload fingerprint. Repeating the same operation returns the current saved status, even if the first response was lost. The operation receipt, appointment update, change history, event, audit entry and notification outbox commit together. Final-write guards recheck appointment version, schedule revision, identity, session, professional assignment/approval, MFA and password snapshot where applicable. Proposal acceptance cannot overwrite a competing appointment or schedule update.

The dashboard now includes unresolved changes. Calendar downloads retain their event UID and add sequence/last-modified fields; users must download/import a fresh copy after a move. Email notices use the existing private update outbox. They are not detailed confirmation attachments, and real delivery still depends on production configuration.

Front desk access is currently restricted to owner/manager/developer accounts through server-side role checks, MFA and a current password for writes. Regular professionals can read their assigned walk-ins. Today's walk-ins waive advance-booking notice but still obey real capacity, duration, cleanup, holds and time off. Starting service requires that the scheduled time has begun and has not ended. An overdue in-service visit blocks new availability for that professional until the shop closes it out. This is a scheduled walk-in workflow, not an unscheduled waiting-list or overbooking mechanism.

## Data and rollout

- Apply additive migration `0011_appointment_changes.sql` before running the new API. It adds versioned appointment changes and durable operation records.
- Apply `0012_walk_in_operations.sql` for guest-visit operation deduplication. Existing appointments and order data are preserved.
- The local `npm run review` runner applies new migrations to its existing review database automatically. Restart the runner after pulling, then use the previously generated test account credentials. Front desk is available at `/account?view=front-desk` after owner MFA setup/unlock.
- These workflows use `STAFF_OPERATIONS_ENABLED`. New online booking still has its independent flag. No hosted flags, databases or credentials were changed.
- Downloaded HTML documents escape stored values, include restrictive content policies, and are served with private/no-store/noindex headers after ownership checks. Internal notes and account credentials are excluded. Generated documents show current records, not immutable financial receipts.

## Verification and remaining acceptance

`npm run check` passed: 189 tests across 14 files, TypeScript, ESLint, production/SSR builds, bundle budgets, production guards, Cloudflare runtime and notification checks. The real Workers/D1 check also verifies that concurrent duplicate change requests create one record and opposing rescheduling decisions produce one saved outcome.

Automated tests cover customer/professional proposal round trips, self-overlap, competing reservations, schedule changes, deduplicated retries, ownership, expired/stale decisions, session/MFA revocation and audit rollback. Component tests cover explicit review, quoted availability, expiry controls and uncertain-response retry. Walk-in API tests cover account-free creation, schedule occupancy, assigned-professional visibility, permitted lifecycle changes and rollback, with matched application/SQLite clocks so after-hours test runs remain deterministic. Document tests cover ownership, status distinction, escaping and private headers.

Real-browser layout, printing, keyboard and screen-reader acceptance still needs completion; the managed preview was previously blocked from localhost. The automated checks do not prove hardware/card operation or email delivery.

Remaining operational limits: no cash/card collection, financial receipt/refund issuance, register opening/closing/reconciliation, guest receipt email, unscheduled queue, appointment extension for overruns, or dedicated front-desk staff permission provisioning. The front desk list is limited to 100 active/recent records and reports overflow. Provider bookings do not automatically synchronize with native bookings.

## Cash and electronic payment implementation decision

Follow-up direction is recorded in [shop payments and barber earnings](shop-payments-and-barber-earnings.md): the user reports Booksy use and proposes shop-owned collections, barber earnings and retail commissions. Square is recommended for evaluation; compensation terms and merchant onboarding remain unconfirmed. The proposal extends the implementation sequence below without activating financial features.

Before implementing the financial records and processor calls, establish who sells each service/product and receives the funds. A shop-owned sale model differs from independent barber sellers. This determines merchant identifiers on sales/receipts, which account creates each charge, who handles refunds/disputes, and whether combined service/merchandise checkout is one sale or multiple sales. Stripe explicitly makes merchant-of-record identity depend on charge configuration. [Stripe merchant-of-record documentation](https://docs.stripe.com/connect/merchant-of-record).

If an existing Square merchant account and Square Terminal are used, Square can connect the custom front desk to a paired terminal; completion must come from verified provider state/webhooks. Cash is recorded through its Payments API rather than Terminal checkout. [Square Terminal overview](https://developer.squareup.com/docs/terminal-api/overview), [cash payments](https://developer.squareup.com/docs/payments-api/take-payments/cash-payments).

The next implementation sequence once ownership/provider are known:

1. Immutable merchant/line/amount snapshots and sale references for appointments and merchandise; tax/shipping and receipt identity supplied by confirmed business settings.
2. Cash tender received/change, operator/register identity, audited reversals and issued receipt snapshots. Separate fulfillment/service completion from payment completion.
3. Provider test-mode online checkout, durable payment attempts, signed webhook inbox and reconciliation. Never mark paid from a browser redirect alone.
4. In-person terminal checkout, tender-aware refunds, partial/split tender only if selected, printer/reader acceptance and register reconciliation.
5. Guest receipt delivery and owner exception handling for uncertain payments, failed messages and stock/booking conflicts.

Do not treat `commerce_receipts`, `appointment_change_operations` or `walk_in_operations` as customer financial receipts: they are internal transaction guards. No provider was arbitrarily selected or paid feature presented as complete in this milestone.
