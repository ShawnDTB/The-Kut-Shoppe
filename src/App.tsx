import './styles.css';
import {
  booksyUrl,
  bookingPaths,
  business,
  findRoute,
  navigation,
  services,
  team,
  type VerificationStatus,
} from './data/site';

interface AppProps {
  url: string;
}

const statusLabels: Record<VerificationStatus, string> = {
  'verified-live-site': 'Migrated from current site',
  'verified-booking-platform': 'Verified booking source',
  'requires-verification': 'Review before launch',
  placeholder: 'Placeholder',
};

function VerificationBadge({ status }: { status: VerificationStatus }) {
  if (status === 'verified-live-site' || status === 'verified-booking-platform') {
    return null;
  }
  return <span className="verification-badge">{statusLabels[status]}</span>;
}

function Header() {
  return (
    <>
      <div className="utility-bar">
        <div className="container utility-inner">
          <span>{business.address}</span>
          <span className="utility-hours">
            Hours vary by professional — check booking availability
          </span>
          <a href={business.phoneHref}>{business.phone}</a>
        </div>
      </div>
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="/" aria-label="The Kut Shoppe home">
            <span className="brand-mark" aria-hidden="true">
              K
            </span>
            <span>The Kut Shoppe</span>
          </a>
          <nav aria-label="Primary navigation">
            <ul className="nav-list">
              {navigation.map(([label, href]) => (
                <li key={href}>
                  <a href={href}>{label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <a className="button button-compact" href="/book">
            Book
          </a>
        </div>
      </header>
    </>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <p className="footer-heading">The Kut Shoppe</p>
          <p>
            Precision barbering and modern styling in downtown Stroudsburg.
          </p>
        </div>
        <div>
          <p className="footer-heading">Visit</p>
          <p>{business.address}</p>
          <a href={business.phoneHref}>{business.phone}</a>
        </div>
        <div>
          <p className="footer-heading">Information</p>
          <a href="/contact">Contact</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} The Kut Shoppe LLC</span>
        <span>Platform by Designed to Breakthrough LLC</span>
      </div>
    </footer>
  );
}

function HomePage() {
  return (
    <>
      <section className="section hero">
        <div className="container hero-grid">
          <div>
            <p className="eyebrow">Stroudsburg, Pennsylvania</p>
            <h1>Precision cuts. Modern styling. Right on Main Street.</h1>
            <p className="lede">
              The Kut Shoppe brings barbering and styling professionals together
              in a welcoming neighborhood shop built around consistency,
              conversation, and long-term client relationships.
            </p>
            <div className="button-row">
              <a className="button" href="/book#barber">
                Book a barber
              </a>
              <a className="button button-secondary" href="/book#styling">
                Book locs or styling
              </a>
            </div>
            <a className="text-link" href="/team">
              Meet the team <span aria-hidden="true">→</span>
            </a>
          </div>
          <div
            className="hero-visual"
            aria-label="Placeholder for authentic Kut Shoppe photography"
          >
            <div className="hero-visual-frame">
              <span className="visual-label">Authentic shop photography</span>
              <strong>Visual migration pending</strong>
              <p>
                Existing photography will be optimized after image rights and
                the preferred hero image are confirmed.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="reputation-strip" aria-label="Shop highlights">
        <div className="container reputation-grid">
          <div>
            <strong>Hundreds of verified client reviews</strong>
            <span>Current public booking platform</span>
          </div>
          <div>
            <strong>{business.address}</strong>
            <span>Downtown Stroudsburg</span>
          </div>
          <div>
            <strong>Appointments recommended</strong>
            <span>Walk-ins depend on availability</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Services</p>
              <h2>One shop, two clear booking paths.</h2>
            </div>
            <p>
              Choose barber services or loc and styling services without
              guessing which appointment link to use.
            </p>
          </div>
          <div className="card-grid">
            {services.map((service, index) => (
              <article className="card" key={service.route}>
                <p className="card-number">0{index + 1}</p>
                <h3>{service.title}</h3>
                <p>{service.summary}</p>
                <a className="text-link" href={service.route}>
                  Explore services <span aria-hidden="true">→</span>
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-dark">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">The crew</p>
              <h2>Book by professional when you know who you need.</h2>
            </div>
            <p>
              Team biographies and direct profile links remain intentionally
              unpublished until each professional’s details are confirmed.
            </p>
          </div>
          <div className="team-grid">
            {team.map((member) => (
              <article className="team-card" key={member.name}>
                <div className="team-letter" aria-hidden="true">
                  {member.name.slice(0, 1)}
                </div>
                <div>
                  <VerificationBadge status="requires-verification" />
                  <h3>{member.name}</h3>
                  <p>{member.note}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section booking-band">
        <div className="container booking-band-inner">
          <div>
            <p className="eyebrow">Ready when you are</p>
            <h2>Choose your service, professional, and available time.</h2>
          </div>
          <a className="button button-light" href="/book">
            Start booking
          </a>
        </div>
      </section>
    </>
  );
}

function BookPage() {
  return (
    <section className="section page-hero">
      <div className="container">
        <p className="eyebrow">Appointments</p>
        <h1>Start with the service you need.</h1>
        <p className="lede">
          Choose barbering or loc and styling services. You will continue to
          Booksy to select a professional and an available time.
        </p>
        <div className="booking-grid">
          {bookingPaths.map((path) => (
            <article className="booking-card" id={path.id} key={path.id}>
              <VerificationBadge status={path.status} />
              <h2>{path.title}</h2>
              <p>{path.description}</p>
              <a
                className="button"
                href={path.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                Continue to Booksy <span aria-hidden="true">↗</span>
              </a>
              {path.status === 'requires-verification' ? (
                <p className="fine-print">
                  The destination currently opens the main shop profile while a
                  dedicated styling link is verified.
                </p>
              ) : null}
            </article>
          ))}
        </div>
        <div className="notice-panel">
          <h2>Not sure which option to choose?</h2>
          <p>
            Call the shop at <a href={business.phoneHref}>{business.phone}</a>.
            The general contact form will not be used to reserve appointments.
          </p>
        </div>
      </div>
    </section>
  );
}

function RoutePage({ url }: { url: string }) {
  const route = findRoute(url);
  const service = services.find((item) => item.route === route.path);

  return (
    <section className="section page-hero">
      <div className="container">
        <VerificationBadge status={route.status} />
        <p className="eyebrow">{route.eyebrow}</p>
        <h1>{route.heading}</h1>
        <p className="lede">{route.intro}</p>

        {route.path === '/services' ? (
          <div className="card-grid route-content">
            {services.map((item) => (
              <article className="card" key={item.route}>
                <h2>{item.title}</h2>
                <p>{item.summary}</p>
                <a className="text-link" href={item.route}>
                  View category →
                </a>
              </article>
            ))}
          </div>
        ) : null}

        {service ? (
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
              <p>
                Individual pricing will remain on the booking platform until the
                service list is approved.
              </p>
            )}
            <p className="fine-print">
              Website prices are migrated from the current public service page.
              Booksy remains the source for appointment availability and final
              booking details.
            </p>
            <a
              className="button"
              href={booksyUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View booking availability
            </a>
          </div>
        ) : null}

        {route.path === '/team' ? (
          <div className="team-grid route-content">
            {team.map((member) => (
              <article className="team-card team-card-light" key={member.name}>
                <div className="team-letter" aria-hidden="true">
                  {member.name.slice(0, 1)}
                </div>
                <div>
                  <VerificationBadge status="requires-verification" />
                  <h2>{member.name}</h2>
                  <p>{member.note}</p>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {route.path === '/visit' ? (
          <div className="split-grid route-content">
            <div className="content-panel">
              <h2>{business.address}</h2>
              <p>{business.walkIns}</p>
              <a className="button" href={business.phoneHref}>
                Call {business.phone}
              </a>
            </div>
            <div className="content-panel">
              <VerificationBadge status={business.hoursStatus} />
              <h2>General hours</h2>
              <p>{business.hoursNote}</p>
            </div>
          </div>
        ) : null}

        {route.path === '/reviews' ? (
          <div className="content-panel route-content">
            <h2>Hundreds of verified client reviews</h2>
            <p>
              Approved excerpts will be added with public attribution, platform,
              source URL, and a verification date.
            </p>
            <a
              className="button"
              href={booksyUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View current Booksy reviews
            </a>
          </div>
        ) : null}

        {route.path === '/gallery' ? (
          <div className="gallery-placeholder route-content">
            <p>
              Gallery inventory and image optimization begin after source assets,
              reuse rights, and professional attribution are confirmed.
            </p>
          </div>
        ) : null}

        {!service &&
        !['/services', '/team', '/visit', '/reviews', '/gallery'].includes(
          route.path,
        ) ? (
          <div className="content-panel route-content">
            <h2>Foundation content</h2>
            <p>
              This route, metadata, navigation, and static HTML output are now
              established. Final production content is tracked through the
              verification and migration documents.
            </p>
            <a className="button button-secondary" href="/book">
              Book an appointment
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function App({ url }: AppProps) {
  const route = findRoute(url);
  return (
    <div className="site-shell">
      <Header />
      <main id="main-content">
        {route.path === '/' ? (
          <HomePage />
        ) : route.path === '/book' ? (
          <BookPage />
        ) : (
          <RoutePage url={url} />
        )}
      </main>
      <Footer />
    </div>
  );
}
