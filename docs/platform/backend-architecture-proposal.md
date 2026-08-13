# Backend Architecture Proposal

**Status: proposal only, not implemented.** Written 2026-08-13 as part of a repository-consolidation session, for the owner to review before any backend development begins. Nothing in this document has been built.

## Why this exists

Platform V2's frontend (accounts, booking, shop, staff/admin tools) is complete enough to review end-to-end, but every byte of its data lives in the visitor's own browser (`localStorage`). Nothing is shared between devices, nothing survives a cleared cache, and nothing is actually received by the shop. This document proposes the real backend needed to change that — sized for what a single-location barbershop actually needs, not a generic enterprise platform.

## Start from what already exists

`migrations/0001_unified_platform.sql` is a genuinely solid, already-designed D1 schema — users, sessions, phone verification, staff profiles with per-location weekly availability and schedule exceptions, appointment holds (a real slot-locking mechanism) and appointments with a full status lifecycle, an appointment event log, products/variants/images with inventory movements, carts and orders, a notification outbox, staff earnings and payouts, and an audit log. It was never applied anywhere or built against, but it's a strong starting point and this proposal builds on it rather than replacing it.

**One concrete gap found in it:** the `users` table has no password column at all (`email`, `phone`, `display_name`, `role`, `status`, verification timestamps — nothing else). That matches the *original* frontend auth model (`src/data/auth.ts`, phone-based, no password), but the frontend has since moved to real password auth (`src/data/auth-v2.ts`, PBKDF2-hashed passwords). Before building against this schema, the owner needs to decide: add `password_hash` / `password_algo` / `password_updated_at` columns and keep password auth, or go passwordless (magic link / OTP email, which the schema's `phone_verification_challenges` table already half-suggests) and change the frontend to match. This proposal assumes **password auth is kept** (matches the current frontend UX and avoids a login-flow rewrite), so the schema needs that small addition — see [Auth](#auth) below.

## Recommended shape: Cloudflare Workers + D1, nothing more exotic

Given the project is already Cloudflare Pages-shaped (`public/_headers`, `public/_redirects`, a D1-ready schema, no other cloud vendor referenced anywhere), staying on Cloudflare is the path of least friction — one bill, one dashboard, one deploy pipeline, and the static site and API share an origin (no separate CORS story).

| Concern | Recommendation | Why |
|---|---|---|
| API compute | **Cloudflare Workers** (one Worker, versioned routes) | Already the natural pairing with Pages + D1; no new vendor |
| Primary database | **D1** (the existing schema) | Already designed, SQLite semantics are enough at this scale — one shop, one location, low write volume |
| Sessions | **D1 `sessions` table + signed, HttpOnly, SameSite=Lax cookie** | The schema already has this table; no need for a separate session store (KV/Durable Objects) at this traffic level |
| Product/staff images | **R2** | Cheap, already fits the `product_images.storage_key` design; skip image transforms initially, add Cloudflare Images later only if real photo volume demands it |
| Notification delivery | **Queues**, consuming the existing `notification_outbox` table | Decouples "an appointment was created" from "the email actually sent"; retries belong in a queue, not in the request path |
| Bot protection on public forms | **Turnstile** on `/book` (guest submission) and signup | Free, invisible-first, protects the booking/signup endpoints from scripted abuse without a CAPTCHA UX tax on real customers |
| Payments | **Stripe** (hosted Checkout or Elements — never raw card fields through this app) | Do not build a payment processor. `public/_headers`' CSP and this repo's own docs already say never to store raw card numbers; Stripe's off-the-shelf compliance is the only sane choice for a business this size |
| Email | **Resend or Postmark** (transactional API, not SMTP) | Simple API, good deliverability reputation out of the box, trivial Worker integration |
| SMS | **Twilio** | Same reasoning — do not build SMS delivery |
| Rate limiting / abuse | **Cloudflare's built-in rate limiting rules** (dashboard-configured, no code) on `/api/auth/*` and `/api/book` | Simplest option that actually stops credential-stuffing and booking-spam; add app-level throttling only if that's not enough |

**Explicitly not recommended for a v1:** Durable Objects (D1 + short-lived holds cover the concurrency need — see [Booking flow](#booking-flow)), a message broker beyond Queues, a second database, or a fully custom auth system. All of these solve problems this business doesn't have yet.

## Auth

- Add `password_hash TEXT NOT NULL`, `password_algo TEXT NOT NULL DEFAULT 'argon2id'`, `password_updated_at TEXT NOT NULL` to `users`. Hash with **Argon2id** server-side (Workers now support this via WASM; this replaces the frontend's client-side PBKDF2, which is fine for a demo but was never meant to be the final word given `docs/platform/production-cutover-checklist.md` already calls out "Server-side Argon2id password hashing" itself).
- Login issues an opaque session token; only its hash is stored in `sessions.token_hash` (already modeled). Cookie is `HttpOnly; Secure; SameSite=Lax`.
- `PlatformCapability` (already defined in `src/data/auth-v2.ts`: `manage-own-appointments`, `manage-shop-appointments`, `manage-products`, `manage-orders`, `manage-staff`, `manage-roles`, `manage-platform`) becomes the actual authorization model — check it in Worker middleware per-route, not just in the UI. The frontend already encodes this correctly; the backend just needs to enforce the same rules instead of trusting the client.
- Every account-mutating endpoint requires a valid session; every staff/admin endpoint additionally requires the matching capability. No endpoint should infer role from a request body field the client controls.

## Booking flow

The schema's `appointment_holds` table is the right mechanism for the concurrency problem this app already flags in its own docs ("Test Any Available Barber across simultaneous requests"):

1. Customer picks service + barber + slot → Worker inserts a short-lived row into `appointment_holds` (e.g. 5-minute expiry) inside a transaction that also checks for conflicts against existing `appointments` and other unexpired holds for that staff/time range.
2. Customer submits contact details → Worker converts the hold into a real `appointments` row (`status = 'requested'`), deletes the hold, and enqueues a `notification_outbox` entry (already modeled) for the shop and, once verified, the customer.
3. A scheduled Worker (Cron Trigger) sweeps expired holds every minute — cheap, no Durable Object needed at this volume.
4. Staff confirm/decline/propose-alternate through the same capability-gated endpoints the current `StaffPlatformPages.tsx`/`Booking.tsx` UI already models; the frontend's state machine (`requested` → `confirmed`/`reschedule-proposed`/`waitlisted`/`declined`/`cancelled`, etc.) maps directly onto the schema's `appointments.status` CHECK constraint — this was clearly designed with that flow in mind.

## Staff / admin permissions

Mirror the existing `PlatformCapability` map into Worker route guards exactly as `hasPlatformCapability()` already expresses it client-side (see `src/data/auth-v2.ts`) — the frontend's model doesn't need to change, it just needs a server that actually enforces it. `updatePlatformRole()`'s existing elevation rules (only owner/developer can grant owner/developer; nobody can demote themselves out of owner) should be re-implemented server-side verbatim, since right now they're client-side-only and trivially bypassable.

## Shop / order flow

- Cart lives server-side once a session exists (`carts`/`cart_items`, already modeled) — a `guest_token_hash` column already supports guest carts without an account.
- Checkout creates an `orders` row with a real inventory reservation (`product_variants.stock_reserved`, `inventory_movements` with `movement_type = 'reservation'`) inside a transaction, so two customers can't both "win" the last unit.
- Payment: Stripe Checkout session created server-side; webhook flips `orders.status` from `payment_required`/`submitted` → `paid`/`accepted`. The app never sees a raw card number.
- Staff fulfillment actions (`preparing` → `ready_for_pickup`/`shipped` → `completed`) are the same status transitions `ProductAdminHubV5.tsx`/`OrderAdminV5.tsx` already model client-side today.

## Deployment architecture

```
Cloudflare Pages  (this repo's existing build: npm run build -> dist/)
        |
        |  same zone, same domain
        v
Cloudflare Worker (new: /api/*)
        |
        +-- D1 (0001_unified_platform.sql + the auth addendum above)
        +-- R2 (product/staff images)
        +-- Queues (notification_outbox consumer)
        +-- Cron Trigger (appointment_holds sweep)
        |
        +-- Stripe   (payments, webhook -> Worker)
        +-- Resend/Postmark  (email)
        +-- Twilio   (SMS)
        +-- Turnstile (bot protection on /api/auth/*, /api/book)
```

Staging: a second D1 database + a second Pages/Worker environment (Cloudflare supports this natively via `wrangler.toml` environments) — never test against the production database.

## Security concerns specific to this app

- **CSP is already strict** (`public/_headers`: `script-src 'self'`, no `unsafe-inline`) — keep it that way; any new third-party script (Stripe.js, Turnstile) needs an explicit CSP allowance, not a blanket loosening.
- **Never let the client assert its own role or capability** in an API request — every write endpoint re-derives the actor from the session, not from a request body field.
- **Rate-limit `/api/book` and `/api/auth/*` specifically** — a booking form and a login form are the two most abuse-prone public endpoints on a site like this.
- **Audit log the things that matter**: role changes, appointment status changes made by staff, order status changes, payout approvals. The schema already has `audit_events` for exactly this — use it from day one, not as an afterthought.
- **PII minimization**: guest bookings/orders already only require name/email/phone (matches the current frontend); don't add fields "just in case."

## Migration path from the current frontend-only implementation

The frontend already has clean data-access boundaries (`src/data/auth-v2.ts`, `src/data/platform.ts`, `src/data/storefront.ts` — each a single module other components import through, never reaching `localStorage` directly). That's the leverage point:

1. **Stand up the Worker API and D1 schema (with the auth addendum) in isolation first.** No frontend changes yet. Validate it independently (integration tests against a staging D1).
2. **Swap the data-access modules' internals from `localStorage` reads/writes to `fetch()` calls against the new API, one module at a time**, keeping every function's exported signature identical wherever possible (`readAppointments()`, `createAppointmentRequest()`, `readProducts()`, etc. already return/accept shapes close to the D1 schema's rows). Components shouldn't need to change at all if this is done right — that's the whole point of the existing boundary.
3. **Start with `platform.ts` (booking) or `storefront.ts` (shop) — whichever the owner wants live first — not both at once.** `auth-v2.ts` has to move in the same pass as whichever one goes first, since both depend on a real session.
4. **Keep the legacy `auth.ts` bridge in mind during this migration**: `StaffPlatformPages.tsx` and `CommercePlatformPages.tsx` still authenticate via the old `auth.ts` session model (see the "Two parallel, incompatible auth data models" note in `CLAUDE.md`). Migrating auth to the real backend is also the forcing function to finally move those two files onto `auth-v2.ts`'s model — don't build server-side support for two auth systems.
5. **Run the migrated module and the browser-only version side by side behind a flag** (e.g. `VITE_USE_BACKEND=true`) for one internal review cycle before removing the `localStorage` fallback entirely.
6. **Only after the full loop (auth → booking → shop → staff/admin) is live against the real backend**, revisit `docs/platform/production-cutover-checklist.md` item by item — most of it (email/SMS verification, payments, staff/payout workflows) becomes concrete implementation work at that point rather than an open question.

Do not attempt all of this in one pass. Auth first (nothing else works without it), then booking or shop (pick one), then the other, then staff/admin tooling last (it has the smallest user base and the most tolerance for a slower rollout).
