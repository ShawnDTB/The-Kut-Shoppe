import {
  booksyUrl,
  bookingPaths,
  business,
  findRoute,
  services,
  team,
} from '../data/site';
import { galleryItems, originalAssets, teamPortraits } from '../data/visuals';
import { Arrow } from './Layout';

const routePresentation: Partial<Record<string, { heading: string; intro: string }>> = {
  '/services': {
    heading: 'Barbering, grooming, and styling services.',
    intro: 'Explore haircut, beard, loc, braid, color, scalp-care, and styling options before choosing the right booking path.',
  },
  '/team': {
    heading: 'Meet the professionals behind the shop.',
    intro: 'The Kut Shoppe brings barbering and styling professionals together for clients across Stroudsburg and the Pocono area.',
  },
  '/gallery': {
    heading: 'Real work from the shop.',
    intro: 'Browse fades, tapers, scissor cuts, beard work, locs, braids, kids cuts, designs, and first-haircut moments.',
  },
  '/products': {
    heading: 'Grooming and hair care between visits.',
    intro: 'Ask about products available through the shop to help maintain your cut, style, hair, and scalp between appointments.',
  },
  '/about': {
    heading: 'More than a chair and a haircut.',
    intro: 'A welcoming neighborhood shop centered on personal service, carefully finished work, and long-term client relationships.',
  },
  '/reviews': {
    heading: 'A reputation built one appointment at a time.',
    intro: 'See verified client feedback from appointments booked through The Kut Shoppe’s public booking profile.',
  },
  '/contact': {
    heading: 'Call the shop when you need guidance.',
    intro: 'Get help choosing a service, confirming walk-in availability, or finding the correct appointment path.',
  },
  '/privacy': {
    heading: 'Privacy information.',
    intro: 'This page explains how the finished website will handle contact details, analytics, and service-provider data.',
  },
  '/terms': {
    heading: 'Website terms.',
    intro: 'General website terms and any approved appointment-policy references will be published here.',
  },
};

export function BookPage() {
  return (
    <section className="section page-hero ornament-section ornament-bg-2">
      <div className="container narrow-container">
        <p className="eyebrow">Appointments</p>
        <h1>Start with the service you need.</h1>
        <p className="lede">
          Choose barbering or loc and styling services, then continue to the booking profile to select a professional and available time.
        </p>
        <div className="booking-grid">
          {bookingPaths.map((path) => (
            <article className="booking-card" id={path.id} key={path.id}>
              <p className="booking-card-label">{path.id === 'barber' ? 'Haircuts and grooming' : 'Locs, braids and styling'}</p>
              <h2>{path.title}</h2>
              <p>{path.description}</p>
              <a className="button" href={path.href} target="_blank" rel="noopener noreferrer">
                Continue to Booksy <span aria-hidden="true">↗</span>
              </a>
            </article>
          ))}
        </div>
        <div className="notice-panel">
          <h2>Not sure which option to choose?</h2>
          <p>
            Call the shop at <a href={business.phoneHref}>{business.phone}</a>. General messages and contact forms are not used to reserve appointments.
          </p>
        </div>
      </div>
    </section>
  );
}

function ServicesRoute() {
  return (
    <div className="route-service-list route-content">
      {services.map((item, index) => (
        <article className="route-service-row" key={item.route}>
          <span>0{index + 1}</span>
          <div>
            <h2>{item.title}</h2>
            <p>{item.summary}</p>
          </div>
          <a className="text-link" href={item.route}>
            View category <Arrow />
          </a>
        </article>
      ))}
    </div>
  );
}

function ServiceRoute({ path }: { path: string }) {
  const service = services.find((item) => item.route === path);
  if (!service) return null;

  return (
    <div className="content-panel route-content">
      <h2>Services and pricing</h2>
      {service.prices.length ? (
        <ul className="price-list">
          {service.prices.map(([name, price]) => (
            <li key={name}>
              <span>{name}</span>
              <strong>{price}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p>Individual pricing and appointment details are available through the booking profile.</p>
      )}
      <p className="fine-print">
        Booksy remains the source for current appointment availability and final booking details.
      </p>
      <a className="button" href={booksyUrl} target="_blank" rel="noopener noreferrer">
        View booking availability
      </a>
    </div>
  );
}

function TeamRoute() {
  return (
    <div className="route-content team-route-layout">
      <div className="team-collage" aria-hidden="true">
        {teamPortraits.map((portrait, index) => (
          <figure className={`team-collage-item team-collage-item-${index + 1}`} key={portrait}>
            <img src={portrait} alt="" width="700" height="700" loading="lazy" />
          </figure>
        ))}
      </div>
      <div className="crew-panel">
        <h2>The Kut Shoppe crew</h2>
        <ul className="crew-list">
          {team.map((member) => (
            <li key={member.name}>{member.name}</li>
          ))}
        </ul>
        <p>Choose a service, then review the professionals and appointment times currently available through booking.</p>
        <a className="button" href="/book">Choose a booking path</a>
      </div>
    </div>
  );
}

function AboutRoute() {
  return (
    <div className="route-content about-route-layout">
      <div className="about-route-copy">
        <h2>A welcoming shop where clients are more than the next appointment.</h2>
        <p>
          The Kut Shoppe combines the charm of a neighborhood barbershop with a carefully selected team and a broad mix of barbering and styling services.
        </p>
        <p>
          Every visit is approached personally: understand the look, provide a comfortable experience, and build long-lasting relationships through consistent service in the Poconos.
        </p>
        <a className="button" href="/book">Choose an appointment</a>
      </div>
      <figure className="editorial-image about-route-image">
        <img src={originalAssets.introPhoto} alt="Inside The Kut Shoppe" width="900" height="900" loading="lazy" />
      </figure>
    </div>
  );
}

function VisitRoute() {
  return (
    <div className="split-grid route-content">
      <div className="content-panel">
        <p className="eyebrow">Address</p>
        <h2>{business.address}</h2>
        <p>{business.walkIns}</p>
        <a className="button" href={business.phoneHref}>Call {business.phone}</a>
      </div>
      <div className="content-panel">
        <p className="eyebrow">Availability</p>
        <h2>Check the schedule before visiting.</h2>
        <p>{business.hoursNote}</p>
        <a className="button button-secondary" href="/book">View booking options</a>
      </div>
    </div>
  );
}

function ReviewsRoute() {
  return (
    <div className="content-panel route-content">
      <h2>Read feedback from booked appointments.</h2>
      <p>Visit the public booking profile to see current ratings and verified feedback from Kut Shoppe clients.</p>
      <a className="button" href={booksyUrl} target="_blank" rel="noopener noreferrer">View Booksy reviews</a>
    </div>
  );
}

function GalleryRoute() {
  return (
    <div className="gallery-grid gallery-grid-expanded route-content">
      {galleryItems.map((item, index) => (
        <figure className={`gallery-item gallery-item-${index + 1}`} key={item.src}>
          <img src={item.src} alt={item.alt} width="800" height="800" loading="lazy" />
          <figcaption>{item.category}</figcaption>
        </figure>
      ))}
    </div>
  );
}

function DefaultRoute({ path }: { path: string }) {
  if (path === '/products') {
    return (
      <div className="content-panel route-content">
        <h2>Ask about products during your next visit.</h2>
        <p>Grooming and hair-care products are available through the shop to help maintain your finished look between appointments.</p>
        <a className="button button-secondary" href="/book">Book an appointment</a>
      </div>
    );
  }

  if (path === '/contact') {
    return (
      <div className="content-panel route-content">
        <h2>Call for the fastest answer.</h2>
        <p>For service guidance, appointment questions, or walk-in availability, call the shop directly. Reservations should continue through the booking page.</p>
        <a className="button" href={business.phoneHref}>Call {business.phone}</a>
      </div>
    );
  }

  if (path === '/privacy') {
    return (
      <div className="content-panel route-content">
        <h2>Privacy details are being finalized.</h2>
        <p>The policy will describe any contact-form processing, analytics, cookies, and third-party service providers before those features are enabled on the production website.</p>
        <a className="button button-secondary" href="/contact">Contact the shop</a>
      </div>
    );
  }

  if (path === '/terms') {
    return (
      <div className="content-panel route-content">
        <h2>Website terms are being finalized.</h2>
        <p>Final terms will cover website use and link to any approved appointment, cancellation, or booking-provider policies.</p>
        <a className="button button-secondary" href="/book">View booking options</a>
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
  const isWideRoute = ['/team', '/gallery', '/about'].includes(route.path);

  return (
    <section className="section page-hero ornament-section ornament-bg-3">
      <div className={`container ${isWideRoute ? 'route-wide' : 'narrow-container'}`}>
        <p className="eyebrow">{route.eyebrow}</p>
        <h1>{presentation?.heading ?? route.heading}</h1>
        <p className="lede">{presentation?.intro ?? route.intro}</p>

        {route.path === '/services' ? <ServicesRoute /> : null}
        {hasServiceRoute ? <ServiceRoute path={route.path} /> : null}
        {route.path === '/team' ? <TeamRoute /> : null}
        {route.path === '/about' ? <AboutRoute /> : null}
        {route.path === '/visit' ? <VisitRoute /> : null}
        {route.path === '/reviews' ? <ReviewsRoute /> : null}
        {route.path === '/gallery' ? <GalleryRoute /> : null}
        {!hasServiceRoute &&
        !['/services', '/team', '/about', '/visit', '/reviews', '/gallery'].includes(route.path) ? (
          <DefaultRoute path={route.path} />
        ) : null}
      </div>
    </section>
  );
}
