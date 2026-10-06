# Kut Shoppe website cohesion review

Initial inventory: October 5, 2026. Browser follow-up: October 6, 2026. Baseline: dev-branch / ead9806, matching the deployed main release.

## Pass 1 — Current state

The live inventory captured 22 routes (see Website-Baseline-2026-10-05.json), all returning HTTP 200. Public booking, shop, and account pages are intentional construction pages. The development platform contains customer accounts, appointment requests and changes, order requests, professional onboarding, availability, front desk, sales preparation, cash registers, and role-specific dashboards.

No broken internal destination was identified in that HTTP inventory. The more significant problems are content, destination intent, and discoverability:

| Finding | Customer consequence | Planned correction |
| --- | --- | --- |
| Services has no primary heading | Poor page orientation, especially with assistive technology | Restore a clear services/pricing heading |
| Public booking ignores barber/loctician query | Customers repeat a choice they already made | Preserve provider intent and identify the chosen professional |
| Homepage crew cards all link to generic booking | Clicking a person loses context | Link to that professional's crew profile |
| Public accounts use workspace navigation | Construction page appears to be a private dashboard | Keep public navigation on public placeholders |
| Multiple navigation definitions | Header/footer can drift | Share the canonical navigation |
| Duplicate, unused reviews renderer; inconsistent ratings metadata | Conflicting review claims and unnecessary code | Retain one review page and link to current ratings |
| Shop teaser always says coming soon | Development shop appears unavailable even when enabled | Match teaser to public/development release |
| Two cart drawers with incomplete keyboard lifecycle | Different behavior and missing modal focus management | Reuse a native modal drawer |
| Cart nests a main landmark and has an unnamed image link | Confusing screen-reader navigation | Correct landmarks and link names |
| Checkout implies a completed purchase and calculated charges | Customers may misunderstand unpaid requests | Explain review, unpaid submission, and later charge confirmation |
| Sign-in at checkout loses visible purchase context | Customer cannot tell whether their cart remains | Explain cart preservation and provide a return link |
| Appointment/history copy predates rescheduling and active orders | Working features appear absent | Align instructions with current record actions |
| Store management has no dashboard return | Staff detour through personal account views | Add a consistent dashboard return |
| Sales/register tools missing from overview | Staff must hunt through the sidebar | Add role-scoped dashboard shortcuts |
| Old route metadata advertises retired staff capabilities | Browser titles promise unavailable tools | Use current workspace descriptions |
| Duplicate account prerender and redirect aliases in sitemap | Redundant generated pages/search destinations | Deduplicate routes and omit aliases from sitemap |

## Pass 2 — Game plan

1. Keep the public launch boundary intact: current external booking providers; construction pages for accounts and commerce.
2. Preserve the customer's intent from services and crew through booking. Distinguish website appointments from external provider appointments.
3. Make commerce one consistent request flow: catalog → product/cart → sign-in if needed → review → unpaid request → account record.
4. Make client, professional, and owner/manager navigation reflect the capabilities each role actually has. Keep authorization on the server.
5. Remove clearly unreachable duplicate content; share the cart and navigation. Defer broad CSS consolidation because it requires visual regression checks.
6. Run application, release, Worker, and static-page checks; record bundle sizes and customer-journey regressions.

## Verification limits

The initial October 5 browser review was blocked by an exhausted approval-service allowance. Browser access returned October 6; the completed browser checks and remaining device-specific limits are recorded below.

## Pass 3 — Implemented corrections

All corrections in the findings table were implemented on the development branch. In addition:

- Removed the unreachable `CustomerBooking` component and its obsolete tests; transferred its distinct stale-selection case to the current `RestoredBooking` tests. The explicit local design preview remains separate and disabled in production.
- Reused one cart drawer across catalog and product detail. It now uses a native modal dialog, restores the opening control on close, and does not reset focus when quantities change. Category buttons expose their selected state.
- Corrected nested main landmarks in both cart and checkout. Product image links have names even without product photos. Catalog photos have dimensions to reserve space.
- Preserved valid encoded product URLs while making malformed product paths show the normal not-found recovery.
- Kept public crew handles separate from server account IDs. A named booking preference stays visible; customers explicitly select an eligible chair in native booking instead of the website guessing an identity.
- Kept backend permissions, monetary calculations, business prices, production feature flags, and external booking destinations unchanged.

## Pass 4 — Customer journey regression review

| Journey | Evidence and outcome |
| --- | --- |
| Homepage → crew → professional | Each crew card targets the matching profile anchor; every generated fragment target resolves |
| Services/crew → external booking | Tests preserve Steph, KasH, Mr. Glen, and Kris-P context, show the correct provider, and offer a return to all booking options |
| Native booking → sign-in → request | Existing tests preserve the selected service, chair, price, and signed quote through sign-in and uncertain retries |
| Change barber or date | Tests clear previous times and ignore late responses; an unknown public handle does not silently choose a server account |
| Catalog → cart → checkout | Shared cart controls maintain quantities; category selection is announced; cart and checkout use a single main landmark |
| Guest checkout → sign-in | Integration test preserves the checkout destination and cart contents after the session becomes available |
| Request submission → account record | Existing test confirms unpaid submission, stable retry key, saved-order handoff, and cart clearing only after success |
| Customer history → appointment actions | Copy now identifies website change options and explains that external provider appointments remain with that provider |
| Professional dashboard | Role-scoped test retains assigned request and availability links without owner sales/register controls |
| Owner/manager dashboard → store management → dashboard | Role-scoped shortcuts expose sales and register tools; store management includes a dashboard return; customers see access denial |
| Invalid product link | Component test shows a recoverable product-not-found page rather than a URL decoding exception |

The automated journey review passed. The October 6 follow-up below adds browser evidence for customer and staff journeys.

## Verification results

- Full `npm run check`: **295 application tests across 26 files**, **12 environment tests**, type checks, lint, production build, bundle budget, production gates, and both Cloudflare runtime verification suites passed.
- Public-release verification passed: construction pages, both external providers, local images, closed account/commerce/booking gates, and exclusion of unfinished platform screens from the public bundle.
- Static HTML review: **36 generated routes, zero findings** for internal destination/fragment validity, primary heading count, main landmark count, duplicate IDs, control names, image alt attributes/dimensions, and local image availability. Redirect aliases remain supported and are excluded from the sitemap.
- Production bundles, gzip level 9: **74.54 KiB JavaScript / 120 KiB budget**, **36.09 KiB CSS / 40 KiB budget**. The recorded starting values were 75.13 and 36.07 KiB respectively.
- The full development platform build also passed. Its account and commerce code remains split from the public page entry; the public launch build omits those screens entirely.

These are source, component, runtime, and static-output checks. They do not measure real-device rendering speed, contrast, layout at zoom, screen-reader usability, or browser-native focus containment.

## October 6 browser follow-up

The real Cloudflare API ran against isolated local D1 data. Public construction pages and the enabled development platform were reviewed separately. Production feature gates remain closed.

### Additional findings and fixes

| Finding | Correction and verification |
| --- | --- |
| A legacy stylesheet still hid the restored Services heading | Removed the hiding rule; verified the visible H1 at mobile width |
| Selected checkout delivery text had poor contrast and lacked an explicit group focus indicator | Changed secondary text to #444 on #ededed and added a visible keyboard outline; verified shipping/pickup keyboard selection |
| Guest sign-in could leave checkout scrolled beyond its heading | Focus the checkout heading after the transition; integration assertion and browser review passed |
| Booking progress minimum widths overflowed at 320 px | Allow four equal shrinking columns and shorten the third label to “Date & time”; progress client/scroll widths both 289 px |
| Repeated schedule removal buttons did not identify their target independently | Accessible names now include day, time range, and location, or time-off dates; verified in the browser |
| An unconfirmed request displayed “Confirmed time” and reserved-time rescheduling copy | Show rescheduling only for confirmed appointments; regression cases cover requested, waitlisted, declined, cancelled, completed, and confirmed records |
| Old local review MFA secrets were unavailable | Added opt-in named review databases with four roles and saved local test MFA setup/recovery records, enrolled through the normal API; preserved the old database and verified persistence across restart |

### Browser evidence

- Home, Services, Crew, Reviews, and enabled Shop reviewed at 1280, 390, and 320 px, with no page-wide horizontal overflow. See Responsive-Review-2026-10-06.json.
- Public Account, Booking, and Shop construction pages reviewed visually at 320 px. Provider choices, call/visit actions, and public navigation remain available.
- Mobile navigation opens as a native modal, starts on Close, keeps page controls out of keyboard navigation, and returns to Menu on Escape. Tab can pass through browser chrome before returning to the modal. Cart opening, Escape, and focus restoration were also verified.
- Product/cart → guest sign-in → checkout preserved two items and produced a $30 unpaid local pickup request. The saved customer order showed the correct items, amount, and submitted status; another role could not open it as a personal order.
- Customer dashboard → barber booking → service → professional → October 7 at 9 AM → request submission → saved pending record succeeded. Assigned barber MFA → request queue → explicit confirmation succeeded. Customer dashboard then showed one confirmed upcoming visit and zero pending decisions. Confirmed details expose rescheduling, calendar download, and cancellation-request controls; pending details no longer contain confirmed-time claims.
- Owner MFA → shop overview → front desk → sales preparation → cash register → inventory succeeded. Inventory exposes a dashboard return. Empty states identify the required next steps.
- Barber MFA → chair overview → availability succeeded. Manager MFA → shop overview succeeded. Both mobile dashboards fit at 320 px; barber navigation omits shop management and manager navigation omits owner-only setup reviews. Customer navigation has no staff sections, and a staff-only URL provides a recoverable access-denied state.

Screenshots: Services-Mobile-2026-10-06.png, Public-Account-Mobile-2026-10-06.png, and Customer-Dashboard-Confirmed-2026-10-06.png. The records shown are fictional local fixtures.

### Final checks and release boundary

Final `npm run check` passed after all fixes: **301 application tests across 26 files**, **12 environment tests**, type checks, lint, public build, bundle budgets, production gates, Cloudflare API checks, and notification Worker checks. Public gzip budgets remained 74.54 KiB JavaScript / 120 KiB and 36.10 KiB CSS / 40 KiB. The generated-page audit covers 36 routes with zero findings. The development build continues to split account and commerce code from the public entry.

The browser tests cover selected desktop/mobile layouts, keyboard flows, labels, and the corrected contrast states. They are not an actual screen-reader certification, a 200% browser-zoom test, or a real-device performance measurement. Those device-specific checks remain before hosted platform activation. Email sender verification, hosted owner provisioning, and real notification delivery also remain separate launch requirements; no production accounts were enabled by this audit.

Broad consolidation of historical CSS layers is deferred: the targeted conflicting rule was removed, and the stylesheet remains within its budget. All four audit passes now have source, automated, and browser evidence, with the above limits explicit. Changes remain on the development branch; this follow-up does not deploy or activate unfinished public features.
