# Homepage condensation and route strategy

Audit date: 2026-08-02

## Sources reviewed

- Current public homepage, services, about, gallery, and shop pages
- Existing WordPress content and Elementor design settings
- Current React implementation on `main`
- Full-page desktop screenshots captured during local review

## Core diagnosis

The redesign had preserved the correct visual language, but every content idea was given the scale and spacing of a major campaign section. The result was visually polished but operationally exhausting: customers had to move through a hero, utility strip, introduction, feature grid, service grid, appointment divider, gallery, trust section, review section, team section, merchandise section, second appointment section, and footer.

The problem was not the amount of useful information. The problem was that related information was separated into too many self-contained chapters.

## What remains valuable

Preserve these established choices:

- Near-black background and grayscale-first palette
- Large Judson editorial headings
- Mulish and Maven Pro for functional text
- Real shop and service photography
- Original illustrated service icons
- Low-opacity fixed ornamental artwork
- Restrained outlined buttons
- Separate barbering and styling booking paths
- Direct phone and address access
- A limited number of photographic parallax moments
- Static, indexable routes beneath the homepage

## What caused the excessive length

### Repeated service explanation

The hero listed services, the introduction repeated service breadth, the three-feature row repeated the customer range and service breadth, and the six service cards explained the same categories again.

### Repeated appointment prompts

Booking appeared in the hero, after services, in a full-width photography divider, and again in the final conversion section. The repeated calls to action did not add new information.

### Proof split across three sections

The gallery, cleanliness standards, and reviews each received a separate large section even though they answer one customer question: “Can I trust the work and experience?”

### About and team separated unnecessarily

The About section explained the relationship-driven shop, while the Team section separately named the professionals. These are stronger together because the people are part of the shop story.

### Merchandise received editorial-page weight

Products are a useful supporting offer but not the primary conversion goal. A full editorial merchandise section interrupted the path toward booking.

## Condensed customer journey

The revised homepage follows five stages.

### 1. Identify and choose

The hero establishes the business, location, major service categories, barbering path, styling path, and phone number. A compact strip immediately confirms address, appointment guidance, and direct contact.

### 2. Understand the service offer

The original introduction, three feature cards, six detailed service cards, and post-service booking row are condensed into one section.

The section contains:

- One concise barbering-versus-styling explanation
- Three practical service summaries
- Six original illustrated icons
- One services-and-pricing link
- Two booking choices

### 3. See proof and trust the experience

Gallery work, selected shop standards, and verified Booksy feedback are combined into one section.

The visual proof receives more space than the explanatory copy. Only six representative images appear on the homepage; the full gallery remains a dedicated route.

### 4. Understand the shop and crew

The shop introduction and public team roster are combined around one authentic shop photograph. The page identifies the professionals without requiring a full standalone team showcase during the primary journey.

### 5. Book or visit

One final photographic section contains the booking choices, address, phone number, walk-in guidance, and visit link. This is the only full-width appointment divider retained.

## Page and navigation strategy

The goal is not to delete useful routes. It is to distinguish primary customer tasks from supporting pages.

### Primary navigation

- Services: homepage service section
- Work: homepage work and trust section
- About: homepage shop and crew section
- Shop: current product route, later replaced by the commerce experience
- Book now: dedicated booking menu
- Phone: direct call action

### Dedicated routes that remain useful

- `/book`: booking guidance and external booking destinations
- `/services`: complete service and pricing information
- `/gallery`: full work archive
- `/products`: temporary product information, later `/shop`
- `/reviews`: shareable review destination
- `/team`: shareable team destination when profiles are verified
- `/privacy` and `/terms`: legal routes

### Routes that can become homepage-led

- About
- Team overview
- Visit and contact guidance
- Review summary

These routes may remain available for search and direct links, but they do not need equal prominence in the header.

### Future scalable routes

- `/shop`: product categories, product detail, cart, and checkout
- `/account`: orders, saved information, and account preferences
- `/book`: first-party booking router or integration

The shared header and footer should remain stable as these systems are added. Commerce and account actions should join the right-side action area rather than expanding the editorial navigation.

## Mobile rules

The mobile homepage should not imitate the desktop page by stacking every large section vertically.

- Hero remains focused on the two booking paths
- Quick facts become compact rows
- Service icons use a two-column grid
- Service explanations remain short and scannable
- Featured work uses a two-column grid with six images
- About and crew stack into one section
- Product teaser becomes a compact card
- Final booking and visit information stack into one conversion block
- Fixed backgrounds fall back to normal scrolling
- No information depends on hover

## Content rules

- Explain a fact once, in the place where it supports a decision
- Prefer labels and direct options over paragraphs describing how to navigate
- Do not explain the site’s internal system to the customer
- Keep booking language action-oriented
- Let photography, service names, and clear controls answer common questions naturally
- Use the phone number as the fallback for ambiguity
- Keep uncertain information out of customer-facing copy until verified

## Visual pacing rules

- Reserve full-height treatment for the opening hero only
- Use one final photographic booking divider
- Standard content sections should fit comfortably within one desktop viewport when possible
- Avoid consecutive centered headings
- Alternate text-led and image-led layouts
- Use decorative background artwork as framing, not the primary content
- Products and secondary information should use strips or compact cards
- The footer should conclude the journey rather than repeat every section

## Measurement target

At a typical 1440p desktop viewport, the main homepage journey should require approximately half the number of screenshots previously needed. The exact page height will vary, but each scroll should introduce a new customer decision rather than another version of information already presented.