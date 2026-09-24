# Launch implementation backlog

**September 24 update:** [feature completion review](feature-completion-review.md)
records the current gaps and priority order. Shared website/walk-in check-in,
service/completion, cancellations/no-shows, professional history and customer
withdrawal of unaccepted unpaid orders are implemented with migrations through
**0015**. Manager calendar/history pagination, money collection and financial
receipts remain unfinished. The user now authorizes feature pushes to `main`;
older dev-only workflow references below describe prior milestones.

Baseline: `3071cc8`, September 13, 2026. See [audit and competitor findings](launch-readiness-audit.md). Prior completed cancellation work is documented separately in [appointment cancellation](appointment-cancellation.md).

Implementation progress after audit commit `90e7cad`: [mobile navigation and dashboard milestone](mobile-dashboard-milestone.md). Tasks not listed below remain planned.

| Task | Current status | Remaining acceptance |
| --- | --- | --- |
| A1 | Preview attempt blocked by browser environment (`ERR_BLOCKED_BY_CLIENT`) | Reproduce original clipping with viewport/scroll evidence; do not claim visual acceptance. |
| A2 | Implemented: one modal layout, one scroll region, obsolete drawer CSS retired, desktop transition at 1041px | Real-device short viewport, zoom and 981–1040px layout checks. |
| A3 | Implemented: native modal, initial/return focus, cancellation, outside close and scroll restoration; lifecycle regression tests pass | Real-browser Tab/Shift+Tab, screen reader and background inertness checks. jsdom cannot prove native focus behavior. |
| B1 | Implemented: prominent next visit, requests/pickups, updated records, secondary totals/profile, refresh recovery | Visual mobile/desktop acceptance and long-content review. |
| B2 | Verified in SQLite API tests: customer-owned cancellation/proposal attention, uncapped counts, pickup-ready orders and update-time ordering | Full customer workflow acceptance remains B3. Rescheduling actions remain milestone C. |

Follow-up implementation: [rescheduling, guest walk-ins and printable documents](rescheduling-walk-ins-and-documents.md).

| Task | Follow-up status | Remaining scope |
| --- | --- | --- |
| C1–C3 | Implemented: separate change history, customer requests/withdrawal, professional approval/alternatives, customer acceptance/decline | Real-browser journey acceptance. |
| C4–C5 | Implemented: atomic schedule move, cancellation interlock, calendar versioning, private notices, expiry/cleanup/repeated requests; concurrent D1 duplicate/opposing-decision checks pass | Future payment/deposit integration and broader device/customer acceptance. |
| D3 | Printable current booking/request documents and order acknowledgements implemented | Detailed confirmation emails and immutable issued financial documents remain. |
| E1–E3 | Owner/manager guest walk-in scheduling and lifecycle implemented; professionals see assigned guest visits | Dedicated front-desk permissions, unscheduled queue, account linking, full day/week calendar and pagination. |
| D1 | Shop-owned collection proposed from owner-direction discussion; Square/Stripe comparison and onboarding plan documented | Kash must confirm seller, compensation/payroll, tax/shipping and processor/device choices before activation. |
| D2/D4, E4/E5, F1–F5 | Financial integration planned against the proposed shop seller model | Cash/card collection, paid receipts, refunds, terminal and register reconciliation are not implemented. |
| H1–H5 | Service earnings, retail attribution, tip accounting and pay-run requirements documented | No live commission rate, ledger writer, staff statement or disbursement workflow is implemented. |

Next: implement the shared sale and receipt foundation using the proposed shop-owned collection model, then cash/register operations and processor sandbox checkout. The user reports Booksy is currently used and believes Kash wants centralized business-bank collection plus service earnings and retail commissions for barbers. Treat those policies as provisional, with Square recommended for evaluation. See [shop payments, barber earnings and Booksy transition](shop-payments-and-barber-earnings.md) for P1–P7 implementation order, processor research, onboarding requirements and acceptance criteria. Continue A/B visual and complete customer journey acceptance before launch.

Priority means implementation order and launch impact, not an estimated delivery date. Size is omitted until the payment/hardware and business decisions are resolved. Implement each milestone as a coherent working journey with source, migration, tests and a review guide on `dev-branch`.

## A — Navigation and accessibility

| ID | Work | Dependency | Completion evidence |
| --- | --- | --- | --- |
| A1 | Reproduce mobile header/drawer top clipping at top and scrolled positions | None | Screenshots and viewport/zoom/scroll values identify the actual cause; test both header and opened menu. |
| A2 | Consolidate drawer CSS and align 981/1040 breakpoints | A1 | One drawer layout and one scroll region; short landscape and 981–1040px resize remain usable; close/header never inaccessible. |
| A3 | Modal focus containment, background inertness, Escape and focus/scroll return | A2 | Keyboard and assistive-technology checks pass; reopening and desktop transition restore page state. |
| A4 | Apply modal behavior to cart/confirmation surfaces; audit forms and date controls | A3 | Long names, zoom, keyboard, field errors, reduced motion and touch targets tested across customer journeys. |

Target files: `Layout.tsx`, navigation CSS and conflicting polish selectors, shared modal utility/component, customer/commerce forms. Retire old declarations rather than introducing a new override pile. Protect the two booking choices and working calendar flow.

## B — Customer dashboard and complete customer actions

| ID | Work | Dependency | Completion evidence |
| --- | --- | --- | --- |
| B1 | Attention/next-visit hierarchy and responsive dashboard composition | A2 | Real status-driven actions; phone layout stacks in task order; empty/loading/error/stale states designed. |
| B2 | Dashboard API includes change/cancellation attention and latest activity | B1 contract | An older appointment changed today appears in activity; counts match detail/queue state and ownership. |
| B3 | Customer feature acceptance sweep | A4 | Sign-up/verification/recovery, profile/address, email/password change, logout/revocation, booking, history pagination/detail/calendar and cancellation exercised end to end. |
| B4 | Correct stale copy and action availability across routes | B2/B3 | No claim of unavailable order opening, automated waitlist or provider synchronization; every enabled action reaches a working flow. |
| B5 | Durable recovery across reload/session expiry | B3 | Booking/cart context preserved appropriately; unknown saved operations are looked up before new submission; no private account data stored as browser authority. |

Target files: `CustomerOverview.tsx`, `customer-dashboard.ts`, `shared/dashboard.ts`, `CustomerHistory.tsx`, `CustomerRecordDetails.tsx`, account navigation and shared visual rules.

## C — Rescheduling and appointment lifecycle

| ID | Work | Dependency | Completion evidence |
| --- | --- | --- | --- |
| C1 | Versioned change-request records and policies | Approved request semantics | Migration preserves existing reservations/history; change state separate from visit/payment state. |
| C2 | Customer same-service/professional date/time change | C1 | Original remains reserved; new choice uses existing selector; clear pending/withdrawn outcome. |
| C3 | Staff approve/decline and propose alternative; customer accept/decline | C2 | Atomic move; rejected/expired proposals preserve original; expired or stale actions explain recovery. |
| C4 | Interactions with cancellation, payment/deposit and calendar | C3 | Cancellation-vs-move race has one valid result; payment references persist; confirmation/ICS updates and one event notice. |
| C5 | Overdue requests and repeated changes | C4 | Explicit handling after visit start, decline and prior approved move; queue never becomes permanently unmanageable. |

Required tests: self-overlap, two customers competing for replacement time, two staff decisions, schedule/time-off change, DST/repeated hour, revoked account/MFA, duplicate retry, reload, expiry and transaction rollback. No broad staff availability bypass.

## D — Sale/payment/document foundation

| ID | Work | Dependency | Completion evidence |
| --- | --- | --- | --- |
| D1 | Merchant, processor/hardware, tax/shipping and policy decision record | Owner input before money activation | Seller and fund recipient identified for every service/product; scope and device path confirmed. |
| D2 | Shared sales/line snapshots, tenders, attempts, allocations and refunds | D1 model constraints | Service and merchandise reference one sale model; fulfillment never implies payment; totals server-calculated. |
| D3 | Booking acknowledgement and confirmed-visit documents | C1 event model | Print/email/account versions distinguish requested from confirmed and show paid/balance truthfully. |
| D4 | Issued receipt/refund snapshots and secure retrieval | D2 | Price/catalog edits cannot change old receipt; no access by guessed reference; guest receipt delivery supported. |
| D5 | Notification/document outbox and delivery exceptions | D3/D4 | Retry does not issue duplicates; resend is controlled; owner sees failures; messages omit unnecessary private details. |

Do not repurpose `commerce_receipts` as customer financial receipts. Create explicitly named domain records. Confirm receipt numbering, print/thermal needs and retention rules before finalizing issued-document schemas.

## E — Front desk, walk-ins and cash

| ID | Work | Dependency | Completion evidence |
| --- | --- | --- | --- |
| E1 | Scoped receptionist/cashier permissions and provisioning | D1 roles | Staff with front-desk permission can act for customers; ordinary customer and unrelated staff cannot. |
| E2 | Guest/existing customer booking and queue | C conflict model, E1 | No forced email/account; walk-in cannot collide with online booking; queue is not a fabricated reservation. |
| E3 | Day/week calendar, check-in, service, completion, no-show/left | E2 | Staff can run a day; action history and capacity remain consistent across views. |
| E4 | Service plus merchandise counter sale and cash tender | D2/D4, E3 | Cash received/change recorded exactly once, stock updated, receipt issued; merchandise-only sale works. |
| E5 | Cash register sessions and reconciliation | E4 | Opening float, paid-in/out, refunds, counted/expected cash and variance trace to a cashier; corrections are audited. |
| E6 | Outage procedure and later-entry reconciliation | E4/E5 | Staff can recognize unsaved transactions and follow approved continuity steps without duplicate records. |

Acceptance journey: a guest walks in, waits, receives a haircut, adds pomade, pays cash, receives a printed receipt and appears in the day's reconciliation without creating an online account.

## F — Electronic payments, receipts and order operations

| ID | Work | Dependency | Completion evidence |
| --- | --- | --- | --- |
| F1 | Online processor checkout and durable payment attempt | D1/D2 | Server prices, abandoned checkout, authentication, success/failure and reload recovery validated in sandbox. |
| F2 | Signed webhook inbox, deduplication and reconciliation | F1 | Duplicate/out-of-order/late events cannot double-charge, double-fulfill or mark wrong sale paid. |
| F3 | In-person terminal checkout | D1, E4, F2 | Paired device, cancellation/timeout, tips if enabled, authoritative completion and card receipt tested with actual hardware before launch. |
| F4 | Partial/full refunds and tender-aware corrections | F2/F3 | Refund status and receipt reflect actual outcome; amount cannot exceed refundable balance; stock return is separate. |
| F5 | Deposit/split tender support if selected | D1, F4 | Allocations sum correctly; balance follows reschedule; mixed cash/card refund reconciles. Otherwise explicitly outside first release. |
| F6 | Order messages, pickup/shipping and management pagination | D5, F2 | Confirmation/ready/shipped/refunded notices and status agree; more than 100 orders remain manageable. |
| F7 | Catalog/media/inventory exceptions | E4/F6 | Online/counter compete safely for final unit; reservations expire; returns and damaged stock recorded; controlled product media. |

Acceptance journey: online product checkout paid electronically → stock reservation → pickup/shipping → customer receipt; second journey: walk-in haircut charged on terminal → receipt and reconciliation. Include payment success after timeout and payment success after a stock/slot hold expires.

## G — Release and operations

| ID | Work | Dependency | Completion evidence |
| --- | --- | --- | --- |
| G1 | Provider calendar integration or explicit cutover | Before selling shared native slots | Booksy/GlossGenius boundary proven; no assumed sync or duplicate availability. |
| G2 | Owner access and exception workspace | E/F | Pending decisions, payment mismatches, failed notices, refunds and register variance have responsible operators. |
| G3 | Privacy/security/retention and business content review | Data/provider scope fixed | Documented access/deletion handling, redacted logs, final policies, verified hours/prices and media dependencies. |
| G4 | Isolated staging and provider delivery | D1 | Correct origin/cookies/HTTPS, migrations, secrets, real email/Turnstile and payment sandbox configuration. |
| G5 | Backup, restore, migration and rollback rehearsal | G4 | Restore into fresh database; ownership/inventory/payment references reconcile; pending workflows survive rollback strategy. |
| G6 | Device, accessibility, performance and full-day acceptance | A–F | Mobile/desktop/keyboard/screen-reader journeys and actual reader/printing pass; alerts and outage procedures exercised. |
| G7 | Release review for main/production | G1–G6 | Explicit recorded acceptance of defined launch scope; no hidden placeholders or fake successful actions. |

## H — Barber earnings, retail commissions and pay runs

P1–P7 in the [payment decision proposal](shop-payments-and-barber-earnings.md) define the dependency order across D/E/F/H. These are planned tasks; baseline earnings/payout tables alone do not implement them.

| ID | Work | Dependency | Completion evidence |
| --- | --- | --- | --- |
| H1 | Effective service/retail compensation policies and per-line professional attribution | D1, D2 | Owner-approved rates, recognition rules and exclusions; immutable policy snapshots; prospective changes and audited corrections; unset rates are explicit. |
| H2 | Append-only earnings events and separate tip liabilities | H1, E4/F2 | Paid/delivered source references and approved recognition rules; exact discount/rounding calculations; refund review never silently deducts wages/tips; direct cash tips cannot be paid twice. |
| H3 | Barber statements and owner liability/reconciliation view | H2 | Own-account isolation, source traceability, pagination, pending/approved/paid distinction; daily visibility separate from weekly pay schedule. |
| H4 | Pay-run review and employee payroll export | H3, confirmed payroll provider/pay codes | User confirmed employee status. Pay periods, applicable base/timekeeping/overtime, commissions and tips reconcile; duplicate allocation/export protection; required compensation is not delayed by discretionary approval. |
| H5 | Payroll result integration and confirmation | H4, provider onboarding | Separate processor settlements, gross compensation, withholding and employee net pay; idempotent attempts, unknown/failed outcomes, completion evidence and audit; no unbacked withdraw button. |

Acceptance journey: a guest receives a haircut and buys a barber-referred product, pays the shop, receives a receipt, and generates the correct service/retail/tip statement entries. A reviewed weekly pay run records the actual staff payment once. A subsequent partial merchandise refund retains the original attribution/rate and routes any compensation adjustment through the approved policy.

## September 14 implementation checkpoint

The user confirmed that barbers are employees. Employee payroll is the compensation path; contractor withdrawals are outside the current plan. Rates, pay schedule, payroll provider and tax/shipping settings remain to be supplied.

[Sale preparation and immutable estimates](sales-estimates-milestone.md) implements the first P1/D2 document-and-amount increment: protected owner/manager preparation from existing native visits/orders, server prices, exact discount allocation, explicit unresolved charges, signed review, immutable issued copies, private customer history and printable estimates. Front desk and order management link into it. All 207 tests and the full project check pass, including concurrent D1 saves. Browser layout/printing acceptance remains blocked by the preview environment.

This does not complete P1/D2: live merchant configuration, versioned commission policies, finalized sales, tenders, payments/refunds and financial receipts remain. Next implement confirmed business settings and the finalized sale/payment ledger, followed by P2 cash/register and P3 processor sandbox checkout. Preserve the current booking and shop flows. Estimates do not reserve inventory, record payment, create wages or send email.

## Working rules for future changes

- Start with A1–A3; inspect the reported clipping before claiming a fix.
- Track each task as planned/in progress/verified, with commit and evidence when completed.
- Keep the current customer functionality reachable. Refine existing screens and data flows rather than deleting features to simplify styling.
- Never treat a successful build as proof of real email, card processing, cash handling or visual accessibility.
- State remaining limitations in milestone documentation. New features must include the failed, pending and uncertain outcome paths.
- Do not enable real money movement, migrate hosted data or merge main as a side effect of UI review work.
