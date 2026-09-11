# Professional availability management

The shared account dashboard now has an **Availability** section for approved professionals. It uses the existing `STAFF_OPERATIONS_ENABLED` gate and staff MFA grant. No new migration is needed; apply existing migrations through 0008. Public defaults remain disabled. No deployment or browser acceptance was performed.

## Workflow

- Add weekly working windows at an active, approved location. Windows must start and end within one day. Adjacent windows are allowed; overlapping weekly windows are rejected, including across locations. To revise hours, add non-overlapping coverage where needed and remove the old window when it no longer supports an appointment or hold. There is no automatic appointment movement.
- Add one-date time off using the selected location's time zone. It blocks the professional at **all** locations. Use separate entries for multiple dates. Only future starts within the next 366 days are accepted. Clock-change dates require shop review rather than guessing ambiguous or nonexistent local times.
- Remove a weekly window only if it does not intersect a future active appointment, proposed visit, hold, or cleanup allowance at that location. This is deliberately conservative even if an imported exception could supply alternative coverage. Overnight or malformed appointment records require review.
- Remove upcoming or in-progress time off created by your own account. Time off recorded by someone else is visible but requires shop assistance to change. Expired time off and other exception types are outside this editor.

Weekly clocks use the location's time zone. The time-off list explicitly displays the device's time zone; stored timestamps are UTC. Booking retains the existing conservative DST behavior. Weekly schedules spanning different time zones, unavailable assigned locations, or added availability at another location require shop review. This editor does not calculate travel time, edit service prices/durations, change cleanup policies, create dated extra availability, override another professional, or manage business-wide closures.

## Safety boundary

`GET /api/v1/me/professional/schedule` returns own approved locations, active weekly windows, future/current time off, and the current booking revision. It excludes customer identity, notes, and appointment details. The server reads a consistent snapshot and rechecks the authenticated professional after reading it.

`POST /api/v1/me/professional/schedule` accepts only one of `add_hours`, `remove_hours`, `add_time_off`, or `remove_time_off`, with the expected revision and the fields required for that action. IDs are scoped to the authenticated professional. Staff cannot select an arbitrary professional ID. Owner or manager roles do not provide another person's schedule access through this endpoint.

Time off is checked against active requests, confirmed visits, proposed reschedules, checked-in/in-service visits, and unexpired holds across locations. Checks include the larger of recorded reservation end and the current cleanup allowance. Untimed or malformed unresolved records fail closed. Completed/cancelled visits do not block future editing. Existing appointments are never cancelled, repriced, or moved by a schedule change.

The final D1 transaction conditionally inserts a unique audit receipt only while the booking revision, active verified role, approved profile, session, and MFA grant still match. The mutation requires that receipt. Database triggers advance the booking revision when availability changes, so a competing booking or schedule edit cannot both commit against the same old snapshot. Audit metadata retains the requested change and previous removed window/entry without customer information or credentials. Mutation failure rolls back the audit. Twenty changes per account per fifteen minutes and existing origin/JSON/body guards apply.

After an uncertain response, reload before retrying. The client does not blindly retry a schedule write or store drafts locally. A stale revision is rejected even when another professional's change caused it; the global revision favors safety over fewer refreshes.

## Validation and staging

The suite includes 143 tests: 74 API, 58 retained adapter, eight authenticator and three wall-time tests. The full check passed at 142 tests, followed by all eight focused scheduling tests after the final profile-ownership regression guard. New coverage checks add/remove behavior, revision advancement, audit history, appointment/cleanup/proposed-time/hold conflicts, foreign IDs, MFA, malformed reservations, clock-change dates, final authorization and transaction rollback. Real local Workers/D1 checks race duplicate weekly changes and time off against a customer booking. Only one conflicting operation may save. Existing account, MFA, onboarding, booking and notification runtime coverage remains.

In isolated staging, configure accounts/MFA, complete professional approval, and enable staff operations only for approved reviewers. Exercise weekly hours, time-off conflicts, role/MFA expiry, lost responses and a concurrent booking. Test keyboard/mobile controls, device-versus-location time zones and schedule display in hosted browser acceptance before release. No real account information is needed for these checks.

Disable staff operations to stop schedule reads and edits. Saved hours and time off remain effective in the booking engine; disable native booking separately when stopping new requests. Preserve audit records. There is no automatic schedule rollback.

Next: customer cancellation/rescheduling policy and workflows, staff views of confirmed upcoming visits, and a concrete restricted-staging launch rehearsal. Shop-wide overrides, verified owner bootstrap/role grants, security alerts, delivery webhooks and public cutover remain separately scoped work.
