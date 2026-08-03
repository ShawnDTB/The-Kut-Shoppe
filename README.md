# The Kut Shoppe Platform

A code-based replacement for The Kut Shoppe's WordPress website, maintained by Designed to Breakthrough LLC.

The existing WordPress website remains the public production site while the replacement is designed, verified, tested, and reviewed.

## Development workflow

`main` is currently the active development branch because it is not connected to the live production domain. Use a feature branch for risky infrastructure changes, large experiments, or work that may leave the project temporarily unbuildable.

```bash
git switch main
git pull origin main
npm install
npm run dev
```

Validation:

```bash
npm run check
```

## Current design direction

The redesign preserves the original site's dark editorial identity, illustrated service icons, authentic photography, fixed translucent ornament layers, and restrained parallax dividers while replacing the WordPress runtime with a maintainable React, TypeScript, Vite, and Cloudflare-ready platform.

See `docs/brand/live-site-style-audit.md` for the full visual analysis and asset-migration rules.