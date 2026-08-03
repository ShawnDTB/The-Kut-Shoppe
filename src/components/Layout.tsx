import type { ReactNode } from 'react';
import { business } from '../data/site';
import { originalAssets } from '../data/visuals';

const primaryNavigation = [
  ['Services', '/services'],
  ['Gallery', '/gallery'],
  ['Team', '/team'],
  ['About', '/about'],
  ['Visit', '/visit'],
] as const;

const socialLinks = [
  ['Instagram', 'https://www.instagram.com/thekutshoppe/'],
  ['Facebook', 'https://www.facebook.com/TheKutShoppe/'],
] as const;

function isCurrentRoute(currentPath: string, href: string) {
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function Arrow() {
  return <span aria-hidden="true">→</span>;
}

function BookingMenu() {
  return (
    <details className="booking-menu">
      <summary>
        <span>Book now</span>
        <span className="booking-menu-chevron" aria-hidden="true" />
      </summary>
      <div className="booking-menu-panel">
        <div className="booking-menu-heading">
          <span>Appointments</span>
          <strong>Choose the service you need.</strong>
        </div>
        <a className="booking-menu-choice" href="/book#barber">
          <span>
            <small>Haircuts · fades · beards</small>
            <strong>Book with a barber</strong>
          </span>
          <Arrow />
        </a>
        <a className="booking-menu-choice" href="/book#styling">
          <span>
            <small>Locs · braids · styling</small>
            <strong>Book styling services</strong>
          </span>
          <Arrow />
        </a>
        <a className="booking-menu-all" href="/book">
          View all booking information
        </a>
      </div>
    </details>
  );
}

function Header({ currentPath }: { currentPath: string }) {
  return (
    <>
      <div className="utility-bar">
        <div className="container utility-inner">
          <a className="utility-location" href="/visit">
            <span className="utility-marker" aria-hidden="true" />
            518 Main Street · Downtown Stroudsburg
          </a>
          <span className="utility-hours">
            Appointment based · Walk-ins when availability allows
          </span>
          <a className="utility-phone" href={business.phoneHref}>
            Call {business.phone}
          </a>
        </div>
      </div>
      <header className="site-header">
        <div className="container header-inner header-inner-branded">
          <a className="brand brand-lockup" href="/" aria-label="The Kut Shoppe home">
            <span className="brand-emblem">
              <img src={originalAssets.logo} alt="" width="76" height="76" />
            </span>
            <span className="brand-copy">
              <strong>The Kut Shoppe</strong>
              <small>Classic barbering · Modern styling</small>
            </span>
          </a>

          <div className="menu-surface">
            <span className="menu-signature" aria-hidden="true" />
            <nav className="desktop-nav" aria-label="Primary navigation">
              <ul className="nav-list nav-list-branded">
                {primaryNavigation.map(([label, href]) => {
                  const current = isCurrentRoute(currentPath, href);
                  return (
                    <li key={href}>
                      <a href={href} aria-current={current ? 'page' : undefined}>
                        {label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          <div className="header-actions">
            <a
              className="header-call"
              href={business.phoneHref}
              aria-label={`Call The Kut Shoppe at ${business.phone}`}
            >
              <span className="header-call-label">Call the shop</span>
              <strong>{business.phone}</strong>
            </a>
            <BookingMenu />
          </div>

          <details className="mobile-nav mobile-nav-branded">
            <summary aria-label="Open navigation">
              <span className="mobile-menu-icon" aria-hidden="true">
                <i />
                <i />
              </span>
              <span>Menu</span>
            </summary>
            <nav aria-label="Mobile navigation">
              <div className="mobile-nav-heading">
                <span>Explore</span>
                <strong>The Kut Shoppe</strong>
              </div>
              {primaryNavigation.map(([label, href]) => {
                const current = isCurrentRoute(currentPath, href);
                return (
                  <a key={href} href={href} aria-current={current ? 'page' : undefined}>
                    {label}
                    <Arrow />
                  </a>
                );
              })}
              <div className="mobile-booking-group">
                <span>Book an appointment</span>
                <a href="/book#barber">Barber services</a>
                <a href="/book#styling">Locs, braids and styling</a>
              </div>
              <a className="mobile-call-link" href={business.phoneHref}>
                Call {business.phone}
              </a>
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
          <p>Classic barbering, modern styling, and a neighborhood shop experience in downtown Stroudsburg.</p>
          <div className="footer-socials" aria-label="The Kut Shoppe social media">
            {socialLinks.map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            ))}
          </div>
        </div>
        <div>
          <p className="footer-heading">Visit</p>
          <p>{business.address}</p>
          <a href={business.phoneHref}>{business.phone}</a>
          <a href="/visit">Directions and visit details</a>
        </div>
        <div>
          <p className="footer-heading">Information</p>
          <a href="/services">Services</a>
          <a href="/gallery">Gallery</a>
          <a href="/reviews">Reviews</a>
          <a href="/products">Products</a>
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

export function SiteLayout({
  children,
  currentPath,
}: {
  children: ReactNode;
  currentPath: string;
}) {
  return (
    <div className="site-shell">
      <Header currentPath={currentPath} />
      <main id="main-content">{children}</main>
      <Footer />
    </div>
  );
}
