# Customer foundation review

Reviewed 2026-09-09. Repository: `ShawnDTB/The-Kut-Shoppe`. Base: `dev-branch`, commit `536bd3676e4cf8826a829d6883b0074bf3396f22`. Changes are proposed on `codex/customer-foundation`; neither `main` nor the WordPress site was changed.

## What the audit found

The repository has a useful product prototype, established shop branding, separate barber/loctician booking destinations, public page metadata, and several rounds of accessibility and code cleanup. The initial `npm run check` passed 58 tests. Initial production assets measured 114.26 KB JavaScript and 32.64 KB CSS, gzip, within the existing budgets.

The largest risk was the gap between what the interface appeared to do and what the application could actually deliver:

| Priority | Evidence in the starting code | Consequence | Change in this branch |
|---|---|---|---|
| Critical | `auth-v2.ts` trusted accounts, roles, and session IDs from localStorage | A person controlling their browser also controlled the apparent authorization boundary | Production accounts use a same-origin API, server-side credential checks, and opaque HttpOnly session cookies |
| Critical | `/book`, checkout, and administration used browser data adapters | A customer could submit something the business never received | Production booking uses the existing verified provider URLs; commerce remains closed; prototype operations require explicit local preview mode |
| High | Verification codes were created/stored in the browser, with no delivery transport; password recovery was disabled | Production customers could not complete a genuine verified account/recovery flow | Server-generated email codes, verification, sign-in, recovery, and password changes are implemented with a Resend adapter |
| High | Customer history was filtered by current email and optional current phone | Changing contact details could hide records; knowing contact details was treated as evidence of ownership | History queries use the authenticated `customer_user_id` exclusively; guest records are never automatically claimed |
| High | Existing role checks were client-only, with legacy role aliases and an extra developer flag | Reusing the old dashboard as a protected backend could preserve privilege escalation paths | New APIs read roles from the database, reject role/ID/verification fields in customer writes, and expose no staff mutation endpoints |
| Medium | `users.phone` was mandatory in the unapplied SQL baseline | Email registration could not follow the intended optional-phone model | The baseline now permits NULL phone; the additive migration creates credentials, challenges, rate limits, and profile fields |
| Medium | `/dashboard` rendered client content without its own prerendered route; walk-in and 404 output were indexable | Direct navigation and indexing could expose inconsistent behavior | Dashboard prerender added; private/unfinished operational routes and 404 output excluded from indexing |
| Medium | CI used `npm install --no-package-lock` even though a lockfile exists | CI could validate different dependencies from the review environment | CI now uses `npm ci`; new runtime tools are pinned |
| Medium | Production source maps and prototype code were bundled | Unnecessary internal implementation was shipped to the browser | Public source maps disabled; the local platform is a development-only lazy import |
| Ongoing | Roughly three dozen global CSS layers, versioned component remnants, third-party fonts and WordPress-hosted images | Maintenance and eventual WordPress removal remain harder than necessary | New account styles are scoped; broad stylesheet consolidation and asset migration remain separate work |

Final local validation passed all 74 tests, TypeScript, ESLint, prerender/build, production gates, and the Cloudflare runtime test. Production JavaScript is 78.71 KB gzip (about 31% below the baseline); CSS is 33.63 KB, still within the 40 KB budget. Generated internal-link targets resolved. The new account palette measures 16.47:1 for primary text, 9.74:1 for supporting text, and 3.88:1 for input boundaries against their declared backgrounds. These are source-color calculations, not a complete rendered accessibility audit.

This is source and generated-output analysis. It is not a claim that every existing public page was visually inspected in a browser.

## Applying the screenshots

### Screenshot 1: “20 reasons why your app looks vibecoded”

The useful principle is a deliberate interface that fits this business. The list is not a universal ban on a font, icon package, serif type, or the use of three columns.

| Screenshot feedback | Assessment for this repository | Applied decision |
|---|---|---|
| Purple/blue gradients; gradient hero text; colored card borders | Those are not the shop's approved identity. Existing red accents and photo overlays have a different purpose | Keep the black/ivory identity and restrained gold detail; the new account surface has solid backgrounds and neutral dividers |
| Glass cards; low-contrast dark mode; grain over gradients | Layered decoration has accumulated in the old CSS and can compete with functional screens | No glass or texture layers in the new account surface; explicit readable text, input boundaries, focus rings, and status colors |
| Inter everywhere; Space Grotesk + Instrument Serif; serif italics | The site uses its own Judson/Mulish and supporting type choices; a serif is part of the shop identity | Preserve that identity, without introducing another type system or decorative italic emphasis into forms |
| Emoji headings; ubiquitous Lucide icons; untouched shadcn | The project has no Lucide/shadcn dependency and did not need a new component library | Use clear text labels and semantic controls; no decorative emoji/icon dashboard boxes |
| Repeated three-box rows; badges above headlines | Customer tasks need a working account, not a marketing landing page | Real Appointments/Orders/Profile/Security sections; record lists and honest empty states |
| Scroll fades; cursor beams; buttons fading on hover | These add no value to authentication or profile editing | New account content is immediately visible, buttons retain contrast, and reduced-motion settings are respected |
| Inconsistent spacing | Dense forms and multiple CSS generations create a real maintenance concern | Scoped spacing, 48px inputs, wrapping navigation, and a single-column mobile form layout |
| Excessive em dashes; generic copy | UI copy should explain the task and its actual result | Plain language such as “Save profile,” “Sign out on every device,” and an explicit explanation that external bookings do not sync automatically |

### Screenshot 2: pre-launch checklist

“Present” means implemented in this repository. Hosted configuration and real-world verification are separate gates.

| Item | Status after this branch | Remaining work |
|---|---|---|
| 1. Privacy policy | Present; account/provider descriptions updated | Shop approval, actual retention periods, request-handling owner, and legal review for the final operating model |
| 2. Terms | Present | Confirm cancellation, deposits, returns, minors, fulfillment, and dispute policies before activating the relevant features |
| 3. Secrets off frontend | Implemented and production-output checked | Configure secrets in Cloudflare; never paste them into `VITE_*` variables or Git |
| 4. HTTPS | Secure cookies, origin checks, CSP upgrade directive, HSTS headers | Set the real origin and Cloudflare HTTPS redirect/TLS settings; verify them on staging and the final domain |
| 5. Cookie consent | No advertising/audience analytics added; essential session cookie described | Inventory tracking after provider/domain configuration and assess applicable consent requirements; a decorative banner would not supply consent enforcement |
| 6. Titles/descriptions | Existing per-route metadata retained; dashboard route added | Final content review and public canonical-domain verification |
| 7. Social preview image | Still outstanding | Approve a real sharing image and add absolute metadata; this branch does not generate an unrequested branding asset |
| 8. Favicon | Existing favicon retained | Verify final browser rendering |
| 9. Sitemap/robots | Existing generation retained; private-route checks added | Protect staging from indexing at the hosting layer too |
| 10. Image alt text | Existing asset semantics retained | Full rendered accessibility review of public pages and future uploaded images |
| 11. Image compression | Still outstanding for remote WordPress assets | Obtain approved originals, produce responsive WebP/AVIF variants, and migrate before WordPress removal |
| 12. Load speed | Existing bundle budgets retained; prototype JS excluded from production | Measure actual mobile loading and Core Web Vitals with final images, hosting, and third-party resources |
| 13. Color contrast | New account palette and controls explicitly styled | Rendered contrast review across all public pages and interaction states |
| 14. Mobile | New forms/nav designed to wrap, with 16px inputs and 46–48px controls | Browser acceptance at 320/375/390/430/768/1024px and desktop; mobile keyboard and password-manager checks |
| 15. Custom 404 | Existing custom 404 retained and checked | Verify unknown routes return HTTP 404 on the target host |
| 16. Broken links | Account/provider routes retained and generated paths checked | Public-link crawl and redirects verified after domain setup |
| 17. Form validation | New account API validates types, bounds, fields, phone/address shape; UI supports field constraints | Browser validation and recovery/error usability review |
| 18. Spam protection | Server-side Turnstile validation and D1-backed throttles implemented | Create real domain-scoped keys; configure edge abuse limits and monitor email cost |
| 19. Analytics | Deferred | Agree on actual business questions and privacy requirements before selecting/enabling tracking |
| 20. Clear CTA | Booking remains the public primary action; account actions reflect each task | Confirm the full mobile customer journey on staging |

### Screenshot 3: build-your-own-x

The screenshot points to the educational [build-your-own-x repository](https://github.com/codecrafters-io/build-your-own-x). It can help understand systems, but is not a dependency requirement or a launch-security standard. This project should use established runtime cryptography and service providers, with tests of our own authorization and business rules.

## What customers can use after staging is configured

The new flow is registration → email verification → sign-in → one account with appointments, orders, profile, and security. Phone and delivery address are optional. Saved changes persist in D1 and can be read on a different signed-in device. Password changes and recovery revoke old sessions; customers can also sign out every device explicitly.

History is a real private database read, currently capped at the latest 100 records in each list. There are no invented appointments or orders. Booksy and GlossGenius do not automatically sync here. Online cancellation, rescheduling, native booking submission, order details/checkout, verified email changes, and self-service data export/deletion are not complete. The UI gives the customer a real contact/provider path for those needs.

Accounts remain disabled by default. Missing database or service configuration never falls back to browser accounts. The prior browser platform is preserved solely for disposable local design review with `VITE_LOCAL_PLATFORM_PREVIEW=true` under Vite development.

## How roles build on this foundation

| Person | Shared account foundation | Additional operational authority to build |
|---|---|---|
| Visitor | Public pages and external booking | None |
| Customer | Own identity, profile, history, recovery, session controls | Own appointment changes once the protected booking lifecycle is ready |
| Approved barber, setup incomplete | Same personal account | A server-verified “Finish professional setup” flow; no public listing until approved |
| Barber | Same personal account | Own chair, schedule, assigned appointments, and permitted waitlist work |
| Manager | Same personal account | Shop appointments, staff approval, products, and orders; cannot change Owner/Developer accounts |
| Owner | Same personal account | Business settings and controlled role changes; require stronger authentication before operational launch |
| Developer | Same identity architecture | Explicit, audited support access with its own scope; no browser-controlled developer override |

These are shared components plus separately authorized actions. A visually “upgraded customer dashboard” must not mean fetching everybody's information and hiding it with CSS. Role, resource ownership, staff assignment, account status, and eventual MFA requirements belong in each server endpoint. The schema's legacy `staff`/`admin` roles map to public `barber`/`developer` names at the API boundary.

## Next milestones and exit criteria

1. **Customer staging acceptance.** Bind an isolated D1 database, configure origin, Turnstile, and verified email sender. Demonstrate signup, real delivery, recovery, two-device persistence, logout/revocation, and one customer's inability to access another's data. Review mobile and accessibility behavior. Confirm privacy procedures.
2. **Booking data lifecycle.** Use the existing services/staff/locations/holds schema. Implement server-calculated availability, atomic overlap protection and expiring holds, idempotent requests, immutable customer ownership, shop-time-zone handling, confirmation/proposal/cancellation rules, notification delivery, and a verified guest-claim mechanism. Test simultaneous requests for one slot. Keep provider booking until this loop is accepted.
3. **Barber operations.** Reuse the customer account shell and server identity; add assigned-appointment APIs, professional setup/approval, schedule changes, and auditable staff actions. Test an unapproved barber, a barber viewing another chair, and role removal during a session.
4. **Manager and owner operations.** Add the needed shop-wide APIs with explicit capability guards, MFA/step-up authentication, protected role changes, and audit review. Preserve the distinction between authorization role and a publicly bookable professional.
5. **Commerce and production cutover.** Implement catalog/inventory/order APIs and hosted payments; verify inventory concurrency and webhook authenticity. Migrate assets, approve business content/policies, test backups/restores, configure monitoring and rollback, then plan the domain cutover. A brochure/account-only release can precede native booking/commerce if its disabled states and external booking paths are accepted.

See [customer deployment runbook](customer-deployment-runbook.md) for configuration, controls, test evidence, and remaining release gates.
