# Archived platform-core schema design

> Historical schema record preserved from `feature/platform-core` during the 2026-08-04 repository stabilization. The active migration is `migrations/0001_unified_platform.sql`, which supersedes the original standalone migration.

The first D1 design covered identity and sessions; customer and staff profiles; role controls; locations; services; weekly availability; schedule exceptions; appointment holds and events; products and variants; inventory movements; carts and orders; earnings and payouts; and audit history.

The design prohibited raw card or bank-account storage and treated worker relationship status as an administrator-controlled business record rather than something inferred from onboarding.

Required production services included protected migration tooling, typed validation, authentication, secure sessions, authorization, CSRF controls where applicable, abuse protection, rate limiting, conflict-safe appointment holds, transactional inventory, communication, audit logging, retention and privacy controls, and recovery procedures.

The original SQL file is not retained in the active tree because the unified migration contains the successor schema. The original state remains recoverable from Git history and the pre-stabilization backup branch.
