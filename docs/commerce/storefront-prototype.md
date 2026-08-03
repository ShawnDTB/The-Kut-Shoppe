# Self-Managed Storefront Prototype

## Purpose

This branch establishes a first-party product catalog, cart, fulfillment, checkout, and order-history experience for The Kut Shoppe.

The store is controlled by shop-entered inventory rather than the unrelated placeholder products from the former WordPress shop.

## Customer routes

- `/shop`
  - Shows published products only
  - Supports local cart actions
  - Displays pickup and shipping eligibility
  - Supports an optional Amazon link for the shop's book
- `/cart`
  - Reviews quantities and subtotal
  - Prevents quantities from exceeding published stock
- `/checkout`
  - Collects customer contact details
  - Supports in-store pickup requests
  - Collects shipping details for shipping-eligible products
  - Does not collect payment card information
- `/account`
  - Shows locally recorded order history

## Administrative route

- `/admin/products`

The product editor supports:

- Product name
- Category
- Description
- SKU
- Price
- Quantity on hand
- Product image URL
- Optional Amazon URL
- Pickup eligibility
- Shipping eligibility
- Product weight
- Package dimensions
- Draft, published, or archived status

Known product groups are listed as setup guidance only:

- The shop's existing book inventory
- Durags
- Combs
- Hair picks
- Hair gels and approved care products

No title, price, quantity, description, brand, or product image is invented.

## Current persistence

This branch stores test products, carts, and orders in browser `localStorage`.

It is suitable for product and workflow review, but it is not production inventory. The data is isolated to the current browser.

## Pickup prototype

A pickup order can be recorded without online payment. The prototype:

- Records the customer and order
- Reduces local quantity on hand
- Adds the order to local account history

Production pickup requires:

- Server-side inventory transactions
- Order confirmation delivery
- Staff preparation status
- Ready-for-pickup status
- Pickup completion
- Cancellation and stock restoration
- Tax and payment rules approved by the business

## Shipping prototype

Shipping-eligible products require weight and package dimensions before publication.

The prototype records shipping contact and address details but does not charge the customer. Shipping orders remain `payment-required` until payment, tax, rates, labels, tracking, and refund workflows are integrated.

## Payment boundary

The platform will own:

- Catalog
- Inventory
- Cart
- Orders
- Fulfillment
- Customer account
- Receipts and history

Raw card details must never be stored by the website. A regulated payment processor remains necessary for card authorization, settlement, fraud controls, disputes, and PCI-scoped handling.

## Production replacement

The browser storage adapter will be replaced by authenticated Cloudflare server endpoints backed by D1 tables from `feature/platform-core`.

Production commerce must add:

- Secure administrative permissions
- Server-side product validation
- Product image upload and optimization
- Transactional inventory reservations
- Inventory movement ledger
- Payment integration
- Sales-tax calculation and reporting
- Shipping-rate calculation
- Label and tracking workflow
- Refund and return workflow
- Transactional email
- Customer authentication and order ownership
- Audit events

## Review sequence

1. Open `/admin/products`.
2. Enter a draft using verified product information.
3. Publish the product.
4. Confirm it appears at `/shop`.
5. Add the product to `/cart`.
6. Confirm quantity cannot exceed stock.
7. Test pickup checkout.
8. Confirm the order appears in `/account`.
9. Test a shipping-eligible product and confirm payment is not represented as complete.

## Not ready to merge

This branch should remain a draft until:

- `npm run check` passes in GitHub Actions
- Real product data is supplied and approved
- D1 persistence is connected
- Authentication and permissions are connected
- Inventory transactions are conflict-safe
- Payment and tax strategy is selected
- Shipping and return policies are approved
- Checkout, privacy, and legal language are approved
