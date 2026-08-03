# Customer Platform Foundation

This document records the current boundary and next implementation requirements for The Kut Shoppe Booking, Shop, and Account experiences.

## Current delivery

### Booking

`/book` is an active booking router.

It supports:

- A clear choice between barber and loctician services
- Booking by service category
- Booking by professional
- New-client guidance
- Walk-in guidance
- Appointment-policy and availability handoff
- Direct phone support when a customer is unsure
- Safe outbound links to the current professional booking destinations

The site does not scrape, cache, or reproduce live appointment availability.

### Shop

`/shop` is an active product landing page and commerce foundation.

It supports:

- Approved future catalog categories
- A real in-store product photograph
- Clear in-store availability guidance
- A verified-inventory requirement
- A secure-checkout requirement
- A customer-account preview
- A direct path to call or visit the physical shop

The site does not publish placeholder products, fake inventory, unsupported prices, or an unfinished checkout.

### Account

`/account` is a designed preview of the customer tools planned for first-party commerce.

It communicates planned support for:

- Orders and receipts
- Optional saved checkout details
- Approved fulfillment updates
- Product preferences and eligible reorders

The route does not collect credentials or display a working login until authentication, recovery, privacy, and order-storage workflows are production ready. The prerendered page uses `noindex, follow` while its route remains marked as a placeholder.

Appointments remain with the professionals' current booking profiles unless a secure integration is approved in a later phase.

## Data ownership

Commerce categories, readiness states, account capabilities, and route shapes are centralized in:

```text
src/data/commerce.ts
```

Current booking destinations, professional records, service categories, and business contact information remain centralized in:

```text
src/data/site.ts
```

The three customer experiences are implemented in:

```text
src/components/CustomerPlatformPages.tsx
src/customer-platform.css
```

## Next commerce phase

The online store must not open until the following are approved and implemented:

1. Verified inventory
2. Product names and descriptions
3. Product photography and image rights
4. Prices and variants
5. Stock ownership and synchronization rules
6. Pickup, shipping, and fulfillment policy
7. Tax configuration
8. Payment provider
9. Refund and return policy
10. Transactional email
11. Checkout privacy language
12. Account authentication and recovery
13. Order storage and retention rules
14. Rate limiting and abuse controls
15. Analytics events and consent requirements

## Account launch requirements

Account access should remain disabled until:

- Authentication is implemented server-side
- Email verification and password recovery are tested
- Session handling is secure
- Personal information is minimized
- Guest checkout behavior is decided
- Account deletion and data-request handling are documented
- Order history is connected to verified commerce data
- Failure and recovery states are accessible

## Booking analytics hooks

Current outbound appointment links include a `data-outbound-booking` attribute containing either `barber` or `styling`.

A later privacy-conscious analytics implementation may use those attributes to measure provider selection without collecting appointment details or sensitive customer information.

## Mobile and accessibility requirements

The pages currently use:

- Semantic headings and landmarks
- Keyboard-accessible links and controls
- Visible focus treatment inherited from the global design system
- Large mobile touch targets
- One-column mobile layouts
- Permanent labels rather than hover-only meaning
- Lazy loading for below-the-fold professional images
- Reduced-motion fallbacks
- Disabled account controls that do not imply a working login

## Validation

Before release, run:

```bash
npm run check
```

Then manually validate:

- `/book`
- `/shop`
- `/account`
- All outbound booking links
- All phone and visit links
- Keyboard navigation
- 390 px, 430 px, 768 px, 1024 px, and desktop layouts
- Reduced-motion behavior
- Direct prerendered route visits
- Account `noindex` metadata
