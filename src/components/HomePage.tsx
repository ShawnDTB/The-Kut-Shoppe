import { booksyUrl, business, team } from '../data/site';
import {
  galleryItems,
  originalAssets,
  serviceHighlights,
  shopStandards,
} from '../data/visuals';
import { Arrow } from './Layout';

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

function BookingChoices({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'booking-choice-row booking-choice-row-compact' : 'booking-choice-row'}>
      <a className="booking-choice" href="/book#barber">
        <span className="booking-choice-kicker">Haircuts · fades · beards</span>
        <strong>Book with a barber</strong>
        <Arrow />
      </a>
      <a className="booking-choice" href="/book#styling">
        <span className="booking-choice-kicker">Locs · braids · styling</span>
        <strong>Book styling services</strong>
        <Arrow />
      </a>
    </div>
  );
}

function ServicesOverview() {
  return (
    <section id="services" className="section compact-services ornament-section ornament-bg-3">
      <div className="container compact-services-intro">
        <div>
          <p className="eyebrow">Services for the whole neighborhood</p>
          <h2>One shop. Two clear ways to book.</h2>
          <p className="lede">
            Choose barbering for cuts, fades, beard work, and shaves—or styling for locs, braids, twists, color, and hair care.
          </p>
        </div>
        <div className="service-summary-panel" aria-label="Service overview">
          <div>
            <span>Barbering</span>
            <strong>Cuts, fades, tapers, beards, and straight-razor details</strong>
          </div>
          <div>
            <span>Styling</span>
            <strong>Locs, braids, twists, color, washing, and scalp care</strong>
          </div>
          <div>
            <span>Clients</span>
            <strong>Kids, adults, seniors, women, and longtime regulars</strong>
          </div>
        </div>
      </div>

      <div className="container service-icon-strip">
        {serviceHighlights.map((service) => (
          <a className="service-icon-link" href={service.route} key={service.title}>
            <img src={service.icon} alt="" width="88" height="88" loading="lazy" />
            <span>{service.title}</span>
          </a>
        ))}
      </div>

      <div className="container compact-section-actions">
        <a className="text-link" href="/services">
          Services and pricing <Arrow />
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
          <h2>See the range before choosing your chair.</h2>
          <p>
            Fades, tapers, scissor cuts, beard details, locs, braids, designs, and kids cuts—all from the shop’s current gallery.
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
              <img src={item.src} alt={item.alt} width="640" height="640" loading="lazy" />
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
          <img src={originalAssets.introPhoto} alt="Inside The Kut Shoppe" width="1000" height="760" loading="lazy" />
        </figure>
        <div className="compact-about-copy">
          <p className="eyebrow">A modern twist on classic cuts</p>
          <h2>A neighborhood shop built around the person in the chair.</h2>
          <p className="lede">
            The Kut Shoppe brings barbering and styling professionals together in a welcoming Main Street shop serving Stroudsburg and the Pocono area.
          </p>
          <ul className="compact-crew-list" aria-label="The Kut Shoppe crew">
            {team.map((member) => (
              <li key={member.name}>{member.name}</li>
            ))}
          </ul>
          <div className="compact-about-actions">
            <a className="text-link" href="/about">
              About the shop <Arrow />
            </a>
            <a className="text-link" href="/team">
              Meet the crew <Arrow />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function ShopTeaser() {
  return (
    <section className="shop-teaser ornament-section ornament-bg-8" aria-labelledby="shop-teaser-heading">
      <div className="container shop-teaser-grid">
        <img src={originalAssets.productsPhoto} alt="Product display inside The Kut Shoppe" width="520" height="420" loading="lazy" />
        <div>
          <p className="eyebrow">Products from the shop</p>
          <h2 id="shop-teaser-heading">Keep the fresh look going.</h2>
          <p>Ask about grooming and hair-care products available through the shop.</p>
        </div>
        <a className="button button-secondary" href="/products">
          Product information <Arrow />
        </a>
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <>
      <section className="hero compact-hero">
        <HeroSlideshow />
        <div className="hero-shade" />
        <div className="container hero-content hero-content-refined">
          <p className="eyebrow">Barbering and styling in downtown Stroudsburg</p>
          <h1>Classic cuts. Modern styles. Your chair is waiting.</h1>
          <p className="lede">
            Haircuts, fades, beard work, locs, braids, twists, color, and hair care from one neighborhood crew.
          </p>
          <BookingChoices />
          <a className="hero-call" href={business.phoneHref}>
            Questions? Call {business.phone}
          </a>
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
            <small>Downtown Stroudsburg</small>
          </a>
          <a href="/book">
            <span>Appointments</span>
            <strong>Recommended</strong>
            <small>Walk-ins when availability allows</small>
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

      <section
        id="visit"
        className="parallax-divider appointment-divider final-conversion compact-final"
        style={{ backgroundImage: `url(${originalAssets.secondDivider})` }}
      >
        <div className="parallax-shade parallax-shade-gradient" />
        <div className="container conversion-panel">
          <div className="conversion-copy">
            <p className="eyebrow">Ready when you are</p>
            <h2>Choose the service. Choose the time.</h2>
            <p>Appointments are recommended. Walk-ins are welcome when availability allows.</p>
            <BookingChoices compact />
          </div>
          <aside className="visit-card" aria-label="Visit The Kut Shoppe">
            <span>Visit the shop</span>
            <strong>518 Main Street</strong>
            <p>Stroudsburg, PA 18360</p>
            <a href={business.phoneHref}>{business.phone}</a>
            <a className="text-link" href="/visit">
              Visit details <Arrow />
            </a>
          </aside>
        </div>
      </section>
    </>
  );
}
