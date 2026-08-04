# Platform V2 Round-Six Audit

## Review basis

This pass responds to the August 3 owner review of product, checkout, account, booking, public-route, footer, onboarding, and staff-dashboard screenshots. The homepage was intentionally left unchanged.

## Route density and hierarchy

- Reduced oversized top spacing on Services, Gallery, Crew, Reviews, Shop, product, checkout, booking, customer-account, professional-onboarding, Staff Settings, and staff-operation routes.
- Removed the redundant Services route introduction so the service menu begins immediately.
- Revised Gallery to `Discover the talent behind every finish.`
- Revised Crew to `Meet the Crew.` and removed its redundant supporting sentence.
- Removed redundant Shop, booking-gateway, internal Barber-booking, and customer-account eyebrows or headings.
- Kept headings on one line at desktop widths where space permits, while allowing natural wrapping on constrained screens.

## Product, cart, and checkout

- Moved the product category directly above the product title.
- Reduced title dominance and retained early access to price, variants, inventory, and Add to Cart.
- Standardized cart-drawer backdrop behavior.
- Replaced delivery radio-circle presentation with recognizable pickup and shipping cards.
- Added product images, direct quantity editing, increment/decrement, and removal to checkout.
- Kept required marks inline with field labels.
- Added visible address-suggestion status. Google Places suggestions activate only when `VITE_GOOGLE_PLACES_API_KEY` is configured; browser autofill and manual entry remain available without the key.

## Receipts and account orders

- Rebuilt the order-request receipt around a readable short reference, current status, method, update time, line items, product images, SKU, destination, totals, and print/PDF action.
- Added a five-stage pickup or shipping status progression.
- Preserved the distinction between an order-request receipt and proof of payment.
- Made every customer order selectable from the account.
- Reused the same receipt and current status presentation when an order is reopened from the account.

## Account and appointment behavior

- Removed the redundant account eyebrow and moved the content nearer the navigation.
- Reorganized profile editing into Personal details, Contact methods, and Delivery address.
- Renamed contact-change actions to `Update` and added immediate pending, verification, success, and error feedback.
- Improved appointment Date, Time, and Barber readability.
- Added a confirmation prompt before online cancellation.
- Continued to enforce each assigned professional's configured cancellation window. Once the window closes, customers are directed to call the shop.
- Account login submits from the password field when Enter is pressed.

## Footer

- Consolidated repeated actions and links into Brand, Visit, Explore, and Connect areas.
- Kept address, phone, hours, navigation, social links, privacy, terms, and platform credit.

## Production boundaries

This remains browser-backed owner-review functionality. Production still requires protected account sessions, D1 persistence, rate-limited email and SMS delivery, a restricted Google Places key, transactional appointment and inventory locking, payment processing, tax, shipping rates, paid invoices, refunds, and cross-device order state.

## Validation

The isolated round-six branch is required to pass:

- TypeScript
- ESLint
- Production client build
- SSR build and prerendering
- JavaScript and CSS bundle budgets

After merge, the exact `feature/platform-v2` head must also pass Quality and Feature Platform Check, including D1 migration validation.
