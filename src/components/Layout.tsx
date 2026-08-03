import { useEffect, useId, useState, type ReactNode } from 'react';
import { business } from '../data/site';
import {
  shopClosedSummary,
  shopHours,
  shopHoursNote,
  shopHoursSummary,
} from '../data/hours';
import { originalAssets } from '../data/visuals';

const primaryNavigation = [
  ['Services', '/services'],
  ['Gallery', '/gallery'],
  ['Crew', '/team'],
  ['Shop', '/shop'],
] as const;

const secondaryNavigation = [
  ['Visit', '/visit'],
  ['Reviews', '/reviews'],
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

function CustomerActions({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  return (
    <div className={mobile ? 'customer-header-actions customer-header-actions-mobile' : 'customer-header-actions'}>
      <a className="customer-action customer-action-book" href="/book" onClick={onNavigate}>Book now</a>
      <a className="customer-action customer-action-account" href="/account" onClick={onNavigate}>Account / Login</a>
    </div>
  );
}

function MobileNavigation({ currentPath }: { currentPath: string }) {
  const [open, setOpen] = useState(false);
  const drawerId = useId();

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className={`mobile-navigation${open ? ' is-open' : ''}`}>
      <button
        className="mobile-nav-trigger"
        type="button"
        aria-expanded={open}
        aria-controls={drawerId}
        onClick={() => setOpen(true)}
      >
        <span className="mobile-menu-icon" aria-hidden="true"><i /><i /></span>
        <span>Menu</span>
      </button>

      {open ? (
        <div className="mobile-nav-overlay">
          <button className="mobile-nav-backdrop" type="button" aria-label="Close navigation" onClick={close} />
          <aside className="mobile-nav-drawer" id={drawerId} aria-modal="true" aria-label="Site navigation">
            <div className="mobile-drawer-header">
              <a className="mobile-drawer-brand" href="/" onClick={close}>
                <img src={originalAssets.logo} alt="" width="58" height="58" />
                <span><strong>The Kut Shoppe</strong><small>Downtown Stroudsburg</small></span>
              </a>
              <button className="mobile-nav-close" type="button" aria-label="Close navigation" onClick={close}><span aria-hidden="true" /></button>
            </div>

            <nav className="mobile-drawer-content" aria-label="Mobile navigation">
              <div className="mobile-primary-links">
                {primaryNavigation.map(([label, href]) => {
                  const current = isCurrentRoute(currentPath, href);
                  return <a key={href} href={href} aria-current={current ? 'page' : undefined} onClick={close}>{label}<Arrow /></a>;
                })}
              </div>
              <div className="mobile-secondary-links">{secondaryNavigation.map(([label, href]) => <a key={href} href={href} onClick={close}>{label}<Arrow /></a>)}</div>
              <div className="mobile-booking-group"><span>Appointments and account</span><CustomerActions mobile onNavigate={close} /></div>
              <div className="mobile-hours-card">
                <div className="mobile-hours-heading"><span>Shop hours</span><small>Walk-in reference</small></div>
                <dl>{shopHours.map((entry) => <div key={entry.days}><dt>{entry.days}</dt><dd>{entry.hours}</dd></div>)}</dl>
                <small>{shopHoursNote}</small>
              </div>
              <a className="mobile-call-link" href={business.phoneHref} onClick={close}>Call {business.phone}</a>
              <a className="mobile-staff-link" href="/staff/login" onClick={close}>Staff portal</a>
            </nav>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function Header({ currentPath }: { currentPath: string }) {
  return (
    <>
      <div className="utility-bar">
        <div className="container utility-inner">
          <a className="utility-location" href="/visit"><span className="utility-marker" aria-hidden="true" />518 Main Street · Downtown Stroudsburg</a>
          <span className="utility-hours">{shopHoursSummary} · {shopClosedSummary}</span>
          <a className="utility-phone" href={business.phoneHref}>Call {business.phone}</a>
        </div>
      </div>

      <header className="site-header">
        <div className="container header-inner header-inner-branded">
          <a className="brand brand-lockup" href="/" aria-label="The Kut Shoppe home">
            <span className="brand-emblem"><img src={originalAssets.logo} alt="" width="76" height="76" /></span>
            <span className="brand-copy"><strong>The Kut Shoppe</strong><small>Classic barbering · Modern styling</small></span>
          </a>

          <div className="header-navigation-surface">
            <div className="menu-surface">
              <nav className="desktop-nav" aria-label="Primary navigation">
                <ul className="nav-list nav-list-branded">{primaryNavigation.map(([label, href]) => { const current = isCurrentRoute(currentPath, href); return <li key={href}><a href={href} aria-current={current ? 'page' : undefined}>{label}</a></li>; })}</ul>
              </nav>
            </div>
            <div className="header-actions header-actions-direct">
              <a className="header-call" href={business.phoneHref} aria-label={`Call The Kut Shoppe at ${business.phone}`}><span className="header-call-label">Call the shop</span><strong>{business.phone}</strong></a>
              <CustomerActions />
            </div>
          </div>

          <MobileNavigation currentPath={currentPath} />
        </div>
      </header>
    </>
  );
}

function Footer() {
  return (
    <footer className="site-footer footer-refined">
      <div className="container footer-topline">
        <div className="footer-brand-refined">
          <img src={originalAssets.logo} alt="The Kut Shoppe" width="112" height="112" loading="lazy" decoding="async" />
          <div><p className="eyebrow">The Kut Shoppe</p><p className="footer-statement">Good cuts. Personal service. A chair you know on Main Street.</p></div>
        </div>
        <div className="footer-booking-links" aria-label="Customer actions"><a href="/book"><span>Book now →</span></a><a href="/account"><span>Account / Login →</span></a></div>
      </div>

      <div className="container footer-main-grid">
        <div className="footer-visit-block"><p className="footer-heading">Visit</p><strong>518 Main Street</strong><span>Stroudsburg, PA 18360</span><a href={business.phoneHref}>{business.phone}</a><a href="/visit">Directions and visit details <Arrow /></a></div>
        <div className="footer-hours-block"><p className="footer-heading">Hours</p><strong>{shopHoursSummary}</strong><strong>{shopClosedSummary}</strong><small>{shopHoursNote}</small></div>
        <nav className="footer-link-group" aria-label="Explore The Kut Shoppe"><p className="footer-heading">Explore</p><a href="/services">Services and pricing</a><a href="/gallery">Full gallery</a><a href="/team">Meet the crew</a><a href="/shop">Shop</a><a href="/account">Customer account</a></nav>
        <div className="footer-link-group"><p className="footer-heading">Connect</p><a href="/reviews">Client reviews</a>{socialLinks.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noopener noreferrer">{label} <span aria-hidden="true">↗</span></a>)}<a href="/staff/login">Staff portal</a></div>
      </div>

      <div className="container footer-bottom footer-bottom-refined"><span>© {new Date().getFullYear()} The Kut Shoppe LLC</span><div><a href="/privacy">Privacy</a><a href="/terms">Terms</a><span>Platform by Designed to Breakthrough LLC</span></div></div>
    </footer>
  );
}

export function SiteLayout({ children, currentPath }: { children: ReactNode; currentPath: string }) {
  return <div className="site-shell"><Header currentPath={currentPath} /><main id="main-content">{children}</main><Footer /></div>;
}
