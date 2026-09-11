# Functionality restoration: booking and dashboards

## Finding

The user's observation is correct: the account/backend migration improved data handling while reducing what the interface offered at the main entry points. Visual cleanup and security work did not preserve the original product experience completely.

The boundary is visible in git history at `0ab7c2a` (protected customer accounts and production gates), following the earlier platform work. The earlier experience is still represented by `Booking.tsx`, `CustomerAccountDashboard.tsx`, `StaffAccountDashboard.tsx`, and the commerce components, reachable through the explicit development-only `LocalPlatformPreview`. At `a2040b9`, the main `/book` route still rendered external-provider links even when native booking was enabled, and account entry opened appointment history rather than an overview.

The earlier UI was interactive: it had a service → barber → schedule → details flow, appointment cards with date/time/barber, customer change/cancel/proposal controls, orders, editable contact details, and staff workspaces. Its browser-storage adapters could make those interactions appear complete within one browser. They did not establish shared server authority or cross-device persistence. We should preserve the interaction design and rebuild missing operations against the shared backend, rather than treating the old experience as disposable or reconnecting browser role/booking storage.

## Feature inventory and priorities

| Experience | State before this restoration | Action / remaining work |
| --- | --- | --- |
| Main Book Now journey | `/book` only offered external links; real request form was inside appointment history | Restored `/book` to the native account/booking flow when server account and booking gates are enabled; provider links remain available when disabled |
| Service and professional choices | One combined dropdown flattened service/barber/location | Separate service and professional cards; valid locations filtered from actual server options |
| Date and time selection | Native date field and a long time list | Added next-seven-day shortcuts, location-zone dates, and retained actual server availability/time selection |
| Booking review/save | Real backend implemented | Preserved price/length summary, optional note, shop approval, conflict checking, signed quote and idempotent retry |
| Customer landing dashboard | Separate history tabs; no consolidated summary | New overview with next visit, pending/upcoming/completed/order counts, recent appointments/orders, profile and security shortcuts |
| Appointment details/history | Already backed by server, including calendar export and unconfirmed withdrawal | Retained and directly linked from overview and booking completion |
| Profile/security | Real update and verification flows existed but were separated | Retained, surfaced from overview; phone verification/autocomplete from earlier concepts remains separate |
| Guest selection before login | Earlier prototype supported a later customer-details step | Current native flow requires sign-in first. Public catalog/availability and safe continuation through authentication remain a next UX milestone |
| Any available professional and preselected team links | Earlier booking UI supported these behaviors | Not restored yet. Requires eligibility-aware server selection; never randomly assign a professional in the browser |
| Change/cancel and reschedule proposals | Interactive prototype controls; no completed production workflow | Next implementation priority: customer request, staff review, transactional availability updates, clear status and notifications |
| Walk-ins/waitlist | Prototype UI exists | Needs durable queue ownership, capacity handling, and professional actions |
| Staff/owner operational dashboard | Requests, visits, setup reviews and availability exist as account tabs | Next aggregate professional/owner views around today's workload; shop-wide data needs explicit authorization distinct from personal customer data |
| Earnings, payouts, shop and checkout | Prototype workspace/commerce UI exists; public checkout closed | Requires actual commerce/payment/inventory operations. Do not label browser-created orders or earnings as real transactions |

## Implemented in this pass

`ProductionBooking` now checks the server configuration and opens the actual account booking route when enabled. Signing in or verifying registration at `/book` retains the booking intent. Customers can also open Book a visit from account navigation. Guest provider links go directly to the providers instead of sending users back into the sign-in screen.

`CustomerBooking` preserves the backend request contract while separating service, professional, location, date and time. Selecting a different upstream option invalidates previously loaded availability. Selection is locked during review, submission, and uncertain outcomes. Retrying an uncertain response uses the original request key. Quick dates are calendar dates in the selected location's timezone; the API still enforces actual working hours, booking windows, notice periods and conflicts.

`CustomerOverview` is the default account landing surface. `/api/v1/me/dashboard` reads a consistent D1 batch with server-scoped counts, nearest upcoming/active visit, four recently created appointments and three recent orders. Counts are not derived from truncated history. The owner and staff roles do not widen this customer view to other customers. No notes, password material or unrelated customer data are included. External provider appointments are not imported automatically, and empty orders are not filled with made-up purchases.

No migration or new environment flag is required. `npm run review` enables the implemented flow using its persistent local backend. Hosted feature gates and `main` remain unchanged.

## Verification and limits

Added SQLite API coverage for >100 pending records, nearest visit, note exclusion, foreign-account isolation, owner-role isolation, unsupported query parameters and anonymous access. Added React interaction tests for service/professional separation, clearing stale time selections and preserving idempotency across a failed submission. The local Workers check now exercises the new dashboard query.

These checks do not replace a browser/mobile review. Native guest-first booking, any-professional matching, full calendar presentation, appointment changes, operational dashboard aggregation and commerce are still explicit remaining features. This inventory should be updated with each restoration, rather than treating the existence of an old component as evidence that its server-backed workflow is complete.

## Next delivery order

1. Review the restored booking and overview against the original intended journey on desktop/mobile.
2. Restore customer change/cancel/proposal actions with staff review and transaction-safe scheduling.
3. Add public selection/authentication continuation and any-available-professional behavior.
4. Build staff and owner summaries from their authorized operational data; extend the shared customer foundation.
5. Complete durable walk-in/waitlist and commerce flows, then hosted provider verification and deployment acceptance.
