# Platform V2 second-round polish audit

Date: August 3, 2026  
Branch: `feature/platform-v2-polish-round-2`  
Parent: `feature/platform-v2`

## Review basis

This review responds to the owner’s desktop screenshots and hands-on testing of the Platform V2 branch. The review focused on places where the interface remained visually tied to an earlier multi-action prototype, where decorative backgrounds did not read as part of The Kut Shoppe identity, and where task screens made ordinary actions harder to discover than necessary.

The implementation was completed in three cycles:

1. Structural and visual first pass
2. Code, permission, and interaction correction pass
3. Performance, redundancy, mobile, consistency, and user-friendliness audit

## First analysis

### Single-action layouts

The homepage booking components retained dimensions created for two separate booking providers. After the booking paths were consolidated, the remaining button occupied only part of each component and left unintentional empty space.

The correction replaces those components with one reusable booking rail. The rail contains:

- A concise service or booking summary
- One primary Book now action
- An optional supporting phone or service-menu link

The rail is used in the homepage hero, beneath the service icons, and beside the final location conversion.

### Decorative backgrounds

The prior route backgrounds used literal repeated icons. At normal page scale, several icons were difficult to identify and read more like generic clip art than a Kut Shoppe design system.

The correction uses abstract brand textures instead:

- Barber-pole diagonal rhythm
- Comb and clipper spacing
- Crop and alignment lines
- Product shelf lines
- Calendar and operating-grid lines

The texture remains low contrast and does not compete with service menus, gallery images, products, or forms.

### Task-page hierarchy

Account, professional setup, storefront, cart, checkout, and administration routes used homepage-sized headings. This increased wrapping, pushed controls below the fold, and made simple tasks feel more complicated.

The revised task-page hierarchy uses:

- One short title
- One optional supporting sentence
- Immediate access to the active form, catalog, schedule, or action
- Smaller responsive type limits

## First implementation pass

### Homepage

- Added one balanced booking rail to all three affected areas
- Kept Book now as the sole primary booking action
- Converted phone and menu access into supporting text actions
- Replaced diamond trust markers with scissors, clipper, and barber-pole marks
- Clarified that the same-day waitlist appears inside the booking flow when appropriate

### Crew

- Restored the approved horizontal card-stack direction
- Returned to two equal desktop columns
- Gave Kash, Mr. Glen, Kris-P, and Steph identical card heights
- Kept media, copy, and booking actions aligned
- Preserved individual image crop adjustments

### Account

- Removed redundant form headings
- Reduced the size and dominance of the account introduction
- Kept one shared sign-in entry for all roles
- Moved the local Owner preview into a collapsed development disclosure
- Limited account creation to essential fields

### Professional setup

- Marked blocking fields as required
- Added phone-format guidance before submission
- Added an action-area error summary
- Scrolls and focuses the first invalid field
- Clarified that Barbers can edit their own services, hours, and booking rules later

### Dashboard and role workflows

Barber accounts receive direct access to:

- Their calendar
- Their appointment requests
- Same-day waitlist participation
- Services and pricing
- Working hours
- Booking rules

Manager, Owner, and Developer accounts receive direct access to:

- Shop-wide appointments
- Staff roles
- Product administration
- Order administration
- Customer storefront preview

### Storefront

- Reduced the Shop header to a compact utility row
- Moved products to the visual foreground
- Added authorized Manage products and Manage orders links
- Added local development Preview Products
- Clearly labels Preview Products in the catalog
- Supports single-option and multi-variant testing
- Supports pickup, shipping, inventory, cart, checkout, and order-request testing
- Prevents deleted preview records from silently returning

### Cart and checkout

- Added overflow containment
- Capped summary widths
- Added responsive product rows
- Removed sticky behavior when vertical space is constrained
- Changed the mobile cart preview to a bottom sheet
- Improved mobile field and summary layout

## Second analysis and corrective pass

### Storefront seed refresh

The first implementation refreshed React state directly after creating preview records. The preview storage adapter already broadcasts a change event, so the direct refresh was redundant and triggered the React effect lint rule.

The redundant refresh was removed. Storefront state now updates through the same subscribed event path used by all other product changes.

### Product-administration permissions

The dashboard and Shop used Platform V2 capabilities, but the administration guard still depended on the older prototype session. The sign-in compatibility bridge usually hid the mismatch, but it created two sources of truth for authorization.

The administration guard now uses only Platform V2 accounts and capabilities. This makes the access model consistent across:

- Dashboard links
- Shop management links
- Product administration
- Order administration

Barbers remain limited to their own chair and appointment tools. Manager, Owner, and Developer accounts receive commerce administration according to their assigned capabilities.

### Dashboard subscriptions

The customer dashboard used a version-counter pattern to force appointment and order recalculation. The pattern produced hook warnings and obscured what data changed.

The dashboard now subscribes explicitly to appointment and storefront changes and stores the resulting filtered records directly.

## Final performance and consistency audit

### Production build result before the budget guard

- JavaScript: 389.54 KB raw, 103.80 KB gzip
- CSS: 188.06 KB raw, 31.61 KB gzip
- Client modules transformed: 66
- TypeScript: passed
- ESLint: passed
- Production build: passed
- Static prerendering: passed

### Preview-product production boundary

Preview inventory is loaded through a development-only dynamic import. The production build removes that path, so preview product records and generated preview graphics do not become public inventory or add to the normal public bundle.

### Bundle budget

The repository now enforces these gzip budgets after every production build:

- JavaScript: 120 KB
- CSS: 40 KB

`npm run check` now runs:

1. TypeScript
2. ESLint
3. Production build and prerender
4. Bundle budget validation

The budget prevents future feature work from quietly increasing the public payload beyond the reviewed range.

### CSS redundancy

The project still contains a long historical CSS cascade. Several older files provide foundational layout behavior, while the second-round stylesheet intentionally loads last to keep this review reversible.

Removing older files before visual approval could introduce regressions. Consolidation should occur after the owner accepts the updated desktop and mobile presentation. The new bundle budget prevents the temporary cascade from growing without review.

### Mobile review

The final CSS pass includes:

- Single-column booking rails
- Full-width primary booking actions
- Equal Crew cards that convert to a compact image-and-copy layout
- Product cards that become one column on narrow screens
- A cart bottom sheet with safe-area padding
- Non-sticky checkout summaries on smaller or shorter screens
- Cart rows that collapse before horizontal overflow
- Product and administration controls with 44-pixel minimum targets
- Form controls sized to avoid mobile browser zoom
- Visible keyboard focus and reduced-motion behavior

## Remaining production boundary

This branch improves the reviewed browser application. It does not replace the production backend requirements documented for Platform V2.

Production still requires protected APIs, D1 persistence, secure server sessions, verified email, password recovery, transaction-safe booking and inventory operations, production image storage, payments, taxes, shipping, refunds, and regulated payout onboarding.

## Review routes

Recommended local review order:

1. `/`
2. `/services`
3. `/gallery`
4. `/team`
5. `/account`
6. `/dashboard`
7. `/staff/setup`
8. `/staff/settings`
9. `/shop`
10. `/admin/products`
11. `/cart`
12. `/checkout`
13. `/admin/orders`

Use the local Owner preview from the collapsed disclosure on `/account` to review every management route.
