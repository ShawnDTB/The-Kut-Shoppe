import type { MouseEvent, ReactNode } from 'react';
import { bookingPaths, business } from '../data/site';
import { originalAssets } from '../data/visuals';

const primaryNavigation = [
  ['Services', '/#services'],
  ['Work', '/#work'],
  ['About', '/#about'],
  ['Shop', '/shop'],
] as const;

const secondaryNavigation = [
  ['Meet the team', '/team'],
  ['Visit the shop', '/visit'],
  ['Client reviews', '/reviews'],
] as const;

const socialLinks = [
  ['Instagram', 'https://www.instagram.com/thekutshoppe/'],
  ['Facebook', 'https://www.facebook.com/TheKutShoppe/'],
] as const;

function isCurrentRoute(currentPath: string, href: string) {
  if (href.includes('#')) return false;
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

function handleSectionLink(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (!href.startsWith('/#') || window.location.pathname !== '/') return;

  const section = document.getElementById(href.slice(2));
  if (!section) return;

  event.preventDefault();
  window.history.replaceState(null, '', href.slice(1));
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function Arrow() {
  return <span aria-hidden="true">→</span>;
}

function ProviderBookingActions({ mobile = false }: { mobile?: boolean }) {
  return (
    <div className={mobile ? 'provider-booking-actions provider-booking-actions-mobile' : 'provider-booking-actions'}>
      {bookingPaths.map((path) => (
        <a
          className={`provider-booking-link provider-booking-${path.type}`}
          href={path.href}
          key={path.id}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>{path.shortTitle}</span>
          <small>{path.provider}</small>
        </a>
      ))}
    </div>
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
                      <a
                        href={href}
                        aria-current={current ? 'page' : undefined}
                        onClick={(event) => handleSectionLink(event, href)}
                      >
                        {label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          <div className="header-actions header-actions-direct">
            <a
              className="header-call"
              href={business.phoneHref}
              aria-label={`Call The Kut Shoppe at ${business.phone}`}
            >
              <span className="header-call-label">Call the shop</span>
              <strong>{business.phone}</strong>
            </a>
            <ProviderBookingActions />
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
                  <a
                    key={href}
                    href={href}
                    aria-current={current ? 'page' : undefined}
                    onClick={(event) => handleSectionLink(event, href)}
                  >
                    {label}
                    <Arrow />
                  </a>
                );
              })}
              <div className="mobile-secondary-links">
                {secondaryNavigation.map(([label, href]) => (
                  <a key={href} href={href}>{label}</a>
                ))}
              </div>
              <div className="mobile-booking-group">
                <span>Book directly</span>
                <ProviderBookingActions mobile />
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
          <img src={originalAssets.logo} alt="The Kut Shoppe" width="120" height="120" loading="lazy" decoding="async" />
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
          <a href="/services">Services and pricing</a>
          <a href="/gallery">Full gallery</a>
          <a href="/team">Team</a>
          <a href="/reviews">Reviews</a>
          <a href="/shop">Shop</a>
          <a href="/#about">About</a>
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
