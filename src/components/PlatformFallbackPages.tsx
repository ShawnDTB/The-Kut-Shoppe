import { bookingPaths, business } from '../data/site';
import { originalAssets } from '../data/visuals';

export function BookingFallbackPage() {
  return (
    <section className="section platform-fallback-page platform-pattern platform-pattern-tools">
      <div className="container route-wide">
        <header className="platform-fallback-header">
          <div>
            <p className="eyebrow">Appointments</p>
            <h1>Choose the service you need.</h1>
            <p className="lede">
              The Kut Shoppe’s first-party appointment system is being prepared for launch. Current schedules remain available through the professionals’ existing booking pages during the transition.
            </p>
          </div>
        </header>

        <div className="platform-fallback-choice-grid">
          {bookingPaths.map((path, index) => (
            <article key={path.id}>
              <span aria-hidden="true">0{index + 1}</span>
              <p className="eyebrow">{path.type === 'barber' ? 'Cuts, fades, line-ups, and beard work' : 'Locs, braids, retwists, and styling'}</p>
              <h2>{path.type === 'barber' ? 'Barber services' : 'Loctician services'}</h2>
              <p>{path.description}</p>
              <a className={path.type === 'barber' ? 'button' : 'button button-secondary'} href={path.href} target="_blank" rel="noopener noreferrer">
                {path.buttonLabel} <span aria-hidden="true">↗</span>
              </a>
            </article>
          ))}
        </div>

        <div className="platform-fallback-help">
          <div><p className="eyebrow">Need help choosing?</p><h2>Call the shop and we will point you to the right chair.</h2></div>
          <a className="button button-secondary" href={business.phoneHref}>Call {business.phone}</a>
        </div>
      </div>
    </section>
  );
}

export function ShopFallbackPage() {
  return (
    <section className="section platform-fallback-page platform-pattern platform-pattern-products">
      <div className="container route-wide">
        <div className="platform-fallback-split">
          <div>
            <p className="eyebrow">The Kut Shoppe store</p>
            <h1>The verified online catalog is being prepared.</h1>
            <p className="lede">
              The upcoming store will support the shop’s real book inventory, durags, combs, picks, gels, hair-care products, pickup, and shipping without publishing placeholder stock.
            </p>
            <div className="commerce-inline-actions">
              <a className="button" href={business.phoneHref}>Ask what is available</a>
              <a className="button button-secondary" href="/visit">Visit the shop</a>
            </div>
          </div>
          <figure>
            <img src={originalAssets.productsPhoto} alt="Product display inside The Kut Shoppe" width="900" height="900" loading="eager" decoding="async" />
            <figcaption>Current in-store inventory can be confirmed by phone or during an appointment.</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

export function AccountFallbackPage() {
  return (
    <section className="section platform-fallback-page platform-pattern platform-pattern-poles">
      <div className="container narrow-container">
        <div className="platform-fallback-account">
          <img src={originalAssets.logo} alt="The Kut Shoppe" width="112" height="112" />
          <p className="eyebrow">Customer account</p>
          <h1>Account access is not live yet.</h1>
          <p className="lede">
            The universal Account is being built to connect barber appointments, waitlist requests, product orders, pickup, shipping, receipts, and customer updates. Sign-in will open only after secure sessions, verification delivery, and production data storage are connected.
          </p>
          <div className="commerce-inline-actions">
            <a className="button" href="/book">Book now</a>
            <a className="button button-secondary" href="/shop">Visit the Shop</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PrivatePlatformFallbackPage({ area }: { area: string }) {
  return (
    <section className="section platform-fallback-page platform-pattern platform-pattern-poles">
      <div className="container narrow-container">
        <div className="platform-fallback-account">
          <p className="eyebrow">Private platform</p>
          <h1>{area} is not enabled in production.</h1>
          <p>
            This protected workflow remains available for local development and review while authentication, permissions, D1 persistence, transactional messaging, and audit controls are completed.
          </p>
          <a className="button" href="/">Return to the website</a>
        </div>
      </div>
    </section>
  );
}
