# Platform Core Schema

## Purpose

This branch defines the first Cloudflare D1 schema for the self-owned Kut Shoppe customer, booking, staff, commerce, inventory, earnings, and payout platform.

It is a database foundation only. It does not expose public APIs or authentication by itself.

## Core domains

### Identity and access

- `users`
- `sessions`
- `customer_profiles`
- Staff, manager, owner, and administrator roles
- Session revocation and expiration

Production authentication must add secure token generation, hashing, cookie controls, account recovery, verification, rate limiting, and audit events.

### Locations and staff

- `locations`
- `staff_profiles`
- `staff_locations`
- `staff_services`
- Weekly availability
- Schedule exceptions
- New-client and Any Available Barber settings
- Booking notice, window, and buffer settings

The initial Main Street location is seeded at 518 Main Street, Stroudsburg, PA 18360.

### Booking

- `services`
- `weekly_availability`
- `schedule_exceptions`
- `appointment_holds`
- `appointments`
- `appointment_events`

Temporary holds and appointment creation must be coordinated by protected server logic. The schema does not by itself prevent two concurrent requests from selecting the same chair and time.

### Products and inventory

- `products`
- `product_variants`
- `inventory_movements`
- `carts`
- `cart_items`
- `orders`
- `order_items`

Inventory uses a movement ledger so every change can be traced to restock, reservation, sale, return, damage, release, or manual correction.

### Earnings and payouts

- `earning_entries`
- `payout_accounts`
- `payouts`
- `payout_items`

The database can calculate and document approved staff earnings and recorded payouts.

It must never store raw bank account or card information. `payout_accounts` stores only provider references or a manual-ledger status.

Worker relationship status is an administrator-controlled record based on the actual business arrangement. Staff onboarding does not determine legal classification.

### Audit history

- `audit_events`
- Appointment-specific event history
- Inventory movement history
- Earnings approval references

## Required production services

The next platform-core phase must implement:

- D1 migration configuration
- Typed request validation
- Authentication and secure sessions
- Role-based authorization
- CSRF protection where applicable
- Turnstile or comparable abuse protection
- Rate limiting
- Appointment availability queries
- Conflict-safe hold coordination
- Transactional appointment confirmation
- Catalog and inventory APIs
- Cart and order APIs
- Earnings and payout approval APIs
- Transactional email
- Structured audit logging
- Data retention and privacy controls

## Branch integration

- `feature/booking-platform` currently uses browser storage through a typed adapter.
- `feature/commerce-account` currently uses browser storage through a typed adapter.
- Both adapters should be replaced by authenticated API clients that map to this schema.

The customer Account experience will combine appointments and orders after the two feature branches are integrated on top of platform core.

## Validation

The feature workflow applies every SQL migration to an in-memory SQLite database after the frontend checks complete.

This validates SQL syntax and foreign-key table creation, but it does not replace D1 staging migration testing, query tests, authorization tests, or concurrency tests.

## Not ready to merge

This branch should remain a draft until:

- The migration passes GitHub Actions
- Cloudflare bindings and migration commands are added
- Authentication design is approved
- Appointment-hold strategy is approved
- Data retention and privacy requirements are approved
- Staff compensation and payout workflows are confirmed by the business
- Backup, export, and recovery procedures are documented
