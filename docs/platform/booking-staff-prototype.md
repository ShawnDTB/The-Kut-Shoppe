# Internal Booking and Staff Platform Prototype

## Purpose

This branch replaces the barber side of the external booking handoff with an interactive first-party Kut Shoppe experience while keeping Crowned by Steph as the external Loctician booking destination.

The branch is intentionally isolated from `main` until scheduling rules, staff permissions, customer policies, secure persistence, and notifications are approved.

## Customer routes

- `/book`
  - Choose Barber or Loctician
  - Loctician continues to Crowned by Steph
  - Barber continues through service, professional, date, time, customer details, review, and confirmation
- `/account`
  - Shows locally confirmed barber appointments
  - Keeps Loctician appointment management external
  - Reserves space for orders from the commerce branch

## Staff routes

- `/staff`
- `/staff/setup`
- `/staff/calendar`
- `/staff/earnings`
- `/staff/payouts`

Staff onboarding collects:

- Professional name
- Contact details
- Platform role
- Work location
- Accepted services
- Weekly work hours
- Booking buffer
- Minimum notice
- Booking window
- New-client status
- Participation in Any Available Barber
- Preferred payout frequency

## Current persistence

This branch uses browser `localStorage` for test staff profiles and test appointments.

This makes the workflow interactive for design and product review, but it is not a production database. Data is limited to the current browser and can be cleared by the user.

## Production replacement

The browser storage adapter will be replaced by authenticated Cloudflare server endpoints backed by D1 tables from `feature/platform-core`.

Production booking must add:

- Secure customer and staff authentication
- Role-based permissions
- Server-side validation
- Conflict-safe temporary appointment holds
- Transactional appointment creation
- Email or SMS confirmation
- Rescheduling and cancellation controls
- Time-off and schedule-exception management
- Audit events
- Rate limiting and abuse controls
- Customer consent and privacy controls

## Booksy migration use

Public Booksy information is used only as a migration reference for current staff names, service names, displayed prices, durations, and booking behavior. The final platform must not depend on Booksy at runtime.

All migrated information remains subject to shop verification before production.

## Payout boundary

The staff platform owns:

- Earnings calculation
- Adjustments
- Approval workflow
- Payout ledger
- Payout history

The website must not store raw bank account or card information.

The initial mode records payouts made manually by the business. Automated bank transfers require a regulated provider that handles identity verification, tokenized bank onboarding, settlement, reporting, disputes, and compliance.

Worker relationship classification is assigned by approved administrators based on the actual business arrangement. It is not selected by staff during onboarding.

## Review sequence

1. Complete a staff profile at `/staff/setup`.
2. Confirm the schedule and selected services in `/staff`.
3. Create a test barber appointment at `/book`.
4. Confirm the appointment appears in `/staff/calendar`.
5. Confirm it appears in `/account`.
6. Review mobile behavior, keyboard navigation, labels, and error prevention.

## Not ready to merge

This branch should remain a draft until:

- `npm run check` passes in GitHub Actions
- Shop booking policies are approved
- Any Available Barber assignment is finalized
- D1 persistence is connected
- Authentication is connected
- Conflict-safe holds are implemented
- Confirmation delivery is implemented
- Staff authorization protects every private route
