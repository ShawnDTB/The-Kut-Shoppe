<div align="center">

**Original booking page restored:** `/book` again starts with **Barber / Loctician**, followed by the original service-row and weekly-calendar layout. The restored Barber journey uses the current account and scheduling APIs. See [booking page restoration](docs/platform/booking-page-restoration.md) for the exact baseline comparison and review steps.

**September 12 recovery:** [Restored shop and booking](docs/platform/restored-commerce-and-booking.md) reconnects the original catalog, product, cart and checkout screens to server-backed unpaid requests and inventory. Owner product/order management works with MFA. Visitors can choose booking details before signing in. Run `npm run review`; apply migrations through **0009**. [The full baseline comparison](docs/platform/baseline-536bd36-comparison.md) records the regression and remaining parity gaps.

**Functionality restoration:** [Analysis and feature inventory](docs/platform/functionality-restoration.md) compares the earlier platform experience with the current backend. `/book` now opens native booking when enabled, with separate service/professional/date/time choices. Accounts open to an informative overview backed by real scoped dashboard data.

**Run the implemented features:** `npm run review` builds the site and starts its real account API with persistent local D1. It enables customer booking requests, staff setup, availability, and visits, with local customer/staff/owner sign-ins and an account-email inbox. See [working local review](docs/platform/local-review.md) for credentials, review steps, and remaining hosted-release requirements. `npm run dev` alone starts only the frontend.

[Your visits](./docs/platform/staff-visits.md) now gives each approved professional a protected list of assigned upcoming/active website appointments and private visit details. Current coverage is 147 tests plus real local Workers/D1 checks. Public staff operations remain disabled, and no migration after 0008 or deployment was added.

The [professional Availability editor](./docs/platform/professional-scheduling.md) now supports weekly hours and time off with MFA, appointment/hold protection, and atomic booking-revision checks. Current validation covers 143 tests plus real Workers/D1 races. It uses existing migrations through 0008 and the disabled staff-operations gate. Nothing is deployed.

The [professional setup and owner-review workflow](./docs/platform/professional-onboarding.md) now supports drafts, submission, feedback, resubmission, and atomic approval of services/locations behind `STAFF_SETUP_ENABLED=false`. Apply migrations through 0008. [Staff authenticator verification](./docs/platform/staff-authentication.md) protects setup, review, and professional requests; configure its separate server key before restricted staging. Individual schedule management is next. Hosted acceptance, verified role/bootstrap procedures, and operational security review remain launch gates. Nothing is deployed.
  <img src="https://www.thekutshoppe.com/wp-content/uploads/2023/11/a2e8fdecb672406ba74a28a19b4063-the-kut-shoppe-llc-logo-5175fdd512c54b42b4da939b84353a-booksy.png" alt="The Kut Shoppe logo" width="112" height="112" />
  <h1>The Kut Shoppe Platform</h1>
  <p><strong>Fresh cuts. Great conversations. Right here on Main Street.</strong></p>
  <p>A Designed to Breakthrough transformation from a restricted WordPress website into an accessible, GitHub-managed business platform.</p>
</div>

## Customer account update — 2026-09-10

`dev-branch` contains the Cloudflare Pages Functions/D1 customer account foundation, verified email changes, paginated history, appointment/order details, confirmed-visit calendar downloads, and withdrawal of unconfirmed website requests. The shared account screen covers appointments, orders, profiles, and security. See the [repository and screenshot assessment](./docs/platform/customer-foundation-review.md) and [deployment runbook](./docs/platform/customer-deployment-runbook.md) before enabling accounts. Apply migrations in order through `0004_customer_record_details.sql`; migration 0003 invalidates old pending verification/recovery codes. Confirmed cancellations remain future work; native booking, staff decisions/notification infrastructure and unpaid checkout were added in subsequent milestones linked above.

**This is not deployed or approved for public account registration yet.** Accounts stay disabled until server settings, an isolated database, Turnstile, and verified email delivery are configured and staging acceptance passes. The [customer booking engine](./docs/platform/customer-booking-engine.md) now supports server-calculated availability and protected pending requests behind `CUSTOMER_BOOKING_ENABLED=false`. Apply migration `0005_customer_booking_requests.sql` after 0004 before testing it. Barber approval, appointment notifications, commerce, and public native-booking launch remain separate milestones. The public booking page retains the existing providers and online ordering stays closed.

The original browser-only platform remains available for disposable design review under `npm run dev` with `VITE_LOCAL_PLATFORM_PREVIEW=true`. It is excluded from production JavaScript and is never a fallback for failed API requests. Sections below describing local platform operations refer to that prototype unless explicitly stated otherwise.

Use Node **22.13+**, `npm ci`, and `npm run check`. The checks now include account API integration tests, production safety checks, and a local Cloudflare Workers/D1 runtime test. No cloud account or real email is needed to run those checks.

## Project overview

The Kut Shoppe is a Main Street barbershop serving downtown Stroudsburg and the wider Poconos community.

The original WordPress website gave the business an important digital home, but the next stage required more than another page-builder revision. The shop needed clearer booking, stronger mobile usability, direct ownership of its data and code, a verified product catalog, customer accounts, staff access, appointment management, and room for future business systems.

Designed to Breakthrough rebuilt the project around a simple operating philosophy:

> **Designed for the business. Transform the experience. Breakthrough into what comes next.**

The result is no longer limited to a collection of pages. It is becoming a self-owned customer and staff platform built with React, TypeScript, Vite, GitHub, and a Cloudflare-ready architecture.

## Designed

The platform begins with how The Kut Shoppe and its customers actually operate.

The customer journey is organized around the decisions that matter:

- Find the shop and its hours
- Review services and pricing
- Choose a Barber or the Loctician
- Request a barber appointment without creating an account
- Join a same-day waitlist only when the selected schedule is full
- Meet the Crew and preselect a professional
- Browse verified products
- Purchase for pickup or shipping
- Manage appointments and orders through one account

The operational journey is designed around equally practical needs:

- Approve customer accounts for professional access
- Restrict access by role
- Publish barber services and work hours
- Review and confirm appointment requests
- Propose another time when needed
- Manage a same-day waitlist
- Create real products and variants
- Track inventory and fulfillment states
- Separate earnings records from payout rules

## Transform

The transformation replaces WordPress and disconnected booking or commerce plugins with a version-controlled software platform.

The codebase now owns:

- Page structure and navigation
- Responsive behavior
- Accessibility patterns
- Business information
- Service pricing
- Barber booking flow
- Contextual waitlist logic
- Customer accounts
- Staff roles and permissions
- Professional onboarding
- Product catalog and variants
- Cart and checkout workflow
- Order management
- Static prerendering
- Deployment configuration
- Future backend development

Changes can be reviewed, tested, committed, compared, restored, and deployed through GitHub instead of being buried inside a page builder.

## Breakthrough

Platform V2 creates a path toward replacing Booksy for barber appointments while keeping Crowned by Steph as the Loctician booking destination.

It also connects appointments, shopping, staff operations, and customer history through one application rather than several unrelated services.

The frontend workflows are now reviewable together. Production launch still requires the protected backend described in the [production boundary](#production-boundary).

## Platform V2 status

As of 2026-08-13, **`main` is Platform V2.** The earlier `feature/platform-v2` review branch was consolidated into `main` on 2026-08-04 and no longer exists; there is no separate "stable simple site" branch in this repository anymore. Safety snapshots from that consolidation (tags `pre-platform-v2-main-2026-08-04` and `pre-repository-stabilization-2026-08-04`, and branches under `backup/` and `recovery/`) remain in the repository as rollback insurance and should be left alone.

Active development now happens on **`dev-branch`**, branched from `main`. `main` stays production-intent; changes land on `dev-branch` first.

**Platform V2 is not connected to the live website.** `www.thekutshoppe.com` runs on WordPress today, entirely separate from this repository. Nothing here is deployed anywhere yet.

**Platform V2 has no real backend.** Every account, appointment, order, and product described below is stored in the visitor's own browser (see [Current local persistence](#current-local-persistence)). Treat all of it as a working prototype of the intended product, not as production-ready customer-facing functionality, until the backend described in [Production boundary](#production-boundary) exists.

Platform V2 was assembled through isolated feature branches for:

- Email and password authentication
- Role-based access
- Simplified booking
- Contextual same-day waitlist
- Product-first storefront
- Account-linked professional onboarding
- Crew, route, mobile, and accessibility refinement

Each completed phase passed TypeScript, ESLint, and the production build before being merged.

## Customer experience

### Booking

`/book` begins with two clear choices:

- **Book with a Barber**
- **Book with the Loctician**

The Loctician path continues to Crowned by Steph.

The internal Barber flow asks the customer to:

1. Choose a service
2. Choose a specific barber or Any Available Barber
3. Choose a date
4. Choose an available time
5. Enter name, email, phone, and an optional note
6. Review the request
7. Submit for shop confirmation

Customers can book as guests. An account is not required.

A submitted appointment begins as `requested`. It is not presented as confirmed until the shop acknowledges it.

The same-day waitlist is only offered after the customer selects today and no matching appointment time remains. It is not shown as a separate first-step booking type.

### Account

`/account` is the single login entry for every role.

Customer accounts use:

- Name
- Email
- Password

Phone is collected only when an appointment or order needs it.

After sign-in, the account role determines the dashboard:

- Customer
- Barber
- Manager
- Owner
- Developer

Customers see appointments before product orders. The same account is intended to manage both parts of the business.

### Shop

`/shop` is product-first.

The page displays published catalog items without a long platform explanation. Customers can:

- Filter by category
- View images
- See price or price range
- See variant count
- See pickup and shipping availability
- Select product options
- Add items to cart
- Receive visible cart confirmation
- Open a mini-cart
- Continue to cart and checkout

Products support multiple variants, so different colors or editions do not need separate catalog listings.

Only products explicitly published by the shop appear to customers.

### Crew

`/team` uses uniform professional cards and direct booking links.

Crew actions preselect the appropriate booking path:

- Kash
- Mr. Glen
- Kris-P
- Crowned by Steph

The portrait system uses consistent rectangular frames without inherited circular masks or gray radial overlays.

## Staff and business operations

### Role hierarchy

| Role | Intended access |
|---|---|
| Customer | Their appointments, orders, and essential account details |
| Barber | Their chair, services, schedule, assigned appointments, and eligible waitlist requests |
| Manager | Shop-wide appointments, staff approval, products, inventory, and orders |
| Owner | Full business access, roles, storefront, operations, and platform settings |
| Developer | Audited platform support, migrations, diagnostics, and controlled technical access |

Customers create ordinary accounts.

Owner, Developer, or Manager accounts can approve an account as a Barber or Manager. Only Owner or Developer access can assign the highest platform roles.

Professional type and authorization role are separate concepts. A Manager or Owner is not automatically published as an available barber.

### Professional onboarding

Approved accounts complete `/staff/setup` after signing in.

Barber onboarding includes:

- Professional display name
- Business phone
- Main Street location
- Public introduction
- Services
- Weekly availability
- Appointment buffer
- Minimum booking notice
- Booking window
- New-client participation
- Any Available Barber participation
- Same-day waitlist participation

No SMS verification is required during setup.

### Appointment operations

The current staff workflow includes:

- Pending requests
- Staff confirmation
- Decline
- Proposed alternate time
- Customer acceptance or rejection
- Appointment editing
- Open waitlist claims
- Day view
- Week view
- Month view
- Status filtering
- Barber filtering for elevated roles

### Catalog and order operations

Product administration supports:

- Alphabetical categories
- Generated and editable SKUs
- Product variants
- Variant pricing
- Variant inventory
- Product images and alt text
- Product templates
- Saved presets
- Pickup and shipping settings
- Draft and published states

Order administration supports:

- Submitted
- Payment required
- Accepted
- Preparing
- Ready for pickup
- Shipped
- Completed
- Declined
- Cancelled

## Accessibility and mobile usability

The current implementation includes:

- Semantic page structure
- Logical headings
- Keyboard-visible focus
- Escape and backdrop closing for the mobile menu
- Body scroll locking while the drawer is open
- Drawer scroll reset when opened
- At least 44-pixel touch targets
- Form controls sized to reduce mobile zoom
- Visible labels that do not depend on hover
- Reduced-motion support
- Fixed image dimensions
- Responsive booking, account, storefront, cart, checkout, staff, and administration layouts
- Compact mobile shop-hours information
- One visible Book Now action
- One visible Account/Login action
- No separate public Staff Portal button

Low-contrast pattern families bring more life to Services, Crew, Gallery, Visit, Account, Booking, Staff, and Shop pages without adding unnecessary content blocks.

## Local development

### Requirements

- Node.js `22.13.0` or newer
- npm `10.0.0` or newer
- Git

### Run Platform V2

```bash
git fetch origin
git switch dev-branch
git pull --ff-only origin dev-branch
npm install
npm run check
npm run dev
```

The local Vite server normally opens at:

```text
http://localhost:5173/
```

### Development Owner account

A disposable Owner preview account is created only in local Vite development:

```text
Email: owner@thekutshoppe.local
Password: KutShoppeOwner!2026
```

Override the local values with:

```text
VITE_DEV_MASTER_EMAIL=
VITE_DEV_MASTER_PASSWORD=
```

The development seed is disabled in production builds and must not be used as a production credential.

## Recommended review routes

```text
/account
/dashboard
/staff/setup
/staff
/staff/calendar
/staff/requests
/staff/waitlist
/book
/services
/team
/shop
/admin/products
/cart
/checkout
/admin/orders
/visit
```

The complete review sequence is documented in [Platform V2 Review](./docs/platform/platform-v2-review.md).

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the local development server |
| `npm run typecheck` | Validate TypeScript without writing output files |
| `npm run lint` | Run ESLint across the repository |
| `npm run build` | Build and prerender the production website |
| `npm run check` | Run typecheck, lint, and the full production build |
| `npm run preview` | Preview the generated production build |

Production files are generated in `dist/`.

## Technology

- React 19
- TypeScript 5.9
- Vite 8
- ESLint 10
- Build-time server rendering
- Static route prerendering
- GitHub version control
- Cloudflare Pages-compatible output
- Cloudflare D1-ready schema

## Project structure

```text
.github/
  workflows/              Repository validation

docs/
  brand/                  Brand and visual audits
  development/            Performance and feature notes
  foundation/             Production verification
  platform/               Booking, commerce, schema, and V2 handoff

migrations/
  0001_unified_platform.sql  D1 platform schema

public/
  favicon.svg
  _headers
  site.webmanifest

scripts/
  build.mjs
  prerender.mjs

src/
  components/             Public, account, booking, staff, and commerce UI
  data/                   Business and browser-adapter data models
  App.tsx                 Route composition
  entry-client.tsx
  entry-server.tsx
  *.css                    Shared and route-specific styles
```

## Current local persistence

Platform V2 currently uses browser adapters (`window.localStorage`) for local review of:

- Accounts and sessions
- Staff profiles
- Appointment requests
- Waitlist requests
- Product catalog
- Cart
- Orders
- Notification outbox

This makes the complete workflow testable on one device, and nothing more. **None of it is real production data.** It lives only in one visitor's browser, is never sent to a server, disappears if that browser's storage is cleared, and cannot be seen by anyone else — including the shop. Do not treat a customer "creating an account," "booking an appointment," or "placing an order" in this app as something the business has actually received, until the real backend in [Production boundary](#production-boundary) is built and connected.

## Production boundary

The repository includes a D1-ready schema, but production still requires:

- Protected Cloudflare APIs
- D1 bindings
- Server-side Argon2id password hashing
- Secure HttpOnly sessions
- Verified email delivery
- Password reset and recovery
- Rate limiting
- Authorization checks on every API request
- Audit logging
- Transactional appointment holds
- Multi-device inventory reservations
- Object storage and image processing
- Transactional email
- Optional SMS reminders
- Card payment processing
- Tax calculation
- Shipping rates, labels, and tracking
- Refund and return workflows
- Regulated payout onboarding
- Privacy, retention, export, and deletion procedures
- Browser end-to-end tests

Raw card numbers and raw bank-account numbers must never be stored by this application.

## Business information displayed

**The Kut Shoppe**  
518 Main Street  
Stroudsburg, PA 18360  
[570-421-5887](tel:+15704215887)

### Walk-in reference hours

| Day | Hours |
|---|---|
| Monday | 10:00 AM - 4:00 PM |
| Tuesday | 10:00 AM - 6:00 PM |
| Wednesday | 10:00 AM - 6:00 PM |
| Thursday | 10:00 AM - 7:00 PM |
| Friday | 10:00 AM - 7:00 PM |
| Saturday | 10:00 AM - 6:00 PM |
| Sunday | Closed |

Individual professional schedules are configured separately.

## Deployment target

The planned production target is Cloudflare Pages with Workers and D1 for protected platform services.

```text
Build command: npm run build
Output directory: dist
Node version: 20.19 or newer
```

The existing public site should remain available until Platform V2 is approved and its protected backend is production-ready.

## Documentation

- [Platform V2 review and handoff](./docs/platform/platform-v2-review.md)
- [Platform integration audit](./docs/platform/platform-integration-audit.md)
- [Production cutover checklist](./docs/platform/production-cutover-checklist.md)
- [Backend architecture proposal](./docs/platform/backend-architecture-proposal.md) — historical proposal; customer implementation and current gates are in the deployment runbook
- [Live-site style audit](./docs/brand/live-site-style-audit.md)
- [Verification required before production](./docs/foundation/verification-required.md)

## Designed to Breakthrough

Designed to Breakthrough LLC builds practical digital systems for small businesses, creators, and service brands.

The Kut Shoppe transformation applies that philosophy directly:

- **Designed** around the business and its customers
- **Transform** the platform, operations, and customer experience
- **Breakthrough** into a foundation the business can continue building on

## Ownership

Website strategy, design, platform architecture, and technical implementation by **Designed to Breakthrough LLC**, led by **Shawn Dullen, Founder**, for **The Kut Shoppe LLC**.

This repository contains proprietary project code and business assets. Unless a separate license is added, it should not be treated as an open-source project.
