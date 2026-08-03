import {
  shopClosedSummary,
  shopHours,
  shopHoursNote,
  shopHoursSummary,
} from '../data/hours';
import { seniorPricingNote, seniorServicePrices } from '../data/senior-services';
import {
  business,
  findRoute,
  services,
  team,
} from '../data/site';
import { galleryItems } from '../data/visuals';
import { Arrow } from './Layout';
import { LocationMap } from './LocationMap';

const instagramUrl = 'https://www.instagram.com/thekutshoppe/';
const googleReviewsUrl = 'https://www.google.com/maps/search/?api=1&query=The+Kut+Shoppe+518+Main+Street+Stroudsburg+PA';
const effectiveDate = 'August 3, 2026';

const routePresentation: Partial<Record<string, { heading: string; intro: string }>> = {
  '/services': {
    heading: 'Services and pricing.',
    intro: 'Find the service you need, then start one clear booking process.',
  },
  '/team': {
    heading: 'Meet the professionals behind the shop.',
    intro: 'Choose a professional or begin with any available barber.',
  },
  '/gallery': {
    heading: 'Cuts and styles from the shop.',
    intro: 'Browse fades, tapers, scissor cuts, beard work, locs, braids, kids cuts, and designs.',
  },
  '/reviews': {
    heading: 'The work speaks. Clients confirm it.',
    intro: 'Google feedback and real shop work together tell the story of The Kut Shoppe.',
  },
  '/contact': {
    heading: 'Call the shop when you need guidance.',
    intro: 'Get help choosing a service, checking availability, or finding the right booking option.',
  },
  '/privacy': {
    heading: 'Privacy policy.',
    intro: `Effective ${effectiveDate}. How The Kut Shoppe handles website, booking, account, and order information.`,
  },
  '/terms': {
    heading: 'Website terms.',
    intro: `Effective ${effectiveDate}. Rules for using the website, booking services, accounts, and product ordering.`,
  },
};

function ServicesRoute() {
  const adultPrices = services.find((category) => category.title === 'Adult and teen cuts')?.prices ?? [];
  const kidsPrices = services.find((category) => category.title === 'Kids cuts')?.prices ?? [];
  const locticianCategories = services.filter((category) => category.bookingType === 'styling');

  return (
    <div className="services-directory route-content">
      <section className="services-menu-block services-menu-barber" aria-labelledby="barber-menu-heading">
        <div className="services-menu-heading">
          <div>
            <p className="eyebrow">Haircuts, fades, line-ups, and beard work</p>
            <h2 id="barber-menu-heading">Barber services</h2>
            <p>Review prices, then choose a barber and available time.</p>
          </div>
          <a className="button" href="/book?barber=any">Book now <Arrow /></a>
        </div>

        <div className="service-price-section service-price-section-adult">
          <div className="service-price-section-heading"><h3>Adult and teen barber services</h3><span>Ages 13 and up</span></div>
          <ul className="services-menu-list services-menu-list-explicit">{adultPrices.map((item) => <li key={item.name}><span>{item.name}</span><small>{item.duration}</small><strong>{item.price}</strong></li>)}</ul>
        </div>

        <div className="service-price-section service-price-section-senior">
          <div className="service-price-section-heading"><h3>Senior barber services</h3><span>Live shop menu reference</span></div>
          <ul className="services-menu-list services-menu-list-explicit services-menu-list-three">{seniorServicePrices.map((item) => <li key={item.name}><span>{item.name}</span><small aria-hidden="true" /><strong>{item.price}</strong></li>)}</ul>
          <p className="service-price-source-note">{seniorPricingNote}</p>
        </div>

        <div className="service-price-section service-price-section-kids">
          <div className="service-price-section-heading"><h3>Kids barber services</h3><span>Ages 3 to 12</span></div>
          <ul className="services-menu-list services-menu-list-explicit services-menu-list-three">{kidsPrices.map((item) => <li key={item.name}><span>{item.name}</span><small>{item.duration}</small><strong>{item.price}</strong></li>)}</ul>
        </div>
      </section>

      <section className="services-menu-block services-menu-styling" aria-labelledby="loctician-menu-heading">
        <div className="services-menu-heading">
          <div>
            <p className="eyebrow">Locs, braids, twists, retwists, and hair care</p>
            <h2 id="loctician-menu-heading">Loc care with Crowned by Steph</h2>
            <p>Begin on the same booking page, then continue to Steph’s current availability.</p>
          </div>
          <a className="button button-secondary" href="/book?type=loctician">Book Steph <Arrow /></a>
        </div>
        <div className="styling-category-grid">{locticianCategories.map((category) => <article key={category.route}><h3>{category.title}</h3><p>{category.summary}</p><a className="text-link" href={category.route}>Service details <Arrow /></a></article>)}</div>
      </section>
    </div>
  );
}

function ServiceRoute({ path }: { path: string }) {
  const service = services.find((item) => item.route === path);
  if (!service) return null;
  const href = service.bookingType === 'barber' ? '/book?barber=any' : '/book?type=loctician';

  return (
    <div className="content-panel route-content">
      <div className="service-heading-row">
        <div><p className="eyebrow">{service.bookingType === 'barber' ? 'Barber booking' : 'Loctician booking'}</p><h2>{service.prices.length ? 'Services and pricing' : 'Services and availability'}</h2></div>
        <a className="button button-secondary" href={href}>Book now <Arrow /></a>
      </div>
      {service.prices.length ? <ul className="price-list price-list-current">{service.prices.map((item) => <li key={item.name}><span>{item.name}</span><small>{item.duration}</small><strong>{item.price}</strong></li>)}</ul> : <p>Continue to the current service menu, policies, and available appointment times for this category.</p>}
      <p className="fine-print">Confirm final pricing and availability while booking.</p>
    </div>
  );
}

function memberBookingHref(shortName: string, bookingType: string) {
  if (bookingType === 'styling') return '/book?type=loctician';
  const barberIds: Record<string, string> = {
    KasH: 'kash',
    'Mr. Glen': 'mr-glen',
    'Kris-P': 'kris-p',
  };
  return `/book?barber=${barberIds[shortName] ?? 'any'}`;
}

function memberKey(shortName: string) {
  return shortName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function memberPresentation(shortName: string) {
  if (shortName === 'KasH') return { role: 'Owner', lines: ['KasH', 'The Fadeologist'] };
  if (shortName === 'Mr. Glen') return { role: 'Barber', lines: ['Mr. Glen', 'The Kut Doctor'] };
  if (shortName === 'Kris-P') return { role: 'Barber', lines: ['Kris-P Fades'] };
  return { role: 'Loctician', lines: ['Crowned by Steph'] };
}

function TeamRoute() {
  return (
    <div className="route-content verified-team-grid">
      {team.map((member) => {
        const presentation = memberPresentation(member.shortName);
        return (
          <article className="verified-team-card" data-member={memberKey(member.shortName)} key={member.name}>
            <div className="verified-team-media">
              {member.photo ? <img src={member.photo} alt={`${member.name} at The Kut Shoppe`} width="640" height="800" loading="lazy" decoding="async" /> : <div className="verified-team-placeholder" aria-hidden="true">CS</div>}
            </div>
            <div className="verified-team-copy">
              <p className="eyebrow">{presentation.role}</p>
              <h2>{presentation.lines.map((line) => <span key={line}>{line}</span>)}</h2>
              <a className="text-link" href={memberBookingHref(member.shortName, member.bookingType)}>Book {member.shortName} <Arrow /></a>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function VisitRoute() {
  return (
    <div className="visit-route-stack route-content">
      <LocationMap compact />
      <div className="split-grid visit-hours-grid">
        <div className="content-panel"><p className="eyebrow">Walk-in reference hours</p><h2>Shop hours</h2><dl className="visit-hours-list">{shopHours.map((entry) => <div key={entry.days}><dt>{entry.days}</dt><dd>{entry.hours}</dd></div>)}</dl><small>{shopHoursNote}</small></div>
        <div className="content-panel"><p className="eyebrow">Before you visit</p><h2>Check current availability.</h2><p>{business.walkIns}</p><p className="visit-hours-summary">{shopHoursSummary} · {shopClosedSummary}</p><div className="proof-actions"><a className="button" href="/book">Book now</a><a className="button button-secondary" href={business.phoneHref}>Call {business.phone}</a></div></div>
      </div>
    </div>
  );
}

const googleReviewSummaries = [
  {
    name: 'Christopher McCabe',
    theme: 'Community and family',
    text: 'Describes a community-focused shop where his son looks forward to appointments and leaves happy with the result.',
  },
  {
    name: 'Chadd Satterfield',
    theme: 'Consistency and timing',
    text: 'Highlights consistent work, on-time seating, easy booking, a clean shop, and the relaxed conversation that makes each visit enjoyable.',
  },
  {
    name: 'Isaiah Marseille',
    theme: 'Professional service',
    text: 'Calls every haircut a pleasant experience and recommends the friendly, professional team.',
  },
  {
    name: 'Carl David Walters, Jr.',
    theme: 'Clean and precise',
    text: 'Recommends Kash and the crew for precise cuts that keep him and his boys looking fresh.',
  },
  {
    name: 'Team-Goya-Gang Arango',
    theme: 'Long-term trust',
    text: 'Shares that years of appointments with Glen have stayed careful, consistent, and fully focused on the finished cut.',
  },
  {
    name: 'Reyna Geronimo Gomez',
    theme: 'A shop worth returning to',
    text: 'Praises the professionalism and dedication to the craft after finding the shop following a move to the area.',
  },
] as const;

function ReviewsRoute() {
  const work = galleryItems.slice(0, 4);
  return (
    <div className="route-content reviews-showcase">
      <section className="reviews-rating-band">
        <div><span className="reviews-stars" aria-label="4.9 out of 5 stars">★★★★★</span><strong>4.9</strong><small>59 Google reviews</small></div>
        <p>Clients repeatedly mention the same things visible throughout the gallery: careful work, consistent timing, a clean shop, and a welcoming atmosphere.</p>
        <a className="button" href={googleReviewsUrl} target="_blank" rel="noopener noreferrer">Read all Google reviews <span aria-hidden="true">↗</span></a>
      </section>

      <div className="reviews-testimonial-grid">
        {googleReviewSummaries.map((review) => <article key={review.name}><p className="eyebrow">Google review · {review.theme}</p><blockquote>{review.text}</blockquote><strong>{review.name}</strong></article>)}
      </div>

      <section className="reviews-work-link">
        <div><p className="eyebrow">See what clients are talking about</p><h2>Feedback backed by the work.</h2><p>Move from the testimonials directly into recent cuts, fades, beard details, locs, braids, and designs from the shop.</p><a className="button button-secondary" href="/gallery">View the full gallery <Arrow /></a></div>
        <div className="reviews-gallery-strip">{work.map((item) => <a href="/gallery" key={item.src}><img src={item.src} alt={item.alt} width="420" height="420" loading="lazy" decoding="async" /><span>{item.title}</span></a>)}</div>
      </section>
    </div>
  );
}

function GalleryRoute() {
  const categories = Array.from(new Set(galleryItems.map((item) => item.category)));
  return (
    <div className="route-content gallery-directory">
      <div className="gallery-category-key" aria-label="Gallery categories">{categories.map((category) => <span key={category}>{category}</span>)}</div>
      <div className="gallery-catalog">{galleryItems.map((item) => <figure className="gallery-catalog-card" key={item.src}><div className="gallery-catalog-image"><img src={item.src} alt={item.alt} width="800" height="800" loading="lazy" decoding="async" /></div><figcaption><span>{item.category}</span><strong>{item.title}</strong></figcaption></figure>)}</div>
      <div className="gallery-followup"><p>See recent work, shop updates, and new styles on Instagram.</p><a className="button button-secondary" href={instagramUrl} target="_blank" rel="noopener noreferrer">View Instagram <span aria-hidden="true">↗</span></a></div>
    </div>
  );
}

function PrivacyRoute() {
  return (
    <article className="legal-page route-content">
      <section><h2>Information we collect</h2><p>We collect only the information needed to provide the feature you use. This may include your name, email address, phone number, appointment details, account credentials, order contents, pickup or shipping choice, shipping address, and messages you send to the shop.</p><p>When the production platform is enabled, technical information such as browser type, device information, IP address, pages visited, and security logs may also be collected to operate, protect, and improve the website.</p></section>
      <section><h2>How information is used</h2><ul><li>Process and manage appointment requests, confirmations, changes, cancellations, and waitlist activity.</li><li>Create and secure customer or staff accounts.</li><li>Process product orders, inventory reservations, pickup, shipping, receipts, refunds, and customer support.</li><li>Send transactional email or text messages when those services are enabled and you provide the required contact information.</li><li>Prevent fraud, abuse, unauthorized access, and scheduling or inventory conflicts.</li><li>Maintain business, tax, accounting, and audit records where required.</li></ul></section>
      <section><h2>Payments and payouts</h2><p>The Kut Shoppe website will not store complete card numbers or raw bank-account credentials. Regulated payment and payout providers may collect and process that information under their own privacy notices when online payments or automated staff payouts are enabled.</p></section>
      <section><h2>Local preview data</h2><p>The current development preview stores test accounts, appointments, products, carts, and orders in the browser used for testing. That local data is not a secure production account system and should not contain real customer, payment, or banking information.</p></section>
      <section><h2>Cookies and local storage</h2><p>The site may use essential cookies or browser storage for sessions, carts, preferences, security, and application functionality. Optional analytics or marketing technologies will be disclosed and configured separately before use.</p></section>
      <section><h2>Sharing information</h2><p>Information may be shared with service providers that support hosting, communications, security, payment processing, shipping, fulfillment, analytics, or customer support. We may also disclose information when required by law, to protect customers or the business, or in connection with a business transfer. The website is not designed to sell personal information.</p></section>
      <section><h2>Retention and security</h2><p>Information is retained only as long as reasonably needed for the service, business records, dispute handling, security, and legal obligations. Reasonable administrative, technical, and physical safeguards are used, but no online system can promise absolute security.</p></section>
      <section><h2>Your choices</h2><p>You may request access to, correction of, or deletion of eligible account information by contacting the shop. Some records may need to be retained for completed appointments, orders, taxes, fraud prevention, disputes, or other legal obligations.</p></section>
      <section><h2>Children</h2><p>Parents or legal guardians should make appointments and purchases for children. The account and storefront are not intended for children to independently submit personal information.</p></section>
      <section><h2>Changes and contact</h2><p>This policy may be updated as the booking, account, messaging, payment, shipping, and payout features move into production. Material changes will be posted with a revised effective date.</p><p>Questions may be directed to The Kut Shoppe LLC at 518 Main Street, Stroudsburg, PA 18360, by calling <a href={business.phoneHref}>{business.phone}</a>, or through the <a href="/contact">contact page</a>.</p></section>
    </article>
  );
}

function TermsRoute() {
  return (
    <article className="legal-page route-content">
      <section><h2>Using the website</h2><p>These terms apply to your use of The Kut Shoppe website, appointment tools, waitlist, customer and staff accounts, product catalog, cart, order requests, pickup, shipping, and related communications. By using an enabled feature, you agree to provide accurate information and use the platform lawfully.</p></section>
      <section><h2>Appointments and waitlist</h2><ul><li>An appointment request is not confirmed until the assigned professional or authorized shop account accepts it.</li><li>Displayed availability can change while another customer completes a request.</li><li>The same-day waitlist does not guarantee service, a particular barber, or a specific time.</li><li>Customers must follow the cancellation, late-arrival, no-show, age, service, and preparation policies shown during booking or communicated by the professional.</li><li>Loctician services may continue through Crowned by Steph’s external booking service and its separate terms.</li></ul></section>
      <section><h2>Accounts</h2><p>You are responsible for protecting your password and for activity under your account. Do not share staff or administrative credentials. Access may be limited, suspended, or removed when needed to protect customers, the shop, or the platform.</p></section>
      <section><h2>Products, pricing, and inventory</h2><p>Only published catalog records are offered for sale. Prices, descriptions, images, variants, and availability may be corrected when an error is found. Adding an item to a cart does not guarantee inventory until the applicable reservation or order process is completed.</p></section>
      <section><h2>Orders, pickup, and shipping</h2><ul><li>Submitting checkout creates an order request unless the page clearly states that payment and acceptance are complete.</li><li>Pickup orders are not ready until the shop marks them ready and sends confirmation.</li><li>Shipping availability, cost, taxes, delivery estimates, and carrier terms are confirmed before payment or fulfillment.</li><li>The shop may decline or cancel an order because of inventory errors, pricing errors, suspected fraud, fulfillment limits, or other operational issues.</li></ul></section>
      <section><h2>Payments, returns, and refunds</h2><p>Online payments, deposits, refunds, and automated payouts will be processed through regulated providers when enabled. Applicable return, exchange, refund, cancellation, and deposit terms will be shown before payment. Products that are opened, used, personalized, hygienic in nature, or otherwise not resalable may be subject to additional restrictions where permitted by law.</p></section>
      <section><h2>Third-party services</h2><p>The website may link to or use services operated by other companies, including booking, maps, payment, shipping, social media, or marketplace providers. Their services are governed by their own terms and privacy notices.</p></section>
      <section><h2>Website content</h2><p>The Kut Shoppe name, branding, photographs, text, designs, and website materials may not be copied, republished, sold, or used commercially without permission. Customer reviews remain the property and responsibility of their original authors and platforms.</p></section>
      <section><h2>Availability and limitations</h2><p>The website is provided on an as-available basis. Temporary outages, errors, maintenance, delayed messages, or inaccurate third-party information may occur. Nothing on the website replaces direct confirmation from the shop or professional when timing, service suitability, price, or availability is important.</p></section>
      <section><h2>Governing law and changes</h2><p>These terms are governed by applicable United States and Pennsylvania law, without limiting rights that cannot legally be waived. Terms may be updated as platform features change. Continued use after an update means the revised terms apply to later activity.</p></section>
      <section><h2>Contact</h2><p>Questions may be directed to The Kut Shoppe LLC at 518 Main Street, Stroudsburg, PA 18360, by calling <a href={business.phoneHref}>{business.phone}</a>, or through the <a href="/contact">contact page</a>.</p></section>
    </article>
  );
}

function DefaultRoute({ path }: { path: string }) {
  if (path === '/contact') return <div className="content-panel route-content"><h2>Call for the fastest answer.</h2><p>For service guidance, appointment questions, or walk-in availability, call the shop directly.</p><a className="button" href={business.phoneHref}>Call {business.phone}</a></div>;
  return <div className="content-panel route-content"><h2>That page is no longer available.</h2><p>Return to the homepage or use the navigation to continue browsing The Kut Shoppe.</p><a className="button button-secondary" href="/">Return home</a></div>;
}

export function RoutePage({ url }: { url: string }) {
  const route = findRoute(url);
  const presentation = routePresentation[route.path];
  const hasServiceRoute = services.some((item) => item.route === route.path);
  const isWideRoute = ['/team', '/gallery', '/services', '/reviews'].includes(route.path);
  const pageClass = route.path === '/services'
    ? 'route-services-page route-pattern-tools'
    : route.path === '/gallery'
      ? 'route-gallery-page route-pattern-gallery'
      : route.path === '/team'
        ? 'route-team-page route-pattern-chairs'
        : route.path === '/visit'
          ? 'route-visit-page route-pattern-map'
          : route.path === '/reviews'
            ? 'route-reviews-page route-pattern-reviews'
            : route.path === '/privacy'
              ? 'route-privacy-page route-pattern-account'
              : route.path === '/terms'
                ? 'route-terms-page route-pattern-terms'
                : 'route-default-page';

  return (
    <section className={`section page-hero ${pageClass}`}>
      <div className={`container ${isWideRoute ? 'route-wide' : 'narrow-container'}`}>
        <header className="route-page-intro"><p className="eyebrow">{route.eyebrow}</p><h1>{presentation?.heading ?? route.heading}</h1><p className="lede">{presentation?.intro ?? route.intro}</p></header>
        {route.path === '/services' ? <ServicesRoute /> : null}
        {hasServiceRoute ? <ServiceRoute path={route.path} /> : null}
        {route.path === '/team' ? <TeamRoute /> : null}
        {route.path === '/visit' ? <VisitRoute /> : null}
        {route.path === '/reviews' ? <ReviewsRoute /> : null}
        {route.path === '/gallery' ? <GalleryRoute /> : null}
        {route.path === '/privacy' ? <PrivacyRoute /> : null}
        {route.path === '/terms' ? <TermsRoute /> : null}
        {!hasServiceRoute && !['/services', '/team', '/visit', '/reviews', '/gallery', '/privacy', '/terms'].includes(route.path) ? <DefaultRoute path={route.path} /> : null}
      </div>
    </section>
  );
}
