import { shopCategories } from '../data/commerce';
import { shopClosedSummary, shopHoursNote, shopHoursSummary } from '../data/hours';
import {
  bookingPaths,
  booksyUrl,
  business,
  findRoute,
  getBookingPath,
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
    intro: 'See the current barber menu below, or book locs, braids, twists, and retwists directly with Crowned by Steph.',
  },
  '/team': {
    heading: 'Meet the professionals behind the shop.',
    intro: 'Choose a professional, then continue directly to the booking profile that maintains their schedule.',
  },
  '/gallery': {
    heading: 'Cuts and styles from the shop.',
    intro: 'Browse fades, tapers, scissor cuts, beard work, locs, braids, kids cuts, and designs in one clear gallery.',
  },
  '/shop': {
    heading: 'Products for the look between appointments.',
    intro: 'The online store is being prepared around approved inventory rather than the former placeholder catalog.',
  },
  '/reviews': {
    heading: 'A reputation built one appointment at a time.',
    intro: 'Read verified feedback from hundreds of Kut Shoppe clients.',
  },
  '/contact': {
    heading: 'Call the shop when you need guidance.',
    intro: 'Get help choosing a service, confirming walk-in availability, or finding the correct booking option.',
  },
  '/privacy': {
    heading: 'Privacy information.',
    intro: 'This page will reflect the finished analytics, commerce, account, and contact services enabled for production.',
  },
  '/terms': {
    heading: 'Website terms.',
    intro: 'Website terms will remain separate from appointment policies maintained by external booking services.',
  },
};

export function BookPage() {
  return (
    <section className="section page-hero ornament-section ornament-bg-2">
      <div className="container narrow-container">
        <p className="eyebrow">Appointments</p>
        <h1>Choose the service. Choose your chair.</h1>
        <p className="lede">
          Book cuts, fades, beard work, and line-ups with a barber. Book locs, braids, twists, and retwists with the loctician.
        </p>
        <div className="booking-grid">
          {bookingPaths.map((path) => (
            <article className="booking-card" id={path.id} key={path.id}>
              <p className="booking-card-label">
                {path.type === 'barber' ? 'Barber services' : 'Loctician services'}
              </p>
              <h2>{path.title}</h2>
              <p>{path.description}</p>
              <a className="button" href={path.href} target="_blank" rel="noopener noreferrer">
                {path.buttonLabel} <span aria-hidden="true">↗</span>
              </a>
            </article>
          ))}
        </div>
        <div className="notice-panel">
          <h2>Not sure where to book?</h2>
          <p>
            Call the shop at <a href={business.phoneHref}>{business.phone}</a> and we will point you to the right chair.
          </p>
        </div>
      </div>
    </section>
  );
}

function ServicesRoute() {
  const barberBooking = getBookingPath('barber');
  const locticianBooking = getBookingPath('styling');
  const barberPrices = services
    .filter((category) => category.bookingType === 'barber')
    .flatMap((category) => category.prices)
    .filter(
      (item, index, list) => list.findIndex((candidate) => candidate.name === item.name) === index,
    );
  const locticianCategories = services.filter((category) => category.bookingType === 'styling');

  return (
    <div className="services-directory route-content">
      <section className="services-menu-block services-menu-barber" aria-labelledby="barber-menu-heading">
        <div className="services-menu-heading">
          <div>
            <p className="eyebrow">Haircuts, fades, line-ups, and beard work</p>
            <h2 id="barber-menu-heading">Barber services</h2>
            <p>Review current prices and appointment times, then choose your barber.</p>
          </div>
          <a className="button" href={barberBooking.href} target="_blank" rel="noopener noreferrer">
            {barberBooking.buttonLabel} <span aria-hidden="true">↗</span>
          </a>
        </div>
        <ul className="services-menu-list">
          {barberPrices.map((item) => (
            <li key={item.name}>
              <span>{item.name}</span>
              <small>{item.duration}</small>
              <strong>{item.price}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="services-menu-block services-menu-styling" aria-labelledby="loctician-menu-heading">
        <div className="services-menu-heading">
          <div>
            <p className="eyebrow">Locs, braids, twists, retwists, and hair care</p>
            <h2 id="loctician-menu-heading">Loc care with Crowned by Steph</h2>
            <p>View the current service menu, policies, prices, and available times when you book.</p>
          </div>
          <a className="button button-secondary" href={locticianBooking.href} target="_blank" rel="noopener noreferrer">
            {locticianBooking.buttonLabel} <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div className="styling-category-grid">
          {locticianCategories.map((category) => (
            <article key={category.route}>
              <h3>{category.title}</h3>
              <p>{category.summary}</p>
              <a className="text-link" href={category.route}>
                Service details <Arrow />
              </a>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ServiceRoute({ path }: { path: string }) {
  const service = services.find((item) => item.route === path);
  if (!service) return null;

  const booking = getBookingPath(service.bookingType);

  return (
    <div className="content-panel route-content">
      <div className="service-heading-row">
        <div>
          <p className="eyebrow">{booking.type === 'barber' ? 'Barber booking' : 'Loctician booking'}</p>
          <h2>{service.prices.length ? 'Services and pricing' : 'Services and availability'}</h2>
        </div>
        <a className="button button-secondary" href={booking.href} target="_blank" rel="noopener noreferrer">
          {booking.buttonLabel} <span aria-hidden="true">↗</span>
        </a>
      </div>
      {service.prices.length ? (
        <ul className="price-list price-list-current">
          {service.prices.map((item) => (
            <li key={item.name}>
              <span>{item.name}</span>
              <small>{item.duration}</small>
              <strong>{item.price}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          The booking profile maintains the current service menu, prices, policies, and available appointment times for this category.
        </p>
      )}
      <p className="fine-print">Confirm final pricing and availability when booking.</p>
    </div>
  );
}

function TeamRoute() {
  return (
    <div className="route-content verified-team-grid">
      {team.map((member) => (
        <article className="verified-team-card" key={member.name}>
          {member.photo ? (
            <img
              src={member.photo}
              alt=""
              width="480"
              height="480"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="verified-team-placeholder" aria-hidden="true">CS</div>
          )}
          <div>
            <p className="eyebrow">{member.specialty}</p>
            <h2>{member.name}</h2>
            <a className="text-link" href={member.bookingHref} target="_blank" rel="noopener noreferrer">
              Book with {member.shortName} <span aria-hidden="true">↗</span>
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}

function VisitRoute() {
  return (
    <div className="visit-route-stack route-content">
      <LocationMap compact />
      <div className="split-grid">
        <div className="content-panel">
          <p className="eyebrow">Walk-in reference hours</p>
          <h2>{shopHoursSummary}</h2>
          <p>{shopClosedSummary}</p>
          <small>{shopHoursNote}</small>
        </div>
        <div className="content-panel">
          <p className="eyebrow">Before you visit</p>
          <h2>Check your professional’s availability.</h2>
          <p>{business.walkIns}</p>
          <a className="button" href={business.phoneHref}>Call {business.phone}</a>
        </div>
      </div>
    </div>
  );
}

function ReviewsRoute() {
  return (
    <div className="content-panel route-content review-summary-panel">
      <div>
        <p className="review-rating">5.0</p>
        <p>Hundreds of verified client reviews are available through the barber booking profile.</p>
      </div>
      <a className="button" href={booksyUrl} target="_blank" rel="noopener noreferrer">Read client reviews</a>
    </div>
  );
}

function GalleryRoute() {
  const categories = Array.from(new Set(galleryItems.map((item) => item.category)));

  return (
    <div className="route-content gallery-directory">
      <div className="gallery-category-key" aria-label="Gallery categories">
        {categories.map((category) => <span key={category}>{category}</span>)}
      </div>
      <div className="gallery-catalog">
        {galleryItems.map((item) => (
          <figure className="gallery-catalog-card" key={item.src}>
            <div className="gallery-catalog-image">
              <img src={item.src} alt={item.alt} width="800" height="800" loading="lazy" decoding="async" />
            </div>
            <figcaption>
              <span>{item.category}</span>
              <strong>{item.title}</strong>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="gallery-followup">
        <p>See recent work, shop updates, and new styles on Instagram.</p>
        <a className="button button-secondary" href={instagramUrl} target="_blank" rel="noopener noreferrer">
          View Instagram <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  );
}

function ShopRoute() {
  return (
    <div className="route-content shop-foundation">
      <div className="shop-category-grid">
        {shopCategories.map((category) => (
          <article className="shop-category-card" key={category.slug}>
            <span aria-hidden="true" />
            <h2>{category.name}</h2>
            <p>{category.description}</p>
            <small>Approved inventory coming soon</small>
          </article>
        ))}
      </div>
      <div className="shop-foundation-note">
        <div>
          <p className="eyebrow">In the meantime</p>
          <h2>Ask what is available in the display case.</h2>
          <p>Call the shop or ask during your next appointment about current in-store products.</p>
        </div>
        <a className="button" href={business.phoneHref}>Call {business.phone}</a>
      </div>
    </div>
  );
}

function DefaultRoute({ path }: { path: string }) {
  if (path === '/account') {
    return (
      <div className="content-panel route-content">
        <h2>Account access is not required yet.</h2>
        <p>Customer accounts will be enabled with online orders, saved details, and order history when the verified catalog launches.</p>
        <a className="button button-secondary" href="/shop">Return to the shop</a>
      </div>
    );
  }

  if (path === '/contact') {
    return (
      <div className="content-panel route-content">
        <h2>Call for the fastest answer.</h2>
        <p>For service guidance, appointment questions, or walk-in availability, call the shop directly.</p>
        <a className="button" href={business.phoneHref}>Call {business.phone}</a>
      </div>
    );
  }

  if (path === '/privacy' || path === '/terms') {
    return (
      <div className="content-panel route-content">
        <h2>{path === '/privacy' ? 'Privacy details are being finalized.' : 'Website terms are being finalized.'}</h2>
        <p>Final language will be published before analytics, customer accounts, or first-party commerce are enabled.</p>
        <a className="button button-secondary" href="/contact">Contact the shop</a>
      </div>
    );
  }

  return (
    <div className="content-panel route-content">
      <h2>That page is no longer available.</h2>
      <p>Return to the homepage or use the navigation to continue browsing The Kut Shoppe.</p>
      <a className="button button-secondary" href="/">Return home</a>
    </div>
  );
}

export function RoutePage({ url }: { url: string }) {
  const route = findRoute(url);
  const presentation = routePresentation[route.path];
  const hasServiceRoute = services.some((item) => item.route === route.path);
  const isWideRoute = ['/team', '/gallery', '/shop', '/services'].includes(route.path);
  const pageClass = route.path === '/services'
    ? 'route-services-page'
    : route.path === '/gallery'
      ? 'route-gallery-page'
      : '';

  return (
    <section className={`section page-hero ornament-section ornament-bg-3 ${pageClass}`}>
      <div className={`container ${isWideRoute ? 'route-wide' : 'narrow-container'}`}>
        <header className="route-page-intro">
          <p className="eyebrow">{route.eyebrow}</p>
          <h1>{presentation?.heading ?? route.heading}</h1>
          <p className="lede">{presentation?.intro ?? route.intro}</p>
        </header>

        {route.path === '/services' ? <ServicesRoute /> : null}
        {hasServiceRoute ? <ServiceRoute path={route.path} /> : null}
        {route.path === '/team' ? <TeamRoute /> : null}
        {route.path === '/visit' ? <VisitRoute /> : null}
        {route.path === '/reviews' ? <ReviewsRoute /> : null}
        {route.path === '/gallery' ? <GalleryRoute /> : null}
        {route.path === '/shop' ? <ShopRoute /> : null}
        {!hasServiceRoute &&
        !['/services', '/team', '/visit', '/reviews', '/gallery', '/shop'].includes(route.path) ? (
          <DefaultRoute path={route.path} />
        ) : null}
      </div>
    </section>
  );
}
