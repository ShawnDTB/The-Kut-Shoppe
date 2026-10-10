# Account rollout update — October 9, 2026

The user approved an account-only release on main. See [account public rollout](account-public-rollout.md) for the current scope, verified Resend sender, applied migration and rollback. Only accounts are enabled; booking/shop holding pages and all other operational gates remain closed. Older account-disabled statements below describe the initial holding-page launch.

# Live domain status

Both `www.thekutshoppe.com` and `thekutshoppe.com` are active Pages custom domains with validated certificates. Their CNAME records point to `the-kut-shoppe.pages.dev`; apex redirects to www. Existing MX, SPF, DMARC and other legacy DNS entries were preserved. The prior website A records were both `69.163.182.247`; a full dashboard transcription is saved with the handoff outputs. The registrar transfer can finish independently.

The automatic GitHub main Pages build passed, including the Pages-specific flat HTML output needed to avoid trailing-slash redirect loops. The separate Worker is deployed and service-bound. Automatic Worker Builds are connected to GitHub main as of October 5, 2026. Each run uses Node 22, executes `npm run check`, then publishes with `npx wrangler deploy --config wrangler.production.toml`. Only main triggers production builds; development branches have no production trigger. The dedicated `Kut Shoppe main deployments` credential is restricted to Workers Scripts: Edit within the hosting account. Temporary Workers Builds Configuration: Edit access is used only for initial setup and is removed after verification.

Latest validation: full `npm run check` passed with 283 application tests, 12 environment tests, production gates and both runtime suites.

# Pages and Worker connection update

Cloudflare DNS is active ahead of the registrar transfer. The `the-kut-shoppe` Pages project is connected to GitHub `main`, with `npm run build:pages` and `dist-pages` as its build/output. `wrangler.toml` is now the Pages configuration; `wrangler.local.toml` preserves the disabled local D1 template. Pages forwards production-domain API requests to the existing `the-kut-shoppe` Worker through the `API` service binding. Preview deployments have no service binding and cannot access production accounts. `wrangler.production.toml` remains the separate Worker configuration.

A real Turnstile widget is provisioned for apex/www. Separate random AUTH_SECRET and MFA_ENCRYPTION_KEY plus TURNSTILE_SECRET_KEY are stored as Worker secrets. No secret values are committed. All account/booking/shop flags remain disabled pending verified transactional email and owner acceptance. Production origin is `https://www.thekutshoppe.com`.

Pages and the separate Worker automatically build main. For a manual Worker release, use `npx wrangler deploy --config wrangler.production.toml`. The commands are deliberately separate: Pages does not overwrite Worker credentials or its database binding.

The earlier initial-launch record below is historical; domain and credential claims are superseded by this update.

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
