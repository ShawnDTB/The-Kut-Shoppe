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

export function BookPage() {
  return (
    <section className="section page-hero ornament-section ornament-bg-2">
      <div className="container narrow-container">
        <p className="eyebrow">Appointments</p>
        <h1>Start with the service you need.</h1>
        <p className="lede">
          Choose barbering or loc and styling services, then continue to the current booking profile to select a professional and available time.
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
      <h2>Current service information</h2>
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
        <p>Individual pricing and appointment details are available through the current booking profile.</p>
      )}
      <p className="fine-print">
        Website prices are carried over from the current public service page. Booksy remains the source for appointment availability and final booking details.
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
      <div className="team-collage" aria-label="Team photography from the current Kut Shoppe website">
        {teamPortraits.map((portrait, index) => (
          <figure className={`team-collage-item team-collage-item-${index + 1}`} key={portrait}>
            <img src={portrait} alt="Kut Shoppe team portrait" width="700" height="700" loading="lazy" />
          </figure>
        ))}
      </div>
      <div className="crew-panel">
        <h2>The current public roster</h2>
        <ul className="crew-list">
          {team.map((member) => (
            <li key={member.name}>{member.name}</li>
          ))}
        </ul>
        <p>Use the booking page to choose a service and review current professional availability.</p>
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
          The Kut Shoppe’s current About page emphasizes the charm of its neighborhood atmosphere, a carefully selected team, and the importance of treating every client as an individual rather than a face in the crowd.
        </p>
        <p>
          The shop takes time to learn what clients want and aims to build long-lasting relationships through classic barbering, modern styling, and consistent personal service in the Poconos.
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
      <h2>Verified feedback is available on the current booking profile.</h2>
      <p>The review page will present selected public feedback with accurate source attribution rather than an unverified hardcoded count.</p>
      <a className="button" href={booksyUrl} target="_blank" rel="noopener noreferrer">View current Booksy reviews</a>
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
        <h2>Products are promoted in the shop.</h2>
        <p>Ask about available grooming and hair-care products during your next appointment. The online catalog will link only to approved Kut Shoppe merchandise and inventory.</p>
        <a className="button button-secondary" href="/book">Book an appointment</a>
      </div>
    );
  }

  if (path === '/contact') {
    return (
      <div className="content-panel route-content">
        <h2>Call for the fastest answer.</h2>
        <p>For appointment questions, service guidance, or walk-in availability, call the shop directly. Appointment reservations should continue through the booking page.</p>
        <a className="button" href={business.phoneHref}>Call {business.phone}</a>
      </div>
    );
  }

  return (
    <div className="content-panel route-content">
      <h2>Website information</h2>
      <p>This page will be completed before the code-based website replaces the current WordPress site.</p>
      <a className="button button-secondary" href="/">Return home</a>
    </div>
  );
}

export function RoutePage({ url }: { url: string }) {
  const route = findRoute(url);
  const hasServiceRoute = services.some((item) => item.route === route.path);
  const isWideRoute = ['/team', '/gallery', '/about'].includes(route.path);

  return (
    <section className="section page-hero ornament-section ornament-bg-3">
      <div className={`container ${isWideRoute ? 'route-wide' : 'narrow-container'}`}>
        <p className="eyebrow">{route.eyebrow}</p>
        <h1>{route.heading}</h1>
        <p className="lede">{route.intro}</p>

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
