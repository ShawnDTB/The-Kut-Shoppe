# Customer flow refinement

Implementation date: 2026-08-02

## Goal

Refine the code-based website so it communicates like a working neighborhood barbershop before introducing more experimental design ideas. The original live website remains the source for business tone, service breadth, customer groups, gallery categories, appointment guidance, and major homepage messages.

## Problems addressed

- The hero looked polished but did not immediately separate barber appointments from loc and styling appointments.
- General marketing phrases replaced the specific barbering and styling language used by the live website.
- Service icons had lost the descriptions that help customers understand what each category includes.
- Internal verification badges and development notes appeared in the customer interface.
- Team photographs were assigned to names by array position without confirmed image-to-name mapping.
- The gallery preview was too small to represent the breadth of work shown on the current website.
- Phone, address, appointment guidance, and walk-in expectations were not prominent enough near conversion points.
- The main application component contained nearly every page, asset map, and visual section.

## Refined homepage flow

1. **Hero identification and booking choice**
   - States that The Kut Shoppe is a barbershop and styling destination in Stroudsburg.
   - Names barbering, loc, braid, styling, color, and hair-care services.
   - Separates barber booking from loc and styling booking.
   - Provides a direct call option for uncertain visitors.

2. **Immediate shop facts**
   - Address
   - Appointment recommendation
   - Walk-in availability guidance
   - Phone number

3. **Shop introduction**
   - Preserves the original “modern twist on classic cuts” message.
   - Restores the welcoming, relationship-focused language from the live About page.

4. **Original experience features**
   - Diverse clientele from kids and seniors to women.
   - Fades, tapers, locs, cornrows, braids, twists, and related services.
   - Grooming and hair-care products associated with the shop.

5. **Detailed illustrated services**
   - Retains all six custom service icons.
   - Restores short descriptions for haircuts, shaving, beard trims, color, scalp care, and styling.
   - Repeats the two booking paths after the service explanation.

6. **Photographic shop divider**
   - Preserves the original full-width fixed photography transition.

7. **Expanded work proof**
   - Represents fades, tapers, scissor cuts, designs, beard work, locs, braids, kids cuts, and first cuts.
   - Adds visible category captions.

8. **Concrete trust section**
   - Replaces generic “precision / consistency / community” wording with tangible practices supported by the current live site.
   - Removes the outdated pandemic certification emphasis.

9. **Team section**
   - Displays current team photography as a neutral collage.
   - Lists the four public professional names separately.
   - Avoids claiming which unverified photograph belongs to which person.

10. **Final booking and visit conversion**
    - Repeats separate barber and styling choices.
    - Presents the address and phone number directly beside the booking actions.
    - Explains appointment and walk-in expectations.

11. **Products**
    - Retains the original merchandise purpose below the appointment-focused content.
    - Avoids exposing internal project-management wording.

## Shared structure changes

- `src/components/Layout.tsx`: header, footer, simplified navigation, phone, and booking actions
- `src/components/HomePage.tsx`: customer-focused homepage sections
- `src/components/Pages.tsx`: booking and supporting route content
- `src/data/visuals.ts`: audited visual assets, original icon content, gallery categories, and shop standards
- `src/refinement.css`: homepage and customer-flow styles
- `src/route-refinement.css`: expanded route layouts
- `src/App.tsx`: route composition only

## Navigation decision

Primary navigation is intentionally limited to:

- Services
- Gallery
- Team
- About
- Visit

Call and Book remain visible actions. Reviews, contact, products, privacy, and terms remain accessible through the footer or relevant page links.

## Asset warning

The development build still references the public WordPress media library. Before launch, every approved image and icon must be copied into the GitHub-managed asset pipeline, optimized, and tested independently of WordPress.

## Remaining verification

- Exact professional image-to-name mapping
- Direct booking URL for each professional or service group
- Final current shop hours
- Approved review excerpts and count strategy
- Product catalog and purchase destination
- Final legal and contact-processing content
