# Component and data architecture

## Rendering model

The application uses React components during development and a Vite server build to prerender every public route into static HTML. Browser JavaScript hydrates the same markup for progressive enhancement. Core content, metadata, navigation, and calls to action do not depend solely on client-side rendering.

## Foundation structure

- `src/data/site.ts`: source-tracked business information, booking paths, services, team names, navigation, and route metadata
- `src/App.tsx`: shared layout and initial route components
- `src/entry-client.tsx`: browser hydration
- `src/entry-server.tsx`: static rendering and route metadata
- `src/styles.css`: design tokens, responsive layout, focus states, and reduced-motion behavior
- `scripts`: production build and prerender process
- `public`: Cloudflare headers, redirects, robots, and manifest

## Verification status model

Content uses four states:

- `verified-live-site`
- `verified-booking-platform`
- `requires-verification`
- `placeholder`

Questionable information is visible as a staging review badge and is documented separately before production.

## Planned component expansion

- Accessible mobile navigation dialog
- Responsive image and picture component
- Structured-data component
- Breadcrumbs
- Filterable and progressively loaded gallery
- Approved professional profile cards
- Review cards with source attribution
- Cloudflare-backed contact form
- Privacy-conscious analytics events
