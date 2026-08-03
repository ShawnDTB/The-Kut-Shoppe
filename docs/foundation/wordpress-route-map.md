# WordPress route migration map

Initial inventory date: 2026-08-02

| Current route | Proposed route | Action | Notes |
|---|---|---|---|
| `/` | `/` | Replace in place | Preserve brand and primary booking intent |
| `/services/` | `/services` | 301 | Add meaningful service subroutes |
| `/aboutus/` | `/about` | 301 | Move team content to `/team` |
| `/gallery/` | `/gallery` | 301 | Migrate curated and optimized assets |
| `/shop/` | `/products` | 301 | Do not migrate placeholder products |
| `/cart/` | `/products` | 301 | Commerce disabled in phase one |
| `/checkout/` | `/products` | 301 | Commerce disabled in phase one |
| `/my-account/` | `/products` | 301 | Remove unused account experience |

## Remaining migration work

- Crawl indexed attachment, category, tag, author, feed, and pagination URLs
- Review Search Console and analytics for valuable legacy routes
- Inventory backlinks
- Export page titles, descriptions, approved copy, and source images
- Verify redirects on the Cloudflare preview
- Monitor 404 traffic after launch
