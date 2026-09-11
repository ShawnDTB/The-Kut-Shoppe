# CLAUDE.md — The Kut Shoppe

Guidance for Claude Code sessions working in this repository. Read this before making changes.

Local activation follow-up: `npm run review` now builds and serves the actual account API with persistent isolated D1 and generated local credentials. Read `docs/platform/local-review.md`. The script is loopback-only; its email sink, test Turnstile response, and local role bootstrap must never enter application modules or deployment entrypoints. Hosted resources and unfinished workflows remain outstanding.

## Latest assigned-visits update

Read `docs/platform/staff-visits.md`. `server/staff-visits.ts` and `StaffVisits.tsx` add read-only assigned upcoming/active visits and scoped details. Preserve actor/profile/session/MFA guards in each final query, assigned-staff-only ownership, minimized list fields, signed instant/ID cursors, and the malformed-time count. Only accepted website records are included; no provider import, status transitions, or shop-wide authority. No migration after 0008 or deployment. Current suite: 147 tests plus Workers/D1 visit-isolation and existing runtime checks. Next: customer cancellation/rescheduling requests with staff review; do not invent cancellation fees, notice periods, refunds or automatic approval rules.

## Latest professional scheduling update

Read `docs/platform/professional-scheduling.md`. `server/professional-schedule.ts` and `ProfessionalSchedule.tsx` implement own weekly hours and time off behind the existing staff-operations gate and MFA. No new migration. Preserve consistent snapshots, final revision/role/profile/session/MFA checks, receipt-conditioned mutations, and audit metadata. Recheck that the professional ID is unchanged before returning a read snapshot. Time off protects active/proposed appointments, holds and cleanup buffers across locations; removing hours must preserve their support for visits. Reject unsupported timezone/legacy cases rather than guessing. No appointment rescheduling/cancellation, pricing or shop-wide overrides. Current suite: 143 tests plus real Workers/D1 schedule/booking races. No deployment/browser acceptance. Next: customer cancellation/rescheduling policy, confirmed staff visit views and restricted-staging rehearsal.

## Latest professional onboarding update (2026-09-11)

Read `docs/platform/professional-onboarding.md`. Migration 0008 adds private professional submissions. `server/professional-setup.ts` and `ProfessionalSetup.tsx` implement own draft/save/submit and owner/admin review with return/resubmit/approve. `STAFF_SETUP_ENABLED=false` is independent of staff operations; preserve disabled defaults. Every final query/write needs current MFA, role and resource guards; review also needs a fresh password. No self approval, manager review, automatic role grants, or owner bootstrap. Approved/disabled existing profiles cannot be overwritten. Approval rechecks catalog/revision, uses standard prices/durations, refuses profiles with legacy operational schedules, and commits profile/assignments/audit atomically. No schedule creation, public profile publishing, or onboarding email. Current check: 135 tests plus real Workers/D1 submission/approval races and existing runtime coverage. Next: own weekly hours and exceptions using approved locations, existing booking revisions, timezone rules, conflict protection, MFA and audit transactions. No deployment/browser acceptance.

## Latest staff authentication update (2026-09-11)

Read `docs/platform/staff-authentication.md` for the current milestone, superseding older password-only staff notes below. Migration 0007 and `server/staff-mfa.ts`/`totp.ts` add encrypted TOTP, one-use recovery codes, and per-session fifteen-minute staff grants. `MFA_ENCRYPTION_KEY` is a separate server-only secret; never export it through Vite. `StaffAuthenticator.tsx` is shared by Security and Professional requests. Preserve MFA checks in final customer-data queries and appointment writes, not only early guards or UI. Replacing MFA requires an existing grant plus password, preserves the old authenticator until confirmed, and invalidates old grants/recovery codes atomically. Password/email recovery never removes MFA; keep the dual-inbox email-change flow. Current check: 126 tests plus Workers/D1 enrollment/code races and existing appointment/notification runtime tests. All launch flags remain disabled. No deployment/browser acceptance. Next: approved professional onboarding and own-schedule management, with separately authorized manager/owner review and verified bootstrap.

## Customer account update (2026-09-10)

Read `docs/platform/customer-foundation-review.md` and `customer-deployment-runbook.md` first for the current customer architecture. The older prototype notes below remain useful for local design-review code, but production accounts now use `server/`, `functions/api/[[path]].ts`, `src/data/customer-api.ts`, and `src/components/CustomerAccount.tsx`. Their identity is a server-validated HttpOnly cookie, never `auth-v2.ts` localStorage. `LocalPlatformPreview.tsx` preserves the old UI only under explicit Vite development preview; do not reconnect it to production routes or add a localStorage fallback on API errors.

`npm run check` also runs SQLite API tests, production-output safety checks, and a real local Workers/D1 smoke test with mocked external delivery. Node 22.13+ is required. `wrangler.toml` is now present but has a placeholder D1 ID and disabled accounts. Nothing was deployed. Database migration 0001 was an unapplied baseline and now permits nullable phone; any environment that applied the old baseline needs a reviewed upgrade migration. No staff/admin mutation APIs are enabled yet.

Continue and push on `dev-branch`, not the prior `codex/customer-foundation` review branch or `main`. Customer email changes now live in `server/email-change.ts` and `CustomerEmailChange.tsx`: current password, both inboxes, initiating-session binding, and atomic session/recovery revocation are required. Do not weaken the old-inbox requirement to a notification while MFA is absent. Migration 0003 is additive and invalidates pre-existing pending verification/recovery codes without changing accounts/history. `server/history.ts` and `CustomerHistory.tsx` provide signed, owner-scoped keyset pagination. `/me/overview` is compatibility-only (100-record cap); new full-history UI must use `/me/appointments` and `/me/orders`. `npm run check` currently covers 82 tests and a concurrent Workers/D1 email-change test. Real email/Turnstile, browser acceptance, and security review remain staging gates.

Customer record details now use `server/customer-records.ts`, `server/calendar.ts`, and `CustomerRecordDetails.tsx`, with additive migration 0004. Every detail/download/write is scoped to the authenticated immutable customer ID, including owner-role accounts. Customers may withdraw only future/untimed, unconfirmed website requests or waitlist entries. Preserve atomic status/version/session guards, withdrawal receipts, and transactional audit events. Confirmed cancellations and provider bookings require the existing contact/provider path. Calendar exports are static private copies, exclude customer notes/contact details, and require confirmed offset-qualified start/end times. Order details use historical snapshots and disclose the 100-item display limit. This slice adds five API tests (87 total), plus concurrent withdrawal coverage in Workers/D1. It does not enable native booking, staff notifications, payments, or production accounts.

### Booking engine follow-up

Read `docs/platform/customer-booking-engine.md` before changing scheduling. Migration 0005 adds database-maintained revision triggers, idempotent request keys, and `reserved_until`. `server/booking.ts` takes a consistent schedule snapshot and conditionally commits only against the same revision and an active verified session. Preserve this boundary in future staff/import workflows. `server/booking-time.ts` resolves location wall times and DST explicitly. `CustomerBooking.tsx` is an authenticated, separately gated request/review form; `CUSTOMER_BOOKING_ENABLED` remains false. No browser draft storage, native public cutover, temporary hold promise, staff approval API, or appointment notification delivery was added. Current validation is 97 tests plus real Workers/D1 two-customer and duplicate-submission races. Next is a protected barber approval queue with transactional notification delivery and operational authentication gates.

## Project identity

Latest professional slice: read `docs/platform/professional-requests-notifications.md`. Migration 0006 adds decision receipts and a dedicated appointment outbox. `server/staff-requests.ts` protects each professional's own queue and rechecks password/role/profile/session/version at decision time. Confirmation reuses scheduling excluding the request itself. `StaffRequests.tsx` extends the shared account shell; manager/owner roles confer no shop-wide authority here. Keep `STAFF_OPERATIONS_ENABLED=false` publicly: password reauthentication is NOT MFA. `server/notification-worker.ts` is a separate disabled scheduled Worker with leases, frozen provider keys/payloads, and bounded retries. It records provider acceptance, not inbox delivery. Never dispatch the prototype outbox. Current coverage is 107 tests plus offline-bundled Workers/D1 races and scheduled delivery tests. No deployment or browser acceptance.

**The Kut Shoppe** is a real barbershop on Main Street in downtown Stroudsburg, PA, serving the Poconos area. **Designed to Breakthrough LLC / DTB Solutions** (Shawn Dullen, founder) builds and maintains its digital presence.

**Important: this repository is not yet the live website.** The production site today is `https://www.thekutshoppe.com`, running on WordPress — untouched by anything in this repo. This repository is an in-progress React/TypeScript rebuild ("Platform V2") that is meant to eventually replace it. Do not assume anything you change here is visible to real customers until someone confirms a Cloudflare Pages deployment is actually wired to the production domain.

Conversion goals for the eventual public site: fast trust-building first impression, clear services/pricing, easy booking, strong mobile experience, local-search discoverability. Real booking today happens through two external providers: **Booksy** (barbers) and **GlossGenius** (Crowned by Steph, loctician) — see `src/data/site.ts`.

## Actual tech stack (verified, not assumed)

- **React 19** + **TypeScript 5.9** (strict mode, `noUncheckedIndexedAccess` on) + **Vite 8**
- Hand-rolled routing: `src/App.tsx` matches `window.location.pathname` against `src/data/site.ts` — no React Router or framework routing
- Hand-rolled SSR + static prerendering: `src/entry-server.tsx` (`renderToString`) + `scripts/prerender.mjs` writes one `index.html` per route into `dist/`; `src/entry-client.tsx` hydrates in the browser
- **ESLint 10** flat config (`eslint.config.js`) with `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- **Vitest** covers browser adapters (`src/data/*.test.ts`, jsdom) and the account API (`server/api.test.ts`, real SQLite); no React component/rendering tests or React Testing Library.
- Node `>=22.13.0` per `package.json` engines; `.nvmrc` pins `22`
- Deployment target is **Cloudflare Pages** with Functions and D1 (`wrangler.toml`, `functions/`, `server/`, `migrations/`). Local backend tests work; hosted configuration is not provisioned and accounts remain disabled.

## Repository architecture

```
src/App.tsx            Central route switch + shared layout wiring (the single source of truth for what's actually "live")
src/entry-client.tsx    Browser hydration entry
src/entry-server.tsx    SSR entry + per-route SEO metadata + the route list used for prerendering/sitemap
src/data/site.ts        Real business info, services/pricing, team, nav, route metadata + a content verification-status model
src/data/*.ts           Other business data + browser-only "platform" persistence adapters (accounts, appointments, orders, etc. — NOT a real backend, see below)
src/components/*.tsx    UI components — see "Component version sprawl" below before touching any of these
src/*.css               Globally imported in App.tsx, cascade-order dependent — see "CSS" below
scripts/build.mjs       Client build + SSR build + prerender, invoked by `npm run build`
scripts/prerender.mjs   Writes static HTML per route + sitemap.xml into dist/
scripts/check-bundle-size.mjs   Enforces gzip budgets (see below)
docs/platform/          Extensive audit/handoff docs for the Platform V2 effort — read `production-cutover-checklist.md` before assuming anything platform-related is production-ready
migrations/             D1 schema (not yet applied anywhere real)
```

### Historical Platform V2 prototype notes (development-only)

The account update above supersedes production/auth/routing claims in the historical notes below. These notes describe the retained browser-only preview, not the production account service. Production uses the server account API and external booking links; do not restore prototype routes as a backend fallback.

This codebase has grown well beyond a marketing site into a full multi-role SaaS: customer accounts, barber/manager/owner/developer roles, an internal booking engine with waitlist, a product shop with cart/checkout/inventory, and staff/admin dashboards. This is deliberate, not runaway scope creep — the owner confirmed it's the active direction.

**But it has no real backend.** Accounts, appointments, orders, and inventory all live in browser storage (`src/data/*.ts` adapters). `docs/platform/production-cutover-checklist.md` lists everything required before this is safe to expose to real customers (real database, server-side auth, payments, email/SMS, etc.) — as of this writing, none of it is checked off.

**Concretely:** the homepage's "Book Now" CTA and the `/book` "Book with a Barber" path currently route into this backend-less internal engine (`/book?barber=any`), not directly to the real Booksy calendar. "Book with the Loctician" correctly links out to the real GlossGenius URL. Do not let the internal barber flow go live/get indexed before its backend exists — either finish the backend first, or keep/restore a direct external link as an interim safeguard. This is the single highest-stakes gate before any real deployment.

### Two parallel, incompatible auth data models — read before touching account/session code

`src/data/auth.ts` (legacy, storage keys `kut-shoppe.*.v2`, `CustomerAccount` type, no password field, phone-based SMS verification) and `src/data/auth-v2.ts` (current, storage keys `kut-shoppe.*.v3`, `PlatformAccount` type, real PBKDF2 password hashing, capability-based roles) are **not two versions of the same system — they're genuinely different data models with separate storage and no shared source of truth.**

`auth-v2.ts` is the source of truth for the account itself (identity, password, role, capabilities). `auth.ts` is kept only as a write-only-by-convention compatibility shim for the one place that hasn't migrated (see below) — never build new account/session logic against `auth.ts` directly. Its phone/email formatting utilities (`normalizePhone`, `isValidPhone`, `formatPhone`, etc.) are fine to keep using freely; those are pure functions, not part of the account/session divide.

**`src/data/session.ts` (added 2026-08-14) is the single facade every component should use for "who is signed in" and permission checks** — `getCurrentAccount()`, `isStaff()`, `isManagement()`, `can(account, capability)`, `endSessionEverywhere()`. It wraps `auth-v2.ts` and exists so components don't need to know the two-system split is an implementation detail. `StaffPlatformPages.tsx` (all of `/staff/*` — calendar, requests, waitlist, earnings, payouts, notifications) and `CommercePlatformPages.tsx` were migrated onto this facade in the same pass that created it, closing the last real dependency those files had on `auth.ts`'s `getSessionAccount()`. `AccountAccessV5.tsx` and `StaffOnboardingV5/V6.tsx` still dual-write a compatible `auth.ts` record on login/onboarding completion (`bridgePrototypeSession` / `saveLegacyAccount` / `startLegacySession`) as a safety net for any code that reads `auth.ts` directly — check reachability before assuming something still needs it.

`updatePlatformRole()` (the role-elevation feature in `StaffAccountDashboard.tsx`'s Access Manager) now syncs the legacy `auth.ts` record immediately on every role change, rather than waiting for that user's next login — this used to be a known gap; it no longer is.

**Authorization rule, enforced at the data layer (`updatePlatformRole()`) and mirrored in the Access Manager UI's `disabled` state:** only an Owner or Developer can assign an Owner/Developer role, **and only an Owner or Developer can modify an *existing* Owner/Developer account at all** — a Manager cannot touch one even to leave its role unchanged. This closes a real privilege-descalation bug found and fixed 2026-08-14 (a Manager could demote an Owner to `customer` through the real UI, actually removing their access) — see `src/data/auth-v2.test.ts`'s `updatePlatformRole authorization` suite for the regression tests before loosening this.

Don't casually merge `auth.ts` and `auth-v2.ts` into one system; see the engineering report from the 2026-08-13 consolidation session for the full migration plan.

### Component version sprawl — read before deleting or "consolidating" anything

Some components still exist in multiple numbered generations (e.g. `AccountAccessV2`...`AccountAccessV5`, `StaffOnboardingV2`...`V6`). A 2026-08-13 session consolidated the chains that were safe to flatten without behavior change:

- `RoleDashboardV4/V5/V6` → `StaffAccountDashboard.tsx` / `CustomerAccountDashboard.tsx` / `AccountDashboard.tsx`
- `LayoutV5/V6` (plus the old, mostly-dead `Layout.tsx`) → `Layout.tsx` (exports `SiteLayout`, `Arrow`)
- `BookingV6/V7` → `Booking.tsx` (exports `Booking`, `WalkInEntry`)
- `StaffPlatformPagesV6` → `StaffPlatformGate.tsx` (renamed only, not merged into the underlying `StaffPlatformPages.tsx`)

**`/staff/settings` does not route through `StaffPlatformPages.tsx`** despite that file historically having its own `StaffSettingsPage` — `App.tsx`'s route dispatch matches the literal `/staff/settings` URL to the separate `StaffSettingsV5.tsx` component before `isStaffRoute` is ever checked, so `StaffPlatformPages.tsx`'s version could never render. That dead function (and its now-unused-only-there imports: `FieldError`, `barberServiceOptions`, `saveStaffProfile`, `validateStaffProfile`, `WeeklyWindow`) was removed 2026-08-14. If you're looking for the live barber "chair settings" page, it's `StaffSettingsV5.tsx`, not anything inside `StaffPlatformPages.tsx`.

**`StaffOnboardingV5.tsx`/`StaffOnboardingV6.tsx` were deliberately left alone** — V6 now intercepts every non-barber, non-customer account before it reaches V5, making V5's `!isBarber` branches dead, but those branches are interleaved inside the same dense single-line JSX ternaries as the still-live barber wizard. See the comment block at the top of `StaffOnboardingV5.tsx` before attempting to touch it.

**Before treating any `src/components/*.tsx` file as dead or current: trace real reachability from `src/App.tsx`'s imports**, transitively, by grepping the whole `src/` tree for `from './<Name>'` (there are no dynamic imports in this codebase to worry about, as of this writing). Some "live" chains wrap others as role-based fallbacks rather than superseding them outright — read the actual component before assuming a version number tells you anything.

### CSS — do not assume file-name versions match component versions

All CSS files are imported unconditionally and globally in `src/App.tsx`, in a specific cascade order that matters (no CSS modules, no scoping). **A CSS file named e.g. `booking-v2.css` is not necessarily only used by a "V2" component** — verified twice now, `booking-v2.css`, `storefront-v2.css`, and `staff-onboarding-v2.css` classes are consumed by current-generation components despite the naming. Never delete or "clean up" a CSS file (or even a single rule) based on its filename alone — cross-reference every class token in a selector against a literal-text search of all live `.tsx`/`.ts` source first. Watch for dynamic class names built from runtime enum values via template literals (e.g. `` `order-status-${order.status}` ``) — a literal-text search can't see the concatenated result, so treat known dynamic-prefix families (`order-status-`, `order-payment-`, `order-v5-`, `staff-status-`, `account-v6-view-`) as unremovable regardless of what a naive search says.

### Bundle budgets

`npm run bundlecheck` enforces **120 KB gzip JS / 40 KB gzip CSS**, checked against everything in `dist/assets`. This was essentially maxed out (~119.97/39.99 KB) until a 2026-08-13 dead-CSS-rule removal pass reclaimed real headroom (CSS down to ~32.6 KB); a 2026-08-14 pass removing dead code from `StaffPlatformPages.tsx` (see above) took JS down further to ~114.3 KB. Treat headroom as still finite — recheck `npm run bundlecheck` after any nontrivial addition, and prefer removing genuinely dead code/CSS (verified via reachability/usage tracing, never by filename) over just accepting a shrinking margin. Vitest/jsdom are dev dependencies only and are not pulled into the production bundle — confirm this stays true (module count and gzip size unchanged after `npm run build`) if you touch test config.

### "Not signed in" vs "signed in but no linked profile" — two different empty states

`StaffPlatformPages.tsx`'s `StaffProtectedRoutes` (and similar guards elsewhere, e.g. `AdminAccess.tsx`'s `AdminGuard`) can hit two genuinely different situations that look similar in code (`!account` vs `account` truthy but missing a linked record) but need different messaging: an anonymous visitor should be told to sign in; an authenticated Manager/Owner/Developer who hasn't finished professional setup yet (no `staffProfileId`) should be sent to `/staff/setup`, not told to "sign in" again. Collapsing both into one "sign-in required" screen is a real, easy-to-miss dead end — it's reachable straight from that same account's own dashboard quick links — found and fixed 2026-08-14. Check both cases explicitly and separately in any new staff/admin guard.

### Hydration-safety pattern for anything outside a `ClientPlatform` gate

`App.tsx`'s `ClientPlatform` wrapper (`useSyncExternalStore`) makes browser-only content safely render nothing during the hydration-critical first pass, then swap in the real content after mount — but this only protects components that are actually inside that wrapper. **Anything rendered outside it (the shared `Layout.tsx` Header, `HomePage.tsx`, the `RoutePage` fallback pages) must not read `localStorage`/session/cart state via a `useState(() => ...)` lazy initializer**, because that runs during the hydration-critical render and will only match the server's output when the browser's storage happens to be empty — a real, site-wide, easy-to-miss bug (see `Layout.tsx`'s `Header`, fixed 2026-08-13: start from the SSR-safe default, e.g. `null`/`0`, and set the real value in a mount effect instead). To reproduce this class of bug reliably, don't rely on random reloads — seed `localStorage` with fake account/cart data in a production preview build (`kut-shoppe.cart.v2`, `kut-shoppe.accounts.v3` + `kut-shoppe.session.v3`) and it should reproduce on the very first load.

## Development commands (all verified to actually exist and run)

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start Vite dev server (`http://localhost:5173`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint across the repo |
| `npm run test` | `vitest run` — data-layer tests under `src/data/*.test.ts`, see "Automated tests" below |
| `npm run build` | Full production build: client build → SSR build → prerender → sitemap (writes `dist/`) |
| `npm run bundlecheck` | Enforce the JS/CSS gzip budgets above |
| `npm run check` | typecheck → lint → test → build → bundlecheck, chained (this is the canonical "is it healthy" command) |
| `npm run preview` | Preview the built `dist/` output |

### Automated tests

Vitest covers `src/data/*.ts` only (auth-v2, session, platform, storefront) — real localStorage-backed functions run under jsdom, not mocked. There are no React component/rendering tests and no React Testing Library; that was a deliberate proportionality call given the repo had zero test infrastructure before 2026-08-14, not an oversight. If you add tests for component behavior, that's a real infra decision (new dependency, rendering harness) — don't add it silently.

`src/test/setup.ts` replaces the global `localStorage`/`sessionStorage` with an in-memory polyfill. This isn't optional plumbing: recent Node versions (this repo's dev environment runs Node 25.x against an engines floor of 20.19.0) ship their own native, non-functional `localStorage` global gated behind an unset `--localstorage-file` flag, which otherwise shadows jsdom's working implementation and makes every `localStorage.setItem(...)` call throw. If tests that touch storage start failing with `"localStorage.setItem is not a function"` after a dependency bump, check this file still runs (`vite.config.ts`'s `test.setupFiles`) before assuming the app code broke.

## Development conventions already established here

- Business data (name, address, phone, services, pricing, team, booking URLs) is centralized in `src/data/site.ts` — don't hardcode business facts elsewhere.
- Route content carries an explicit verification status (`verified-live-site` / `verified-booking-platform` / `requires-verification` / `placeholder`) used to drive `robots` meta and sitemap inclusion (`placeholder` routes are `noindex` and excluded from the sitemap). Preserve this pattern for new routes.
- SEO metadata (title/description/canonical/OG) is generated per-route in `src/entry-server.tsx`, not hardcoded in `index.html`.
- `index.html`'s `<div id="root"><!--app-html--></div>` is only filled in by the production prerender step. In dev, `#root` is genuinely empty — `src/entry-client.tsx` branches on `import.meta.env.DEV` + whether `#root` has element children to decide `createRoot` vs `hydrateRoot`. The `import.meta.env.DEV` check is load-bearing, not just a guard: it lets Vite dead-code-eliminate the whole dev-only branch (including the `createRoot` import) from the production bundle, so the fix costs nothing in the real build. Keep that structure if you touch this file.

## Design principles

The site should read as modern, polished, premium, confident (masculine without being stereotypical), approachable, and *specific to this shop* — never a generic SaaS/AI-generated template look. Avoid: excessive gradients/glassmorphism, glow-everything, unnecessary pill shapes, repetitive three-card sections, oversized low-content headings, decorative-only animation, same-composition-every-section, ungrounded new colors. Every visual change should solve a real hierarchy, UX, responsiveness, performance, accessibility, or conversion problem — not personal preference.

## Responsive requirements

Every meaningful frontend change must be checked at minimum at **320 / 375 / 390 / 430 / 768 / 1024px** and desktop. Watch for horizontal overflow, clipped content, undersized touch targets (44px minimum for primary actions — footer/utility text links are a lower-stakes exception already present in this codebase), and booking-flow friction on mobile. Desktop is not the canonical layout; mobile is a first-class target given most customers will arrive on a phone.

## Business content integrity

**Never fabricate** business hours, prices, staff bios, reviews, testimonials, awards, credentials, or any other business fact. Real data lives in `src/data/site.ts` and is explicitly hours-unverified (`hoursStatus: 'requires-verification'`) — do not present hours as confirmed fact, including in any structured data / JSON-LD you add. If something in the repo looks incorrect, inconsistent, or stale, flag it to the owner instead of inventing a fix.

## Git safety

- Don't develop directly on `main`. **`dev-branch`** (branched from `main`) is the active development branch as of 2026-08-13 — continue work there unless told otherwise. `main` stays production-intent.
- No force-push, no history rewrite, no deleting branches/tags, no merging into `main`, without explicit owner approval.
- This history already contains intentional safety artifacts from an 2026-08-04 stabilization event: tags `pre-platform-v2-main-2026-08-04` / `pre-repository-stabilization-2026-08-04`, and branches `backup/pre-platform-v2-restore-2026-08-04` / `recovery/restore-platform-v2-2026-08-04`. Leave them alone — they're rollback insurance, not clutter. The now-superseded `claude/repository-foundation` branch (same tip as `dev-branch`'s starting point) is also still around; don't delete it without being asked.
- **Only one Claude Code session should operate in this working directory at a time.** Git branch state and the working tree are shared filesystem state, not session-isolated — a concurrent session running `git checkout`/`git commit` here will race with yours. If you see unexplained commits or branch changes in `git reflog` that you didn't make, stop and check with the owner before continuing.

## Validation before claiming work is done

Run `npm run check` (must pass clean) at minimum. For frontend changes, also: start `npm run dev`, check the browser console for errors, and spot-check the affected pages across the responsive breakpoints above. Don't say "it works" without having actually run it — state plainly if something couldn't be verified in the current environment.
