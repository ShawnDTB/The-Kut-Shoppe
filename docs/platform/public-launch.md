# Public launch — October 4, 2026

The public release is the marketing website plus booking, shopping and account holding pages. Existing Booksy and Crowned by Steph booking links remain usable. No native appointment request, signup, checkout, payment or cash workflow is enabled publicly.

## Deployment

- Worker: `the-kut-shoppe`, account `ef97f4e6cee13846035d6e5982999bd8`.
- Temporary URL: `https://the-kut-shoppe.shawndtb.workers.dev` (noindex).
- Production configuration: `wrangler.production.toml`.
- Isolated production D1: `kut-shoppe-production`, `5ff3c286-4d23-4810-a80a-6336d85a7328`. Migrations 0001–0017 applied. No review users or business records copied.
- Intended owner: `admin@thekutshoppe.com`. Sender: `The Kut Shoppe <admin@thekutshoppe.com>`. These are planned addresses, not proof of a provisioned mailbox or email provider.

`npm run check` validates source, tests, public build, size budgets, production gates, and the account/notification runtime against disposable local data. `npm run deploy:release` builds and checks the holding-page release and deploys the production Worker. Wrangler also invokes the same build and gate when deployed directly. Deployment never enables account flags automatically.

`npm run review` builds the full platform and starts the local account review service on localhost:8788. `npm run dev` exposes full development routes; `npm run build:platform` builds their deployable code for isolated future staging. Never upload the development build directly as production assets. The public release excludes unfinished platform screen bundles. Keep development on dev-branch; main is the reviewed production source.

All site images and decorative backgrounds are now served from `public/media`, independent of WordPress/DreamHost. They are optimized WebP copies of existing shop artwork. Production D1 is never used by the local review service.

## Domain cutover

The domain was not present in the connected Cloudflare account when this release was prepared. The owner is handling the transfer. Before changing nameservers, inventory and preserve existing DNS, especially any mail-related records. Registrar transfer and hosting cutover are separate steps.

Once the Cloudflare zone is active, bind `www.thekutshoppe.com` and `thekutshoppe.com` as Worker Custom Domains for `the-kut-shoppe`, following Cloudflare's conflict checks for existing DNS records. Add both custom-domain routes to the production configuration so future deployments retain them. Set `APP_ORIGIN` to `https://www.thekutshoppe.com`. The Worker redirects the apex to www while preserving paths and queries. Verify TLS, redirects, static pages, local images, provider links, and closed APIs on both hostnames before retiring DreamHost. Canonical URLs and sitemap already use www. The temporary workers.dev address stays noindex.

## Account activation, separately from this launch

1. Configure a working mailbox/routing for admin@thekutshoppe.com and a verified transactional sender with SPF/DKIM/DMARC. Configure the existing Resend integration and test delivery, verification, recovery and email changes.
2. Provision a real hostname-authorized Turnstile widget. Store its secret and the Resend API key as Worker secrets. Generate separate random AUTH_SECRET and MFA_ENCRYPTION_KEY; store securely and never commit them. No production credentials have been invented or copied from review.
3. Use an isolated staging Worker/database for the full account build; run the three-pass account and role acceptance there. The current production deploy command deliberately rejects activation flags; update that release policy only with the reviewed account release.
4. Register and verify admin@thekutshoppe.com through the real flow, then bootstrap its owner role through a controlled database change with an audit record. There is no seeded owner password. Enroll owner MFA before staff management. Keep customer role assignment as the registration default.
5. Enable features in reviewed stages. Booking requires approved provider availability, staff operations and tested appointment delivery. Shop and cash workflows need separate operational acceptance. Never deploy the example notification configuration unchanged.

## Rollback

Keep the previous Cloudflare deployment/version available and roll back to it if a new public deployment fails verification. If a domain cutover fails, restore the recorded prior DNS configuration until resolved. Public code rollback must not reverse or delete account data. The production database is currently a new, empty installation; future schema changes require their own migration review.
