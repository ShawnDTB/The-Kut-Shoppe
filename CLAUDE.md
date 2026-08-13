# CLAUDE.md — The Kut Shoppe

Guidance for Claude Code sessions working in this repository. Read this before making changes.

## Project identity

**The Kut Shoppe** is a real barbershop on Main Street in downtown Stroudsburg, PA, serving the Poconos area. **Designed to Breakthrough LLC / DTB Solutions** (Shawn Dullen, founder) builds and maintains its digital presence.

**Important: this repository is not yet the live website.** The production site today is `https://www.thekutshoppe.com`, running on WordPress — untouched by anything in this repo. This repository is an in-progress React/TypeScript rebuild ("Platform V2") that is meant to eventually replace it. Do not assume anything you change here is visible to real customers until someone confirms a Cloudflare Pages deployment is actually wired to the production domain.

Conversion goals for the eventual public site: fast trust-building first impression, clear services/pricing, easy booking, strong mobile experience, local-search discoverability. Real booking today happens through two external providers: **Booksy** (barbers) and **GlossGenius** (Crowned by Steph, loctician) — see `src/data/site.ts`.

## Actual tech stack (verified, not assumed)

- **React 19** + **TypeScript 5.9** (strict mode, `noUncheckedIndexedAccess` on) + **Vite 8**
- Hand-rolled routing: `src/App.tsx` matches `window.location.pathname` against `src/data/site.ts` — no React Router or framework routing
- Hand-rolled SSR + static prerendering: `src/entry-server.tsx` (`renderToString`) + `scripts/prerender.mjs` writes one `index.html` per route into `dist/`; `src/entry-client.tsx` hydrates in the browser
- **ESLint 10** flat config (`eslint.config.js`) with `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- No test framework is configured (no `test` script exists — don't invent one silently)
- Node `>=20.19.0` per `package.json` engines; `.nvmrc` pins `22`
- Deployment target is **Cloudflare Pages** (`public/_headers`, `public/_redirects`, a D1-ready schema in `migrations/`) — but no `wrangler.toml` or Cloudflare binding exists yet; nothing here is connected to a real database or backend

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

### Platform V2: what it actually is

This codebase has grown well beyond a marketing site into a full multi-role SaaS: customer accounts, barber/manager/owner/developer roles, an internal booking engine with waitlist, a product shop with cart/checkout/inventory, and staff/admin dashboards. This is deliberate, not runaway scope creep — the owner confirmed it's the active direction.

**But it has no real backend.** Accounts, appointments, orders, and inventory all live in browser storage (`src/data/*.ts` adapters). `docs/platform/production-cutover-checklist.md` lists everything required before this is safe to expose to real customers (real database, server-side auth, payments, email/SMS, etc.) — as of this writing, none of it is checked off.

**Concretely:** the homepage's "Book Now" CTA and the `/book` "Book with a Barber" path currently route into this backend-less internal engine (`/book?barber=any`), not directly to the real Booksy calendar. "Book with the Loctician" correctly links out to the real GlossGenius URL. Do not let the internal barber flow go live/get indexed before its backend exists — either finish the backend first, or keep/restore a direct external link as an interim safeguard. This is the single highest-stakes gate before any real deployment.

### Two parallel, incompatible auth data models — read before touching account/session code

`src/data/auth.ts` (legacy, storage keys `kut-shoppe.*.v2`, `CustomerAccount` type, no password field, phone-based SMS verification) and `src/data/auth-v2.ts` (current, storage keys `kut-shoppe.*.v3`, `PlatformAccount` type, real PBKDF2 password hashing, capability-based roles) are **not two versions of the same system — they're genuinely different data models with separate storage and no shared source of truth.**

`auth-v2.ts` is primary: `AccountAccessV5.tsx` (signup/login), `AccountDashboard.tsx`/`CustomerAccountDashboard.tsx`/`StaffAccountDashboard.tsx` (account views) all use it. But `auth.ts` is still genuinely load-bearing: **`StaffPlatformPages.tsx` (all of `/staff/*` — calendar, requests, waitlist, earnings, payouts, notifications) and `CommercePlatformPages.tsx` authenticate exclusively via `auth.ts`'s `getSessionAccount()`, and were never migrated to `auth-v2.ts`.** To keep those pages working, `AccountAccessV5.tsx` and `StaffOnboardingV5/V6.tsx` dual-write a compatible `auth.ts` record every time someone logs in or completes onboarding (`bridgePrototypeSession` / `saveLegacyAccount` / `startLegacySession`).

This bridge has a known gap: `updatePlatformRole()` (the role-elevation feature in `StaffAccountDashboard.tsx`'s Access Manager) only updates `auth-v2.ts` — it does not sync the legacy `auth.ts` record, so a role change won't be visible to the `/staff/*` pages until that user's next login. Don't casually merge these two systems; see the engineering report from the 2026-08-13 consolidation session for the full migration plan. Do keep using `auth.ts`'s phone/email formatting utilities (`normalizePhone`, `isValidPhone`, etc.) freely — those are just pure functions, not part of the account/session divide.

### Component version sprawl — read before deleting or "consolidating" anything

Some components still exist in multiple numbered generations (e.g. `AccountAccessV2`...`AccountAccessV5`, `StaffOnboardingV2`...`V6`). A 2026-08-13 session consolidated the chains that were safe to flatten without behavior change:

- `RoleDashboardV4/V5/V6` → `StaffAccountDashboard.tsx` / `CustomerAccountDashboard.tsx` / `AccountDashboard.tsx`
- `LayoutV5/V6` (plus the old, mostly-dead `Layout.tsx`) → `Layout.tsx` (exports `SiteLayout`, `Arrow`)
- `BookingV6/V7` → `Booking.tsx` (exports `Booking`, `WalkInEntry`)
- `StaffPlatformPagesV6` → `StaffPlatformGate.tsx` (renamed only, not merged into the underlying 55KB `StaffPlatformPages.tsx`)

**`StaffOnboardingV5.tsx`/`StaffOnboardingV6.tsx` were deliberately left alone** — V6 now intercepts every non-barber, non-customer account before it reaches V5, making V5's `!isBarber` branches dead, but those branches are interleaved inside the same dense single-line JSX ternaries as the still-live barber wizard. See the comment block at the top of `StaffOnboardingV5.tsx` before attempting to touch it.

**Before treating any `src/components/*.tsx` file as dead or current: trace real reachability from `src/App.tsx`'s imports**, transitively, by grepping the whole `src/` tree for `from './<Name>'` (there are no dynamic imports in this codebase to worry about, as of this writing). Some "live" chains wrap others as role-based fallbacks rather than superseding them outright — read the actual component before assuming a version number tells you anything.

### CSS — do not assume file-name versions match component versions

All CSS files are imported unconditionally and globally in `src/App.tsx`, in a specific cascade order that matters (no CSS modules, no scoping). **A CSS file named e.g. `booking-v2.css` is not necessarily only used by a "V2" component** — verified twice now, `booking-v2.css`, `storefront-v2.css`, and `staff-onboarding-v2.css` classes are consumed by current-generation components despite the naming. Never delete or "clean up" a CSS file (or even a single rule) based on its filename alone — cross-reference every class token in a selector against a literal-text search of all live `.tsx`/`.ts` source first. Watch for dynamic class names built from runtime enum values via template literals (e.g. `` `order-status-${order.status}` ``) — a literal-text search can't see the concatenated result, so treat known dynamic-prefix families (`order-status-`, `order-payment-`, `order-v5-`, `staff-status-`, `account-v6-view-`) as unremovable regardless of what a naive search says.

### Bundle budgets

`npm run bundlecheck` enforces **120 KB gzip JS / 40 KB gzip CSS**, checked against everything in `dist/assets`. This was essentially maxed out (~119.97/39.99 KB) until a 2026-08-13 dead-CSS-rule removal pass reclaimed real headroom (CSS down to ~32.6 KB). Treat headroom as still finite — recheck `npm run bundlecheck` after any nontrivial addition, and prefer removing genuinely dead code/CSS (verified via reachability/usage tracing, never by filename) over just accepting a shrinking margin.

### Hydration-safety pattern for anything outside a `ClientPlatform` gate

`App.tsx`'s `ClientPlatform` wrapper (`useSyncExternalStore`) makes browser-only content safely render nothing during the hydration-critical first pass, then swap in the real content after mount — but this only protects components that are actually inside that wrapper. **Anything rendered outside it (the shared `Layout.tsx` Header, `HomePage.tsx`, the `RoutePage` fallback pages) must not read `localStorage`/session/cart state via a `useState(() => ...)` lazy initializer**, because that runs during the hydration-critical render and will only match the server's output when the browser's storage happens to be empty — a real, site-wide, easy-to-miss bug (see `Layout.tsx`'s `Header`, fixed 2026-08-13: start from the SSR-safe default, e.g. `null`/`0`, and set the real value in a mount effect instead). To reproduce this class of bug reliably, don't rely on random reloads — seed `localStorage` with fake account/cart data in a production preview build (`kut-shoppe.cart.v2`, `kut-shoppe.accounts.v3` + `kut-shoppe.session.v3`) and it should reproduce on the very first load.

## Development commands (all verified to actually exist and run)

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start Vite dev server (`http://localhost:5173`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint across the repo |
| `npm run build` | Full production build: client build → SSR build → prerender → sitemap (writes `dist/`) |
| `npm run bundlecheck` | Enforce the JS/CSS gzip budgets above |
| `npm run check` | typecheck → lint → build → bundlecheck, chained (this is the canonical "is it healthy" command) |
| `npm run preview` | Preview the built `dist/` output |

There is no test script — don't reference `npm test` or invent one without being asked.

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
