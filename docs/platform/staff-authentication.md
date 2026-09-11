# Staff authenticator verification

Latest follow-up: [professional onboarding and owner review](professional-onboarding.md) now reuses these MFA grants. Apply migration 0008 and its separate setup gate. Current coverage is 135 tests; the 126-test count below records the authenticator slice. Individual schedule management remains next.

Implemented on `dev-branch`, 2026-09-11. Apply additive migration `0007_staff_authenticator.sql` after 0006. This adds staff step-up verification to the existing account session. It does not change customer login or grant a role, approve a professional, enable operations, or deploy the site.

## Account experience

Elevated-role accounts can set up an authenticator from **Security**, including before professional operations open. Approved professionals must verify before seeing the request queue. Setup requires their current password, manual entry of a private setup key into an authenticator app, and confirmation with its first six-digit code. Pending setup lasts ten minutes, permits five code attempts, and is bound to the initiating session and credential. No third-party QR generator receives the seed.

Successful setup shows eight recovery codes once. Store them separately from the authenticator; each works only once alongside the current password. The UI keeps codes and setup keys only in component memory, clears password/code inputs after requests, and uses private no-store API responses. Leaving the page loses the display. If the confirmation response is lost, the authenticator already entered into the app can unlock access with its next code; use the replacement flow to obtain a new recovery set if necessary.

An unlock lasts fifteen minutes on that session only. Signing in on another device does not inherit it. The UI removes the queue when the window expires and rechecks server status when returning to the tab. A Lock staff access button ends that device's grant. Server enforcement applies independently of UI state. Information already read cannot be recalled from a device; use trusted devices and sign out when finished.

Replacement requires a current password and an unexpired staff grant. A recovery code can establish that grant if the old device is lost. Starting replacement preserves the active authenticator. Confirming the new code atomically replaces it, replaces all recovery codes, and invalidates all prior staff grants through a new authenticator version. Personal sessions on other devices remain signed in but cannot access staff resources until reverified. Use Sign out on every device for account-wide revocation.

Password changes, email changes, and password recovery retain MFA enrollment while revoking account sessions. Existing dual-inbox email-change checks remain required. There is no email-only MFA removal, browser role editor, or automatic support override. Losing both authenticator and recovery codes requires a separately approved, verified recovery process; that operational process is not implemented yet.

## Server controls

| Control | Implementation |
|---|---|
| Authenticator | RFC 6238 TOTP, HMAC-SHA-1, six digits, thirty-second step, current/adjacent steps; 160-bit random seed |
| Seed storage | AES-256-GCM with a fresh 96-bit nonce and user-bound authenticated context; separate server key |
| Replay | Monotonic counter atomically consumed before granting access; the enrollment code cannot immediately unlock another session |
| Recovery | Eight random 80-bit codes; account-bound HMAC hashes only; one-use receipts consumed in the grant transaction |
| Session grant | Authenticator version, current role, and absolute expiry on the existing server-owned session; active/verified account and valid session required |
| Role/status changes | Database trigger clears grants and pending enrollment when role, status, or verification state changes |
| Resource enforcement | Own-professional reads and final appointment writes recheck grant, version, role, session validity, and approved profile |
| Abuse | Existing origin, JSON, body-size and IP limits; ten MFA attempts per account per fifteen minutes; five pending confirmation attempts |
| Audit | Enrollment/replacement, successful authenticator unlock, and recovery-code use recorded without codes or seeds |

TOTP is not phishing-resistant. This implementation follows the algorithm and replay requirements in [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238.html); recovery and replacement need the operational protections described by [OWASP's MFA guidance](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html). Security-sensitive future owner administration should assess passkeys or security keys as part of its own launch review.

| API | Purpose |
|---|---|
| `GET /api/v1/me/mfa` | Configuration/enrollment state and this session's staff expiry; no seed or codes |
| `POST /api/v1/me/mfa/enroll/start` | Current-password check and session-bound setup, or verified replacement |
| `POST /api/v1/me/mfa/enroll/confirm` | Atomic activation, new recovery codes, and initiating-session grant |
| `POST /api/v1/me/mfa/unlock` | Current password plus fresh authenticator or unused recovery code |
| `POST /api/v1/me/mfa/lock` | Clear this session's staff grant |

## Staging and operations

1. Back up the isolated staging database and apply migrations through 0007 before running this code, even if staff operations remain disabled. The migration creates no users or authenticators. Confirm the existing baseline matches the customer deployment runbook.
2. Set `MFA_ENCRYPTION_KEY` as a **Pages server secret** containing 32 cryptographically random bytes encoded as 64 hexadecimal characters. Generate it in the operator's secure environment. Never use `VITE_*`, commit it, print it in CI logs, reuse test fixtures, or give it to the notification Worker. Keep `AUTH_SECRET` separate.
3. Preserve the encryption key with restricted, tested backups separate from D1 exports. Restore testing must include authenticator decryption. Replacing this key without a reviewed re-encryption/recovery procedure makes existing seeds unusable. During suspected compromise disable staff operations, revoke sessions, preserve evidence, and prepare controlled recovery; do not silently delete MFA to restore access. Automated key rotation is not implemented.
4. Use only synthetic staging accounts. Initial staff role assignment and identity verification remain controlled onboarding tasks; a password holder can enroll a first authenticator after receiving a staff role. The shop must verify the person and approve the professional before operational access. No bootstrap or real role grants were performed here.
5. Test manual authenticator setup, password-manager behavior, keyboard/mobile flows, recovery-code saving, missed responses, clock skew, tab return, expiry, replacement, revocation, and cross-professional isolation in hosted staging. Test enrollment/replacement alerts and define verified lost-factor recovery before public launch; out-of-band MFA security alerts are still outstanding.
6. Keep `STAFF_OPERATIONS_ENABLED=false` publicly until onboarding, security review, hosted runtime/browser acceptance, and operational ownership are complete. Accounts, native booking, and appointment-email dispatch retain their independent disabled defaults.

Do not roll back to the password-only staff implementation with operations enabled. Disable staff operations first; retain the additive schema, encrypted seeds, recovery receipts, and audit history. A database restore must not resurrect used recovery codes or old grants: use a reviewed restore/re-enrollment plan and revoke sessions before service resumes.

## Validation and next milestone

The full local check contains 126 tests: 58 retained adapter tests, 57 API tests, three wall-time tests, and eight authenticator cryptography tests. RFC vectors validate the algorithm; API tests cover encrypted storage, session/credential binding, attempts/expiry, missing configuration, replay, replacement, recovery, transaction rollback, and final read/write authorization. Offline-compiled Cloudflare Workers/D1 tests race enrollment, recovery-code consumption, and authenticator-code consumption across sessions, alongside existing appointment and notification races. External delivery is mocked. No browser testing, real service setup, or deployment was performed.

Next is **professional onboarding and schedule management**: an eligible person completes their professional profile; the shop reviews it; approved professionals manage only their own location/service availability and exceptions. Use the existing MFA gate, capability/resource checks, scheduling revision triggers, and audit transactions. Manager/owner review and role changes need explicit additional server permissions and a verified bootstrap process. Customer cancellations/rescheduling, delivery webhooks, and launch acceptance remain separate backlog items.
