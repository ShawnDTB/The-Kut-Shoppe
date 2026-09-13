# Customer, mobile and in-person operations audit

Date: September 13, 2026. Repository baseline: `dev-branch`, `3071cc8ef8bd67b1442bfa669f0d5d50a81549c2`.

## Executive assessment

The product has a useful server-backed foundation, but it is not yet a complete shop operating system. Customers can create accounts, book/request a visit, request cancellation, browse products and submit unpaid orders. The missing work connects those actions to a working day in the shop: changing visits, taking walk-ins, checking people in, recording payment, issuing receipts, completing service/fulfillment and reconciling money and inventory.

Prioritize mobile access first, then customer lifecycle and action visibility, then the shared sale/payment model and front-desk operations. Retain the restored two-choice booking gateway, weekly date/time flow, server identity and conflict protection. Refine dashboard presentation around real actions rather than removing information or introducing decorative statistics.

This document is analysis and proposed design. It does not claim implementation of the proposed features. The prior implementation passed 169 tests; those tests do not constitute mobile, screen-reader, terminal or hosted acceptance. Local preview access was blocked by the browser service in the preceding visual review. This audit uses current source and official platform documentation, not authenticated competitor dashboards or a new visual reproduction of the reported clipping. It assesses the repository, not the separately hosted WordPress website. No feature is marked complete merely because a prototype, CSS class, database status or provider capability exists.

Execution tasks and completion criteria are in [the implementation backlog](launch-implementation-backlog.md).

## 1. Current journey coverage

| Journey | Current evidence | Gap to a usable launch |
| --- | --- | --- |
| Mobile navigation | `Layout.tsx` portals a labelled drawer, moves focus to Close, supports Escape and locks body scrolling | Reproduce top clipping; consolidate conflicting scroll rules and breakpoints; contain focus, make background inert and return focus. |
| Customer access/profile | Current account backend supports verification, recovery, profile/address updates, password/email changes and session revocation | Full device/keyboard acceptance; validate error association, paste/autofill and expired-session recovery. Exercise every customer action, not just signup. |
| Dashboard | `CustomerOverview.tsx` and `/me/dashboard` show counts, next visit, profile and recent records | Cancellation requests are absent from the pending count; recent appointment activity sorts by creation, not latest activity; actionable changes/payment/receipt data are absent. |
| Barber booking | Restored gateway and service/professional/week/date/time selection; signed quote and server request transaction | Reschedule and proposals; guest front-desk booking; reload recovery; policy-aware actions and actual hosted notifications. |
| Loctician booking | Existing provider handoff | It is not synchronized into website account history. Explicitly preserve this boundary until provider access and operating arrangements are verified. |
| Cancellation | Future confirmed website visits can request cancellation; assigned staff approve/decline; pending keeps time reserved | Current milestone allows one request per appointment and requires a decision before the start. Follow-up/reopening and overdue requests need operational treatment. |
| Staff | Setup/approval, MFA, availability/time off, request decisions and assigned visit lists | Full day/week calendar, check-in/service/completion/no-show commands, walk-in queue, cashier access and reception tools. |
| Shop | Catalog, variants, stock-aware cart, saved unpaid pickup/shipping requests, protected product/order administration | Electronic processing, cash tender, true payment receipts, tax/shipping policy, refunds, order notifications, guest counter sale and reconciliation. |
| Customer documents | Appointment calendar download and order/request detail/confirmation surfaces | Print/email booking confirmation, durable paid-sale receipts, refund documents and a customer document list. `commerce_receipts` is an internal transaction guard, not a customer's proof of payment. |
| Owner | Product/order management and professional review | Role provisioning/revocation, front-desk permissions, cashier reconciliation, financial reporting and operational exception queues. |
| Deployment | Migrations through 0010; local review runner; API, transaction and Worker tests | Real staging resources/providers, validated policies, backup/restore, monitoring, media ownership and real devices. |

## 2. Mobile menu and accessibility

### Source findings

The user's report is a release-blocking navigation symptom. We must test both the visible site header after shrinking a desktop browser and the opened mobile drawer; these can have different causes.

1. **Breakpoint mismatch:** `Layout.tsx` closes the drawer on resize at `min-width: 981px`, while `final-mobile-performance-pass.css` displays mobile navigation through 1040px. At 981–1040px the mobile trigger is present but resize handling treats the screen as desktop.
2. **Competing scroll containers:** the original drawer uses `overflow: hidden` and a scrollable `.mobile-drawer-content`. `polish-round-5.css` overrides the drawer to `overflow: auto !important` while leaving the inner scroller. The header is sticky inside the outer scroll container. Opening resets the outer drawer's scroll position, not explicitly the inner container.
3. **Viewport and width conflicts:** the overlay uses forced `100vw`, `100dvh` and a `100svh` minimum. Earlier drawer max-width rules remain alongside later grid sizing. This needs testing with scrollbar widths, short landscape windows, browser chrome and zoom. A giant z-index does not correct incorrect geometry.
4. **Page locking:** opening sets `body` to fixed with a negative top inset based on document scroll. Cleanup restores position/overflow but clears inset rather than preserving its prior value. Check opening at the top and far down the page, rotating, crossing the breakpoint and reopening. This is a possible contributor, not a proven explanation of top clipping.
5. **Modal behavior is incomplete:** there is no keyboard focus trap, background `inert` handling or explicit return to the menu trigger in this component. A portal and `aria-modal` alone do not implement those behaviors.

### Recommended implementation

Move drawer ownership into one dedicated component/stylesheet and remove its older competing declarations. Use one shared breakpoint, a viewport-anchored shell, a non-scrolling close/header row and one flexible scrollable content area. Include safe-area padding and a viewport-height fallback. Keep the dark solid surface, ivory text, restrained warm accent, existing logo and clear Book/Account/Cart actions. Put hours in the existing expandable section so they remain available without crowding primary navigation.

Prefer a native modal dialog where the supported-browser matrix allows it; otherwise implement the full equivalent focus/inert lifecycle. Preserve scroll position and previous inline styles, handle Escape/backdrop/route change consistently, and close cleanly when returning to desktop. Apply the same modal contract to cart drawers and confirmation dialogs.

The W3C modal pattern specifies contained tab focus, inert background content and appropriate focus return. Use it as behavioral acceptance guidance, not just an ARIA checklist. [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

### Accessibility acceptance matrix

- Widths: 320, 360, 390, 768, 980, 981, 1024, 1040, 1041 and 1440 CSS pixels. Include short 320–430px landscape heights.
- Test 200% text resizing and 400% zoom/reflow. Menus, forms and receipt text must not require whole-page horizontal scrolling. Genuine calendar/table regions may scroll independently; offer an agenda/list view when practical. [W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
- Keyboard: Tab/Shift+Tab, Escape, return focus, predictable date/time selection and visible focus that sticky headers cannot cover.
- Assistive technology: meaningful headings/landmarks, input labels and instructions, field-specific errors, summary links to invalid fields, status announcements and no success conveyed only by color.
- Touch: use 44–48px project targets for main controls, visible selected states and no hover-only actions. This is our design target, not a blanket statement of the WCAG minimum.
- Exercise password managers, paste, autofill, screen keyboards, reduced motion, enlarged text and long customer/product names.
- Aim for WCAG 2.2 AA; verify text/control contrast with measurements. Do not declare conformance from visual inspection or automated checks alone.

## 3. Competitor/platform findings

These are documented product/API patterns. The benefit column is our proposed application, not a claim that a competitor uses our architecture or that its private dashboard was tested.

| Reference | Verified pattern and limitation | What benefits this product |
| --- | --- | --- |
| **Acuity Scheduling** — broad appointment-based businesses | Its reschedule API supports a new date/calendar and availability queries that ignore the appointment being changed. Admin rescheduling can disable validation. | Reuse the booking selector, exclude only the authorized original appointment from its own overlap check, and preserve server validation for staff operations. Do not inherit an unrestricted admin bypass. [API reference](https://developers.acuityscheduling.com/reference/put-appointments-id-reschedule). |
| **Cal.com** — meeting/team scheduling | Separate reschedule and request-reschedule endpoints exist. The latter explicitly cancels the original and emails a new booking link. | Distinguish changing an appointment from inviting someone to rebook. Our proposed pending-change flow retains the original until the replacement is accepted; calling a similarly named API is not enough. [Reschedule](https://cal.com/docs/api-reference/v2/bookings/reschedule-a-booking), [request semantics](https://cal.com/docs/api-reference/v2/bookings/request-to-reschedule-a-booking). |
| **Calendly** — professional scheduling | A reschedule produces both created and cancelled invitee events, with old/new invitee relationships. | Keep a durable change history and deduplicate/correlate events. A reschedule must not become two revenue events, duplicate confirmations or an accidental refund. [Webhook behavior](https://developer.calendly.com/docs/api-guides/see-how-webhook-payloads-change-when-invitees-reschedule-events). |
| **SimplyBook.me** — services plus client portal/POS | Client rescheduling exposes account/email actions and restrictions; it is documented as incompatible with Approve Bookings. Its POS combines services/products and guest clients, but records payments rather than operating an integrated card terminal. | Put changes next to the appointment; test feature combinations. Provide a unified counter sale while distinguishing recorded cash/external tender from a card actually processed by a reader. [Rescheduling](https://help.simplybook.me/wiki/Client_Rescheduling_custom_feature), [POS](https://help.simplybook.me/wiki/Point_of_Sale_custom_feature). |
| **Square** — retail and in-person payment platform | Payments API records cash received and change. Terminal API pairs a custom POS with a device and reports asynchronous card checkout outcomes; cash is handled separately. | A strong integration candidate for a shop counter. Unify sale references across online, terminal and cash flows without pretending a browser button or cash entry ran a card transaction. [Cash payments](https://developer.squareup.com/docs/payments-api/take-payments/cash-payments), [Terminal API](https://developer.squareup.com/docs/terminal-api/overview). |
| **Stripe** — online and in-person payment infrastructure | PaymentIntents model a payment lifecycle. Terminal supports prebuilt or custom receipts with required payment information. | Separate money movement from appointment/order status; persist attempts and provider references. Use processor-hosted payment collection and processor receipt data instead of building raw card forms or inventing receipt fields. [PaymentIntents](https://docs.stripe.com/payments/payment-intents), [Terminal receipts](https://docs.stripe.com/terminal/features/receipts). |

Acuity also documents overlapping webhook categories that can deliver duplicate updates. Event-driven integration needs idempotency even when the UI looks like a single action. [Acuity webhooks](https://developers.acuityscheduling.com/docs/webhooks).

### Integration direction

Keep our customer experience and business data model. Compare **Square online + Terminal** against **Stripe online + Terminal** using the shop's actual merchant account, hardware, seller structure and support needs. Square is the initial counter/POS candidate from this research; Stripe remains a credible alternative for a custom payment flow. This is a shortlist, not a purchasing decision or a claim about relative fees.

Do not add a second scheduling engine merely to imitate a competitor dashboard. The current native booking engine already handles availability and transactions. External Booksy/GlossGenius appointments require either a verified supported integration or a deliberate cutover/operating boundary before the same barber's time is sold through both systems. Provider handoff alone is not synchronization.

## 4. Dashboard design direction

Retain the dark, ivory and warm-accent identity. Use Judson for the greeting/primary heading and Mulish for controls, dates, tables and supporting text. Keep interface heading sizes restrained; reserve larger editorial typography for public marketing sections. Use a consistent spacing scale and opaque, quietly separated surfaces. Place real photographs on public/crew surfaces, not behind account data.

### Customer overview hierarchy

1. **Needs your attention:** pending change proposal, cancellation awaiting review, balance due or pickup ready. Show the specific action and status, with no artificial badge when nothing needs attention.
2. **Next visit:** large readable date/time, service, professional, location, confirmation state and payment/balance state. Put View details first, with Change/Cancel only when allowed; directions and calendar actions remain secondary.
3. **Orders:** concise fulfillment rows with a meaningful order reference, amount/payment state and next action. Let customers open receipts from the relevant order.
4. **Recent activity:** actual event chronology, not merely the newest records by creation. Include decisions and changed times so older appointments with recent actions do not disappear.
5. **Profile/security:** compact summary and links, with private data shown only where useful. Avoid repeating a full address throughout the dashboard.

Move lifetime completed/order counts below current tasks. On mobile, stack these in the same priority order and use a compact customer section navigator. On desktop, make the next visit dominant with a narrower action/order column. Do not introduce extra charts until they answer a customer question.

Use explicit text states such as “Confirmed · Pay at shop” and “Cancellation requested · Visit still confirmed.” Colors and icons supplement those words. Every card needs loading, empty, unavailable, stale, permission and error states. A failed refresh should not erase all useful previously loaded data without explaining its age.

### Staff and owner extension

Reuse navigation, typography, status presentation, forms, record details and document components. Staff need a day agenda, incoming requests, check-in queue and checkout. Owners add catalog, staffing, cashier reconciliation and operational exceptions. Server capabilities determine access; an owner is not automatically the assigned professional for every appointment. Shared styling must not imply shared access to all customers' records.

## 5. Rescheduling design

Implement an explicit change-request record with immutable history and its own version/decision receipt. Initial scope: same service, professional and location with a different date/time. Later support professional/service changes with explicit duration and price review.

Proposed lifecycle: requested → approved / declined / withdrawn / expired / superseded. Staff may issue a proposed alternative for customer acceptance. Keep the appointment itself confirmed at the original time while a change is pending; do not overload one appointment status to mean both its current reservation and an undecided change.

Recommended initial hold policy: do not hold a requested replacement time indefinitely. State that it is a preference until approved and recheck at acceptance. If a timed offer hold is added, display its expiry and release it automatically; it must use the same reservation model. The original remains reserved until the replacement is committed atomically.

At approval/acceptance, recheck identity, capability, appointment version, still-pending request, service eligibility, time zone, hours, time off, buffers, notice/window policy and conflicts. Exclude only this customer's original appointment when evaluating a move that overlaps itself. A failed move leaves the original untouched. Preserve payment/deposit references; changing the time does not charge again or automatically refund.

Persist old/new times and actor decisions, update account activity, queue one notification per event, and regenerate confirmation/calendar data. Permit withdrawal of a pending change. Define cancellation-versus-reschedule precedence so a concurrent cancellation cannot leave a replacement appointment active. Handle stale links, reloads, simultaneous staff actions, DST transitions and request expiry.

No arbitrary cutoff or fee is chosen in this audit. Make the shop's chosen policy visible before submission. Until set, manual approval and clear status are safer than promising instant changes.

## 6. Booking documents, receipts and money

### Separate document types

| Document | Created when | Must communicate |
| --- | --- | --- |
| Request acknowledgement | Appointment/order request persists | Reference, requested details and pending status; no claim of confirmation or payment. |
| Booking confirmation | Staff accepts or a permitted instant booking commits | Appointment reference, service, professional, date/time/time zone, location, policy/help links, amount paid and balance if applicable. |
| Payment receipt | Cash tender is recorded or processor payment succeeds | Durable receipt number, seller/location, timestamp/currency, item snapshots, discounts, tax, tip, tender, amount paid and remaining balance; processor-required fields for card-present payments. |
| Refund/adjustment document | Refund or correction is recorded | Link to original receipt, amount/method/reason and actual status; a refund request is not a settled refund. |

Provide accessible account views, email delivery/resend and print layouts. Store immutable issued snapshots; later product names/prices must not rewrite a historic receipt. Keep internal transaction receipts distinct from customer documents. A server-generated printable HTML receipt can be the first document implementation; downloadable PDFs and thermal formats can follow the actual hardware requirement. Do not print customer addresses on pickup receipts unless necessary.

### Proposed financial model

Introduce a sale with service/product line snapshots, adjustments, currency and tax/fulfillment totals. Link appointments and orders to it. Track payment attempts, tenders, refunds and allocations separately from fulfillment/visit states. A completed haircut can still have a balance; a prepaid product can still await pickup.

Cash tender needs amount received, amount applied, change given, cashier, location/register session and idempotent receipt. A “Pay cash at shop” online choice records an unpaid balance, not cash received. Card payments need server-priced amounts, provider IDs, signed webhook verification, replay protection and reconciliation for late/duplicate/out-of-order outcomes. Never mark paid from a browser redirect or accept a client-supplied total as authoritative.

Create a sale/payment attempt durably before the external call. Retain stable references across refreshes and uncertain responses. After timeout, check the existing attempt before starting a new charge. Reserve/release stock or booking holds consistently with payment expiry; reconcile a payment that succeeds after a hold expires through a controlled exception/refund process. Refund acceptance must not automatically restock an item that has not been returned.

Support full cash and full card first; model allocations so deposits and cash/card splits can be added without a rewrite. Partial payments, tips, discounts and deposits require explicit business rules before exposure. Keep manual cash/external tender entry permission separate from refunds, price overrides and financial reports. Reversals must remain in audit history.

Decide **who is the seller and receives funds** before activating a processor: the shop, each independent professional, or both by sale type. A multi-seller arrangement changes onboarding, payouts, refunds and mixed-cart allocation. Do not assume one merchant account may collect for everyone. Have the business confirm tax, receipt, retention and cancellation practices with its advisers; this audit does not set legal or tax policy.

## 7. Walk-ins and front-desk operation

A person must be able to walk into the shop, receive a service, buy merchandise, pay cash and leave with a receipt without creating an online account.

Proposed front-desk flow:

1. Select existing customer or create a minimal guest visit. Do not require an email for a cash walk-in. Separate receipt contact from marketing consent.
2. Select service and eligible professional; choose now or a future opening using the same availability/conflict rules as online booking.
3. If unavailable, add a visible queue entry with preference and arrival time. Estimated waits are estimates; do not publish an exact promise unless supported by actual operations.
4. Check in → waiting → assigned/ready → in service → completed, with no-show/left/cancelled alternatives. Only assigned/reserved visits consume a specific calendar slot; define queue priority and capacity explicitly.
5. Open checkout from the visit, add products if needed, calculate current approved totals and collect cash or send the amount to a paired card terminal. A merchandise-only sale must also work.
6. Record the tender, issue/print a receipt and update stock/service status. Staff can find and reprint the same receipt later.
7. Close the register: opening float, expected cash, counted cash, change, cash refunds, paid-in/out, variance and responsible operator. Keep money reconciliation separate from staff earnings/payouts.

Receipt lookup for a guest must not expose records by order number alone. Any later account claim requires verified ownership; matching a typed email/name/phone is insufficient. Public queue screens should avoid full personal details.

Plan for internet/terminal failure. Do not promise offline card acceptance without a supported processor/hardware flow. For an initial online-only POS, present a clear unavailable state and an approved manual cash continuity procedure with controlled later entry; do not report an unsaved transaction as complete.

## 8. What “usable launch” means

For the selected scope, a customer and staff member can complete normal journeys and recover from common failures without database edits, fake accounts or developer intervention. It is not a feature percentage and does not mean every competitor feature must be built.

Required launch journeys:

- Mobile visitor finds services, opens/closes menu, books, signs in and completes verification without losing the selected visit.
- Customer sees the correct visit, changes it, cancels it, downloads confirmation, updates profile/security and sees current decisions.
- Cash walk-in and card walk-in work from arrival through service, checkout and receipt without requiring online signup.
- Online merchandise purchase and in-person product sale share inventory; the last unit cannot be sold twice.
- Pickup/shipping orders show accurate payment and fulfillment states, notices, receipts and refund outcomes.
- Staff can manage the day, exceptions, time off and requests; owner can manage access, catalog, register totals and failed operations.
- Staging demonstrates duplicate clicks, refreshes, expired sessions, unavailable slots, abandoned checkout, processor timeout, duplicate webhook, terminal cancellation, email failure and restored database behavior.

Additional release requirements: controlled media hosting before WordPress retirement; approved business hours/prices/review claims; working 404/links/metadata; legal pages matching actual operations; HTTPS/secrets/cookie/origin configuration; role/ownership checks on every record/document; log redaction and retention; backup restoration; notification/payment failure alerts; dependency review; incident ownership; real device/assistive technology acceptance.

Loyalty points, memberships, gift cards, recurring appointments, complex analytics and automated staff payouts may follow launch unless the owner identifies them as existing business requirements. Cash recording, receipts, secure money handling and basic appointment changes are core to the scope requested here.

## 9. Decisions that affect implementation

Record these before their dependent phase; they do not block mobile fixes, dashboard work or the first rescheduling implementation:

| Decision | Why it matters | Working direction |
| --- | --- | --- |
| Seller/merchant per service and product | Payments, mixed sales, refunds, payouts | Verify shop versus independent professionals before choosing account structure. |
| Existing processor/readers/register/printer | Hardware compatibility, effort, receipt output | Inventory current equipment; evaluate Square and Stripe against it. |
| Booking source of truth | Double-booking prevention | Native scheduling only where external calendars have a verified integration or explicit cutover boundary. |
| Reschedule/cancel/deposit/no-show policies | What customers can do and what money changes | Manual review until approved rules exist; preserve the original during a pending move. |
| Cash/card/split/deposit/tip rules | Sale model and reconciliation | Full cash/card first; keep allocations ready for later combinations. |
| Shipping and tax rules | Accurate totals before charging | Confirm products, locations, shipping methods and calculation approach. |
| Guest handling and front-desk access | Usability/privacy/authorization | Minimal guest visits, scoped cashier capabilities, verified later claims. |
| Outage and support ownership | Real-world continuity | Document fallback and reconciliation; nominate who resolves exceptions. |

## Recommended order

1. Repair and verify mobile navigation/accessibility.
2. Upgrade dashboard hierarchy and complete customer action/status consistency.
3. Implement rescheduling and customer/staff proposals with conflict and retry tests.
4. Establish sale, payment and document models; deliver booking confirmations early.
5. Build front-desk guest booking, walk-in/day operations and cash checkout/receipts.
6. Integrate online and terminal payments, refunds, order communications and reconciliation.
7. Complete inventory/fulfillment, owner controls, staging, recovery and device acceptance.

Keep each milestone reviewable on `dev-branch`, with migrations and acceptance evidence. Main remains a release decision after the agreed journeys pass.
