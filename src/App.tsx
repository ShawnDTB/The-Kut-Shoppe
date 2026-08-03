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

const assetRoot = 'https://www.thekutshoppe.com/wp-content/uploads/2023/11';

const originalAssets = {
  logo: `${assetRoot}/a2e8fdecb672406ba74a28a19b4063-the-kut-shoppe-llc-logo-5175fdd512c54b42b4da939b84353a-booksy.png`,
  hero: [
    `${assetRoot}/Screenshot_20221226_011226.png`,
    `${assetRoot}/Screenshot_20221226_010224.png`,
    `${assetRoot}/116349555_2729516800613989_1244638744107863079_n.jpg`,
    `${assetRoot}/248722629_609910650359815_1940157589140309591_n.jpg`,
  ],
  introPhoto: `${assetRoot}/Screenshot-3.png`,
  trustPhoto: `${assetRoot}/Screenshot-2.png`,
  productsPhoto: `${assetRoot}/displaycasxe.jpeg`,
  firstDivider: `${assetRoot}/shaving-accessories-and-tools-in-barber-shop-VSFV5XH.jpg`,
  secondDivider: `${assetRoot}/tattooed-barber-trimming-bearded-man-with-shaving-SGQDLF4.jpg`,
};

const featureItems = [
  {
    icon: `${assetRoot}/3-Icon.png`,
    title: 'Skilled professionals',
    text: 'A neighborhood crew built around practiced barbering, styling, and client relationships.',
  },
  {
    icon: `${assetRoot}/2-Icon.png`,
    title: 'Personalized service',
    text: 'Choose the professional and service path that match the appointment you need.',
  },
  {
    icon: `${assetRoot}/1-Icon.png`,
    title: 'Complete grooming',
    text: 'Cuts, beard work, locs, braids, color, scalp care, and finishing services in one shop.',
  },
] as const;

const legacyServices = [
  {
    title: 'Haircuts',
    route: '/services/haircuts',
    icon: `${assetRoot}/Service-1.png`,
  },
  {
    title: 'Shaving',
    route: '/services/beards-shaves',
    icon: `${assetRoot}/Service-2.png`,
  },
  {
    title: 'Beard trims',
    route: '/services/beards-shaves',
    icon: `${assetRoot}/Service-3.png`,
  },
  {
    title: 'Hair coloring',
    route: '/services/color-scalp-care',
    icon: `${assetRoot}/Service-4.png`,
  },
  {
    title: 'Scalp treatments',
    route: '/services/color-scalp-care',
    icon: `${assetRoot}/Service-5.png`,
  },
  {
    title: 'Locs and styling',
    route: '/services/locs-braids',
    icon: `${assetRoot}/Service-6.png`,
  },
] as const;

const galleryImages = [
  `${assetRoot}/Screenshot_20221226_125914.png`,
  `${assetRoot}/Screenshot_20221226_010005.png`,
  `${assetRoot}/Screenshot_20221226_125828.png`,
  `${assetRoot}/341024966_1956517418048758_341679834709831618_n.jpg`,
  `${assetRoot}/344361926_1681491582285389_2600761642670164496_n.jpg`,
  `${assetRoot}/338925785_1231422527579297_5877031053853473996_n.jpg`,
] as const;

const teamImages = [
  `${assetRoot}/b521fb91846b4912bcf89cb676f6fe-the-kut-shoppe-llc-inspiration-6d4b772c52f84dcb8af50f0766a068-booksy.jpeg`,
  `${assetRoot}/fa1a7071815a4526b184301c3e7080-the-kut-shoppe-llc-inspiration-27244e73fa644d338ae5080ebaf27c-booksy.jpeg`,
  `${assetRoot}/279b398b746b47c3b584ff26907608-the-kut-shoppe-llc-inspiration-18a0bfc98974498999b18db892b5ad-booksy.jpeg`,
  `${assetRoot}/14becf6b3de4465fab8cf78acce292-the-kut-shoppe-llc-inspiration-0604d68ee1534f7387d707b8df3b50-booksy.jpeg`,
] as const;

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

function Arrow() {
  return <span aria-hidden="true">→</span>;
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
            <img src={originalAssets.logo} alt="" width="64" height="64" />
            <span>The Kut Shoppe</span>
          </a>
          <nav className="desktop-nav" aria-label="Primary navigation">
            <ul className="nav-list">
              {navigation.map(([label, href]) => (
                <li key={href}>
                  <a href={href}>{label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <a className="button button-compact header-book" href="/book">
            Book
          </a>
          <details className="mobile-nav">
            <summary aria-label="Open navigation">Menu</summary>
            <nav aria-label="Mobile navigation">
              {navigation.map(([label, href]) => (
                <a key={href} href={href}>
                  {label}
                </a>
              ))}
              <a href="/book">Book appointment</a>
            </nav>
          </details>
        </div>
      </header>
    </>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <img src={originalAssets.logo} alt="The Kut Shoppe" width="120" height="120" />
          <p>Precision barbering and modern styling in downtown Stroudsburg.</p>
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

function HeroSlideshow() {
  return (
    <div className="hero-slides" aria-hidden="true">
      {originalAssets.hero.map((image, index) => (
        <span
          className={`hero-slide hero-slide-${index + 1}`}
          key={image}
          style={{ backgroundImage: `url(${image})` }}
        />
      ))}
    </div>
  );
}

function HomePage() {
  return (
    <>
      <section className="hero">
        <HeroSlideshow />
        <div className="hero-shade" />
        <div className="container hero-content">
          <p className="eyebrow">The Kut Shoppe · Stroudsburg, Pennsylvania</p>
          <h1>Classic cuts with a modern edge.</h1>
          <p className="lede">
            Precision barbering, locs, braids, styling, and grooming services
            from a neighborhood crew on Main Street.
          </p>
          <div className="button-row hero-actions">
            <a className="button" href="/book#barber">
              Book appointment <Arrow />
            </a>
            <a className="button button-secondary" href="/services">
              Explore services
            </a>
          </div>
        </div>
        <a className="scroll-cue" href="#modern-twist" aria-label="Continue to the next section">
          <span />
        </a>
      </section>

      <section id="modern-twist" className="section ornament-section ornament-bg-3">
        <div className="container editorial-split">
          <div className="editorial-copy">
            <p className="eyebrow">Established neighborhood craft</p>
            <h2>A modern twist on classic cuts.</h2>
            <p className="lede">
              The Kut Shoppe combines the familiar rhythm of a neighborhood
              barbershop with a broad range of current barbering and styling
              services.
            </p>
            <a className="text-link" href="/about">
              More about the shop <Arrow />
            </a>
          </div>
          <figure className="editorial-image offset-image">
            <img
              src={originalAssets.introPhoto}
              alt="Inside The Kut Shoppe"
              width="900"
              height="900"
            />
          </figure>
        </div>
        <div className="container feature-grid">
          {featureItems.map((item) => (
            <article className="feature-item" key={item.title}>
              <img src={item.icon} alt="" width="96" height="96" loading="lazy" />
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section services-section ornament-section ornament-bg-2">
        <div className="container centered-heading">
          <p className="eyebrow">Our services</p>
          <h2>You look great. Now make it perfect.</h2>
          <p>Explore the service categories represented on the current live site.</p>
        </div>
        <div className="container service-icon-grid">
          {legacyServices.map((service) => (
            <article className="service-icon-card" key={service.title}>
              <img src={service.icon} alt="" width="112" height="112" loading="lazy" />
              <h3>{service.title}</h3>
              <a href={service.route} className="text-link">
                Read more <Arrow />
              </a>
            </article>
          ))}
        </div>
      </section>

      <section
        className="parallax-divider"
        style={{ backgroundImage: `url(${originalAssets.firstDivider})` }}
      >
        <div className="parallax-shade" />
        <div className="container divider-content">
          <p className="eyebrow">Main Street, Stroudsburg</p>
          <h2>Experience the art of grooming at its finest.</h2>
          <a className="button" href="/book">
            Book appointment <Arrow />
          </a>
        </div>
      </section>

      <section className="section ornament-section ornament-bg-4">
        <div className="container editorial-split editorial-split-reverse">
          <figure className="editorial-image">
            <img
              src={originalAssets.trustPhoto}
              alt="The Kut Shoppe workspace"
              width="900"
              height="900"
              loading="lazy"
            />
          </figure>
          <div className="editorial-copy">
            <p className="eyebrow">Why choose us</p>
            <h2>Your destination for a dapper look.</h2>
            <p className="lede">
              A welcoming shop experience centered on consistency, clean work,
              conversation, and long-term client relationships.
            </p>
            <div className="rule-list">
              <span>Precision</span>
              <span>Consistency</span>
              <span>Community</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section gallery-section ornament-section ornament-bg-5">
        <div className="container centered-heading">
          <p className="eyebrow">Our gallery</p>
          <h2>Best known for a great haircut.</h2>
          <p>
            A first curated view of work already shown on the current website.
          </p>
        </div>
        <div className="container gallery-grid">
          {galleryImages.map((image, index) => (
            <figure className={`gallery-item gallery-item-${index + 1}`} key={image}>
              <img
                src={image}
                alt={`Hair and grooming work from The Kut Shoppe gallery, image ${index + 1}`}
                width="800"
                height="800"
                loading="lazy"
              />
            </figure>
          ))}
        </div>
        <div className="container centered-action">
          <a className="button button-secondary" href="/gallery">
            Explore the gallery <Arrow />
          </a>
        </div>
      </section>

      <section
        className="parallax-divider appointment-divider"
        style={{ backgroundImage: `url(${originalAssets.secondDivider})` }}
      >
        <div className="parallax-shade parallax-shade-gradient" />
        <div className="container divider-content divider-content-left">
          <p className="eyebrow">Make an appointment</p>
          <h2>Choose the service and professional that fit your visit.</h2>
          <p>
            Appointments are recommended. Walk-ins depend on professional
            availability.
          </p>
          <a className="button" href="/book">
            Start booking <Arrow />
          </a>
        </div>
      </section>

      <section className="section team-section ornament-section ornament-bg-9">
        <div className="container centered-heading">
          <p className="eyebrow">The team</p>
          <h2>The Kut Shoppe crew.</h2>
          <p>
            Team names and images below are drawn from the current public site;
            profile details remain held for verification.
          </p>
        </div>
        <div className="container portrait-grid">
          {team.map((member, index) => (
            <article className="portrait-card" key={member.name}>
              <div className="portrait-image">
                <img
                  src={teamImages[index]}
                  alt={member.name}
                  width="700"
                  height="700"
                  loading="lazy"
                />
              </div>
              <VerificationBadge status="requires-verification" />
              <h3>{member.name}</h3>
              <p>{member.note}</p>
            </article>
          ))}
        </div>
        <div className="container centered-action">
          <a className="button button-secondary" href="/team">
            Meet the team <Arrow />
          </a>
        </div>
      </section>

      <section className="section products-section ornament-section ornament-bg-8">
        <div className="container editorial-split">
          <div className="editorial-copy">
            <p className="eyebrow">Our merchandise</p>
            <h2>Products from the shop.</h2>
            <p className="lede">
              The original website promotes in-store and online products. The
              approved inventory and purchasing destination are being verified
              before this section becomes transactional.
            </p>
            <a className="text-link" href="/products">
              Product information <Arrow />
            </a>
          </div>
          <figure className="editorial-image product-image">
            <img
              src={originalAssets.productsPhoto}
              alt="Product display inside The Kut Shoppe"
              width="900"
              height="900"
              loading="lazy"
            />
          </figure>
        </div>
      </section>
    </>
  );
}

function BookPage() {
  return (
    <section className="section page-hero ornament-section ornament-bg-2">
      <div className="container narrow-container">
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
    <section className="section page-hero ornament-section ornament-bg-3">
      <div className="container narrow-container">
        <VerificationBadge status={route.status} />
        <p className="eyebrow">{route.eyebrow}</p>
        <h1>{route.heading}</h1>
        <p className="lede">{route.intro}</p>

        {route.path === '/services' ? (
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
              Booksy remains the source for availability and final booking details.
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
          <div className="portrait-grid route-content">
            {team.map((member, index) => (
              <article className="portrait-card" key={member.name}>
                <div className="portrait-image">
                  <img
                    src={teamImages[index]}
                    alt={member.name}
                    width="700"
                    height="700"
                    loading="lazy"
                  />
                </div>
                <VerificationBadge status="requires-verification" />
                <h2>{member.name}</h2>
                <p>{member.note}</p>
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
          <div className="gallery-grid route-content">
            {galleryImages.map((image, index) => (
              <figure className="gallery-item" key={image}>
                <img
                  src={image}
                  alt={`Hair and grooming work from The Kut Shoppe gallery, image ${index + 1}`}
                  width="800"
                  height="800"
                  loading="lazy"
                />
              </figure>
            ))}
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
