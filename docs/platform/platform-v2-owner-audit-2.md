# Platform V2 Owner Audit 2

## Scope

This audit reviewed the working booking, customer account, staff waitlist, staff settings, and management navigation flows on `feature/platform-v2`. The approved homepage and `main` branch were outside the change scope.

## Findings corrected

### Appointment-change safety

The previous online change route reused the existing appointment record before staff approval even though the customer message said the original appointment remained in place. That could replace or cancel an approved appointment during an unapproved change request.

Online appointment changes are now paused. Opening an appointment-change link leaves the existing appointment untouched and directs the customer back to Appointments or to call the shop. A production change flow should store a pending proposal separately from the approved appointment.

### Staff walk-in intake

Staff Calendar and Waitlist tools linked to `/book/walk-in`, but that route previously redirected to the public booking gateway.

The route now requires a staff, Manager, Owner, or Developer session. It collects the service and required customer contact details, creates a same-day waitlist request without claiming a chair or appointment time, and returns the user to the staff waitlist.

### Customer account navigation

Signed-in `/account` sessions previously bypassed the reviewed account wrapper, and the four account sections were not represented in the URL.

Signed-in customers now receive the audited dashboard. Appointments, Orders, Profile, and Security use `?view=` URLs, so refreshes and browser navigation retain the requested section. Receipt links continue to open Orders.

### Role-appropriate staff settings

Manager, Owner, and Developer accounts could reach Barber chair controls for services, hours, buffers, and customer availability.

Management accounts are now stopped at a role boundary and directed to the operational dashboard. Barber settings remain available only to Barber accounts.

### Barber settings accuracy

The prior settings screen included browser-only cancellation, refund, earnings, and payout controls that were not enforced by protected production services. It also repeated profile editing already handled during professional setup.

The settings screen now focuses on values that drive the current booking engine: services, weekly hours, buffer time, minimum notice, booking window, new-client acceptance, Any Available participation, and waitlist participation.

### Management heading scope

Management wording was previously corrected through a document-wide DOM search. The adjustment is now scoped to the active staff shell and uses a consistent operational heading.

## Validation

GitHub Actions passed:

- TypeScript
- ESLint
- Production client build
- SSR build and static prerendering
- JavaScript bundle budget: 119.97 KB gzip / 120 KB
- CSS bundle budget: 39.99 KB gzip / 40 KB

## Remaining boundaries

This is still browser-backed owner-review functionality. Production requires protected APIs, D1 persistence, server-side authorization, secure sessions, transactional appointment locking, verification delivery, payments, audit logs, and browser end-to-end tests.

Online rescheduling remains intentionally paused until pending changes can be stored separately from approved appointments.

The public booking calendar continues to use the existing Booking V6 engine. Its remaining legacy assumptions, including closed-day presentation and customer waitlist eligibility, should be addressed in a dedicated production booking-rules pass rather than patched into this audit.

A manual browser walkthrough was not performed as part of this repository-only audit.
