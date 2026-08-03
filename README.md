<div align="center">
  <img src="https://www.thekutshoppe.com/wp-content/uploads/2023/11/a2e8fdecb672406ba74a28a19b4063-the-kut-shoppe-llc-logo-5175fdd512c54b42b4da939b84353a-booksy.png" alt="The Kut Shoppe logo" width="112" height="112" />
  <h1>The Kut Shoppe</h1>
  <p><strong>Fresh cuts. Great conversations. Right here on Main Street.</strong></p>
  <p>A modern, GitHub-managed website for The Kut Shoppe in downtown Stroudsburg, Pennsylvania.</p>
</div>

## Project overview

This repository contains the code-based replacement for The Kut Shoppe's current WordPress website. It is maintained by [Designed to Breakthrough LLC](https://www.dtbsolutions.tech/) and is being developed as a faster, more accessible, easier-to-maintain platform with full technical ownership outside of WordPress.

The project preserves the personality of the original site while improving navigation, booking clarity, mobile usability, local search visibility, performance, accessibility, and future commerce readiness.

The current public website remains live at [thekutshoppe.com](https://www.thekutshoppe.com/) while this replacement is reviewed and prepared for launch. This repository is not yet connected to the production domain.

## Current status

**Stage:** Active development and client review  
**Integrated branch:** `main`  
**Production website:** Existing WordPress site  
**Target hosting:** Cloudflare Pages  
**Runtime goal:** Static, prerendered pages with no WordPress runtime

The current build includes:

- A condensed, customer-focused homepage
- Direct barber and loctician booking paths
- Current barber service names, durations, and prices
- Separate adult, senior, and kids service groups
- A labeled and responsive work gallery
- A Crew page with public professional profiles
- A Visit page with shop hours, contact details, and Google Maps
- A Shop foundation prepared for verified future inventory
- A mobile navigation drawer with hours, booking, and contact actions
- Static prerendering for indexable routes
- A custom favicon and site metadata foundation
- Reduced-motion and mobile-specific behavior

## Business information currently displayed

**The Kut Shoppe**  
518 Main Street  
Stroudsburg, PA 18360  
[570-421-5887](tel:+15704215887)

### Walk-in reference hours

| Day | Hours |
|---|---|
| Monday | 10:00 AM - 4:00 PM |
| Tuesday | 10:00 AM - 6:00 PM |
| Wednesday | 10:00 AM - 6:00 PM |
| Thursday | 10:00 AM - 7:00 PM |
| Friday | 10:00 AM - 7:00 PM |
| Saturday | 10:00 AM - 6:00 PM |
| Sunday | Closed |

These are displayed as walk-in reference hours. Individual professionals maintain their own availability through their booking profiles.

## Booking integrations

Appointments remain with the providers currently used by the shop.

- **Barber appointments:** [The Kut Shoppe on Booksy](https://booksy.com/en-us/71309_the-kut-shoppe_braids-locs_34196_stroudsburg)
- **Loctician appointments:** [Crowned by Steph](https://crownedbysteph.glossgenius.com/)

The website sends customers directly to the appropriate booking destination. Availability, provider schedules, appointment policies, and final checkout details remain with those external services.

## Design direction

The redesign is intended to feel like a refined continuation of the original website, not a generic barbershop template.

The current visual system uses:

- A near-black and white foundation
- Soft gray typography and borders
- Restrained barber-red accents
- Editorial serif display type
- The original illustrated service icons
- Authentic shop, gallery, and professional photography
- Transparent glass panels where they support readability
- Subtle ornamental backgrounds inherited from the original design language
- Clear booking and contact actions
- Responsive layouts that prioritize mobile customers

The goal is a confident, welcoming, community-oriented experience that feels connected to Main Street, downtown Stroudsburg, and the Poconos.

See [`docs/brand/live-site-style-audit.md`](./docs/brand/live-site-style-audit.md) for the detailed visual audit.

## Technology

- React 19
- TypeScript 5.9
- Vite 8
- ESLint 10
- Node.js 20.19 or newer
- npm 10 or newer
- Server-side rendering during the build process
- Static prerendering for production routes
- Cloudflare Pages compatible output

No WordPress runtime, Elementor runtime, WooCommerce runtime, database, or client-side page builder is required.

## Routes

| Route | Purpose |
|---|---|
| `/` | Homepage, hours, services preview, work preview, crew, shop preview, booking, and location |
| `/services` | Full barber menu and loctician booking path |
| `/services/haircuts` | Adult and teen haircut details |
| `/services/beards-shaves` | Beard and line-up combinations |
| `/services/kids-cuts` | Kids services for ages 3 through 12 |
| `/services/locs-braids` | Locs, braids, twists, and retwists |
| `/services/color-scalp-care` | Color, washing, scalp care, and related services |
| `/gallery` | Labeled gallery of cuts, styles, details, and first-cut experiences |
| `/team` | The Kut Shoppe Crew |
| `/book` | Barber and loctician booking router |
| `/visit` | Full-color map, daily hours, phone number, and visit guidance |
| `/reviews` | Verified review destination |
| `/shop` | Future verified product catalog foundation |
| `/account` | Reserved for future order and account functionality |
| `/contact` | Direct contact guidance |
| `/privacy` | Production privacy policy placeholder |
| `/terms` | Production website terms placeholder |

Legacy route handling:

- `/about` redirects to `/team`
- `/products` redirects to `/shop`

## Local development

### Requirements

- Node.js `20.19.0` or newer
- npm `10.0.0` or newer
- Git

### Clone and run

```bash
git clone https://github.com/ShawnDTB/The-Kut-Shoppe.git
cd The-Kut-Shoppe
npm install
npm run dev
```

Open the local Vite URL, normally:

```text
http://localhost:5173/
```

### Pull the latest integrated version

```bash
git switch main
git pull --ff-only origin main
npm install
npm run dev
```

## Available commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run typecheck` | Run TypeScript validation without emitting files |
| `npm run lint` | Run ESLint across the repository |
| `npm run build` | Create the client build, SSR build, and prerendered static output |
| `npm run check` | Run typecheck, lint, and the full production build |
| `npm run preview` | Preview the generated production build locally |

The production build is written to `dist/`.

## Build and prerendering

The build pipeline:

1. Removes previous build output.
2. Creates the browser bundle with Vite.
3. Creates a temporary server-rendering bundle.
4. Renders every static route into its own `index.html` file.
5. Generates `404.html`.
6. Removes the temporary server bundle.

This gives search engines and customers meaningful HTML before JavaScript loads while preserving React for hydration and interaction.

## Project structure

```text
.github/
  workflows/          GitHub automation

docs/
  brand/              Visual, homepage, and customer-flow audits
  development/        Performance, booking, mobile, and commerce notes
  foundation/         Verification and launch requirements

public/
  favicon.svg         Browser and manifest icon
  _headers            Cloudflare security and content headers
  site.webmanifest    Web application metadata

scripts/
  build.mjs           Production build coordinator
  prerender.mjs       Static route renderer

src/
  components/         Layout, homepage, pages, and map components
  data/               Business, booking, pricing, hours, visuals, and commerce data
  App.tsx              Route composition and legacy redirects
  entry-client.tsx     Browser entry
  entry-server.tsx     Server-rendering entry
  *.css                Shared and responsive visual layers
```

## Content and data ownership

Business information is centralized rather than repeated across components.

Important data files include:

- `src/data/site.ts` for routes, booking paths, services, business information, and the Crew
- `src/data/hours.ts` for the daily schedule and customer-facing hours notes
- `src/data/senior-services.ts` for the senior service menu
- `src/data/visuals.ts` for service icons, gallery entries, and legacy media references
- `src/data/commerce.ts` for the future Shop category structure

Do not invent prices, services, team details, credentials, testimonials, product inventory, parking information, or accessibility claims. Missing or disputed details belong in the verification record until approved.

See [`docs/foundation/verification-required.md`](./docs/foundation/verification-required.md).

## Current content sources

The development build currently draws from:

- The live WordPress website
- The WordPress export and Elementor configuration
- The public barber booking profile
- Crowned by Steph's public booking profile
- The shop's public social profiles
- Client-supplied corrections and approvals

The external booking providers remain the final source for availability and checkout details.

Some approved visual assets are still referenced from the legacy WordPress media library. Before the WordPress site is retired, those assets must be downloaded, ownership-confirmed, optimized, and served from this project.

## Performance and accessibility

The current implementation includes:

- Prerendered static HTML
- Responsive layouts and touch-friendly controls
- A fixed mobile navigation drawer with one scroll area
- Escape-key, backdrop, and route-link closing behavior
- Body scroll locking while the mobile menu is open
- Eager loading only for the primary homepage image
- Lazy loading and asynchronous decoding for secondary images
- Fixed image dimensions to reduce layout movement
- Reduced-motion support
- Semantic headings, navigation, lists, buttons, links, and definition lists
- Visible captions and labels that do not depend on hover
- A color map on the dedicated Visit page and a dark treatment on the homepage

See [`docs/development/performance-booking-commerce-pass.md`](./docs/development/performance-booking-commerce-pass.md) for the detailed implementation audit.

## Shop and account roadmap

The Shop is intentionally a foundation rather than a fake storefront.

Planned route structure:

```text
/shop
/shop/category/:slug
/shop/product/:slug
/cart
/checkout
/account
```

Before first-party commerce is enabled, the project still needs approved inventory, product photography, pricing, stock handling, fulfillment rules, tax configuration, returns policy, payment processing, privacy terms, and account requirements.

The former WordPress placeholder products will not be migrated.

## Deployment target

The planned production target is Cloudflare Pages.

Recommended configuration:

```text
Build command: npm run build
Output directory: dist
Node version: 20.19 or newer
```

Cloudflare Workers or Pages Functions should only be added when a real server-side requirement exists, such as a verified contact workflow or first-party commerce integration.

Before production cutover:

- Run `npm run check`
- Confirm the launch roster, hours, senior age threshold, and pricing
- Confirm reuse rights and attribution for gallery and Crew images
- Move all approved media into the repository or an approved asset service
- Validate all routes, redirects, images, links, metadata, and booking destinations
- Test desktop, tablet, and mobile layouts
- Confirm privacy and terms language
- Configure Cloudflare Pages and domain redirects
- Keep the WordPress site available until the replacement is approved and deployed

## Development workflow

`main` is currently the integrated development branch because the repository is not connected to the production domain and the WordPress site remains live.

Use separate branches for changes that could leave the project incomplete or temporarily unbuildable:

```text
feature/*   New isolated functionality
fix/*       Corrections and regressions
content/*   Approved copy and data changes
archive/*   Preserved experiments that are no longer active
```

Once the new platform becomes production, `main` should return to production-ready-only status and integrated preview work should move to a staging workflow.

## Documentation

- [Live-site style audit](./docs/brand/live-site-style-audit.md)
- [Homepage condensation and route strategy](./docs/brand/homepage-condensation-audit.md)
- [Performance, booking, mobile, and commerce pass](./docs/development/performance-booking-commerce-pass.md)
- [Verification required before production](./docs/foundation/verification-required.md)

## Ownership

Website platform and technical implementation maintained by **Designed to Breakthrough LLC** for **The Kut Shoppe LLC**.

This repository contains proprietary project code and business assets. Unless a separate license is added, it should not be treated as an open-source project.
