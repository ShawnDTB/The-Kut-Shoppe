# Complete baseline comparison and recovery recommendation

Implementation follow-up: [Shop and booking recovery](restored-commerce-and-booking.md) records the subsequent restoration, tests and remaining gaps. This comparison preserves the pre-restoration evidence at `3c614b5`.

## Scope and conclusion

Compared the exact Git baseline `536bd36` with current `dev-branch` at `3c614b5ec908015cf8d4192091d52a11c4a3f854`. GitHub confirms that current branch head. This is an analysis of the repository website and its local review modes, not an audit of a deployed WordPress instance or a claim that either version has been browser-accepted in this session.

**The regression is real. Use the older interface and workflows as the restoration baseline, and retain the newer backend as the implementation foundation. Do not reset the entire branch.** The original booking and shop were interactive implementations with meaningful validation and state transitions. Their local storage limitations justified backend work before public operation; they did not justify removing the entire development experience or treating every shop feature as dependent on payment processing.

The central migration mistake was replacing reachable product flows before their replacements reached functional parity. Subsequent changes added valuable backend capabilities but did not close all the resulting user-facing gaps. The recent booking/overview restoration is a partial recovery, not a return to the baseline experience.

## Evidence and verification

- Compared route dispatch, header/cart behavior, runtime mode selection, booking, customer/staff dashboards, storefront/product/cart/checkout, product/order management, data adapters, API dispatch, deployment settings, security headers and production checks.
- Inspected `536bd36` in a separate detached worktree. TypeScript, ESLint, all **58 baseline tests**, client/SSR builds, prerendering and bundle budgets passed. This used the installed dependency tree shared with the current checkout, not a fresh install of the historical lockfile. It establishes source compatibility here, not an exact historical dependency reproduction.
- Current `3c614b5` has a successful [GitHub Quality run](https://github.com/ShawnDTB/The-Kut-Shoppe/actions/runs/34656455897). Its prior local verification passed **150 tests**, builds, production gates and Workers/D1 checks.
- No diff exists between baseline and current for these inspected core files: `Booking.tsx`, `CustomerAccountDashboard.tsx`, `StaffAccountDashboard.tsx`, `StorefrontV5.tsx`, `CommerceCustomerV5.tsx`, `CartPageV4.tsx`, `ProductAdminHubV5.tsx`, `OrderAdminV5.tsx`, `auth-v2.ts`, `platform.ts`, `storefront.ts`, and `session.ts`. The major original implementation is still present.
- The homepage component and pre-existing CSS files are unchanged in this comparison. A new account stylesheet was added. The primary loss is operational route reachability and workflow substitution, not wholesale deletion of the website design.
- No application code, environment flags, `dev-branch` reference, or `main` reference was changed for this analysis. This report is the only deliverable added to the current checkout.

## What existed at 536bd36

### Booking

`Booking.tsx` implements a staged Service → Barber → Appointment → Details journey, followed by confirmation. It supports service selection, named or any-available professional, a week-based calendar, available time slots, notice/window rules, customer contact details and notes, and appointment requests. Query parameters include `type`, `barber`, and `appointment`; the last connects the customer change-appointment action back to scheduling. The flow checks ownership before loading an appointment for editing. Same-day availability and waitlist paths are represented. `/book/walk-in` has a separate entry point.

`platform.ts` implements eligible professionals, working windows, generated slots, conflict checks, any-available matching, request creation, confirmation/decline, alternative-time proposals, customer responses, and walk-in claiming. These were actual local operations. Requests are stored in browser localStorage and notifications are queued in a local outbox. The records and availability are not a shared authoritative schedule across different customers' devices.

### Customer accounts and dashboards

The baseline already had an account tab shell, so tabs themselves are not the cause of the regression. The richer appointment cards displayed date, time, barber and status, with change/cancel controls, policy-window explanations and accept/decline actions for proposed times. Order cards linked to detailed receipts. Contact/profile, address and security controls were present. Non-customer identities entered staff/management dashboards through role-aware routing.

Identity, session and capability logic existed in `auth-v2.ts` and `session.ts`, including earlier fixes preventing managers from modifying owner/developer roles. Nevertheless, roles and records were browser-controlled. Customer appointment ownership often used email rather than the new server's immutable user ID. Those are concrete data-authority limitations, not reasons to discard the interface.

### Shop and checkout

`StorefrontV5.tsx` supports published products, category filters, product details, variant choices, stock-aware add-to-cart, a cart drawer, quantities, removal and subtotals. Product management includes product records, variants, inventory, images, publishing and presets. Order management and customer receipts provide the downstream workflow.

`CheckoutPageV5` explicitly supports **pickup and shipping requests**, validates contact/shipping fields, creates an order request, clears the cart and shows a receipt. Shipping requests enter `payment-required`; pickup requests enter `submitted`. The receipt explicitly says it is not proof of payment, and shipping/tax/payment are confirmed before acceptance. There is no card collection or completed payment-provider integration in this inspected flow.

This distinction changes the recovery plan: Stripe or another online payment service is not a prerequisite for restoring catalog browsing, cart interaction, or an unpaid order-request workflow. A shared database and authoritative order/stock validation are prerequisites for accepting those requests from real customers reliably.

Products, orders and reservations were localStorage-backed. Development sample products were seeded in Vite development. A fresh production browser did not acquire a shared published catalog merely by building the baseline. Local stock calculations did not protect against purchases submitted from other devices.

### Staff and owner operations

The earlier UI included chair/shop navigation, a calendar, request handling, waitlist, services/pricing, working hours, booking rules, product/order management and an account role manager. Staff pages calculate gross service totals from completed local appointments. Tips, adjustments and payout figures include unfinished/zero states; automated payout connection is explicitly disabled. It would be inaccurate to say all payout features were complete at the baseline.

## Route-by-route comparison

| Route or feature | 536bd36 | Current normal/review route | Assessment |
| --- | --- | --- | --- |
| `/book` | Original staged booking UI | New sign-in-first booking when server gates are enabled; otherwise provider links | Partially restored, not original parity |
| Guest browsing before identity | Service/barber/date choices before details | Account sign-in precedes native selection | Lost interaction flow |
| Any available / barber preselection | Implemented in original booking | Current new form requires explicit professional; old query behavior not fully carried over | Missing |
| Calendar | Week-based presentation and navigation | Date shortcuts/input followed by times | Simplified replacement |
| `/book?appointment=…` | Change an owned appointment | New native flow does not implement the edit journey | Missing; must not create an unintended duplicate request |
| `/book/walk-in` | Walk-in entry | Provider-booking screen | Disconnected |
| `/shop` | Catalog/filter/cart drawer | Contact-only shop screen | Entire workflow disconnected |
| `/shop/:slug` | Product/variant detail | Same contact-only shop screen | Disconnected |
| `/cart` | Cart quantities/removal/totals | Same contact-only shop screen | Disconnected |
| `/checkout` | Pickup/shipping request and receipt | Same contact-only shop screen | Disconnected, not just missing payments |
| Header cart | Quantity and cart link | Hidden outside legacy preview | Deliberate removal |
| `/account`, `/dashboard` | Customer detail cards or role-specific dashboard | New shared account with overview and tabs | Valuable new data foundation, incomplete action parity |
| Customer change/cancel/proposal response | Interactive local controls | Details/calendar export and unconfirmed withdrawal; confirmed changes not implemented | Missing |
| `/staff/*` | Distinct operational routes | All sent to `CustomerAccount`; functionality lives under new query-based tabs | Old URLs lose intended meaning |
| `/admin/products`, `/admin/orders` | Distinct management workspaces | Sent to `CustomerAccount` without corresponding commerce tooling | Missing |
| Staff requests/availability/visits | Browser-backed operational UI | New protected APIs and account tabs | New implementation worth retaining |
| Owner role management | Browser-local account role editor | No equivalent production role mutation endpoint | Missing; a permission helper is not a working management API |
| Notifications | Local outbox | New account email integration and separate appointment-email Worker; hosted dispatch not configured | Better backend, incomplete delivered workflow |

## Exactly where and why the regression happened

The decisive change is `0ab7c2a`, immediately after the requested baseline. It changed 41 files and introduced the server account foundation plus production gating.

1. `App.tsx` removed the original operational component imports and direct route dispatch. It mapped booking to `ProductionBooking`, all commerce routes to `ProductionShop`, and staff/admin routes to `CustomerAccount`.
2. The original screens were moved behind `LocalPlatformPreview`, requiring both Vite development and `VITE_LOCAL_PLATFORM_PREVIEW=true`.
3. The header hid the cart outside that mode. Sample product seeding also became conditional on legacy preview.
4. Server gates defaulted to false and the hosted D1 identifier remained an all-zero placeholder. A plain frontend server could not supply the new APIs.
5. `scripts/check-production.mjs` asserts that the committed operation gates remain false and checkout contains “Online ordering is not open yet.” Its tests intentionally preserve the closed state. They must evolve with a reviewed environment/capability release plan; simply removing checks would not implement missing services.
6. Later commits added authenticated booking requests, staff decisions, MFA, onboarding, schedules and visits. `a2040b9` made them locally runnable; `3c614b5` restored a booking entry and overview. Neither supplied server commerce or restored the complete baseline UI.

The valid concern was exposing browser-trusted identities, schedules and order records to public production. The excessive response was applying that concern to the whole development/review experience, including read-only storefront browsing and unpaid request checkout, without preserving visible parity or providing an equally complete replacement. Deployment safety and product completeness were treated as the same switch.

The original 58 adapter tests can still pass while those adapters' screens are unreachable. The larger current suite establishes useful backend behavior, but does not certify every baseline journey through its original URL. This is why test counts did not prevent the regression.

## Newer work to preserve

- Server-owned identities and record ownership; hashed passwords and opaque session cookies.
- Verification/recovery, current-password checks, dual-inbox email changes and session revocation.
- D1 migrations, private record APIs, pagination and calendar export.
- Server scheduling, timezone handling, signed quotes, idempotent request retries and transaction/conflict controls.
- Professional decisions, setup review, MFA and schedule protections.
- Transactional appointment outbox and worker delivery machinery, while distinguishing provider acceptance from inbox delivery.
- Dashboard API and informative summary data; privacy headers, no-index handling and bundle checks.

This is a useful backend to attach to the earlier interface. Restoring the old components wholesale without changing their adapters would not automatically use any of it.

## Recovery options

| Option | Benefit | Cost / limitation | Verdict |
| --- | --- | --- | --- |
| Reset dev-branch to 536bd36 | Exact historical source experience | Removes newer work from branch tip, complicates collaboration, restores browser-only authority; does not provision services or migrate D1 backward | Not recommended |
| Revert all later commits with new commits | Preserves history while returning old source | Same product/backend losses, unnecessary removal of useful work | Not recommended |
| Continue expanding the replacement screens | Keeps current implementation shape | Requires recreating already-designed flows and risks drifting farther from the requested product | Not the preferred UI direction |
| Restore baseline interface, adapt it to retained backend | Recovers original experience while preserving data/security improvements | Requires explicit boundary work and complete journey tests | Recommended |

## Concrete recovery sequence

### 1. Recover the complete baseline experience for comparison

Use the retained legacy mode in the current branch to review the original booking, shop, cart, checkout and management surfaces. For the exact historical reference, use the detached baseline checkout. Keep this separate from the server review identity/database so there is no silent fallback or accidental mixing of account stores. A first implementation change should make these two development modes unmistakable and easy to launch rather than hiding one behind undocumented settings.

No branch reset is needed to view the old experience today. In the current project, set `VITE_LOCAL_PLATFORM_PREVIEW=true` in `.env.local`, then run `npm run dev`. This flag does not affect `npm run review`, which builds production assets. Use test information. Data from the server review at port 8788 does not become browser-preview data at port 5173; old local records are origin-specific.

### 2. Treat 536bd36 as the accepted feature/interaction baseline

Capture an explicit checklist for every route in the table. Reuse its screens, visual hierarchy, calendar, product detail, cart drawer, checkout and management workspaces. Preserve subsequent useful overview additions where they fit. Refactor data calls behind typed service boundaries rather than replacing the screen with a smaller substitute.

Use the server identity everywhere in the integrated mode. Translate legacy concepts deliberately: customer email ownership → immutable ID; `barber` display role → server `staff`; hyphenated/underscored statuses; date/time pairs → timezone-qualified timestamps; client prices → server quotes. Avoid two authoritative copies of appointments or orders.

### 3. Restore shop as a first-class deliverable

Do not put this behind payments again. Implement a published catalog API plus protected product/variant/inventory administration, reconnect the original storefront/detail/cart, and implement pickup/shipping request submission and owner processing. Cart selections may remain device-local, but the server must validate product publication, quantities, availability and current prices when creating an idempotent order request. Customer history must read the resulting server order. Stock reservations and order-state changes need transaction protection. Decide and preserve the baseline's guest-request behavior with appropriate verification and request ownership.

Acceptance: publish a product as the owner; a separate customer browser sees it; select a variant; add/edit cart; submit a pickup request; owner sees/processes it; the customer sees its status; retrying does not duplicate it; conflicting inventory requests cannot oversell. Payment stays explicitly unpaid/manual until a provider is connected.

### 4. Restore the original booking journey on the scheduling API

Restore calendar navigation, professional preselection, any-available matching, selection before sign-in/details, and safe continuation after verification. Keep server-side availability authoritative. Implement customer changes/cancellations, professional proposals and responses with transactional schedule updates and explicit request status. Restore walk-in/waitlist routes and ownership. Missing business rules should constrain those actions specifically, not make the booking page inaccessible.

Acceptance: test named and any-available professionals, different service durations, full dates, notice limits, timezone changes, competing customers, retry after failure, back/forward navigation, edit/cancel/proposal decisions and visibility from another authenticated device.

### 5. Restore role-specific workspaces and meaningful URLs

Map `/staff/calendar`, requests, waitlist, settings, notifications and `/admin/products`/orders to their actual workflows. Add protected role assignment with verification/audit/session handling. Keep the current professional-only scope where appropriate; separately authorize shop-wide management. Reuse the customer foundation without replacing every staff page with the customer overview. Retain honest ledger/payout limitations from the baseline.

### 6. Separate review readiness from hosted launch readiness

Keep real-customer deployment dependent on actual resources, secrets, origin configuration and provider verification. Keep local/integration review usable throughout. Gate capabilities at their relevant write boundary, with clear environment configuration. Add route-level journey tests so a shop URL returning a contact-only screen cannot count as a successful shop restoration.

Before main: baseline parity checklist, desktop/mobile/browser acceptance, negative authorization and concurrent-write tests, verified hosted services, and a migration-aware rollback plan. A Git rollback does not undo applied database migrations.

## Recommendation to Shawn

Return to the original product experience, not to an earlier and weaker data layer. The fastest way to see the old functionality is already available in the retained preview. The right implementation direction is a forward restoration using that interface, with shop request functionality elevated to immediate priority alongside full booking parity. Do not perform another broad replacement or disable whole feature areas merely because a later integration is unfinished.

## Primary code references

- [Baseline route dispatch](https://github.com/ShawnDTB/The-Kut-Shoppe/blob/536bd36/src/App.tsx)
- [Current route dispatch](https://github.com/ShawnDTB/The-Kut-Shoppe/blob/3c614b5/src/App.tsx)
- [Migration that changed reachability](https://github.com/ShawnDTB/The-Kut-Shoppe/commit/0ab7c2a)
- [Original booking](https://github.com/ShawnDTB/The-Kut-Shoppe/blob/536bd36/src/components/Booking.tsx)
- [Original checkout and receipts](https://github.com/ShawnDTB/The-Kut-Shoppe/blob/536bd36/src/components/CommerceCustomerV5.tsx)
- [Original storefront data operations](https://github.com/ShawnDTB/The-Kut-Shoppe/blob/536bd36/src/data/storefront.ts)
- [Retained legacy route mode](https://github.com/ShawnDTB/The-Kut-Shoppe/blob/3c614b5/src/components/LocalPlatformPreview.tsx)
- [Current API capabilities](https://github.com/ShawnDTB/The-Kut-Shoppe/blob/3c614b5/server/api.ts)
- [Current closed-state production assertions](https://github.com/ShawnDTB/The-Kut-Shoppe/blob/3c614b5/scripts/check-production.mjs)
