import { booksyUrl, business, team } from '../data/site';
import {
  featureItems,
  galleryItems,
  originalAssets,
  serviceHighlights,
  shopStandards,
  teamPortraits,
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

function GalleryPreview() {
  return (
    <div className="container gallery-grid gallery-grid-expanded">
      {galleryItems.map((item, index) => (
        <figure className={`gallery-item gallery-item-${index + 1}`} key={item.src}>
          <img src={item.src} alt={item.alt} width="800" height="800" loading="lazy" />
          <figcaption>{item.category}</figcaption>
        </figure>
      ))}
    </div>
  );
}

function TeamShowcase() {
  return (
    <div className="container team-showcase">
      <div className="team-collage" aria-hidden="true">
        {teamPortraits.map((portrait, index) => (
          <figure className={`team-collage-item team-collage-item-${index + 1}`} key={portrait}>
            <img src={portrait} alt="" width="700" height="700" loading="lazy" />
          </figure>
        ))}
      </div>
      <div className="crew-panel">
        <p className="eyebrow">The Kut Shoppe crew</p>
        <h2>Familiar professionals. One neighborhood shop.</h2>
        <p className="lede">
          Barbering and styling services come together under one roof so clients can choose the service and professional that fit their visit.
        </p>
        <ul className="crew-list">
          {team.map((member) => (
            <li key={member.name}>{member.name}</li>
          ))}
        </ul>
        <a className="text-link" href="/team">
          Meet the crew <Arrow />
        </a>
      </div>
    </div>
  );
}

function ReviewBand() {
  return (
    <section className="review-band" aria-labelledby="review-band-heading">
      <div className="container review-band-inner">
        <div>
          <p className="eyebrow">Client feedback</p>
          <h2 id="review-band-heading">Real appointments. Real experiences.</h2>
          <p>
            Read verified feedback from clients who booked barbering and styling services through The Kut Shoppe.
          </p>
        </div>
        <div className="review-band-actions">
          <a className="button" href="/reviews">
            Read client reviews <Arrow />
          </a>
          <a className="text-link" href={booksyUrl} target="_blank" rel="noopener noreferrer">
            View Booksy feedback <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <>
      <section className="hero">
        <HeroSlideshow />
        <div className="hero-shade" />
        <div className="container hero-content hero-content-refined">
          <p className="eyebrow">The Kut Shoppe · Barbershop and styling in Stroudsburg</p>
          <h1>Classic cuts. Modern styles. Your chair is waiting.</h1>
          <p className="lede">
            Haircuts, fades, tapers, beard work, locs, braids, twists, color, and hair care from a neighborhood crew serving the Pocono area.
          </p>
          <BookingChoices />
          <a className="hero-call" href={business.phoneHref}>
            Not sure which service to book? Call {business.phone}
          </a>
        </div>
        <a className="scroll-cue" href="#modern-twist" aria-label="Continue to the next section">
          <span />
        </a>
      </section>

      <section className="shop-quickfacts" aria-label="Shop information">
        <div className="container quickfacts-grid">
          <div>
            <span>Visit</span>
            <strong>518 Main Street</strong>
            <small>Downtown Stroudsburg</small>
          </div>
          <div>
            <span>Appointments</span>
            <strong>Recommended</strong>
            <small>Walk-ins based on availability</small>
          </div>
          <div>
            <span>Questions</span>
            <strong>{business.phone}</strong>
            <small>Call before your visit</small>
          </div>
        </div>
      </section>

      <section id="modern-twist" className="section ornament-section ornament-bg-3">
        <div className="container editorial-split">
          <div className="editorial-copy">
            <p className="eyebrow">A modern twist on classic cuts</p>
            <h2>A barbershop built around the people in the chair.</h2>
            <p className="lede">
              The Kut Shoppe pairs the welcoming atmosphere of a neighborhood barbershop with barbering, loc, braid, styling, color, and hair-care services for clients across generations.
            </p>
            <p>
              The experience is personal: take time to understand the look, provide a comfortable visit, and build the kind of relationship that keeps clients coming back.
            </p>
            <a className="text-link" href="/about">
              More about the shop <Arrow />
            </a>
          </div>
          <figure className="editorial-image offset-image">
            <img src={originalAssets.introPhoto} alt="Inside The Kut Shoppe" width="900" height="900" />
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
          <p>Explore barbering, grooming, styling, color, and hair-care services available through the shop.</p>
        </div>
        <div className="container service-icon-grid service-icon-grid-detailed">
          {serviceHighlights.map((service) => (
            <article className="service-icon-card" key={service.title}>
              <img src={service.icon} alt="" width="112" height="112" loading="lazy" />
              <h3>{service.title}</h3>
              <p>{service.description}</p>
              <a href={service.route} className="text-link">
                View services <Arrow />
              </a>
            </article>
          ))}
        </div>
        <div className="container service-booking-block">
          <p>Know what you need?</p>
          <BookingChoices compact />
        </div>
      </section>

      <section
        className="parallax-divider"
        style={{ backgroundImage: `url(${originalAssets.firstDivider})` }}
      >
        <div className="parallax-shade" />
        <div className="container divider-content">
          <p className="eyebrow">Come visit us today</p>
          <h2>Experience the art of grooming at its finest.</h2>
          <p>Barbering and styling services on Main Street in downtown Stroudsburg.</p>
          <a className="button" href="/book">
            Choose your appointment <Arrow />
          </a>
        </div>
      </section>

      <section className="section gallery-section ornament-section ornament-bg-5">
        <div className="container centered-heading">
          <p className="eyebrow">Real work from the shop</p>
          <h2>Best known for a great haircut—and much more.</h2>
          <p>Fades, tapers, scissor cuts, beard details, locs, braids, designs, kids cuts, and first-cut moments.</p>
        </div>
        <GalleryPreview />
        <div className="container centered-action">
          <a className="button button-secondary" href="/gallery">
            Explore the full gallery <Arrow />
          </a>
        </div>
      </section>

      <section className="section trust-section ornament-section ornament-bg-4">
        <div className="container editorial-split editorial-split-reverse">
          <figure className="editorial-image">
            <img src={originalAssets.trustPhoto} alt="The Kut Shoppe workspace" width="900" height="900" loading="lazy" />
          </figure>
          <div className="editorial-copy">
            <p className="eyebrow">Why choose us</p>
            <h2>A clean, personal, and carefully finished experience.</h2>
            <p className="lede">
              Great service is more than the final mirror check. It starts with a clean workspace, fresh client supplies, personal attention, and a professional appointment experience.
            </p>
            <ul className="standards-list">
              {shopStandards.map((standard) => (
                <li key={standard}>{standard}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <ReviewBand />

      <section className="section team-section ornament-section ornament-bg-9">
        <TeamShowcase />
      </section>

      <section className="section products-section ornament-section ornament-bg-8">
        <div className="container editorial-split">
          <div className="editorial-copy">
            <p className="eyebrow">Our merchandise</p>
            <h2>Keep the fresh look going between appointments.</h2>
            <p className="lede">
              Grooming and hair-care products are available through the shop to help maintain the finished look between visits.
            </p>
            <a className="text-link" href="/products">
              Product information <Arrow />
            </a>
          </div>
          <figure className="editorial-image product-image">
            <img src={originalAssets.productsPhoto} alt="Product display inside The Kut Shoppe" width="900" height="900" loading="lazy" />
          </figure>
        </div>
      </section>

      <section
        className="parallax-divider appointment-divider final-conversion"
        style={{ backgroundImage: `url(${originalAssets.secondDivider})` }}
      >
        <div className="parallax-shade parallax-shade-gradient" />
        <div className="container conversion-panel">
          <div className="conversion-copy">
            <p className="eyebrow">Make an appointment</p>
            <h2>Choose your service, then choose your time.</h2>
            <p>
              The Kut Shoppe is appointment-focused. Walk-ins are welcome when availability allows, and the shop is available by phone when you need help choosing the correct service.
            </p>
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
