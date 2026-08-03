import { bookingPaths, booksyUrl, business, team } from '../data/site';
import {
  galleryItems,
  originalAssets,
  serviceHighlights,
  shopStandards,
} from '../data/visuals';
import { Arrow } from './Layout';
import { LocationMap } from './LocationMap';

function HeroBackdrop() {
  return (
    <div className="hero-static-media" aria-hidden="true">
      <img
        src={originalAssets.introPhoto}
        alt=""
        width="1600"
        height="1200"
        loading="eager"
        decoding="async"
      />
    </div>
  );
}

function BookingChoices({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'booking-choice-row booking-choice-row-compact' : 'booking-choice-row'}>
      {bookingPaths.map((path) => (
        <a
          className="booking-choice"
          href={path.href}
          key={path.id}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="booking-choice-kicker">
            {path.type === 'barber' ? 'Haircuts · fades · beards' : 'Locs · braids · styling'}
          </span>
          <strong>{path.shortTitle}</strong>
          <small className="booking-choice-provider">{path.provider}</small>
          <Arrow />
        </a>
      ))}
    </div>
  );
}

function ServicesOverview() {
  const featuredCut = galleryItems[0];

  return (
    <section id="services" className="section compact-services ornament-section ornament-bg-3">
      <div className="container services-chair-intro">
        <div className="services-chair-copy">
          <p className="eyebrow">Services for the whole neighborhood</p>
          <h2>You look great. Now let us make it perfect.</h2>
          <p className="lede">
            Fades, clean line-ups, beard work, kids cuts, locs, braids, and styling—whatever brings you in, the crew takes the time to get it right.
          </p>
          <p className="services-owner-note">Top-rated barbering and styling in downtown Stroudsburg.</p>
        </div>
        <figure className="services-chair-photo services-finished-cut">
          <img
            src={featuredCut.src}
            alt={featuredCut.alt}
            width="900"
            height="900"
            loading="lazy"
            decoding="async"
          />
          <figcaption>The Kut Shoppe · 518 Main Street · steps from the Sherman Theater</figcaption>
        </figure>
      </div>

      <div className="container service-icon-strip">
        {serviceHighlights.map((service) => (
          <a className="service-icon-link" href={service.route} key={service.title}>
            <img src={service.icon} alt="" width="88" height="88" loading="lazy" decoding="async" />
            <span>{service.title}</span>
          </a>
        ))}
      </div>

      <div className="container compact-section-actions">
        <a className="text-link" href="/services">
          Current services and pricing <Arrow />
        </a>
        <BookingChoices compact />
      </div>
    </section>
  );
}

function WorkAndTrust() {
  const previewItems = galleryItems.slice(0, 6);
  const standards = shopStandards.slice(0, 3);

  return (
    <section id="work" className="section compact-proof ornament-section ornament-bg-5">
      <div className="container compact-proof-grid">
        <div className="proof-copy">
          <p className="eyebrow">Real work. Real appointments.</p>
          <h2>Check the work out. Then choose your chair.</h2>
          <p>
            Fades, tapers, scissor cuts, beard details, locs, braids, designs, and kids cuts from the shop gallery.
          </p>
          <ul className="trust-shortlist">
            {standards.map((standard) => (
              <li key={standard}>{standard}</li>
            ))}
          </ul>
          <div className="proof-actions">
            <a className="button button-secondary" href="/gallery">
              View the full gallery <Arrow />
            </a>
            <a className="text-link" href={booksyUrl} target="_blank" rel="noopener noreferrer">
              Read Booksy feedback <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>

        <div className="compact-gallery" aria-label="Featured work from The Kut Shoppe">
          {previewItems.map((item) => (
            <figure key={item.src}>
              <img src={item.src} alt={item.alt} width="640" height="640" loading="lazy" decoding="async" />
              <figcaption>{item.category}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutAndCrew() {
  return (
    <section id="about" className="section compact-about ornament-section ornament-bg-4">
      <div className="container compact-about-grid">
        <figure className="compact-about-image">
          <img
            src={originalAssets.trustPhoto}
            alt="The Kut Shoppe prepared for a client visit"
            width="1000"
            height="760"
            loading="lazy"
            decoding="async"
          />
        </figure>
        <div className="compact-about-copy">
          <p className="eyebrow">A modern twist on classic cuts</p>
          <h2>A Main Street shop built around the person in the chair.</h2>
          <p className="lede">
            The Kut Shoppe brings barbering and styling professionals together in downtown Stroudsburg, just steps from the Sherman Theater.
          </p>
          <div className="compact-crew-grid" aria-label="The Kut Shoppe crew">
            {team.map((member) => (
              <a
                className="compact-crew-card"
                href={member.bookingHref}
                key={member.name}
                target="_blank"
                rel="noopener noreferrer"
              >
                {member.photo ? (
                  <img
                    src={member.photo}
                    alt=""
                    width="112"
                    height="112"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="compact-crew-monogram" aria-hidden="true">CS</span>
                )}
                <span>
                  <strong>{member.shortName}</strong>
                  <small>{member.specialty}</small>
                </span>
              </a>
            ))}
          </div>
          <a className="text-link" href="/team">
            Meet the crew <Arrow />
          </a>
        </div>
      </div>
    </section>
  );
}

function ShopTeaser() {
  return (
    <section className="shop-teaser ornament-section ornament-bg-8" aria-labelledby="shop-teaser-heading">
      <div className="container shop-teaser-grid">
        <img
          src={originalAssets.productsPhoto}
          alt="Product display inside The Kut Shoppe"
          width="520"
          height="420"
          loading="lazy"
          decoding="async"
        />
        <div>
          <p className="eyebrow">Products from the shop</p>
          <h2 id="shop-teaser-heading">Keep the fresh look going.</h2>
          <p>Ask about grooming, hair-care, accessories, and Kut Shoppe merchandise available through the shop.</p>
        </div>
        <a className="button button-secondary" href="/shop">
          Visit the shop <Arrow />
        </a>
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <>
      <section className="hero compact-hero hero-focused">
        <HeroBackdrop />
        <div className="hero-shade" />
        <div className="container hero-content hero-content-minimal">
          <div className="hero-glass-panel">
            <p className="eyebrow">The Kut Shoppe · Downtown Stroudsburg</p>
            <h1>Your look. Done right.</h1>
            <p className="lede">
              Fresh cuts, beard work, locs, braids, and styling from a Main Street crew that knows its clients.
            </p>
            <BookingChoices compact />
            <a className="hero-call" href={business.phoneHref}>
              Questions? Call {business.phone}
            </a>
          </div>
        </div>
        <a className="scroll-cue" href="#services" aria-label="Continue to services">
          <span />
        </a>
      </section>

      <section className="shop-quickfacts compact-quickfacts" aria-label="Shop information">
        <div className="container quickfacts-grid">
          <a href="/visit">
            <span>Visit</span>
            <strong>518 Main Street</strong>
            <small>Steps from the Sherman Theater</small>
          </a>
          <a href="/book">
            <span>Appointments</span>
            <strong>Two booking providers</strong>
            <small>Choose barbering or styling</small>
          </a>
          <a href={business.phoneHref}>
            <span>Questions</span>
            <strong>{business.phone}</strong>
            <small>Call the shop directly</small>
          </a>
        </div>
      </section>

      <ServicesOverview />
      <WorkAndTrust />
      <AboutAndCrew />
      <ShopTeaser />

      <section id="visit" className="section location-conversion">
        <div className="container location-conversion-grid">
          <div className="conversion-copy location-conversion-copy">
            <p className="eyebrow">Ready for the next one?</p>
            <h2>Your chair is ready when you are.</h2>
            <p>Book your cut on Booksy. For locs, braids, twists, and styling, book directly with Steph.</p>
            <BookingChoices compact />
          </div>
          <LocationMap />
        </div>
      </section>
    </>
  );
}
