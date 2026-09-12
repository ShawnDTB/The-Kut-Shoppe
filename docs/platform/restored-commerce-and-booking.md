# Shop and booking recovery — September 12, 2026

This implements the first recovery milestone from the [536bd36 comparison](baseline-536bd36-comparison.md). It restores the original customer shop screens with a shared server data layer, and restores more of the booking interaction. It does not reset branch history or replace the newer account backend.

## Working in `npm run review`

| Journey | Implemented behavior |
| --- | --- |
| `/shop` | Published catalog, categories, product links, stock-aware cart controls and drawer using the original storefront UI. |
| `/shop/:slug` | Original product detail, variant selection, stock and fulfillment information. |
| `/cart` | Persistent device-local selections, quantities, removal and subtotal. Only product/variant IDs and quantities are stored here. |
| `/checkout` | Website account sign-in/verification, contact/address validation, pickup or shipping **unpaid requests**, and navigation to the saved account order. |
| `/admin/products` | Owner/manager/admin with MFA can create, edit, publish/archive products and manage up to ten variants per product, prices, stock and an image URL/alt text. |
| `/admin/orders` | MFA-protected request list, contact/address details, acceptance, preparation, pickup/shipping, completion and cancellation. Shipping requires a tracking number. Historical records not created by this request workflow are read-only. |
| `/account` | New orders appear in history, details and the dashboard. Owner/manager/admin navigation links to products and orders. |
| `/book` | Visitors select service, professional, location, week/date and time before sign-in. Any-available compares eligible professionals at the selected location and preserves the chosen professional's quote. Sign-in/verification happens at review; selection remains in memory. |
| Staff URLs | `/staff` and `/staff/calendar` open assigned visits; `/staff/requests` opens the request queue; `/staff/setup` opens setup; `/staff/settings` opens availability management. These retain the newer protected workspaces, not the complete old calendar layout. |

The local runner seeds a clearly named review pomade with Matte/Shine variants. Owner changes survive restarts; the runner does not overwrite an existing sample product. No sample products or accounts are provisioned in hosted environments.

## Server behavior

Apply `0009_commerce_requests.sql` after 0008. It adds request idempotency fields, transaction receipts and a revision counter maintained by product, variant, image, order and order-item triggers. D1 batches atomically reserve inventory and create order snapshots. A concurrent stock/catalog/order change invalidates stale writes. Customer writes recheck active verified identity and the current session in SQL; management writes additionally recheck role and MFA.

Submitted client prices must match server prices. Publication, variant activity, fulfillment support, quantities and unreserved stock are checked again at submission. Repeated identical request keys return the same order; reusing a key for different contents is rejected. Cancellation releases reserved stock. Completion releases reservations and consumes physical stock once. Status changes do not charge money or claim payment was received.

`COMMERCE_ENABLED=true` enables the catalog and commerce APIs. Public catalog reads do not require an account session or the account feature switch. Checkout still requires configured account services and a verified session. The review runner enables commerce automatically. Hosted defaults remain false because the repository still lacks provisioned deployment resources; this does not close the local review experience.

## Verification and review

Validation on September 12: **158 tests passed**, as did type checking, lint, builds, bundle limits, production output checks and Workers/D1 checks. The complete local runner also starts with migration 0009, the sample catalog, public booking options and restored route responses.

The project check includes SQLite API integration, React DOM journey tests, client/SSR builds, prerendered route checks, bundle budgets and real Workers/D1 concurrency. Added coverage exercises role/MFA protection, draft catalog filtering, request ownership, price/quantity validation, retry idempotency, stock reservation/release/consumption, stale inventory edits, and two customers competing for the last item. DOM tests exercise catalog → product → cart controls and checkout retry → saved receipt, plus guest weekly browsing and any-available selection.

These checks are not desktop/mobile browser acceptance. Run this review before merging to main:

1. Pull `dev-branch`, run `npm ci`, then `npm run review`. Open `http://localhost:8788/shop`.
2. Use the generated credentials in `.wrangler/review/accounts.json`. On Windows, open a second terminal in the repository and run `notepad .wrangler\review\accounts.json`. Use `customer@example.test` with its generated password. Do not use your GitHub password.
3. Select a sample variant, change cart quantities, submit a pickup request and open its account details. Repeat with a shipping address using test information.
4. In another browser profile, sign in as `owner@example.test`, complete authenticator enrollment and open `/admin/orders`. Process the request; refresh the customer's order to see the new status.
5. Open `/admin/products`, create or edit a product and publish it. Confirm it appears in the other browser. Verify that reserved stock cannot be reduced below open requests.
6. Open `/book` signed out. Choose service/professional/week/time, sign in at review and submit. In a staff browser, confirm the request and inspect `/staff/calendar`.

## Remaining baseline parity gaps

- Confirmed appointment changes/cancellations, staff alternative-time proposals and customer responses, walk-in/waitlist operations, and the original full staff calendar are not restored yet. Legacy `?appointment=` URLs explicitly preserve the existing appointment and link to its details instead of accidentally submitting a second booking.
- Website order requests currently require a verified website account. The baseline's guest request flow is not restored.
- Product administration supports one image URL, not the old upload/multiple-image/preset tooling. Catalogs are bounded to 500 products; order management currently shows 100 orders with open requests first. Pagination and larger catalogs need a follow-up.
- Order emails, online payment, tax/shipping quotes, refunds, receipts proving payment, earnings/payouts and production role provisioning are not implemented by this milestone. Check order status in the account or contact the customer manually.
- Unknown checkout outcomes can be retried safely while the current page stays open. After leaving/reloading it, check account orders before creating another request.
- Full hosted provisioning, provider checks, backup/restore rehearsal, privacy/terms review against actual business practices, and browser/mobile acceptance remain release requirements. A source rollback does not undo a migrated database or inventory reservations.

Next implementation priority is appointment change/cancellation and proposal handling on the existing scheduling transaction model, followed by walk-in/waitlist and staff calendar parity. Keep those tasks tied to this baseline inventory rather than replacing whole screens again.
