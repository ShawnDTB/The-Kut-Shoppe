# Account and dashboard review — October 4, 2026

Implemented on `dev-branch`, starting from the latest local `main` (`9ccc490`). The working tree was clean at the start. No remote publication, production configuration, live database, or WordPress changes were made. Schema remains at migration **0015**.

## Pass 1: current state and account functionality

Traced the production routes, rather than the retained browser-storage prototype. Verified the existing server-backed registration, email verification, password recovery, profile/email/password changes, booking and order history, staff MFA, setup, scheduling, visit lifecycle and management tools.

Closed these gaps:

- Added real account search and staff-role changes behind the staff-operations flag, current management authority, MFA and password confirmation. The server checks target verification, expected role and revision again at commit time. Changes are audited atomically and revoke the target's existing sessions.
- Prevented self-edits, manager edits of owner/administrator access, removing the last active verified owner, and stripping professional access while assigned visits remain unresolved. Assigning a role does not approve or publish a professional profile.
- Added a private active-session list and individual sign-out for other sessions, while retaining all-device sign-out. No session tokens, device fingerprints or fabricated device locations are returned.
- Deduplicated simultaneous session refreshes, preserved identity through transient network failures, and prevented late responses from restoring a signed-out identity or clearing a newer sign-in.
- Added client-side handling for direct staff-only links. Server authorization remains authoritative.

## Pass 2: performance and accessibility

- Split account and commerce code from the initial application download; kept the public booking gateway prerendered. Initial JavaScript decreased from **115.72 kB to 80.98 kB gzip** in the build report, approximately **30%**. This measures transferred code size, not real-user load time or Core Web Vitals.
- Final aggregate gzip budgets passed: **117.88 / 120 KiB JavaScript**, **35.76 / 40 KiB CSS**. The JavaScript budget has limited remaining headroom.
- Added password visibility controls, focus movement through sign-in steps and account navigation, explicit section/role selector labels, and focus on role-change confirmation.
- Honored reduced motion for homepage anchor scrolling.
- Fixed unnamed storefront product-image links when no product image exists.
- Browser audit: **29 views**, no reported WCAG A/AA violations in the automated axe rules used, no horizontal overflow in the tested widths, and no JavaScript page errors. Tested the public pages and role dashboards at **320, 375, 390, 430, 768, 1024 and 1440 px**; secondary account sections at **320, 390, 768 and 1440 px**. Automated checks do not establish complete WCAG conformance or replace assistive-technology and real-device acceptance.

## Pass 3: user experience

- Replaced the long mixed account tab row with grouped desktop navigation and a compact phone section selector. Kept personal appointments/orders distinct from staff and shop work.
- Simplified the account header to shop identity, a return to the public website and account access. Public signed-in navigation now says **Dashboard** rather than an unexplained first name.
- Preserved direct record links and browser Back navigation. Registration and recovery show the destination email, and mode changes are disabled during submissions.
- Kept meaningful loading, empty, unavailable and denied-access states; retained booking-provider alternatives and existing request/confirmation distinctions.
- Staff-access edits have a review step explaining the role and session effects. Searches are bounded to 50 results with a prompt to narrow larger result sets.

## Role dashboards

- **Client:** next visit, pending decisions, pickup-ready orders, recent activity, profile and security remain server-scoped to the client's immutable identity.
- **Barber:** an MFA-protected chair overview shows assigned pending decisions, upcoming/active visits, next clients, availability and professional setup. Incomplete profiles receive setup guidance.
- **Manager/owner/administrator:** an MFA-protected shop overview shows scoped operational counts, upcoming clients and links to the front desk, staff access, orders and authorized setup reviews. Shop management does not require an owner to create a barber profile. Personal bookings remain separate.
- Counts are calculated in the database, not from truncated visible lists. Operational summary reads recheck current role, session and MFA; chair records also require the assigned approved professional profile. No earnings, paid receipts or invented business metrics were added.

## Verification

- `npm run check` passed: **240 application tests**, **12 release-environment tests**, TypeScript, ESLint, production build, bundle budgets, output safety checks, Cloudflare Workers/D1 checks and notification-worker checks.
- Final label-only refinement passed a fresh build, TypeScript, ESLint, bundle and production-output checks.
- Real browser forms against the loopback review API passed registration, password visibility, email verification, profile persistence, mobile navigation/focus/Back, denied staff links, password recovery and sign-in, individual session revocation, owner role-change confirmation, affected-session revocation and the promoted barber's MFA requirement.
- Repeated automated sign-ins exercised the local rate limit. Only disposable review-database counters were cleared for the final workflow rerun; application rate limits remain unchanged.
- All browser-created identities and changes were in the isolated local review database. Local mail and anti-bot verification are simulated by the existing review runner. No messages were sent to actual customers.

## Review and remaining release work

Run `npm run review`, then open `http://localhost:8788/account`. Use the local accounts recorded in `.wrangler/review/accounts.json`. Preserve local authenticator/recovery information when testing staff accounts; the MFA checks are real even in local review.

Hosted activation remains governed by `release-readiness.md`: real hosting/D1 bindings, secrets, verified email and Turnstile, trusted owner provisioning, notification delivery, staging acceptance and the booking-provider cutover plan. The production defaults remain disabled. Payment collection, financial receipts and payroll are separate unfinished product work. Privacy export/deletion requests retain the existing contact-the-shop workflow; no new retention policy or automatic deletion was invented.
