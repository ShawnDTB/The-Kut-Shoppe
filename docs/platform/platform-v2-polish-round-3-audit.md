# Platform V2 round-three customer experience audit

Date: August 3, 2026  
Branch: `feature/platform-v2-polish-round-3`  
Parent: `feature/platform-v2`

## Review basis

This pass responds to the owner’s latest desktop, narrow-browser, mobile-menu, Crew, Shop, dashboard, Checkout, and booking screenshots. The goal was not to add more explanation. It was to remove uncertainty, give recurring actions permanent locations, make every task use the available space, and bring the background system closer to The Kut Shoppe’s actual work.

The work was completed in three passes:

1. Structural and interaction implementation
2. Code, semantic, and rendering correction
3. Performance, mobile, redundancy, and consistency validation

## Homepage

### Booking rails

The hero context remains:

`Barber appointments · same-day waitlist · Loctician direction`

On desktop it remains on one line when space permits. The action area now places Book now first and the phone link below it. The final location section no longer repeats a full booking explanation and large rail. It uses a short heading, one Book now button, and the phone link as secondary contact.

### Trust marks

The three shop-standard marks now match the statements they introduce:

- Clean cape: cape
- Disinfected work surfaces: spray bottle
- Hand-washing and disposable supplies: hand and water-drop mark

## Navigation

Cart now has one permanent position in the global customer actions rather than moving between Shop screens. The header and mobile drawer subscribe to cart changes and show quantity.

Account / Login now changes after authentication:

- Customers see their first name
- Barbers, Managers, Owners, and Developers see their assigned dashboard role

The mobile drawer restores the complete daily hours table. Decorative connector borders between unrelated navigation groups were removed.

## Crew

The approved horizontal two-column card layout remains.

Identity hierarchy now reads:

- Owner: KasH / The Fadeologist
- Barber: Mr. Glen / The Kut Doctor
- Barber: Kris-P Fades
- Loctician: Crowned by Steph

The embedded circular vignette in the available source portraits is cropped out by controlled image scaling and object positioning. Additional pseudo-element overlays, filters, and rounded portrait treatments are explicitly disabled.

## Booking

The entry route is now a minimal decision gateway:

- Barber
- Loctician

The Barber choice enters the internal service, barber, date, and time workflow. The Loctician choice continues to Crowned by Steph’s current external availability. The former oversized introductory headline and standalone waitlist choice are not part of the gateway.

The same-day waitlist remains contextual inside the Barber flow when matching openings are unavailable.

## Shop, cart, and product detail

### Permanent cart access

Cart is available from the global header and mobile drawer on every route.

### Add-to-cart response

Quick add from Shop and add to cart from product detail now provide immediate confirmation and open a complete cart drawer. The drawer:

- Fits the full viewport
- Scrolls independently
- Locks the page behind it
- Closes with Escape, backdrop, or close control
- Shows subtotal
- Supports increase, decrease, and remove
- Provides View cart and Checkout actions

On small screens the drawer becomes a bottom sheet with safe-area spacing.

### Management access

Manage Products and Manage Orders remain visible only when the authenticated role has the required capability. Ordinary customers and Barbers do not receive storefront-administration actions.

## Cart and Checkout

Cart supports plus, minus, direct quantity entry, and removal. The order summary remains in one consistent right column on desktop and moves into normal document flow on narrow or short viewports.

Checkout now follows a familiar task order:

1. Delivery method
2. Contact
3. Shipping address when required
4. Order summary
5. Submit request

The former large Fulfillment and Contact Information headings were replaced with compact section labels. Unsupported delivery methods are disabled, and the effective delivery method is derived without state-changing effects.

The current browser build does not collect card information. It records an order request for workflow testing. Production payment still requires a regulated processor.

## Account and dashboard

The global Account action reflects session state. Account and dashboard layouts use minimum-width containment and responsive grids to prevent text and controls from overlapping.

Store management uses a stable two-column structure with actions in their own column. Barbers continue to receive chair-specific tools, while elevated roles receive only the capabilities assigned to them.

## Dedicated route motifs

The route backgrounds now use recognizable page-specific objects rather than one generic pattern:

- Services: scissors, clippers, grooming containers, comb lines
- Gallery: crop marks and framed work
- Crew: barber chair and comb geometry
- Shop, Cart, Checkout: book, product container, durag, shelf rhythm
- Booking: scissors, barber pole, comb
- Account: calendar, key, receipt
- Reviews: stars and testimonial lines
- Privacy: account and record geometry
- Terms: document and approval marks

The second audit added explicit route-level pseudo-element positioning so these motifs do not depend on older selector behavior.

## Reviews

Reviews is now designed as a continuation of the Gallery rather than a detached text page.

The current review snapshot shows:

- 4.9 Google rating
- 59 Google reviews

The page paraphrases themes from public Google feedback, including consistency, timing, community, professionalism, precision, and long-term trust. It links customers directly to Google for the complete source reviews and connects the testimonials to a four-image shop-work strip and the full Gallery.

This is a dated public snapshot, not a live Google Places API feed. Rating and review count must be rechecked before production launch and periodically afterward.

## Privacy and Terms

The placeholder routes now include complete operational drafts covering the planned platform:

- Appointment requests and contextual waitlist
- Accounts and role access
- Orders, inventory, pickup, and shipping
- Payment and payout boundaries
- Local preview data
- Cookies and browser storage
- Service providers and external links
- Data use, sharing, retention, security, choices, and children
- Product availability, cancellations, returns, refunds, and fulfillment

These pages reflect the currently planned business and technical behavior. They are not legal approval. The business should review them with qualified counsel before production indexing, payment activation, customer-data collection, or automated payouts.

The privacy approach follows the operational principle of collecting only what is needed, protecting it, and disposing of it when no longer required.

## Final validation

The final branch passed:

- TypeScript
- ESLint with no project warnings
- Production build
- Static prerendering
- Existing bundle budget

Measured production output:

- JavaScript: 104.89 KB gzip of a 120 KB budget
- CSS: 33.37 KB gzip of a 40 KB budget
- Client modules transformed: 70

The additional customer workflows and route patterns remain inside the established performance budget.

## Remaining production boundary

This branch remains a browser-backed review application. Production still requires:

- D1-backed APIs
- Server-side password hashing
- HttpOnly sessions
- Verified email and recovery
- Transaction-safe appointment and inventory operations
- Production image storage
- Payment, tax, shipping, refund, and payout integrations
- A live transactional email and optional SMS service
- End-to-end browser testing
- Final business and legal approval for policies

## Recommended review order

1. `/`
2. `/team`
3. `/book`
4. `/shop`
5. `/shop/:product-slug`
6. `/cart`
7. `/checkout`
8. `/account`
9. `/dashboard`
10. `/reviews`
11. `/privacy`
12. `/terms`
