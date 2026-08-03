import {
  shopClosedSummary,
  shopHours,
  shopHoursNote,
  shopHoursSummary,
} from '../data/hours';
import { seniorPricingNote, seniorServicePrices } from '../data/senior-services';
import {
  booksyUrl,
  business,
  findRoute,
  services,
  team,
} from '../data/site';
import { galleryItems } from '../data/visuals';
import { Arrow } from './Layout';
import { LocationMap } from './LocationMap';

const instagramUrl = 'https://www.instagram.com/thekutshoppe/';

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
    heading: 'A reputation built one appointment at a time.',
    intro: 'Read verified feedback from hundreds of Kut Shoppe clients.',
  },
  '/contact': {
    heading: 'Call the shop when you need guidance.',
    intro: 'Get help choosing a service, checking availability, or finding the right booking option.',
  },
  '/privacy': {
    heading: 'Privacy information.',
    intro: 'This page will reflect the finished booking, commerce, account, and contact services enabled for production.',
  },
  '/terms': {
    heading: 'Website terms.',
    intro: 'Website, appointment, account, order, pickup, shipping, and payment terms will be finalized before production launch.',
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
          <a className="button" href="/book">Book now <Arrow /></a>
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
  const href = service.bookingType === 'barber' ? '/book' : '/book?type=loctician';

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

function TeamRoute() {
  return (
    <div className="route-content verified-team-grid">
      {team.map((member) => (
        <article className="verified-team-card" data-member={memberKey(member.shortName)} key={member.name}>
          <div className="verified-team-media">
            {member.photo ? <img src={member.photo} alt={`${member.name}, ${member.specialty} at The Kut Shoppe`} width="640" height="800" loading="lazy" decoding="async" /> : <div className="verified-team-placeholder" aria-hidden="true">CS</div>}
          </div>
          <div className="verified-team-copy"><p className="eyebrow">{member.specialty}</p><h2>{member.name}</h2><a className="text-link" href={memberBookingHref(member.shortName, member.bookingType)}>Book {member.shortName} <Arrow /></a></div>
        </article>
      ))}
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

function ReviewsRoute() {
  return <div className="content-panel route-content review-summary-panel"><div><p className="review-rating">5.0</p><p>Hundreds of verified client reviews remain available through the prior barber booking profile during migration.</p></div><a className="button" href={booksyUrl} target="_blank" rel="noopener noreferrer">Read client reviews</a></div>;
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

function DefaultRoute({ path }: { path: string }) {
  if (path === '/contact') return <div className="content-panel route-content"><h2>Call for the fastest answer.</h2><p>For service guidance, appointment questions, or walk-in availability, call the shop directly.</p><a className="button" href={business.phoneHref}>Call {business.phone}</a></div>;
  if (path === '/privacy' || path === '/terms') return <div className="content-panel route-content"><h2>{path === '/privacy' ? 'Privacy details are being finalized.' : 'Website terms are being finalized.'}</h2><p>Final language will be published before the verified booking, account, commerce, messaging, payment, and payout systems enter production.</p><a className="button button-secondary" href="/contact">Contact the shop</a></div>;
  return <div className="content-panel route-content"><h2>That page is no longer available.</h2><p>Return to the homepage or use the navigation to continue browsing The Kut Shoppe.</p><a className="button button-secondary" href="/">Return home</a></div>;
}

export function RoutePage({ url }: { url: string }) {
  const route = findRoute(url);
  const presentation = routePresentation[route.path];
  const hasServiceRoute = services.some((item) => item.route === route.path);
  const isWideRoute = ['/team', '/gallery', '/services'].includes(route.path);
  const pageClass = route.path === '/services'
    ? 'route-services-page route-pattern-tools'
    : route.path === '/gallery'
      ? 'route-gallery-page route-pattern-gallery'
      : route.path === '/team'
        ? 'route-team-page route-pattern-chairs'
        : route.path === '/visit'
          ? 'route-visit-page route-pattern-map'
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
        {!hasServiceRoute && !['/services', '/team', '/visit', '/reviews', '/gallery'].includes(route.path) ? <DefaultRoute path={route.path} /> : null}
      </div>
    </section>
  );
}
