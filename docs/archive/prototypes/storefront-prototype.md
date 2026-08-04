# Archived self-managed storefront prototype

> Historical workflow record preserved from `feature/commerce-account` during the 2026-08-04 repository stabilization. Platform V2 contains the intentional successor implementation. The old prototype components and CSS were not retained.

The branch established the first first-party catalog, cart, pickup and shipping request, checkout, order-history, and product-administration workflow. It deliberately used verified shop-entered inventory rather than unrelated WordPress placeholder products.

Customer routes included `/shop`, `/cart`, `/checkout`, and `/account`. Administration used `/admin/products` with product identity, SKU, price, stock, imagery, fulfillment eligibility, package data, and publication status.

Important boundaries:

- Browser `localStorage` was for workflow review only, not production inventory.
- Pickup required server-side inventory transactions, fulfillment states, notifications, cancellations, stock restoration, tax, and payment policy.
- Shipping requests remained payment-required.
- Raw card information was never to be stored by the application.
- Production required authenticated Cloudflare endpoints, D1 persistence, conflict-safe inventory, image storage, payments, tax, shipping, refunds, communication, customer ownership, and audit events.
