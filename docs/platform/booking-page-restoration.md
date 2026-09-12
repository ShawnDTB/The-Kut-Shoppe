# Original booking page restored

The requested two-option page at `536bd36` is `BookingGateway`: **Who do you need? → Barber / Loctician**. Barber opens `/book?barber=any`; Loctician opens Crowned by Steph’s GlossGenius site. The “table” is the styled service list with service name, price and duration, followed by the weekly appointment grid.

## Restored experience

`ProductionAccess.tsx` now preserves that gateway, including prerendered HTML, instead of immediately displaying the replacement booking form. `RestoredBooking.tsx` reuses the baseline gateway, progress, panel, service-row, barber-grid, week-grid, times, chair-picker, review and confirmation CSS classes and markup structure. No new visual theme was introduced.

1. Choose Barber or Loctician.
2. Barber: choose a service from the original row layout.
3. Choose a named Barber or any available Barber. A valid `barber` ID in the URL preselects that professional after service selection.
4. Choose a day in the weekly grid. Times load immediately. When more than one chair is open at a time, choose among those barbers with their actual price and duration.
5. Review the appointment, use the verified account/profile, add a note, and send the request.
6. See confirmation and open the saved appointment in the current customer dashboard. Existing staff approval and notification infrastructure receives the same server record.

The account’s Book a visit tab uses the same restored flow. Back buttons preserve the selected service/appointment where appropriate. Late availability responses are ignored after changing week/selection. Network-uncertain submissions keep their request key and freeze editing until resolved.

## Integration boundaries

- Services, prices, durations, locations and available times come from the current API and D1 database. No legacy localStorage account or appointment adapter is imported.
- Weekly days are selectable; openings are checked when clicked. Unlike the old browser implementation, this UI does not hard-code Sundays closed or label unchecked days Open/Full. The server’s actual schedule and notice/window rules decide availability.
- Customers choose before signing in. Verified account access is still required to submit; the selection stays in memory through sign-in. Contact fields reflect the account profile; the profile editor is linked rather than silently changing account identity through a booking form.
- The Loctician remains on the existing provider, exactly as in the baseline. Booksy remains a usable fallback when the native Barber service is unavailable.
- Online appointment edits were already paused by the exported `Booking()` at `536bd36`. Existing edit links retain the current appointment and lead to its details/contact options. Walk-in/waitlist and edit/proposal operations are not newly enabled by this presentation restoration.
- No migration, production activation or main change is needed for this update.

## Review

Pull `dev-branch` and restart `npm run review`. Open **http://localhost:8788/book** with no query string to see both original options. Choose Barber to review the service rows and calendar. The local review professional/haircut are database fixtures; use an additional approved professional to compare chairs.

Automated React DOM checks cover gateway routing, disabled-service provider fallback, protected edit URLs, staged selection, multi-chair quotes, guest sign-in continuity, stale availability responses and idempotent retry/confirmation. The normal build checks assert the prerendered gateway and both destination links. Browser/mobile visual acceptance remains outstanding; reuse of the original CSS is not a claim of pixel-by-pixel browser verification.

Validation: 162 tests passed with the full typecheck/lint/build/bundle/production/Workers gates. The final appointment-history import was also typechecked and rebuilt, including bundle and prerendered gateway checks.
