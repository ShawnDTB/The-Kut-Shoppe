# Repository stabilization — 2026-08-04

## Scope

This pass consolidated the reviewed Platform V2 implementation into the canonical `main` line without rewriting shared history or force-pushing. It audited branch ancestry, pull requests, workflows, source reachability, dependency installation, builds, prerendering, bundle budgets, D1 migration syntax, deployment files, and documentation.

## Recovery points

- `backup/main-pre-platform-v2-2026-08-04` preserves the previous `main` at `c28de06eec94d7e5690b28a6234bae99245dcbbe`.
- `backup/pre-stabilization-2026-08-04` preserves Platform V2 before cleanup at `e6efe48b37e1c6ead118de917537fd9dfdf966d3`.

No history was rewritten and no force-push was used.

## Branch findings

Authentication, booking-flow, storefront, staff-onboarding, accessibility, handoff, polish, stabilization, owner-audit, booking-platform, and platform-integration branches were incorporated into Platform V2. Their branch names can be removed after `main` passes post-merge validation; their commits and pull requests remain.

Superseded branches with unique records were preserved before branch cleanup:

- `feature/commerce-account`: storefront prototype notes archived under `docs/archive/prototypes/`.
- `feature/platform-core`: schema notes archived under `docs/archive/prototypes/`; the old migration was superseded by the unified migration.
- `archive/route-identity-pass`: design reasoning archived under `docs/archive/design/`; its obsolete code and CSS were not merged.

`agent/kut-shoppe-foundation` was merged through PR #1 into `staging`, then promoted through PR #2 into `main`. Those names are no longer required after consolidation.

## Source cleanup

Static import-graph and text-reference checks identified superseded, unreachable component generations and one unreferenced stylesheet. They were removed only after confirming active routes use their later successors.

Retained adapters remain part of the active graph and were not removed blindly. Examples include `BookingV7` over `BookingV6`, `LayoutV6` over `LayoutV5`, and `RoleDashboardV6` over the current dashboard implementation.

## CI and dependencies

- Added and committed `package-lock.json`.
- Replaced `npm install` with deterministic `npm ci`.
- Consolidated frontend and D1 migration checks into `.github/workflows/quality.yml`.
- Removed the obsolete feature workflow and temporary audit workflow.
- Continued to use Node 22 through `.nvmrc`.

## Deployment configuration

The repository retains its Cloudflare Pages-compatible static build, `_headers`, `_redirects`, robots file, manifest, SSR and prerender scripts, and `dist` output contract. No Workers or Pages binding configuration is committed yet; protected APIs and D1 bindings remain production work.

## Validation baseline

The clean audit checkout installed 151 packages with no reported vulnerabilities and passed TypeScript, ESLint, client build, SSR build, static prerendering, bundle budgets, and in-memory migration application. The repository currently has no unit or browser end-to-end test suite.

## Operating model

- `main` is the canonical development and release line.
- New work uses short-lived `feature/*`, `fix/*`, or `chore/*` branches and pull requests into `main`.
- Recovery branches are not development branches.
- Completed branches are deleted after merge and successful post-merge validation.
- Historical decisions live in Git history, pull requests, and `docs/archive/`, not permanent branch clutter.
