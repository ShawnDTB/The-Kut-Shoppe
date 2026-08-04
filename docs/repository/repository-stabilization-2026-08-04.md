# Repository stabilization — 2026-08-04

## Scope

This pass consolidated the reviewed Platform V2 implementation into the canonical `main` line without rewriting shared history or force-pushing. It audited branch ancestry, pull requests, workflows, source reachability, dependency installation, builds, prerendering, bundle budgets, D1 migration syntax, deployment files, documentation, production routes, built assets, browser hydration, and representative mobile and desktop rendering.

## Recovery points

Two annotated tags preserve the pre-cleanup milestones:

- `pre-platform-v2-main-2026-08-04` points to the previous stable `main` at `c28de06eec94d7e5690b28a6234bae99245dcbbe`.
- `pre-repository-stabilization-2026-08-04` points to Platform V2 immediately before cleanup at `e6efe48b37e1c6ead118de917537fd9dfdf966d3`.

Temporary backup branches were created before destructive cleanup, converted to the annotated tags above, verified against their target commits, and then removed. No history was rewritten and no force-push was used.

No preexisting tag references appeared in the full-history checkout used for the audit. No existing GitHub release object was surfaced by the repository data available to this pass.

## Branch findings

Authentication, booking-flow, storefront, staff-onboarding, accessibility, handoff, polish, stabilization, owner-audit, booking-platform, and platform-integration branches were incorporated into Platform V2. Their commits and pull requests remain in the merged history even though their branch references were removed.

Superseded branches with unique records were preserved before branch cleanup:

- `feature/commerce-account`: storefront prototype notes archived under `docs/archive/prototypes/`.
- `feature/platform-core`: schema notes archived under `docs/archive/prototypes/`; the old migration was superseded by the unified migration.
- `archive/route-identity-pass`: design reasoning archived under `docs/archive/design/`; its obsolete code and CSS were not merged.

`agent/kut-shoppe-foundation` was merged through PR #1 into `staging`, then promoted through PR #2 into `main`. Both references were removed after consolidation.

The final active branch set contains only `main`. There are no open pull requests.

## Source cleanup

Static import-graph and text-reference checks identified superseded, unreachable component generations and one unreferenced stylesheet. They were removed only after confirming active routes use their later successors.

Retained adapters remain part of the active graph and were not removed blindly. Examples include `BookingV7` over `BookingV6`, `LayoutV6` over `LayoutV5`, and `RoleDashboardV6` over the current dashboard implementation.

Customer account creation was aligned with the approved account model: name, email, and password are collected during signup; phone is collected only when a booking or order requires it. Local SMS verification was removed from account creation rather than represented as a production capability.

## CI and dependencies

- Added and committed `package-lock.json`.
- Replaced `npm install` with deterministic `npm ci`.
- Consolidated frontend and D1 migration checks into `.github/workflows/quality.yml`.
- Removed the obsolete feature workflow and all one-time audit, cleanup, and tag workflows.
- Continued to use Node 22 through `.nvmrc`.
- The final clean install added 153 packages, audited 154 packages, and reported no vulnerabilities.

The current GitHub Actions runner warns that `actions/checkout@v4` and `actions/setup-node@v4` target the deprecated Node 20 action runtime and are being forced onto Node 24. The repository build itself runs on Node 22 and passes. The action majors should be upgraded after their newer supported versions are reviewed.

## Deployment configuration

The repository retains its Cloudflare Pages-compatible static build, `_headers`, `_redirects`, robots file, manifest, SSR and prerender scripts, and `dist` output contract. No Workers or Pages binding configuration is committed yet; protected APIs and D1 bindings remain production work.

Repository settings observed during the audit:

- public repository;
- default branch `main`;
- merge commits, squash merges, and rebase merges enabled;
- auto-merge disabled.

## Validation baseline

The validated tree passed TypeScript, ESLint, client build, SSR build, static prerendering, bundle budgets, and in-memory application of `migrations/0001_unified_platform.sql`.

Final measured bundle output:

- JavaScript: 119.20 KB gzip of a 120 KB budget.
- CSS: 39.99 KB gzip of a 40 KB budget.

A temporary production-preview audit also:

- requested the public, commerce, account, dashboard, staff, administration, policy, accessibility, and not-found routes;
- verified the generated JavaScript and CSS assets;
- hydrated the homepage, booking gateway, account access, Crew, and Shop pages in headless Chrome;
- captured and reviewed those pages at 390×844 and 1440×1200;
- confirmed Barber and Loctician booking choices, account tabs, phone-free signup, approved Crew naming, and the true empty-catalog storefront state.

The temporary audit workflow was removed after it passed. The repository still has no permanent unit or browser end-to-end test suite.

The final `main` tree after the self-removing cleanup and recovery-tag workflows was compared against the validated stabilization tree and contained no file differences.

GitHub Actions used a fresh checkout for these checks. The GitHub connector cannot inspect uncommitted or untracked files on an individual developer workstation; local working copies should be checked with `git status --short` before deleting corresponding local branches.

## Remaining risks

- CSS has essentially no remaining bundle-budget headroom; future visual work should consolidate the long layered stylesheet chain rather than add more override files.
- JavaScript has limited budget headroom.
- Authentication, appointments, waitlists, commerce, and role workflows remain browser-backed owner-review implementations until protected services replace them.
- There is no permanent unit, integration, or browser end-to-end test suite.
- Cloudflare API, D1 binding, secure-session, transactional locking, delivery, payment, and audit-log work remains.

## Operating model

- `main` is the canonical development and release line.
- New work uses short-lived `feature/*`, `fix/*`, or `chore/*` branches and pull requests into `main`.
- Completed branches are deleted after merge and successful validation.
- Historical milestones use annotated tags.
- Historical decisions live in Git history, pull requests, and `docs/archive/`, not permanent branch clutter.
