import {
  accountBoundary,
  accountCapabilities,
  shopCategories,
  shopLaunchCapabilities,
  type PlatformStatus,
} from '../data/commerce';
import {
  shopClosedSummary,
  shopHours,
  shopHoursNote,
  shopHoursSummary,
} from '../data/hours';
import {
  bookingPaths,
  business,
  getBookingPath,
  services,
  team,
} from '../data/site';
import { originalAssets } from '../data/visuals';
import { Arrow } from './Layout';

function ExternalArrow() {
  return <span aria-hidden="true">↗</span>;
}

function PlatformStatusBadge({ status }: { status: PlatformStatus }) {
  const label = status === 'available-now'
    ? 'Available now'
    : status === 'requires-approval'
      ? 'Pending approval'
      : 'In development';

  return <span className={`customer-status customer-status-${status}`}>{label}</span>;
}

function BookingAction({ type, className = 'button' }: { type: 'barber' | 'styling'; className?: string }) {
  const booking = getBookingPath(type);

  return (
    <a
      className={className}
      href={booking.href}
      target="_blank"
      rel="noopener noreferrer"
      data-outbound-booking={type}
    >
      {booking.buttonLabel} <ExternalArrow />
    </a>
  );
}

const serviceBookingCopy: Record<string, string> = {
  '/services/haircuts': 'Specialty cuts, fades, tapers, buzz cuts, bald cuts, and line-ups for clients ages 13 and up.',
  '/services/beards-shaves': 'Haircut combinations with facial-hair detailing, beard line-ups, and head-and-face line-ups.',
  '/services/kids-cuts': 'Specialty cuts, buzz cuts, and head line-ups for children ages 3 through 12.',
  '/services/locs-braids': 'Loc maintenance, retwists, braids, twists, cornrows, consultations, and related loc care.',
  '/services/color-scalp-care': 'Ask about color, washing, detangling, drying, scalp care, and related hair-care services.',
};

const bookingHoursLabel = shopHours
  .map((entry) => `${entry.days}: ${entry.hours}`)
  .join(' · ');

export function BookingPage() {
  return (
    <section className="section customer-platform-page booking-platform-page">
      <div className="container route-wide">
        <header className="customer-platform-hero booking-platform-hero">
          <div className="customer-platform-hero-copy">
            <p className="eyebrow">Appointments</p>
            <h1>Start with what you need.</h1>
            <p className="lede">
              Choose barbering or loc care, then continue to the current schedule maintained by the professional.
            </p>
          </div>

          <div className="booking-router" aria-label="Primary booking options">
            {bookingPaths.map((path, index) => (
              <article className="booking-router-card" key={path.id}>
                <span className="customer-card-number" aria-hidden="true">0{index + 1}</span>
                <p className="eyebrow">{path.type === 'barber' ? 'Cuts, fades, and beard work' : 'Locs, braids, and retwists'}</p>
                <h2>{path.title}</h2>
                <p>{path.description}</p>
                <a
                  className="button"
                  href={path.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-outbound-booking={path.type}
                >
                  {path.buttonLabel} <ExternalArrow />
                </a>
              </article>
            ))}
          </div>
        </header>

        <section className="customer-platform-section" aria-labelledby="book-by-service-heading">
          <div className="customer-section-heading">
            <div>
              <p className="eyebrow">Choose by service</p>
              <h2 id="book-by-service-heading">Find the right booking path.</h2>
            </div>
            <a className="text-link" href="/services">View services and pricing <Arrow /></a>
          </div>

          <div className="booking-service-grid">
            {services.map((service) => {
              const booking = getBookingPath(service.bookingType);
              return (
                <article className="booking-service-card" key={service.route}>
                  <div>
                    <p className="eyebrow">{service.bookingType === 'barber' ? 'Barber' : 'Loctician'}</p>
                    <h3>{service.title}</h3>
                    <p>{serviceBookingCopy[service.route] ?? service.summary}</p>
                  </div>
                  <div className="booking-service-card-footer">
                    <a className="text-link" href={service.route}>Service details <Arrow /></a>
                    <a
                      className="text-link"
                      href={booking.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-outbound-booking={service.bookingType}
                    >
                      Book now <ExternalArrow />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="customer-platform-section booking-crew-section" aria-labelledby="book-by-professional-heading">
          <div className="customer-section-heading">
            <div>
              <p className="eyebrow">Choose by professional</p>
              <h2 id="book-by-professional-heading">Book the chair you know.</h2>
            </div>
            <a className="text-link" href="/team">Meet the full crew <Arrow /></a>
          </div>

          <div className="booking-professional-grid">
            {team.map((member) => (
              <article className="booking-professional-card" key={member.name}>
                {member.photo ? (
                  <img
                    src={member.photo}
                    alt={`Portrait of ${member.name}`}
                    width="320"
                    height="320"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="booking-professional-placeholder" aria-hidden="true">CS</div>
                )}
                <div>
                  <p className="eyebrow">{member.specialty}</p>
                  <h3>{member.name}</h3>
                  <a
                    className="text-link"
                    href={member.bookingHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-outbound-booking={member.bookingType}
                  >
                    Book with {member.shortName} <ExternalArrow />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="customer-platform-section booking-guidance-section" aria-labelledby="booking-guidance-heading">
          <div className="customer-section-heading">
            <div>
              <p className="eyebrow">Before you book</p>
              <h2 id="booking-guidance-heading">A few things to know.</h2>
            </div>
          </div>

          <div className="booking-guidance-grid">
            <article>
              <span aria-hidden="true">01</span>
              <h3>New clients</h3>
              <p>Start with the service you need. Call the shop when you are unsure which professional or booking path fits.</p>
            </article>
            <article>
              <span aria-hidden="true">02</span>
              <h3>Walk-ins</h3>
              <p>{business.walkIns} Posted shop hours are a walk-in reference rather than a guarantee of individual availability.</p>
            </article>
            <article>
              <span aria-hidden="true">03</span>
              <h3>Policies and availability</h3>
              <p>Current times, deposits, cancellation terms, and appointment policies are shown before confirmation in the professional’s booking profile.</p>
            </article>
          </div>
        </section>

        <section className="customer-help-panel" aria-label="Booking help">
          <div>
            <p className="eyebrow">Need help choosing?</p>
            <h2>Call and we will point you to the right chair.</h2>
            <p>{shopHoursSummary} · {shopClosedSummary}</p>
            <small>{bookingHoursLabel}</small>
          </div>
          <a className="button" href={business.phoneHref}>Call {business.phone}</a>
        </section>
      </div>
    </section>
  );
}

export function ShopPage() {
  return (
    <section className="section customer-platform-page shop-platform-page">
      <div className="container route-wide">
        <header className="customer-platform-hero customer-platform-hero-split shop-platform-hero">
          <div className="customer-platform-hero-copy">
            <p className="eyebrow">The Kut Shoppe store</p>
            <h1>Keep the fresh look going.</h1>
            <p className="lede">
              The online shop is being built around products the shop actually carries, recommends, and approves.
            </p>
            <div className="customer-platform-actions">
              <a className="button" href={business.phoneHref}>Ask what is in store</a>
              <a className="button button-secondary" href="/account">Preview customer accounts</a>
            </div>
          </div>

          <figure className="shop-platform-photo">
            <img
              src={originalAssets.productsPhoto}
              alt="The Kut Shoppe display case with in-store products and accessories"
              width="900"
              height="1100"
              fetchPriority="high"
              decoding="async"
            />
            <figcaption>Current in-store availability can be confirmed by phone or during an appointment.</figcaption>
          </figure>
        </header>

        <div className="shop-principle-strip" aria-label="Online shop principles">
          <span>Verified products only</span>
          <span>No placeholder inventory</span>
          <span>Secure checkout before launch</span>
        </div>

        <section className="customer-platform-section" aria-labelledby="shop-categories-heading">
          <div className="customer-section-heading">
            <div>
              <p className="eyebrow">Catalog foundation</p>
              <h2 id="shop-categories-heading">Built around what belongs in the shop.</h2>
            </div>
          </div>

          <div className="shop-platform-category-grid">
            {shopCategories.map((category, index) => (
              <article className="shop-platform-category-card" key={category.slug}>
                <span className="customer-card-number" aria-hidden="true">0{index + 1}</span>
                <p className="eyebrow">Catalog preparation</p>
                <h3>{category.name}</h3>
                <p>{category.description}</p>
                <small>Products will appear after inventory, pricing, photos, and fulfillment are approved.</small>
              </article>
            ))}
          </div>
        </section>

        <section className="customer-platform-section" aria-labelledby="shop-launch-heading">
          <div className="customer-section-heading">
            <div>
              <p className="eyebrow">Built before opened</p>
              <h2 id="shop-launch-heading">A store customers can trust.</h2>
            </div>
          </div>

          <div className="customer-capability-grid">
            {shopLaunchCapabilities.map((capability) => (
              <article key={capability.title}>
                <PlatformStatusBadge status={capability.status} />
                <h3>{capability.title}</h3>
                <p>{capability.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="shop-today-panel">
          <div>
            <p className="eyebrow">Available today</p>
            <h2>Shop the display case on Main Street.</h2>
            <p>Ask about current grooming, hair-care, accessory, and Kut Shoppe merchandise during your next visit.</p>
          </div>
          <div className="shop-today-actions">
            <a className="button" href={business.phoneHref}>Call {business.phone}</a>
            <a className="button button-secondary" href="/visit">Plan your visit</a>
          </div>
        </section>
      </div>
    </section>
  );
}

export function AccountPage() {
  return (
    <section className="section customer-platform-page account-platform-page">
      <div className="container route-wide">
        <header className="customer-platform-hero customer-platform-hero-split account-platform-hero">
          <div className="customer-platform-hero-copy">
            <p className="eyebrow">Customer accounts</p>
            <h1>A simpler way to return to the shop.</h1>
            <p className="lede">
              Account access will launch with first-party online ordering. No login is collected until secure commerce is ready.
            </p>
            <div className="customer-platform-actions">
              <a className="button" href="/shop">Explore the shop foundation</a>
              <a className="button button-secondary" href="/book">Book an appointment</a>
            </div>
          </div>

          <div className="account-preview" aria-label="Planned customer account preview">
            <div className="account-preview-header">
              <img src={originalAssets.logo} alt="" width="64" height="64" />
              <div>
                <span>Account preview</span>
                <strong>The Kut Shoppe</strong>
              </div>
              <PlatformStatusBadge status="in-development" />
            </div>
            <div className="account-preview-body">
              <div>
                <small>Orders</small>
                <strong>Order history will appear here.</strong>
              </div>
              <div>
                <small>Saved details</small>
                <strong>Optional checkout details, controlled by you.</strong>
              </div>
              <div>
                <small>Fulfillment</small>
                <strong>Pickup or shipping updates after approval.</strong>
              </div>
            </div>
            <button type="button" disabled>Sign in coming with online ordering</button>
          </div>
        </header>

        <section className="customer-platform-section" aria-labelledby="account-tools-heading">
          <div className="customer-section-heading">
            <div>
              <p className="eyebrow">Planned account tools</p>
              <h2 id="account-tools-heading">Useful features, not another required profile.</h2>
            </div>
          </div>

          <div className="customer-capability-grid account-capability-grid">
            {accountCapabilities.map((capability) => (
              <article key={capability.title}>
                <PlatformStatusBadge status={capability.status} />
                <h3>{capability.title}</h3>
                <p>{capability.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="account-boundary-panel">
          <div>
            <p className="eyebrow">Booking stays simple</p>
            <h2>Accounts will support shopping, not get between you and the chair.</h2>
            <p>{accountBoundary}</p>
          </div>
          <div className="account-boundary-actions">
            <BookingAction type="barber" />
            <BookingAction type="styling" className="button button-secondary" />
          </div>
        </section>

        <section className="customer-platform-section account-privacy-section" aria-labelledby="account-privacy-heading">
          <div className="customer-section-heading">
            <div>
              <p className="eyebrow">Privacy by design</p>
              <h2 id="account-privacy-heading">No account before the foundation is secure.</h2>
            </div>
          </div>
          <div className="account-privacy-grid">
            <p>Account access remains disabled until authentication, checkout, privacy, order storage, and recovery workflows are production ready.</p>
            <p>Customers will not be required to create an account to browse approved products. Guest checkout support will be evaluated during commerce implementation.</p>
            <p>The site will collect only the information needed to complete the customer’s chosen transaction or request.</p>
          </div>
        </section>

        <section className="customer-help-panel" aria-label="Current customer options">
          <div>
            <p className="eyebrow">What works today</p>
            <h2>Book, call, browse the work, or visit the shop.</h2>
            <p>{shopHoursNote}</p>
          </div>
          <div className="customer-platform-actions">
            <a className="button" href="/book">Book an appointment</a>
            <a className="button button-secondary" href={business.phoneHref}>Call {business.phone}</a>
          </div>
        </section>
      </div>
    </section>
  );
}
