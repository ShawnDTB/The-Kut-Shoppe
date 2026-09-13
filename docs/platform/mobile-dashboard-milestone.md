# Mobile navigation and customer dashboard

Implemented on `dev-branch` after audit commit `90e7cad`. This milestone addresses the navigation layout and dashboard portions of the [launch backlog](launch-implementation-backlog.md). The original two-choice booking entry, service/professional/date/time selector, shop and existing account actions remain reachable.

## Navigation changes

- Replaced the custom overlay with a native modal dialog rendered outside the page shell. Native modal behavior supplies the top layer, background inertness and keyboard focus containment. The close control receives initial focus; cancel/Escape, outside click, close button and navigation links dismiss it.
- Consolidated viewport and scrolling geometry in `src/mobile-navigation.css`, removing obsolete drawer/header/overlay selectors from six legacy stylesheets. The panel uses the dynamic viewport height, a fixed header within the panel, one scrolling content area, and safe-area padding. It has no entrance animation.
- Aligned the JavaScript desktop transition to 1041px, matching navigation CSS that uses mobile controls through 1040px. Mobile-height resize events no longer close the menu due to the old 981px threshold.
- Closing or unmounting restores the page's overflow, position, inset and scroll position. Closing returns focus to the trigger when it remains available.

This corrects source-level causes identified by the audit. It is not yet proof that every reported visual clipping case is resolved: the managed browser refused local navigation with `net::ERR_BLOCKED_BY_CLIENT`. No new mobile screenshot or screen-reader acceptance is claimed.

## Dashboard changes

The next appointment leads the page, followed by request/pickup information, aggregate totals, recently updated appointments/orders, and profile/security links. Mobile CSS stacks these sections in the same task order. The shop's ivory, charcoal and gold palette and existing display typeface remain in use. Long headings can wrap without fixed heights; record links have larger targets and contextual accessible labels.

`GET /api/v1/me/dashboard` now includes:

| Field | Meaning |
| --- | --- |
| `counts.pending` | Distinct appointments requested, waitlisted, with a proposed reschedule, or confirmed with a pending cancellation. An appointment meeting two conditions is counted once. |
| `pendingAppointments` | Up to four most recently updated pending appointments, including cancellation state and location time zone. |
| `readyOrders` / `readyOrderCount` | Up to three pickup-ready orders plus their uncapped total, limited to pickup fulfillment. |
| `recentAppointments` / `recentOrders` | Most recently updated records, so a change to an older booking/order is visible. These are current record summaries, not an immutable event timeline. |

All seven queries use the authenticated immutable customer ID, including when an owner or professional opens their own customer overview. No guest email matching, staff notes or other customers' records are exposed. No new migration is required beyond existing migrations through `0010`.

Dates use each appointment location's time zone. A pending cancellation explicitly leaves the appointment confirmed. Pickup state does not imply payment, and an order total is not labeled as a paid receipt. Summary links lead to existing appointment/order details; this milestone does not invent rescheduling acceptance or financial actions.

Refresh retains loaded information during a request or network error, labels it as potentially stale after failure, and permits retry. Authorization failure removes cached records. An account identity change remounts the overview immediately and ignores responses from the previous account. No dashboard record is persisted in browser storage.

## Verification and review

`npm run check` passed for this milestone: 177 tests across 13 files, TypeScript, ESLint, client/SSR build, bundle budgets, production guards, and Cloudflare account/booking/inventory/notification runtime checks.

Automated coverage added:

- Native dialog lifecycle, initial and return focus, cancellation, outside/inside clicks, reopening, desktop transition and unmount cleanup. jsdom's modal methods are mocked; native focus containment and layout still require a browser.
- Dashboard cancellation/pickup copy, escaped record links, location time zone, uncapped-summary navigation, stale-data recovery, authorization loss and late responses after account changes.
- Real SQLite/API ownership checks, pending-count deduplication, old-record updates, pickup totals beyond the display limit, and exclusion of foreign/guest orders. Existing booking and commerce regression coverage remains part of the full suite.

Run `npm run check` for TypeScript, lint, tests, production build, bundle limits, production gates, and Workers/notification checks. These checks do not validate real payment processing, real email delivery or physical mobile devices.

Review locally with `npm ci` and `npm run review`. Use the local account credentials file identified by that command; use test information only. Review accounts and their data persist between runs, so requests and orders can be exercised rather than relying on a static mock dashboard.

| Review | Expected result |
| --- | --- |
| Open menu at top and after scrolling, at 320px, 390px and 1024px widths | Close control and brand remain accessible; all links and expanded hours can be reached by scrolling the content. |
| Short landscape, browser chrome resizing, and 200% zoom | Menu remains within the usable viewport; content is not hidden above the screen. |
| Tab and Shift+Tab with menu open | Focus stays within the dialog; background links cannot be operated. |
| Escape, close button, outside click, then reopen | Dialog closes cleanly; prior page position and trigger focus return. |
| Resize from 1024px to desktop while open | Menu closes and desktop navigation appears without leaving a scroll lock. |
| Visit with a pending cancellation | Dashboard shows the original confirmed visit and pending decision, with a link to details. |
| Owner marks a pickup order ready using existing order management | Customer sees pickup-ready status and the correct order details; no invented payment receipt. |
| Dashboard refresh during a connection failure | Existing records remain visible with a stale-data warning and a working retry. |
| Booking and shop smoke check | Both booking entry choices, barber calendar, account booking request and merchandise request remain usable. |

## Remaining work

The complete launch scope is still the [tracked backlog](launch-implementation-backlog.md). Next are real-browser accessibility/customer-flow acceptance and the rescheduling lifecycle that preserves the original appointment until a replacement is approved. Receipts, shared sale/payment records, cash register reconciliation, guest walk-ins, online/terminal payments, refunds, and deployment readiness remain separate required milestones. No payment activation, hosted migration, deployment or merge to main is included here.
