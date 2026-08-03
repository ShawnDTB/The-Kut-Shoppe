# Live-site style audit

Audit date: 2026-08-02

Sources reviewed:

- Current public pages at `thekutshoppe.com`
- WordPress export `thekutshoppe.WordPress.2026-04-03.xml`
- Elementor page, theme, typography, background, image, and animation settings
- Existing logo, illustrated service icons, feature icons, gallery images, team images, and section backgrounds

## Design intent

The replacement should feel like a cleaner and more maintainable continuation of the original website—not a generic luxury barbershop template and not a light SaaS-style redesign.

The visual identity is built around a near-black canvas, white and soft-gray type, large editorial serif headings, open section layouts, illustrated grooming icons, authentic shop photography, translucent ornamental artwork, and occasional fixed-background photo dividers.

## Confirmed palette

Elementor global colors and repeated page settings establish the following core system:

| Role | Original value | Implementation direction |
|---|---:|---|
| Main background | `#0D0D0D` | Primary page canvas |
| Headings | `#F4F4F4` | Large editorial headings |
| Body text | `#D9D9D9` | Paragraphs and navigation |
| Black overlay | `#000000` | Hero and image-divider overlays |
| Transparent | `#02010100` | Layering and section effects |
| Dark translucent layer | `#0000007D` | Photography overlays and depth |

Barber red remains a restrained supporting accent. It should not replace the original grayscale-first identity or cover entire sections.

## Confirmed typography

The original theme uses a mixed editorial and functional hierarchy:

- **Judson:** primary display and major headings
- **Rosarivo:** secondary editorial text
- **Mulish:** paragraphs and general interface copy
- **Alegreya Sans SC:** small labels, eyebrows, and uppercase accents
- **Maven Pro:** card and service headings used throughout Elementor sections

The code-based replacement currently loads these families for visual matching. Before production, they should be self-hosted or reduced to the smallest necessary set to improve privacy and performance.

## Header

The original header is visually quiet and allows the hero photography to carry the first impression.

Preserve:

- Compact dark header
- Circular Kut Shoppe logo
- Light uppercase navigation
- Thin separators rather than large containers
- Understated outlined booking action

Refine:

- Keep navigation keyboard-accessible
- Provide a real mobile navigation pattern
- Make the booking route understandable without making the header visually heavy

## Hero

Confirmed Elementor behavior:

- Four-image background slideshow
- Approximately 90vh minimum height
- 3.5-second slide duration
- Ken Burns movement enabled
- Centered positioning
- Dark overlay around 75 percent opacity
- Small centered message and outlined booking CTA

The replacement recreates this rhythm without a slider dependency. Reduced-motion preferences stop the slideshow and retain the first image.

## Transparent moving background system

The effect described as a transparent background that appears to move while scrolling is a deliberate Elementor layer system, not conventional glassmorphism.

Original section overlays use the following PNGs:

- `BG-2.png`
- `BG-3.png`
- `BG-4.png`
- `BG-5.png`
- `BG-8.png`
- `BG-9.png`

Repeated settings:

- Background overlay attachment: `fixed`
- Position: `center center`
- Size: `cover`
- Opacity: approximately `0.1`

The page content scrolls over these faint fixed ornamental images, creating depth without distracting animation. The React implementation preserves this with ornament section classes and disables fixed attachment on mobile and for reduced-motion users.

## Fixed-photo dividers

The original homepage uses large full-width image dividers to break long dark content areas.

Confirmed images:

- `shaving-accessories-and-tools-in-barber-shop-VSFV5XH.jpg`
- `tattooed-barber-trimming-bearded-man-with-shaving-SGQDLF4.jpg`

Repeated behavior:

- `background-attachment: fixed`
- centered cover image
- strong black or gradient overlay
- centered or left-aligned editorial CTA

These should remain intentional transition moments rather than appearing behind every section.

## Illustrated icon system

The custom icons are a key part of the original personality and should not be replaced with generic line icons.

Feature icons:

- `3-Icon.png`: skilled professionals
- `2-Icon.png`: customized grooming experience
- `1-Icon.png`: grooming products and complete experience

Service icons:

- `Service-1.png`: haircuts
- `Service-2.png`: shaving
- `Service-3.png`: beard trims
- `Service-4.png`: hair coloring
- `Service-5.png`: scalp treatments
- `Service-6.png`: styling

The current development version temporarily references these files from the live WordPress media library. They must be copied into the GitHub-managed asset pipeline, optimized, and given documented ownership before the WordPress installation is retired.

## Homepage rhythm

The original homepage structure is approximately:

1. Quiet header and full-photo slideshow hero
2. “A modern twist on classic cuts” editorial section
3. Three illustrated experience features
4. Illustrated service grid
5. Full-photo booking divider
6. “Why choose us” editorial split section
7. Curated gallery
8. Full-photo appointment divider
9. Team portrait section
10. Merchandise section
11. Dark logo-led footer

The replacement follows this sequence while separating booking, services, team, gallery, and visit information into maintainable routes.

## Layout characteristics

Preserve:

- Large vertical breathing room
- Narrow readable copy columns
- Oversized serif headings
- Alternating centered and asymmetric compositions
- Thin white and gray dividing lines
- Open service layouts rather than floating dashboard cards
- Square or lightly framed photography
- Dark editorial page canvas

Avoid:

- Rounded SaaS cards
- Cream-colored application backgrounds
- Large red blocks
- Black-and-gold luxury styling
- Excessive glass blur
- Repeated checkerboard decoration
- Animation on every section
- Stock icons that erase the custom illustrated identity

## Motion rules

Approved motion language:

- Slow hero image scale movement
- Fixed ornamental section overlays
- Fixed full-photo divider backgrounds on supported desktop browsers
- Small upward hover movement on buttons and icons
- Subtle image zoom on gallery and team hover

Accessibility rules:

- No motion is required to understand content
- `prefers-reduced-motion` removes slideshow and hover animation
- Mobile uses scrolling backgrounds instead of fixed backgrounds
- Text always remains readable against a strong overlay

## Asset migration status

The style pass intentionally references the current public WordPress media URLs so the redesign can be reviewed with the correct visual materials immediately.

Before production launch:

1. Export the approved source images and icons.
2. Confirm ownership and client permission.
3. Optimize originals into AVIF and WebP where appropriate.
4. Preserve PNG only when transparency or illustrated detail requires it.
5. Add responsive dimensions and `srcset` output.
6. Replace every WordPress media URL with a repository-managed path.
7. Verify that no visual asset depends on the retired WordPress host.

## Current implementation decision

`main` is the active development branch while the WordPress website remains the public production system. A feature branch should still be used for risky infrastructure work, large experiments, or changes that could make `main` temporarily unbuildable.