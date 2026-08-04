# The Kut Shoppe Platform V2 Review

## Purpose

Platform V2 combines the website, first-party barber booking, customer accounts, staff access, professional onboarding, product catalog, cart, checkout workflow, order management, and role-based dashboards into one reviewable application.

The branch exists to validate the complete customer and operational experience before production services are connected. It does not replace secure server infrastructure with browser storage.

## Branch

```text
feature/platform-v2
```

`main` remains the stable website branch until Platform V2 is reviewed and the production backend is ready.

## Local setup

```bash
git fetch origin
git switch feature/platform-v2
git pull --ff-only origin feature/platform-v2
npm install
npm run check
npm run dev
```

The local Vite server normally opens at:

```text
http://localhost:5173/
```

## Development Owner account

Platform V2 creates one disposable Owner preview account only in local Vite development:

```text
Email: owner@thekutshoppe.local
Password: KutShoppeOwner!2026
```

These values can be replaced locally with:

```text
VITE_DEV_MASTER_EMAIL=
VITE_DEV_MASTER_PASSWORD=
```

The development seed is disabled in production builds. It is not a production credential and must never be reused for production access.

## Recommended review order

### 1. Account and role hierarchy

Open:

```text
/account
```

Review:

- Customer account creation
- Email and password sign-in
- Show and hide password
- Local Owner sign-in
- Role-aware dashboard routing
- Customer, Barber, Manager, Owner, and Developer roles
- Account promotion controls
- Logout

After signing in with the local Owner account, open:

```text
/dashboard
```

Create a separate customer account, return to the Owner account, and promote that customer to Barber or Manager to review the approval model.

### 2. Professional onboarding

After a customer account is promoted, sign in as that account and open:

```text
/staff/setup
```

Review:

- Professional display name
- Account email linkage
- Business phone
- Main Street location
- Barber service selection
- Weekly availability
- Appointment buffers
- Booking notice and booking window
- New-client participation
- Any Available Barber participation
- Same-day waitlist participation
- Payout boundary explanation

No SMS verification is required. After completion, the setup route redirects to protected professional settings.

### 3. Barber booking

Open:

```text
/book
```

Review:

1. Barber or Loctician choice
2. Barber service selection
3. Specific barber or Any Available Barber
4. Date and available time
5. Guest or signed-in customer details
6. Request review
7. Pending request confirmation language

Loctician booking continues to Crowned by Steph.

A waitlist is offered only when the customer chooses today and no matching barber time remains. It is not presented as a separate first-step booking type.

Crew preselection links can be reviewed from:

```text
/team
```

### 4. Staff operations

After professional onboarding, review:

```text
/staff
/staff/calendar
/staff/requests
/staff/waitlist
/staff/settings
/staff/earnings
/staff/payouts
```

The inherited staff prototype supports:

- Request review
- Staff confirmation
- Decline
- Proposed alternative time
- Customer acceptance or rejection
- Appointment editing
- Day, week, and month calendar views
- Status filters
- Barber filters for elevated roles
- Contextual same-day waitlist claims

### 5. Product administration

Sign in as Owner or Manager and open:

```text
/admin/products
```

Review:

- Alphabetical categories
- Generated and editable product SKU
- Generated variant SKU
- Product image selection
- Image alt text
- Product templates
- Saved presets
- Product variants
- Variant price and stock
- Pickup and shipping settings
- Product publish and redirect

Only products explicitly published by the shop appear in the public catalog.

### 6. Storefront and cart

Open:

```text
/shop
```

Review:

- Product-first layout
- Compact page introduction
- Category filters
- Product images
- Price or price range
- Variant count
- Pickup and shipping labels
- In-cart state
- Visible add-to-cart confirmation
- Mini-cart drawer

Continue through:

```text
/cart
/checkout
```

### 7. Order administration

Open:

```text
/admin/orders
```

Review the owner-controlled order lifecycle:

- Submitted
- Payment required
- Accepted
- Preparing
- Ready for pickup
- Shipped
- Completed
- Declined
- Cancelled

### 8. Public route and mobile pass

Review these routes at mobile, tablet, laptop, and desktop widths:

```text
/
/services
/gallery
/team
/shop
/visit
/book
/account
/dashboard
/staff/setup
/staff/calendar
/admin/products
/admin/orders
```

Key widths:

```text
320
360
390
430
768
820
1024
1280
1440
```

Check:

- Mobile menu starts at the top
- Book Now text is visible
- Account/Login is visible
- No separate Staff Portal link
- Compact hours reference
- At least 44-pixel touch targets
- Keyboard focus visibility
- No horizontal page overflow
- Forms remain readable without mobile zoom
- Reduced-motion behavior
- Crew portraits remain uniformly cropped

## Role model

| Role | Intended access |
|---|---|
| Customer | Their appointments, orders, and essential account details |
| Barber | Their chair, services, availability, assigned appointments, and eligible waitlist requests |
| Manager | Shop-wide appointments, staff approval, products, inventory, and orders |
| Owner | Full business access, roles, storefront, operations, and platform settings |
| Developer | Audited platform support, migrations, diagnostics, and controlled technical access |

Professional type and authorization role are separate concepts. An operational Manager or Owner is not automatically published as an available barber.

## Data minimization

Customer profiles are intended to retain only what the business needs:

- Name
- Email
- Password hash
- Phone when required for an appointment or order
- Appointment history
- Order history
- Shipping address only for shipping orders
- Optional communication preferences later

The platform should not require birthdays, gender, biographies, grooming photographs, or saved addresses before they are operationally necessary.

## Current local persistence

The review branch currently uses browser storage adapters for:

- Accounts and sessions
- Professional profiles
- Appointment requests
- Waitlist requests
- Product catalog
- Cart
- Orders
- Notification outbox

This allows the complete experience to be evaluated on one device. It is not secure multi-user production persistence.

## Production requirements

Production launch still requires:

- Cloudflare D1 bindings and protected APIs
- Server-side Argon2id password hashing
- Secure HttpOnly session cookies
- Verified email delivery
- Password reset and recovery
- Rate limiting and abuse controls
- Authorization checks on every API request
- Audit logging
- Transactional appointment holds
- Multi-device inventory reservations
- Object storage and image processing
- Transactional email
- Optional SMS reminders
- Card payment processing
- Tax calculation
- Shipping rates, labels, and tracking integration
- Refund and return workflows
- Regulated payout onboarding
- Privacy, retention, export, and deletion procedures
- Automated browser end-to-end testing

Raw card numbers and raw bank-account numbers must never be stored in the application database.

## Integration history

Platform V2 was assembled through isolated branches and pull requests:

- Authentication and role-based access
- Simplified booking and contextual waitlist
- Product-first storefront
- Account-linked professional onboarding
- Public visual and accessibility refinement

Each phase passed TypeScript, ESLint, and the production build before being merged into `feature/platform-v2`.

## Merge policy

Platform V2 should remain a draft review against `main` until:

1. The local business workflow is approved.
2. Mobile and desktop review is complete.
3. Production APIs replace browser persistence.
4. Authentication and authorization receive security review.
5. Real messaging is configured.
6. Appointment and inventory concurrency tests pass.
7. Payment, tax, shipping, refund, and payout decisions are finalized.
8. Privacy and terms are approved.
