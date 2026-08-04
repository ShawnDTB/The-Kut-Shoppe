# Platform V2 Stabilization Pass

## Purpose

This pass converts the latest owner review into structural revisions that improve reliability, role accuracy, accessibility, navigation, and long-term maintainability without redesigning the approved homepage.

## Implemented revisions

### Booking rules and shop time

- Replaced the fixed 49-day calendar with a window derived from the selected Barber or the eligible Any Available Barber pool.
- Applied each eligible Barber's configured minimum notice before showing a same-day opening.
- Applied each Barber's configured booking-window limit before offering a date.
- Standardized customer-facing calendar calculations and labels to `America/New_York`.
- Added an Eastern Time notice to the appointment calendar.
- Continued to cross-reference service eligibility, working hours, blocking appointments, Any Available participation, and multiple-chair selection.
- Removed redundant visible booking-page headings while retaining an accessible page heading.

### Customer account organization

- Added task-focused navigation for Appointments, Orders, Profile, and Security.
- Kept Appointments as the default account view.
- Opened Orders automatically when the account is reached from a saved order receipt.
- Reduced simultaneous content and scrolling without removing existing appointment, profile, verification, password, or order functionality.

### Management and professional roles

- Preserved the detailed five-stage onboarding flow for Barbers.
- Added a separate three-stage onboarding flow for Manager, Owner, and Developer accounts.
- Removed customer-facing chair, services, hours, and public-biography requirements from management onboarding.
- Management setup now focuses on account contact information, approved capabilities, location, and review.
- Management accounts return to the management dashboard rather than a chair dashboard.
- Management staff pages receive role-appropriate headings.
- Earnings and Payouts preview zeroes are hidden behind an explicit production-service boundary.
- Management staff navigation hides unfinished Earnings and Payouts entries.

### Accessibility

- Added one shared modal manager for the mobile navigation and cart drawer.
- Focus is contained inside the active modal.
- Background application content becomes inert while a modal is open.
- Focus returns to the previously active control after the modal closes.
- Existing Escape, close, and scroll-restoration behavior remains in place.

### Layout and readability

- Added an operational layout mode for Account, Dashboard, Booking, Cart, Checkout, Staff, and Administration routes.
- Operational routes use wider working containers than public editorial pages.
- The large public footer collapses to its compact legal and platform row on operational routes.
- Increased minimum metadata, helper, and label sizing on operational routes.
- Added responsive account tabs, management onboarding layouts, staff navigation overflow handling, and mobile booking-calendar behavior.
- The approved homepage remains outside this stabilization layer.

### Performance and maintainability

- Added route-level lazy loading for booking, account access, customer dashboard, storefront, cart, checkout, product detail, staff, and administration modules.
- Public homepage, public route content, and reviews remain directly available for prerendering.
- Added one final targeted stabilization stylesheet rather than modifying the approved homepage styles.

## Production boundaries that remain

This pass does not represent browser-backed state as production-ready business data. Production still requires:

- Protected Cloudflare APIs and D1 persistence
- Server-side authorization on every account, appointment, product, order, and role operation
- HttpOnly sessions and server-side password hashing
- Password recovery and session management
- Rate-limited email and SMS verification delivery
- Atomic appointment reservation and inventory transactions
- Real payment processing, tax, shipping, paid receipts, and refunds
- Production image storage
- Audit logs for staff, role, appointment, inventory, and order changes
- Browser end-to-end tests for critical customer and staff flows
- Final privacy, terms, cancellation, refund, and accessibility review

## Validation target

The stabilization branch should pass:

- TypeScript
- ESLint
- Production client build
- SSR build and static prerendering
- JavaScript and CSS bundle budgets
- Existing D1 migration validation
