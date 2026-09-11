# Assigned professional visits

The shared account dashboard now includes **Your visits** beside Professional requests and Availability. It is a read-only view of assigned website appointments, protected by the existing staff-operations gate, approved professional profile, and MFA. No migration after 0008, new configuration, deployment, or provider import is required.

## Experience and scope

The list shows assigned `confirmed`, `reschedule_proposed`, `checked_in`, and `in_service` appointments. Visits whose scheduled end is still in the future appear, including visits already underway. Checked-in/in-service records remain visible even after their scheduled end so unfinished work is not silently hidden. Past ordinary confirmations, completed/cancelled visits, unconfirmed requests, unassigned records, and non-website records are excluded from the list.

Visits are ordered by actual start instant and then ID, twenty-five per page. A signed cursor is bound to the user and professional profile. Different timestamp offsets are compared chronologically through SQLite `julianday`, rather than by string ordering. Refresh reloads the current list; this is not a live push feed or immutable report.

Each list row shows the customer name, service, location/time zone, scheduled start/end, and status. It omits customer notes and prices. Opening a visit loads the recorded price and customer-provided note separately. Proposed times are labeled as awaiting agreement and do not replace the scheduled time. Cancellation/change questions direct the professional to the shop; this slice does not add lifecycle transitions or confirm a reschedule.

Assigned accepted records with missing/invalid times are counted in a shop-review notice instead of silently disappearing. Their detail endpoint remains scoped and can return null times. Resolving those records requires a separate shop workflow. The view does not provide external Booksy/GlossGenius appointments or claim to represent the complete shop calendar.

## Authorization

| Endpoint | Behavior |
|---|---|
| `GET /api/v1/me/professional/visits?cursor=…` | Own assigned upcoming/active visits plus count requiring time review |
| `GET /api/v1/me/professional/visits/:id` | Own assigned accepted-visit detail; past accepted detail can remain accessible by ID |

Both endpoints derive the professional from the authenticated account. Final queries repeat the active verified role, approved profile, exact actor ID, session validity, and MFA checks. `assigned_staff_id` must match: a requested-professional preference cannot expose a visit after it is assigned elsewhere. Manager/owner/admin roles provide no shop-wide access here.

Details for foreign, missing, unassigned, completed/cancelled, or non-website visits return the same unavailable response after professional authorization. Neither endpoint returns account contact details, addresses, credential/session data, internal appointment notes, or payment references. List and count queries execute in a consistent D1 batch. Responses retain private no-store headers and private-route indexing rules. Writes to these routes are unsupported.

The UI shares the existing authenticator boundary, clears loaded details on refresh/errors, and discards the visit view when MFA expires or the account section unmounts. It stores no appointment content in browser storage. Information already viewed cannot be recalled from a device; staff should use trusted devices and sign out when finished.

## Validation and rollout

The full suite contains 147 tests: 78 API integration tests, 58 retained adapter tests, eight authenticator tests, and three wall-time tests. Added coverage checks list/detail data minimization, status/time filtering, malformed-time notices, equal-time pagination, signed-cursor isolation, assignment changes, owner isolation, disabled operations, MFA, and final query authorization. The real local Workers/D1 check creates and confirms a visit through the API, opens it for its assigned professional, and rejects access by another professional and a customer. Existing account/MFA, onboarding, schedule/booking race and notification tests remain.

Use isolated synthetic accounts in restricted staging, with migrations through 0008 and the existing account/MFA configuration. `STAFF_OPERATIONS_ENABLED=false` stays the public default. Verify mobile/keyboard navigation, password managers, time-zone display, refresh after reassignment/status changes, and expired access in hosted browser acceptance before release. No visual/browser acceptance, real email delivery, or deployment was performed in this slice.

Next: customer cancellation/rescheduling requests with explicit staff review before changing confirmed appointments. Define the shop's notice periods, approval responsibilities, fees/refund handling, and external-provider boundaries before enabling automatic cancellation or rescheduling. Upcoming-visit status transitions and shop-wide operational views remain separate capabilities.
