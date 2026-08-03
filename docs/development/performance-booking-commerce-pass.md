# Performance, booking, mobile, and commerce pass

Audit date: 2026-08-02

## Public sources reviewed

- The current Booksy profile supplied by the project owner
- The current Crowned by Steph GlossGenius profile supplied by the project owner
- The Kut Shoppe Instagram profile URL supplied by the project owner
- The current WordPress site
- Local desktop screenshots of the current React implementation

## Booking source of truth

### Barbering

Barbering now links directly to:

`https://booksy.com/en-us/71309_the-kut-shoppe_braids-locs_34196_stroudsburg`

The public profile currently lists:

- KasH The Fadeologist
- Kris-P Fades
- Mr. Glen The Kut Doctor.
- 5.0 rating
- 647 public reviews at the time of this audit

Current public barber categories and prices were moved into centralized typed data.

Kids ages 3 through 12:

- KIDS SPECIALTY KUT — $40 — 1 hour
- KIDS BUZZ KUT — $30 — 1 hour
- KIDS LINE-UP (HEAD ONLY) — $25 — 1 hour

Adults and teens age 13 and older:

- SPECIALTY KUT (W/ FACIAL HAIR AND BEARD LINE-UP) — $55 — 1 hour
- SPECIALTY KUT — $45 — 1 hour
- BUZZ KUT (W/ FACIAL HAIR AND BEARD LINE-UP) — $45 — 1 hour
- BUZZ KUT — $35 — 1 hour
- BALD KUT (W/ FACIAL HAIR AND BEARD LINE-UPS) — $45 — 1 hour
- BALD KUT — $35 — 1 hour
- LINE-UP (HEAD & FACE ONLY) — $30 — 1 hour

Booksy remains the final source at booking because provider data can change independently of this website.

### Locs, braids, and styling

Styling now links directly to:

`https://crownedbysteph.glossgenius.com`

The public GlossGenius landing page confirms the Crowned by Steph business and booking destination. Its complete service and pricing list was not reliably available through the audit tooling, so the website does not duplicate or invent those prices. GlossGenius remains the styling source of truth.

## Header decision

The expandable Book Now panel was removed.

Reasons:

- It covered hero content when opened.
- It repeated a decision already explained in the hero and Book page.
- It required an extra interaction before reaching an external provider.
- Native `details` behavior was inconsistent with the otherwise direct interface.

Replacement:

- Direct Book barber action labeled Booksy
- Direct Book styling action labeled GlossGenius
- Both links open the provider in a new tab
- Mobile navigation shows the same choices as full-width touch targets
- The phone number remains the ambiguity fallback

## Section navigation

Homepage section links now use two layers of resilience:

1. Normal URLs such as `/#about` work from any route.
2. When already on the homepage, React scrolls directly to the section, updates the hash, and closes the mobile navigation drawer.

A hydration-time hash listener also recovers the requested section after local Vite navigation or a full page load.

The dedicated `/about` route is retired from the customer journey and redirects to `/#about`. This removes duplicate About content while preserving old links.

## Team photography

The Booksy profile exposes individually labeled public staff images for:

- KasH The Fadeologist
- Kris-P Fades
- Mr. Glen The Kut Doctor.

Those labeled images are used for their corresponding cards. No image-to-name association was inferred from appearance.

Instagram could not be fetched reliably by the audit tooling. It remains linked from the gallery and footer, but no Instagram image was copied or attributed during this pass.

Crowned by Steph currently uses a neutral monogram until a clearly labeled, approved image is available from GlossGenius, Instagram, or the client.

## Active navigation marker

The former diamond marker was replaced with a monochrome scissors symbol. It uses an inline SVG mask, follows the site’s grayscale palette, and appears consistently on the active dedicated page such as Shop.

## Commerce foundation

The former `/products` route now redirects to `/shop`.

Typed commerce structure now reserves:

- `/shop`
- `/shop/category/:slug`
- `/shop/product/:slug`
- `/cart`
- `/checkout`
- `/account`

Initial categories:

- Grooming
- Hair care
- Accessories
- Kut Shoppe merchandise

No fake inventory, pricing, checkout, or customer accounts are exposed. The Shop page presents category readiness and directs customers to ask about current in-store products.

Commerce readiness flags exist for inventory, payments, shipping, tax, and customer accounts. These prevent the visual shell from being confused with an operational store.

## Performance changes

- Removed the interactive booking dropdown and its runtime state behavior
- Added preconnect hints for the current WordPress image host, Booksy image CDN, and Google Fonts
- Added lazy loading and asynchronous decoding to off-screen team, gallery, shop, and footer images
- Added `content-visibility: auto` and intrinsic-size placeholders to major off-screen sections
- Disabled expensive header backdrop blur on smaller layouts
- Preserved fixed decorative backgrounds only where existing mobile fallbacks already disable them
- Added render-safe image dimensions to reduce layout movement

## Remaining performance work

The largest remaining issue is external media ownership and optimization.

Before production:

1. Export approved WordPress and Booksy images.
2. Store them in the repository or approved asset service.
3. Generate AVIF and WebP responsive variants.
4. Add `srcset` and `sizes`.
5. Replace CSS background images with responsive picture elements where practical.
6. Reduce or self-host the current font set.
7. Run Lighthouse against a production preview on mobile and desktop.
8. Set measurable budgets for JavaScript, CSS, images, LCP, CLS, and INP.

## Mobile rules

- Navigation choices must have a minimum comfortable touch target.
- Booking providers remain visually distinct and directly actionable.
- Secondary links are grouped below the primary homepage journey.
- The navigation drawer uses contained scrolling and closes after same-page navigation.
- Team and Shop grids collapse progressively from two columns to one.
- Price rows retain names, duration, and price without horizontal overflow.
- No required information depends on hover.
