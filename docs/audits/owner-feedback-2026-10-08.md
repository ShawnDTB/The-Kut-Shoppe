# Owner feedback update — October 8, 2026

## Changes

- Removed the separate senior barber service menu and its obsolete data/style rules. Adult barber menus now state: Clients ages 65 and up receive $5 off the adult price.
- Restored visibility of the discount note, which an older stylesheet hid. The note now has readable light text, a larger font, and a full-width border.
- Sunday walk-in reference hours are 10 AM–3 PM, per Kash. Shared hours, footer/header summaries and visit content use the same schedule. Structured data intentionally omits opening hours because individual schedules vary.
- Clarified that posted hours are walk-in reference hours, individual professionals keep separate schedules, and the shop may close on days without bookings.
- Shortened the public address to 518 Main St., including the map panel.
- Added a dated Booksy summary: 5.0 from 664 reviews, including 649 five-star reviews. Google excerpts remain separately labeled; no combined cross-platform rating or outdated Google aggregate is claimed.
- Added Steph’s locally hosted portrait to the shared team data, used on the homepage and crew page. Image is a 337 × 421 WebP, 19,084 bytes, captured from her public styling reel at approximately 3.34 seconds. Only cropping and WebP encoding were applied; no generated facial details or retouching.
- Public account, shop and booking construction gates remain in place. Steph’s crew button continues to the loctician booking handoff.

## Sources and decisions

- Owner feedback and two supplied screenshots: senior discount, Sunday hours and walk-in disclaimer.
- Booksy profile checked October 8, 2026: https://booksy.com/en-us/71309_the-kut-shoppe_barber-shop_34196_stroudsburg
  - Observed 664 total: 649 five-star, 12 four-star and 3 one-star reviews; displayed platform rating 5.0. Used the exact observed total instead of the owner’s approximate 700.
  - Friday closes at 8 PM and Saturday at 7 PM. Updated the stale local values accordingly.
  - Booksy still listed Sunday closing at 2 PM. The owner’s explicit 3 PM closing takes precedence on this website; the external listing may need to be aligned separately.
- Steph’s official booking profile links to @crowned_bysteph: https://crownedbysteph.glossgenius.com/about
- Selected portrait source: https://www.instagram.com/crowned_bysteph/reel/CzZhB2SRAH4/ (November 8, 2023 styling reel).
  - User explicitly authorized finding a portrait frame in Steph’s reels through their signed-in Instagram session.
  - The closer styling frame was selected instead of the event flyer or distant graduation portrait. No Instagram embed or remote media dependency is introduced.

## Validation

- TypeScript and ESLint passed.
- Public build and production gates passed.
- Gzip budget: JavaScript 74.64 KiB / 120 KiB; CSS 36.09 KiB / 40 KiB.
- Static audit: 36 generated routes, zero detected issues in internal links/fragments, primary headings, landmarks, duplicate IDs, control names, image alt attributes, dimensions and asset existence.
- Browser review at 390 px and desktop: discount is visible, no horizontal page overflow on the checked mobile services, crew, visit, reviews and homepage routes; Sunday hours and disclaimer are visible; map-panel street address fits one line; portrait is loaded with alt text and lazy loading; Steph’s booking path reaches the intended GlossGenius handoff.
- This is a scoped owner-feedback content and image update. The full account/dashboard review was completed in the preceding audit; this pass did not repeat authenticated workflows or claim a screen-reader audit.

## Initial review state

Prepared and committed on dev-branch. This update has not been pushed or deployed to the live site.

## Main promotion verification

The user approved promotion to main after a second check of every owner request. The complete project check passed: 301 application tests, 12 environment tests, TypeScript, ESLint, public build, size budgets, production gates, Cloudflare runtime checks and notification Worker checks. All 17 database migrations apply to a fresh in-memory database. The public-release check confirms construction pages and closed platform feature gates. The refreshed 36-route static audit reports zero findings. No stale senior-service menu, Google 4.9/59-review claim, or Sunday-closed copy remains in the public source.

## Supplied portrait replacement — October 9, 2026

The user supplied a preferred portrait to replace the reel frame. The shared team photo now uses `/media/steph-portrait.webp` on the homepage and crew page, and the old reel asset was removed. The supplied 538 × 525 image was encoded as a 30,652-byte WebP without retouching or generated changes. A mobile-only image-position adjustment keeps her face within the narrow crew card. Desktop crew, 390 px mobile crew, and homepage thumbnail were visually checked. The public build, image asset checks, construction-page gates and bundle budgets passed (74.64 KiB JavaScript, 36.11 KiB CSS).
