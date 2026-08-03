<div align="center">
  <img src="https://www.thekutshoppe.com/wp-content/uploads/2023/11/a2e8fdecb672406ba74a28a19b4063-the-kut-shoppe-llc-logo-5175fdd512c54b42b4da939b84353a-booksy.png" alt="The Kut Shoppe logo" width="112" height="112" />
  <h1>The Kut Shoppe Website Transformation</h1>
  <p><strong>Fresh cuts. Great conversations. Right here on Main Street.</strong></p>
  <p>A Designed to Breakthrough case study in moving a local business beyond WordPress and into a modern, accessible, GitHub-managed platform.</p>
</div>

## Project overview

The Kut Shoppe is an established Main Street barbershop serving downtown Stroudsburg and the wider Poconos community.

Its original WordPress website created the first digital home for the business, but the platform eventually became too restrictive for the experience the shop needed next. Page-builder limitations, plugin dependence, duplicated business information, inconsistent booking paths, placeholder commerce, and limited control over accessibility and performance made continued growth harder than it needed to be.

Designed to Breakthrough rebuilt the project around a more durable philosophy:

> **Designed for the business. Transform the experience. Breakthrough into what comes next.**

This repository is the result of that process. It preserves the identity and community presence of The Kut Shoppe while replacing the WordPress runtime with a maintainable React, TypeScript, Vite, and GitHub-based platform.

The existing WordPress website remains public while the replacement is reviewed, verified, and prepared for production.

## The DTB philosophy

### Designed

The work begins with the business, not the framework.

The redesign was shaped around how The Kut Shoppe actually operates and how customers move through the experience:

- Finding the shop on Main Street
- Checking hours before visiting
- Understanding the difference between barber and Loctician services
- Reviewing prices before booking
- Choosing the correct booking path
- Seeing real work from the shop
- Meeting the Crew
- Calling when guidance is needed
- Returning later for products, accounts, and future customer features

The visual system also preserves the strongest parts of the existing brand rather than replacing them with a generic template:

- Near-black backgrounds
- White and soft-gray typography
- Editorial serif headings
- Restrained barber-red accents
- Original illustrated service icons
- Authentic shop, gallery, and professional photography
- A classic barbershop feel with a modern presentation

The result is designed around the business identity, the customer journey, and the Poconos community the shop serves.

### Transform

The transformation goes beyond a visual reskin.

The project moves The Kut Shoppe from a confined WordPress and page-builder environment into a version-controlled software platform with direct ownership over:

- Page structure
- Responsive behavior
- Accessibility
- Performance
- Search metadata
- Booking navigation
- Business information
- Service pricing
- Mobile interaction
- Static rendering
- Deployment
- Future feature development

Business data is centralized instead of repeated across pages. Every major change can be reviewed, tested, committed, documented, and restored through GitHub.

The current transformation includes:

- A condensed homepage focused on booking, hours, location, services, real work, Crew, products, and directions
- Direct barber and Loctician booking paths
- Structured adult, senior, and kids barber pricing
- A responsive gallery using real Kut Shoppe work
- A dedicated Crew page
- A Visit page with hours, phone, directions, and Google Maps
- A mobile navigation drawer designed around touch use
- Static prerendering for meaningful content before JavaScript loads
- Reduced-motion support and accessibility-focused behavior
- A custom favicon, route metadata, redirects, and production foundations
- A Shop structure that does not carry forward unrelated WordPress placeholder products
- An Account structure prepared for future customer tools

The transformed platform is faster to maintain, easier to extend, and far less dependent on third-party page-builder behavior.

### Breakthrough

The purpose of the rebuild is not only to improve the current website. It is to create room for the business to keep growing.

The platform is being prepared for future development that would have been difficult to manage cleanly through the former WordPress setup.

#### Booking

The current website routes customers to the appropriate external booking destination:

- **Book with Barber**
- **Book with Loctician**

The next phase will continue developing the Booking page into a guided experience that can help customers choose by service type, professional, appointment need, and new-client questions before continuing to the correct schedule.

#### Shop

The Shop page will become the verified home for approved Kut Shoppe products, potentially including:

- Grooming products
- Hair-care products
- Accessories
- Kut Shoppe merchandise
- Approved collections

The unrelated placeholder products from the former WordPress and WooCommerce setup will not be migrated.

Before checkout is enabled, the business will need approved inventory, pricing, product photography, fulfillment rules, taxes, returns, and payment processing.

#### Account

The Account page is reserved for future customer functionality such as:

- Order history
- Saved customer details
- Saved addresses
- Product preferences
- Account-based checkout
- Future loyalty and customer tools

These features can now be developed inside one controlled platform instead of being added through disconnected plugins.

## Current customer experience

### Homepage

The homepage brings the most important customer information together without forcing visitors through a long sequence of oversized sections.

Customers can quickly find:

- Daily shop hours
- 518 Main Street
- The shop phone number
- Barber booking
- Loctician booking
- Service categories
- Real work from the gallery
- The Crew
- Product information
- Directions and visit details

### Services

The Services page provides a structured menu with clear sections for:

- Adult and teen barber services
- Senior barber services
- Kids barber services
- Loc care, braids, twists, retwists, and related appointments

The website helps customers understand the available service paths while the booking providers remain responsible for current availability, schedules, policies, and checkout.

### Gallery

The Gallery uses labeled work from The Kut Shoppe instead of generic stock examples. It is responsive, readable on touch devices, and organized around cuts, styling, beard work, designs, kids services, and first-cut experiences.

### Crew

The Crew page gives customers a direct path to the professionals behind the business. Public names, roles, photos, and booking destinations are centralized without inventing biographies, credentials, or specialties that have not been approved.

### Visit

The Visit page includes:

- 518 Main Street, Stroudsburg, Pennsylvania
- Daily walk-in reference hours
- A full-color Google Map
- Direct phone access
- Directions
- Guidance to confirm individual professional availability

## Accessibility and usability

Accessibility is treated as part of the platform architecture, not a final visual patch.

The current implementation includes:

- Semantic page structure
- Logical heading hierarchy
- Keyboard-accessible navigation
- Escape-key and backdrop closing for the mobile menu
- Body scroll locking while the navigation drawer is open
- Large touch targets
- Visible labels that do not depend on hover
- Reduced-motion support
- Fixed image dimensions to reduce layout movement
- Responsive typography and layouts
- Meaningful content available in prerendered HTML
- Clear booking, calling, and direction links

Accessibility review will continue as the Booking, Shop, Account, and checkout experiences are completed.

## Performance and technical ownership

The production build creates static, prerendered HTML for every supported route. Customers and search engines receive meaningful page content before JavaScript finishes loading.

The build process:

1. Creates the browser bundle with Vite.
2. Creates a temporary server-rendering bundle.
3. Renders each supported route into static HTML.
4. Generates a production `404.html` page.
5. Removes temporary server-rendering files.

This approach keeps the maintainability of React while producing output suitable for a fast static host such as Cloudflare Pages.

Secondary images are lazy-loaded, the primary homepage image receives loading priority, responsive behavior is handled directly in the project, and no WordPress runtime or page-builder code is required in production.

## Technology

- React 19
- TypeScript 5.9
- Vite 8
- ESLint 10
- Node.js 20.19 or newer
- npm 10 or newer
- Build-time server rendering
- Static route prerendering
- GitHub version control
- Cloudflare Pages compatible output

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

These hours are presented as walk-in reference hours. Individual schedules may differ and should be confirmed through the appropriate booking destination.

## Booking destinations

- **Barber appointments:** [The Kut Shoppe booking profile](https://booksy.com/en-us/71309_the-kut-shoppe_braids-locs_34196_stroudsburg)
- **Loctician appointments:** [Crowned by Steph](https://crownedbysteph.glossgenius.com/)

## Routes

| Route | Purpose |
|---|---|
| `/` | Homepage and primary customer journey |
| `/services` | Barber pricing and Loctician service access |
| `/services/haircuts` | Adult and teen haircut details |
| `/services/beards-shaves` | Beard and line-up combinations |
| `/services/kids-cuts` | Kids services for ages 3 through 12 |
| `/services/locs-braids` | Locs, braids, twists, and retwists |
| `/services/color-scalp-care` | Color, washing, scalp care, and related services |
| `/gallery` | The Kut Shoppe work gallery |
| `/team` | Crew profiles and booking paths |
| `/book` | Booking router and future guided booking experience |
| `/visit` | Hours, phone, map, and directions |
| `/reviews` | Verified client review destination |
| `/shop` | Current Shop foundation and future verified catalog |
| `/account` | Future customer account experience |
| `/contact` | Direct contact guidance |
| `/privacy` | Future production privacy policy |
| `/terms` | Future production website terms |

Legacy routes are redirected to their current destination:

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

The local Vite server normally opens at:

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

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the local development server |
| `npm run typecheck` | Validate TypeScript without writing output files |
| `npm run lint` | Run ESLint across the repository |
| `npm run build` | Build and prerender the production website |
| `npm run check` | Run typecheck, lint, and the full production build |
| `npm run preview` | Preview the generated production build |

Production files are generated in `dist/`.

## Project structure

```text
.github/
  workflows/          Repository automation

docs/
  brand/              Design, visual, and customer-flow audits
  development/        Performance, booking, mobile, and commerce notes
  foundation/         Production verification requirements

public/
  favicon.svg         Browser and manifest icon
  _headers            Cloudflare security and content headers
  site.webmanifest    Web application metadata

scripts/
  build.mjs           Production build coordinator
  prerender.mjs       Static route renderer

src/
  components/         Layout, homepage, route, and map components
  data/               Business, hours, services, Crew, visual, and commerce data
  App.tsx              Route composition and legacy redirects
  entry-client.tsx     Browser entry
  entry-server.tsx     Server-rendering entry
  *.css                Shared, page, mobile, and accessibility styles
```

## Content control and verification

Business information is centralized and documented instead of being repeated across page-builder sections.

Primary data files include:

- `src/data/site.ts`
- `src/data/hours.ts`
- `src/data/senior-services.ts`
- `src/data/visuals.ts`
- `src/data/commerce.ts`

Prices, services, Crew details, credentials, testimonials, product inventory, accessibility claims, and business policies must be supported or approved before launch.

Open verification items are tracked in [`docs/foundation/verification-required.md`](./docs/foundation/verification-required.md).

Some approved images are still served from the existing WordPress media library. Before WordPress is retired, those assets must be downloaded, ownership-confirmed, optimized, and moved into this platform or an approved asset service.

## Deployment target

The planned production target is Cloudflare Pages.

```text
Build command: npm run build
Output directory: dist
Node version: 20.19 or newer
```

Before production cutover, the final review includes:

- Business hours
- Launch Crew
- Senior pricing and age requirements
- Barber and Loctician booking destinations
- Image ownership and usage
- Mobile and desktop layouts
- Accessibility behavior
- Search metadata
- Redirects
- Privacy and terms
- Shop and Account requirements
- Production domain configuration

The current WordPress website remains available until the replacement is approved and ready to take over.

## Documentation

- [Live-site style audit](./docs/brand/live-site-style-audit.md)
- [Homepage condensation and route strategy](./docs/brand/homepage-condensation-audit.md)
- [Performance, booking, mobile, and commerce pass](./docs/development/performance-booking-commerce-pass.md)
- [Verification required before production](./docs/foundation/verification-required.md)

## Designed to Breakthrough

Designed to Breakthrough LLC builds practical digital systems for small businesses, creators, and service brands.

The work connects business discovery, solution design, interface development, hosting, automation, infrastructure, documentation, and long-term support. The objective is technology that is clear, usable, credible, growth-oriented, and able to evolve with the business.

The Kut Shoppe transformation demonstrates that philosophy in practice:

- **Designed** around the business and its customers
- **Transform** the platform and customer experience
- **Breakthrough** into a foundation ready for future growth

## Ownership

Website strategy, design, and technical implementation by **Designed to Breakthrough LLC**, led by **Shawn Dullen, Founder**, for **The Kut Shoppe LLC**.

This repository contains proprietary project code and business assets. Unless a separate license is added, it should not be treated as an open-source project.
