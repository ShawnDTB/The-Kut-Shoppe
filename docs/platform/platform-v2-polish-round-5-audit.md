# Platform V2 Owner Review: Round Five

## Review scope

Round five responds to the owner review of the booking calendar, customer account, staff settings, checkout, cart drawer, mobile navigation, order administration, product administration, and repeated heading/layout behavior.

The work remains isolated from `main` and targets `feature/platform-v2` only.

## First-pass findings and corrections

### Viewport overlays

The mobile navigation and cart previews were still rendered inside transformed or sticky layout ancestors. That allowed the visible top of each drawer to be clipped even when the drawer itself used `position: fixed`.

Both overlays now render through a React portal directly beneath `document.body`. They use the dynamic viewport, independent scrolling, safe-area padding, explicit body-scroll restoration, and focused close controls.

### Booking

- Back and Loctician actions now live inside the active booking panel.
- Scheduling uses the clearer heading `Choose a date and time`.
- Any Available Barber no longer assigns the first eligible record blindly.
- Selecting a time cross-references every eligible professional's schedule and blocking appointments.
- One available professional is assigned automatically.
- Multiple available professionals produce a final chair choice before customer details.
- Existing appointment details stay active while a requested change awaits approval.
- Completion offers appointment management, editing, and cancellation.

### Accounts and verification

- Customer profiles now include a delivery address.
- Name and address changes save independently.
- Email and phone changes enter pending verification states and are applied only after the matching code succeeds.
- New customer accounts require both email and phone verification before the account opens.
- A hidden honeypot provides a basic browser-level bot signal.
- Production still requires server-side rate limiting, expiring hashed tokens, email delivery, SMS delivery, and audit records.

### Staff policies

A separate staff policy record now stores:

- Online cancellation notice
- Late-cancellation handling
- Refund handling
- Optional policy clarification

The customer account reads the policy attached to the assigned professional rather than displaying a fixed 24-hour statement.

Staff Setup and Staff Settings now expose services, weekly hours, buffers, minimum booking notice, booking window, Any Available participation, waitlist participation, cancellations, and refunds.

### Customer dashboard

- Barber accounts route directly to the operational staff dashboard instead of a redundant intermediate dashboard.
- The customer dashboard uses an intentional Log out action in the page header.
- Appointments support change, cancellation, proposed-time responses, and waitlist removal according to the assigned professional's notice window.
- Contact and delivery fields receive more horizontal space.
- Password controls are collapsed until requested.
- Empty order space links to the Shop, Gallery, and Services.

### Commerce

- Product and storefront cart previews use the same viewport-root overlay behavior.
- Product detail reduces title dominance and moves category and purchase controls earlier.
- Checkout reports specific missing fields, focuses the first invalid field, and preserves browser autocomplete.
- A Google Places adapter activates when `VITE_GOOGLE_PLACES_API_KEY` is configured.
- Apartment, suite, unit, or P.O. box is an optional input placeholder rather than a competing field label.
- Pickup and shipping requests produce printable order-request receipts with line items, identity, fulfillment destination, status, and timing expectations.
- The receipt is not represented as a paid invoice before payment exists.

### Order administration

Order work is divided into:

1. Pickup priority
2. Shipping queue
3. In-person checkout
4. Complete order history

In-person checkout can find an existing account by phone or email or retain a guest email for a future invitation. Payment status is tracked separately from fulfillment status.

Status changes use a second confirmation step and follow a forward sequence. Completed, declined, and cancelled records lock against ordinary cycling.

### Product administration

The default page now manages existing catalog records. New product creation is a separate intentional mode. Existing products have direct Edit and View actions, while the full new-product editor remains available from `New product`.

### Navigation and reviews

Public navigation order is now:

1. Services
2. Gallery
3. Crew
4. Shop
5. Reviews

Review cards use equal-height rows, flexible quotation text, and names anchored consistently at the lower-left edge.

## Second-pass audit

### Accessibility

- Drawers move focus to the close control.
- Escape closes both drawer types.
- Page scrolling is restored after close and responsive-layout changes.
- Invalid checkout fields use `aria-invalid`, inline messages, and first-error focus.
- Required marks stay inline with field names.
- Mobile action targets remain at least 44 pixels.

### Mobile and constrained windows

- Portal overlays no longer inherit clipping or transforms from page content.
- Mobile navigation occupies the complete dynamic viewport.
- Cart content scrolls between a fixed header and footer.
- Account, staff, checkout, receipt, product, and order grids collapse before text or fields overflow.
- Editorial headings use responsive clamps and only wrap when the viewport requires it.

### Performance

The exact PR head passed TypeScript, ESLint, production client and SSR builds, static prerendering, and the bundle budget.

Measured output after round five:

- JavaScript: 117.33 KB gzip / 120 KB budget
- CSS: 37.93 KB gzip / 40 KB budget

The branch remains under budget but has limited remaining headroom. Production backend work should use route-level loading or server endpoints rather than continuing to add large browser-only modules to the initial bundle.

## Production boundaries

The review build does not claim these browser workflows are production security or financial infrastructure.

Before activation, the platform still requires:

- Protected D1 APIs
- Server-side password hashing and HttpOnly sessions
- Rate-limited email and SMS verification
- Google Places key restrictions and billing controls
- Transactional booking and inventory locks
- Card payment processing
- Tax and shipping-rate services
- Paid receipts and invoices
- Refund processing
- Regulated payout onboarding
- End-to-end browser tests
- Final legal and privacy approval
