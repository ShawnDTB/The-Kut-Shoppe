# Production Cutover Checklist

This checklist separates the integrated browser prototype from a secure production release.

## Platform core

- [ ] Create the production D1 database.
- [ ] Apply and verify all migrations in staging.
- [ ] Add encrypted environment secrets and rotate them before launch.
- [ ] Implement server-side sessions with secure, HTTP-only, same-site cookies.
- [ ] Add customer, staff, manager, owner, and administrator authorization guards.
- [ ] Add request validation, rate limiting, CSRF protection, and audit events.
- [ ] Define backups, migration rollback, data export, and recovery procedures.

## Phone and email verification

- [ ] Connect an SMS transport for one-time codes and appointment updates.
- [ ] Connect a transactional email transport for verification, confirmations, receipts, pickup, and shipping updates.
- [ ] Store only verification-code hashes.
- [ ] Enforce expiration, attempt limits, cooldowns, and anti-abuse rules server-side.
- [ ] Add bounce, complaint, delivery-failure, and retry handling.
- [ ] Remove development verification codes from customer-facing pages.

## Booking

- [ ] Load approved barber services, prices, and durations into D1.
- [ ] Complete staff profiles and weekly schedules.
- [ ] Add breaks, vacations, shop closures, and schedule exceptions.
- [ ] Implement transactional slot holds and conflict protection.
- [ ] Approve minimum notice, maximum booking window, cancellation, late-arrival, no-show, and deposit rules.
- [ ] Add staff confirmation, decline, rescheduling, and walk-in actions through protected APIs.
- [ ] Add customer cancellation and proposal response endpoints.
- [ ] Test Any Available Barber across simultaneous requests.
- [ ] Migrate future Booksy appointments before public cutover.
- [ ] Stop new Booksy barber bookings only after parallel verification.

## Staff and payouts

- [ ] Invite and approve each staff account.
- [ ] Prevent staff from granting their own elevated role.
- [ ] Confirm each staff relationship and compensation arrangement outside the onboarding form.
- [ ] Define service revenue, tips, shop share, staff share, adjustments, and deductions.
- [ ] Add earnings approval and payout audit workflows.
- [ ] Select a regulated payout provider before automated transfers.
- [ ] Store only tokenized provider account references, never bank account numbers.

## Shop and inventory

- [ ] Supply verified product names, descriptions, photography, prices, SKUs, and stock.
- [ ] Move product images to object storage and generate optimized sizes.
- [ ] Validate product variants and low-stock thresholds.
- [ ] Implement server-side carts and inventory reservations.
- [ ] Add order acceptance, preparation, pickup, shipping, completion, cancellation, and refund actions.
- [ ] Configure taxes, shipping rates, package weights, dimensions, labels, and tracking.
- [ ] Add inventory movements for restock, damage, return, adjustment, and in-store sale.

## Payments

- [ ] Select a compliant card processor.
- [ ] Use processor-hosted or tokenized payment fields.
- [ ] Never send raw card information through The Kut Shoppe application server.
- [ ] Implement authorization, capture, refund, dispute, webhook, and reconciliation workflows.
- [ ] Add deposit support only after appointment policies are approved.

## Account and privacy

- [ ] Add secure sign-in, sign-out, recovery, session list, and session revocation.
- [ ] Add account data export and deletion workflows.
- [ ] Finalize privacy, terms, cancellation, shipping, pickup, returns, and refund policies.
- [ ] Define retention periods for guest contact details, appointments, orders, audit logs, and message history.
- [ ] Confirm accessibility review across keyboard, screen reader, zoom, contrast, reduced motion, errors, and touch targets.

## Final launch

- [ ] Run typecheck, lint, build, migration, API, and end-to-end tests.
- [ ] Test mobile layouts on current iOS and Android browsers.
- [ ] Test staff workflows on the actual shop phones and tablets.
- [ ] Test simultaneous appointment and inventory conflicts.
- [ ] Test verification, email, SMS, receipts, pickup, shipping, and failure recovery.
- [ ] Complete staging acceptance with the owner and staff.
- [ ] Publish production secrets and bindings.
- [ ] Monitor errors, queue failures, database usage, and abuse after launch.
