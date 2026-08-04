# Archived route identity system

> Historical design record preserved from `archive/route-identity-pass` during the 2026-08-04 repository stabilization. The experiment's code and stylesheet were not merged because later Platform V2 route patterns superseded them.

## Original direction

Services, Gallery, Crew, and Shop should feel like distinct destinations without becoming separate visual brands or adding another obstacle before useful content.

Shared rules included compact introductions, one priority image above the fold, natural mobile wrapping, restrained motion, reduced-motion support, Main Street and Poconos language, and no invented inventory, reviews, biographies, availability, or service details.

- **Services — service board:** active shop photography, original service icons, direct booking paths, and complete pricing.
- **Gallery — work wall:** featured results arranged as framed work with permanent labels on touch devices.
- **Crew — behind the chairs:** working shop imagery, a compact roster, verified cards, and direct booking actions.
- **Shop — display case:** real shop photography and approved category directions without WordPress placeholder products.

Performance guidance included eager-loading only the active route's priority image, using `content-visibility` where appropriate, responsive grids, full-width mobile actions, and no hover-dependent meaning.
