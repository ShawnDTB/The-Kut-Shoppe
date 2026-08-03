import type { ReactNode } from 'react';
import { business, navigation } from '../data/site';
import { originalAssets } from '../data/visuals';

export function Arrow() {
  return <span aria-hidden="true">→</span>;
}

function Header() {
  return (
    <>
      <div className="utility-bar">
        <div className="container utility-inner">
          <span>{business.address}</span>
          <span className="utility-hours">Appointments recommended · Walk-ins based on availability</span>
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
          <a className="header-phone" href={business.phoneHref} aria-label={`Call The Kut Shoppe at ${business.phone}`}>
            Call
          </a>
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
              <a href={business.phoneHref}>Call the shop</a>
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
          <p>Classic barbering, modern styling, and a neighborhood shop experience in downtown Stroudsburg.</p>
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

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      <Header />
      <main id="main-content">{children}</main>
      <Footer />
    </div>
  );
}
