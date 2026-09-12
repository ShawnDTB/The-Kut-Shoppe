# Current state and visual consistency — September 12, 2026

Source baseline: `dev-branch` at `c8baaa72244f05d7f66ddebac076d3b3877986b7`, following the booking and commerce recovery. This is an assessment of the repository and local review implementation, not a claim that these features are deployed on the public domain.

## Assessment

The recovery has reconnected the main customer journeys. The next step should be completing their operational lifecycle, not another replacement of whole screens. Keep the restored Barber/Loctician gateway and service → barber → weekly date/time → review flow. Extend the current server-backed account and scheduling model when adding staff and owner capabilities.

| Area | Current implementation | Work that matters most |
| --- | --- | --- |
| Public site | Homepage, services/prices, crew, gallery, visit/map, review excerpts and policy routes | Consistent typography; image ownership/optimization; verify business content and remove outdated feature promises. Review rating/count are hard-coded, not live Google data. |
| Booking | Two entry choices; native Barber selection, any-available matching, weekly availability, verified-account request submission, signed quote and retry protection; Loctician provider handoff | Confirmed appointment changes/cancellations, alternative-time proposals and customer response. Native scheduling is not synchronized with Booksy or GlossGenius. |
| Customer dashboard/profile | Overview, appointments/orders and details, editable profile/address, verification/recovery, password/email changes and session revocation | Finish actions on existing appointments; improve status/event communication. Account export/deletion remains a handled process rather than automated self-service. |
| Staff | MFA, professional setup/approval, availability/time off, appointment request decisions and assigned visits | A full calendar and daily operations view, walk-ins/waitlist, change proposals and conflict-safe rescheduling. `/staff/calendar` currently opens assigned visits, not the old complete calendar. |
| Shop/customer orders | Published products, variants, cart, verified-account checkout, persistent unpaid pickup/shipping requests and order history | Order messages and fulfillment policies; reload recovery for uncertain checkout outcomes. Paid checkout requires its own payment/tax/shipping/refund implementation. |
| Owner operations | Protected catalog and order management, professional setup review | Safe role provisioning/revocation, larger-list pagination, product media tooling. No earnings/payout functionality yet. |
| Deployment | Worker/API implementation, D1 migrations through 0009, local review runner, security and concurrency checks | Isolated hosted staging, actual service credentials and delivery, owner bootstrap, backup/restore, monitoring, business/privacy approval and real-browser acceptance. Hosted feature defaults remain off. |

See [recovery details](restored-commerce-and-booking.md), [booking restoration](booking-page-restoration.md), and [deployment runbook](customer-deployment-runbook.md) for implementation boundaries. Earlier runbook milestone test counts are historical.

## Why the styling became inconsistent

`App.tsx` imported 36 stylesheets before this change, including successive “final” and “polish” passes. Their order, specificity and `!important` declarations determine the result. Individual fixes have accumulated instead of forming a shared system.

- Base `h1`/`h2` widths were capped at 13/14 characters. Some later sections narrowed them further. This encourages short stacked lines even when a panel has space.
- Headings mixed very large display sizes, line heights below 1, forced `nowrap`, and `overflow-wrap: anywhere`. Product titles, receipts, staff headers and marketing sections each had different rules.
- Five requested font families served overlapping purposes, and several selectors referenced an undefined `--heading-serif` variable.
- Background pseudo-elements stacked remote ornament images, patterned SVGs, repeated gradients and colored glows behind text and forms.
- Icons mixed externally hosted raster assets, font-dependent glyphs, monograms and tiny CSS masks. Their proportions and rendering did not match.

## Changes in this pass

1. Added `visual-system.css` as the shared typography and decoration contract. Page titles use a 2–3.5rem scale; section headings use 1.5–2.25rem; marketing headings use 2–3rem; product-card and dashboard-panel titles stay smaller. Headings wrap normally with readable line height and no narrow character cap. Header action rows can wrap independently.
2. Kept Judson for display and Mulish for interface/body text; removed the three redundant font requests and defined the missing serif alias. Removed the base heading character caps.
3. Removed decorative wallpaper pseudo-elements from content surfaces and title ornaments. Real hero, shop, staff, product and gallery photos remain. This is not an audit or replacement of all remote photographic files.
4. Added six matching decorative SVG service symbols, reused in the original two-choice booking gateway. Adjacent text continues to identify the service. Changed tiny navigation scissors to a current-page line and ambiguous trust illustrations to simple list markers.
5. Removed homepage claims that a same-day waitlist appears automatically. The copy now directs walk-in questions to the shop, matching the implemented flow.

The shared sheet is a containment step for the existing cascade, not completion of CSS consolidation. Important heading-size/line-height declarations are explicitly documented there because older sheets already use important sizes. Future changes should use these shared scales; retire obsolete rules component by component with visual comparisons instead of adding another polish file. No booking API, selection state, calendar controls, order workflow or permission behavior changed.

## Recommended implementation sequence

### 1. Complete the appointment lifecycle

Add customer cancellation/reschedule requests, staff alternate-time proposals and customer acceptance to the existing transaction model. Define shop cutoff and cancellation rules before encoding them. Preserve history, recheck identity/ownership, handle staff/customer races, and notify both sides. Acceptance: an existing appointment can be changed without creating a duplicate or losing the original when the new time conflicts.

### 2. Complete the daily staff workspace

Build the calendar from the same authoritative appointments, availability and time-off records. Add explicit walk-in/waitlist states and assignment only when the backend exists. Acceptance: staff can plan and run a day, and customers never see a slot that was silently assigned through another website workflow. Decide how the team avoids conflicts with external provider calendars before native booking goes live.

### 3. Finish the order-request lifecycle

Add order confirmation/status notifications and management pagination. Improve recovery after a checkout reload with server-owned request identity. Define fulfillment expectations and inventory handling with the owner. Keep unpaid requests clearly labeled. If online payment is wanted, implement provider checkout/webhooks, reconciliation and refunds as a separate milestone rather than relabeling requests as purchases.

### 4. Prepare a hosted staging release

Provision isolated resources and real email/Turnstile configuration. Rehearse owner/staff setup, authorization boundaries, backups and restoration. Confirm retention/deletion handling and the published privacy/terms content against actual business practices. Exercise account, booking and order journeys in separate customer/staff browser sessions. Enable production features only after these checks; a passing local build does not provide hosted delivery or operations.

### 5. Finish visual and asset acceptance

Review `/`, `/services`, `/team`, `/gallery`, `/reviews`, `/visit`, `/book`, the booking table, `/shop`, a long product title, `/cart`, `/checkout`, account/profile/history and staff/owner pages at 360, 390, 768 and 1440px, plus 200% zoom. Check readable titles, action rows, keyboard focus, no body overflow, and image crops. The seven-column booking week intentionally scrolls on narrow screens; preserve that control rather than shrinking dates into unusable cells.

Select approved original photographs, move them to controlled hosting before retiring WordPress, create responsive sizes, and verify crops before replacing image URLs. Keep photos as evidence of the shop and its work, not extra form backgrounds. Font requests are reduced but still external; external fonts/maps and image dependencies remain part of launch review.

## Validation limits

`npm run check` passed: all 162 tests, type checking, lint, client/SSR builds, bundle budgets, production output and Worker/D1 checks. Budget measurements were 104.08 KiB JavaScript (120 KiB limit) and 34.73 KiB CSS (40 KiB limit), gzip. This pass does not add tests that merely duplicate CSS declarations. Existing restored booking and commerce journey tests protect the working behavior.

The browser service rejected the local preview URL with `net::ERR_BLOCKED_BY_CLIENT`. No desktop/mobile screenshots or layout measurements were obtained, and this pass must not be described as browser-accepted. Run the visual matrix above against `npm run review` before merging to main. All work stays on `dev-branch`; no deployment or main merge is included.
