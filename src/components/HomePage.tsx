import { business, team } from '../data/site';
import {
  shopClosedSummary,
  shopHours,
  shopHoursNote,
  shopHoursSummary,
} from '../data/hours';
import {
  galleryItems,
  originalAssets,
  serviceHighlights,
  shopStandards,
} from '../data/visuals';
import { Arrow } from './Layout';
import { LocationMap } from './LocationMap';

function HeroBackdrop() {
  return <div className="hero-static-media hero-shop-floor" aria-hidden="true"><img src={originalAssets.hero[0]} alt="" width="1600" height="900" loading="eager" fetchPriority="high" decoding="async" /></div>;
}

type BookingRailProps = {
  context: string;
  title: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  compact?: boolean;
};

function BookingRail({
  context,
  title,
  secondaryHref,
  secondaryLabel,
  compact = false,
}: BookingRailProps) {
  return (
    <div className={compact ? 'home-booking-rail home-booking-rail-compact' : 'home-booking-rail'}>
      <div className="home-booking-rail-copy">
        <span>{context}</span>
        <strong>{title}</strong>
      </div>
      <div className="home-booking-rail-actions">
        <a className="button home-booking-primary" href="/book">Book now <Arrow /></a>
        {secondaryHref && secondaryLabel ? <a className="home-booking-secondary" href={secondaryHref}>{secondaryLabel}</a> : null}
      </div>
    </div>
  );
}

function ServicesOverview() {
  return (
    <section id="services" className="section compact-services ornament-section ornament-bg-3">
      <div className="container services-chair-intro">
        <div className="services-chair-copy">
          <p className="eyebrow">Proudly serving the Poconos</p>
          <h2>You know the look. We will take care of the rest.</h2>
          <p className="lede">Fresh fade, clean line-up, beard work, a first cut for the little one, or loc and braid work. Tell us what you are going for and we will get you in the right chair.</p>
          <p className="services-owner-note">Barbering and loc care on Main Street in downtown Stroudsburg.</p>
        </div>
        <figure className="services-chair-photo"><img src={originalAssets.introPhoto} alt="A barber at The Kut Shoppe actively cutting a client’s hair" width="1000" height="760" loading="lazy" decoding="async" /><figcaption>A cut in progress at The Kut Shoppe</figcaption></figure>
      </div>
      <div className="container service-icon-strip">{serviceHighlights.map((service) => <a className="service-icon-link" href={service.route} key={service.title}><img src={service.icon} alt="" width="88" height="88" loading="lazy" decoding="async" /><span>{service.title}</span></a>)}</div>
      <div className="container services-booking-rail-wrap">
        <BookingRail
          compact
          context="Haircuts · beard work · kids cuts · locs and styling"
          title="View services or book your chair."
          secondaryHref="/services"
          secondaryLabel="Services and pricing"
        />
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
          <p className="eyebrow">Real work. Real appointments.</p><h2>Check the work out. Then choose your chair.</h2><p>Fades, tapers, scissor cuts, beard details, locs, braids, designs, and kids cuts from the shop gallery.</p>
          <ul className="trust-shortlist">{standards.map((standard) => <li key={standard}>{standard}</li>)}</ul>
          <div className="proof-actions"><a className="button button-secondary" href="/gallery">View the full gallery <Arrow /></a><a className="text-link" href="/reviews">Read client reviews <Arrow /></a></div>
        </div>
        <div className="compact-gallery" aria-label="Featured work from The Kut Shoppe">{previewItems.map((item) => <figure key={item.src}><img src={item.src} alt={item.alt} width="640" height="640" loading="lazy" decoding="async" /><figcaption><strong>{item.title}</strong><span>{item.category}</span></figcaption></figure>)}</div>
      </div>
    </section>
  );
}

function AboutAndCrew() {
  return (
    <section id="about" className="section compact-about ornament-section ornament-bg-4">
      <div className="container compact-about-grid">
        <figure className="compact-about-image"><img src={originalAssets.trustPhoto} alt="The Kut Shoppe prepared for a client visit" width="1000" height="760" loading="lazy" decoding="async" /></figure>
        <div className="compact-about-copy">
          <p className="eyebrow">A modern twist on classic cuts</p><h2>A Main Street shop built around the person in the chair.</h2><p className="lede">The Kut Shoppe brings barbers and a loctician together in downtown Stroudsburg, a few steps away from the Sherman Theater.</p>
          <div className="compact-crew-grid" aria-label="The Kut Shoppe crew">{team.map((member) => <a className="compact-crew-card" href="/book" key={member.name}>{member.photo ? <img src={member.photo} alt="" width="112" height="112" loading="lazy" decoding="async" /> : <span className="compact-crew-monogram" aria-hidden="true">CS</span>}<span><strong>{member.shortName}</strong><small>{member.bookingType === 'styling' ? 'Loctician' : member.specialty}</small></span></a>)}</div>
          <a className="text-link" href="/team">Meet the crew <Arrow /></a>
        </div>
      </div>
    </section>
  );
}

function ShopTeaser() {
  return (
    <section className="shop-teaser shop-teaser-solid" aria-labelledby="shop-teaser-heading">
      <div className="container shop-teaser-grid"><img src={originalAssets.productsPhoto} alt="Product display inside The Kut Shoppe" width="520" height="420" loading="lazy" decoding="async" /><div><p className="eyebrow">Products from the shop</p><h2 id="shop-teaser-heading">Keep the fresh look going.</h2><p>Shop published books, grooming products, hair care, accessories, and approved Kut Shoppe merchandise.</p></div><a className="button button-secondary" href="/shop">Visit the shop <Arrow /></a></div>
    </section>
  );
}

export function HomePage() {
  return (
    <>
      <section className="hero compact-hero hero-focused">
        <HeroBackdrop /><div className="hero-shade" />
        <div className="container hero-content hero-content-minimal">
          <div className="hero-glass-panel hero-glass-panel-hours">
            <p className="eyebrow">The Kut Shoppe · Downtown Stroudsburg</p>
            <h1 className="hero-accessible-title">The Kut Shoppe barbershop and loc care in downtown Stroudsburg</h1>
            <p className="hero-lead">Fresh cuts. Great conversations. Right here on Main Street.</p>
            <div className="hero-hours-panel hero-hours-daily" aria-label="Shop hours"><div className="hero-hours-heading"><span>Shop hours</span><small>Walk-in reference</small></div><dl>{shopHours.map((entry) => <div key={entry.days}><dt>{entry.days}</dt><dd>{entry.hours}</dd></div>)}</dl><p>{shopHoursNote}</p></div>
            <BookingRail
              compact
              context="Barber appointments · same-day waitlist · Loctician direction"
              title="Choose Barber or Loctician."
            />
          </div>
        </div>
        <a className="scroll-cue" href="#services" aria-label="Continue to services"><span /></a>
      </section>

      <section className="shop-quickfacts compact-quickfacts" aria-label="Shop information"><div className="container quickfacts-grid"><a href="/visit"><span>Visit</span><strong>518 Main Street</strong><small>A few steps away from the Sherman Theater</small></a><a href="/visit"><span>Hours</span><strong>{shopHoursSummary}</strong><small>{shopClosedSummary}</small></a><a href={business.phoneHref}><span>Questions</span><strong>{business.phone}</strong><small>Call the shop directly</small></a></div></section>

      <ServicesOverview />
      <WorkAndTrust />
      <AboutAndCrew />
      <ShopTeaser />

      <section id="visit" className="section location-conversion">
        <div className="container location-conversion-grid">
          <div className="conversion-copy location-conversion-copy">
            <p className="eyebrow">Ready for the next one?</p>
            <h2>Your chair is ready.</h2>
            <p>Choose a Barber or Loctician. When today’s barber schedule is full, the waitlist appears automatically.</p>
            <div className="location-booking-actions"><a className="button" href="/book">Book now <Arrow /></a><a className="text-link" href={business.phoneHref}>Call {business.phone}</a></div>
          </div>
          <LocationMap />
        </div>
      </section>
    </>
  );
}
