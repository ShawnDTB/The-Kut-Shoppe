# Confirmed appointment cancellation requests

This milestone adds a working customer → assigned professional → customer cancellation journey to the restored booking/account system. It does not change the Barber/Loctician gateway or replace the booking table.

## Behavior

- A verified customer opens a future, confirmed website appointment in their account and selects **Request cancellation**, then **Send cancellation request**.
- The appointment remains confirmed and occupies its time. A pending cancellation is not a cancelled appointment.
- The assigned, approved professional sees it in the existing request queue. Current MFA and a fresh password are required to approve or decline.
- Approval changes the appointment to cancelled and releases the time. Declining the cancellation leaves the appointment confirmed and reserved.
- Each saved action creates an appointment event, audit event and private notification outbox entries atomically. Account status is authoritative; hosted email delivery still requires the notification worker/provider setup.
- Customers see pending, approved or declined outcomes in appointment details. Approved cancellations stop calendar downloads; previously downloaded calendar files do not update automatically.

There is no automatic cancellation policy, fee, payment or refund. The professional decides before the visit starts. Past/in-progress visits and bookings from external providers must be handled with the shop/provider. If a cancellation was declined, further discussion goes through the shop; this milestone supports one cancellation request per appointment to avoid reopening a resolved decision through retries. Rescheduling and alternative-time proposals remain the next implementation milestone.

## Data and authorization

Apply **0010_appointment_cancellation.sql** after 0009 before serving this code. The local review runner applies it automatically. It adds cancellation request ID, request timestamp and constrained pending/approved/declined state to appointments. Existing appointments start with no cancellation request. Existing appointment revision triggers also cover these updates.

`POST /api/v1/me/appointments/:id/cancellation` accepts only `updatedAt`. It requires an owned future confirmed website record, active verified customer/session and an active approved assigned professional. `STAFF_OPERATIONS_ENABLED=true` is required for new requests so requests are not intentionally opened while the review workspace is disabled. Existing receipt reads remain available. `CUSTOMER_BOOKING_ENABLED` need not be on to manage an existing visit.

The professional decision endpoint gains `cancel` and `keep`. It rechecks record ownership, pending state, saved version, future start, current customer eligibility, professional role/setup, session/MFA and password hash inside the atomic update. A stale or competing action cannot release the appointment. Repeating the same saved decision returns its receipt; reusing its key for an opposite action is rejected.

Customer request retries return the already-saved state without producing another event. Audit or outbox insertion failures roll back the entire mutation. The appointment status, events and notifications cannot partially commit. Staff queue pagination is retained; order is appointment creation time, not cancellation submission time, and cancellation entries have an explicit label.

## Review

1. Pull `dev-branch`, install dependencies and run `npm run review`.
2. Book a future Barber appointment as the review customer. Approve it in the assigned professional's request queue.
3. Open the customer's appointment details, request cancellation and confirm submission. Check that the status remains confirmed and the slot is still occupied.
4. Refresh the professional queue and approve cancellation. Refresh the customer details and availability: the appointment is cancelled and the slot can be booked again.
5. Repeat with another appointment, declining cancellation. Confirm the time remains reserved and the customer sees the declined outcome.

API tests exercise ownership, state/source/time restrictions, MFA/password checks, stale versions, safe retries, slot retention/release, notifications, write-time authorization removal and transaction rollback. React DOM tests exercise customer confirmation/retry and professional approval/retry. The real Workers/D1 check races duplicate customer requests and opposing professional decisions. Browser/mobile acceptance and actual hosted email delivery are separate checks.

No main merge or deployment is included. Before any rollback to an older application, resolve pending cancellation requests or keep the review endpoint available: earlier application versions cannot display this new state. Do not drop the columns or discard request history to roll back the UI.
