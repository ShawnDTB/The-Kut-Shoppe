<div align="center">
  <img src="https://www.thekutshoppe.com/wp-content/uploads/2023/11/a2e8fdecb672406ba74a28a19b4063-the-kut-shoppe-llc-logo-5175fdd512c54b42b4da939b84353a-booksy.png" alt="The Kut Shoppe logo" width="112" height="112" />
  <h1>The Kut Shoppe Website Transformation</h1>
  <p><strong>Fresh cuts. Great conversations. Right here on Main Street.</strong></p>
  <p>A modern website platform designed and developed by <a href="https://www.dtbsolutions.tech/">Designed to Breakthrough LLC</a>.</p>
</div>

## The project

I am Shawn Dullen, Founder of Designed to Breakthrough LLC.

I originally built The Kut Shoppe's website in WordPress. That version gave the business an online presence, but over time it also made the limitations of a page-builder platform increasingly clear. Design changes were harder to control, performance depended on a growing WordPress stack, future features were restricted by plugins, and the business did not have the level of technical ownership I wanted to provide.

This repository represents the next stage of that work.

I am rebuilding The Kut Shoppe as a professional, GitHub-managed website platform using React, TypeScript, Vite, and a static deployment workflow. The goal is not simply to copy the WordPress site into a new framework. The goal is to preserve what made the original site and business recognizable while giving The Kut Shoppe a stronger foundation for accessibility, performance, local visibility, customer navigation, booking conversion, future commerce, and long-term development.

The current WordPress website remains public while this replacement is reviewed, tested, and prepared for launch.

## Why I moved it beyond WordPress

WordPress helped establish the first version of the website, but this project needed more control than a traditional theme and plugin stack could provide.

The new platform gives me direct ownership of:

- Page structure and visual behavior
- Mobile and desktop responsiveness
- Accessibility decisions
- Performance and image-loading behavior
- Search metadata and prerendered page content
- Booking navigation
- Business information and service data
- Future Shop, Account, and customer features
- Version history, review, rollback, and deployment through GitHub

Instead of relying on a collection of page-builder settings and plugins, the website is now built as a maintainable software project. Every important change can be reviewed, documented, tested, committed, and restored when needed.

## What Designed to Breakthrough delivered

This redesign turns the website into a clearer digital headquarters for an established Main Street barbershop.

The current experience includes:

- A focused homepage built around booking, hours, location, services, real work, and the Crew
- Direct booking paths for barbers and the shop's Loctician
- A current barber service menu with adult, senior, and kids pricing groups
- A responsive gallery using real Kut Shoppe work
- A dedicated Crew page with public professional profiles
- A Visit page with daily hours, contact information, directions, and Google Maps
- A mobile navigation drawer designed around touch use and customer priorities
- A future Shop structure that avoids carrying forward unrelated WordPress placeholder products
- A future Account route prepared for orders, saved information, and customer features
- Static prerendering for better first-load content and search visibility
- Reduced-motion support and accessibility-focused interaction behavior
- A custom favicon, structured routes, legacy redirects, and production metadata foundations

The result is faster to maintain, easier to extend, and far less confined than the original WordPress implementation.

## Design approach

I did not want this rebuild to become a generic luxury barbershop template.

The visual direction continues the strongest parts of the original Kut Shoppe identity:

- Near-black backgrounds
- White and soft-gray typography
- Editorial serif headings
- Restrained barber-red accents
- Original illustrated service icons
- Authentic shop, gallery, and professional photography
- Clean glass surfaces where they improve readability
- Subtle ornamental elements drawn from the original site
- Clear booking, calling, and visit actions

The tone is intended to remain confident, welcoming, community-oriented, skilled, direct, modern, and human.

The Kut Shoppe is presented as a downtown Stroudsburg business that serves clients across the Poconos, not as a disconnected online brand.

## Current customer experience

### Homepage

The homepage brings the most important customer information together without forcing visitors through a long sequence of oversized sections.

Customers can immediately find:

- The shop's daily hours
- The Main Street location
- The phone number
- Barber booking
- Loctician booking
- Service categories
- Recent work
- The Crew
- Products available through the shop
- Directions and visit information

### Services

The Services page provides a structured barber menu with separate sections for:

- Adult and teen services
- Senior services
- Kids services
- Loc care, braids, twists, retwists, and related appointments

The website helps customers understand where to go, while the external booking profiles remain responsible for current availability, provider schedules, appointment policies, and checkout.

### Gallery

The Gallery uses labeled work from The Kut Shoppe rather than generic stock examples. It is responsive, readable on touch devices, and organized to help customers understand the range of cuts, styling, beard work, designs, kids services, and first-cut experiences available through the shop.

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

## Booking today

Appointments currently continue through the providers already used by the business.

- **Barber appointments:** [The Kut Shoppe booking profile](https://booksy.com/en-us/71309_the-kut-shoppe_braids-locs_34196_stroudsburg)
- **Loctician appointments:** [Crowned by Steph](https://crownedbysteph.glossgenius.com/)

The website removes unnecessary provider branding from customer-facing buttons and presents the simpler choices:

- Book with Barber
- Book with Loctician

A more complete first-party Booking page is part of the next development phase. That experience will be able to guide customers by service type, professional, appointment need, and new-client questions before continuing to the correct scheduling destination.

## What comes next

This platform was built with future development in mind. The current routes already establish the structure for features that could not be handled cleanly inside the old WordPress setup.

### Booking page

The Booking experience will continue developing into a clearer service and professional router. The goal is to help customers understand what they need and reach the right chair with fewer wrong turns.

Planned improvements include:

- Service-first booking guidance
- Barber and Loctician separation
- Professional selection
- New-client guidance
- Booking policy summaries
- Better handoff to current scheduling providers

### Shop page

The Shop page will become the verified online home for approved Kut Shoppe products.

The future catalog may include:

- Grooming products
- Hair-care products
- Accessories
- Kut Shoppe merchandise
- Approved product collections

The unrelated placeholder products from the former WordPress and WooCommerce setup will not be migrated.

Before checkout is enabled, inventory, pricing, product photography, taxes, fulfillment, returns, and payment processing must be approved and configured.

### Account page

The Account page is reserved for future customer functionality such as:

- Order history
- Saved customer details
- Saved addresses
- Product preferences
- Account-based checkout
- Future loyalty or customer tools

This foundation means those features can be developed as part of the same controlled platform rather than added through disconnected plugins.

## Accessibility and usability

Accessibility is part of the platform architecture rather than a final visual patch.

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

The site will continue to receive accessibility review as the Booking, Shop, Account, and checkout experiences are completed.

## Performance and technical ownership

The production build creates static, prerendered HTML for every supported route. Customers and search engines receive meaningful page content before JavaScript finishes loading.

The build process:

1. Creates the browser bundle with Vite.
2. Creates a temporary server-rendering bundle.
3. Renders each supported route into static HTML.
4. Generates a production `404.html` page.
5. Removes temporary server-rendering files.

This approach provides the maintainability of React while keeping the production output suitable for a fast static host such as Cloudflare Pages.

Secondary images are lazy-loaded, the primary homepage image receives loading priority, responsive behavior is handled directly in the project, and there is no WordPress runtime or page-builder code required in production.

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

One of the most important improvements over the former WordPress setup is that business information is now centralized and documented.

Primary data files include:

- `src/data/site.ts`
- `src/data/hours.ts`
- `src/data/senior-services.ts`
- `src/data/visuals.ts`
- `src/data/commerce.ts`

I do not want unverified information silently filling gaps in the website. Prices, services, Crew details, credentials, testimonials, product inventory, accessibility claims, and business policies must be supported or approved before launch.

Open verification items are tracked in [`docs/foundation/verification-required.md`](./docs/foundation/verification-required.md).

Some approved images are still served from the existing WordPress media library. Before WordPress is retired, those assets must be downloaded, ownership-confirmed, optimized, and moved into this platform or an approved asset service.

## Deployment target

The planned production target is Cloudflare Pages.

```text
Build command: npm run build
Output directory: dist
Node version: 20.19 or newer
```

Before the production cutover, I will complete a final review of:

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
- Shop and account requirements
- Production domain configuration

The current WordPress website will remain available until the replacement is approved and ready to take over.

## Documentation

- [Live-site style audit](./docs/brand/live-site-style-audit.md)
- [Homepage condensation and route strategy](./docs/brand/homepage-condensation-audit.md)
- [Performance, booking, mobile, and commerce pass](./docs/development/performance-booking-commerce-pass.md)
- [Verification required before production](./docs/foundation/verification-required.md)

## About Designed to Breakthrough

Designed to Breakthrough LLC builds websites, IT systems, hosting solutions, automation, and technical documentation for small businesses and creators.

My work on this project covers discovery, business analysis, interface design, development, data organization, deployment planning, performance, accessibility, documentation, and long-term technical support.

The Kut Shoppe project demonstrates the difference between simply publishing pages and building a platform a business can continue growing into.

## Ownership

Website strategy, design, and technical implementation by **Shawn Dullen, Founder of Designed to Breakthrough LLC**, for **The Kut Shoppe LLC**.

This repository contains proprietary project code and business assets. Unless a separate license is added, it should not be treated as an open-source project.
