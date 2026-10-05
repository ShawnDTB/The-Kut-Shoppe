# Kut Shoppe website cohesion review

Date: October 5, 2026. Baseline: dev-branch / ead9806, matching the deployed main release.

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

Automatic approval review blocked the browser walkthrough because its usage allowance was exhausted. Source review, HTTP inventory, component tests, and static HTML checks can continue. Native browser focus containment, mobile layout, contrast, and a complete signed-in visual walkthrough remain unverified until browser access is restored. Automated checks do not substitute for those checks.

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

The automated journey review passed. A complete visual customer walkthrough is still pending because of the browser approval-service limit described above.

## Verification results

- Full `npm run check`: **295 application tests across 26 files**, **12 environment tests**, type checks, lint, production build, bundle budget, production gates, and both Cloudflare runtime verification suites passed.
- Public-release verification passed: construction pages, both external providers, local images, closed account/commerce/booking gates, and exclusion of unfinished platform screens from the public bundle.
- Static HTML review: **36 generated routes, zero findings** for internal destination/fragment validity, primary heading count, main landmark count, duplicate IDs, control names, image alt attributes/dimensions, and local image availability. Redirect aliases remain supported and are excluded from the sitemap.
- Production bundles, gzip level 9: **74.54 KiB JavaScript / 120 KiB budget**, **36.09 KiB CSS / 40 KiB budget**. The recorded starting values were 75.13 and 36.07 KiB respectively.
- The full development platform build also passed. Its account and commerce code remains split from the public page entry; the public launch build omits those screens entirely.

These are source, component, runtime, and static-output checks. They do not measure real-device rendering speed, contrast, layout at zoom, screen-reader usability, or browser-native focus containment.

## Remaining acceptance work

1. Desktop and mobile walkthrough with keyboard, zoom, and a screen reader; check the newly restored service heading, public account header, review band, and shared cart drawer visually.
2. Verify native dialog focus containment/Escape behavior in a real browser, including mobile scrolling and quantity updates.
3. Complete signed-in customer, barber, manager, and owner walkthroughs against the local review database. Account/email setup and activation remain separate from this cohesion cleanup.
4. Consolidate accumulated styling layers only after visual comparisons are available. The current stylesheet is within budget; removing layers blindly risks regressions.

Changes are prepared in development. This audit does not activate unfinished public features or deploy the revised interface to production.
