import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { business } from '../data/site';
import { shopClosedSummary, shopHours, shopHoursNote, shopHoursSummary } from '../data/hours';
import { originalAssets } from '../data/visuals';
import {
  getPlatformSessionAccount,
  subscribeToPlatformAuth,
  type PlatformAccount,
} from '../data/auth-v2';
import { readCart, subscribeToStorefrontChanges } from '../data/storefront';

const primaryNavigation = [
  ['Services', '/services'],
  ['Gallery', '/gallery'],
  ['Crew', '/team'],
  ['Shop', '/shop'],
  ['Reviews', '/reviews'],
] as const;

const socialLinks = [
  ['Instagram', 'https://www.instagram.com/thekutshoppe/'],
  ['Facebook', 'https://www.facebook.com/TheKutShoppe/'],
] as const;

function isCurrentRoute(currentPath: string, href: string) {
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

function accountLabel(account: PlatformAccount | null) {
  if (!account) return 'Account / Login';
  if (account.role === 'customer') return account.name.trim().split(/\s+/)[0] || 'Account';
  return `${account.role.charAt(0).toUpperCase()}${account.role.slice(1)} dashboard`;
}

export function ArrowV5() {
  return <span aria-hidden="true">→</span>;
}

function CustomerActions({
  account,
  cartCount,
  mobile = false,
  onNavigate,
}: {
  account: PlatformAccount | null;
  cartCount: number;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const accountHref = account && account.role !== 'customer' ? '/dashboard' : '/account';
  return (
    <div className={mobile ? 'customer-header-actions customer-header-actions-mobile' : 'customer-header-actions'}>
      <a className="customer-action customer-action-cart" href="/cart" onClick={onNavigate}>Cart <span>{cartCount}</span></a>
      <a className="customer-action customer-action-account" href={accountHref} onClick={onNavigate}>{accountLabel(account)}</a>
      <a className="customer-action customer-action-book" href="/book" onClick={onNavigate}>Book now</a>
    </div>
  );
}

function MobileNavigation({
  currentPath,
  account,
  cartCount,
}: {
  currentPath: string;
  account: PlatformAccount | null;
  cartCount: number;
}) {
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 981px)');
    const closeAtDesktop = () => {
      if (media.matches) setOpen(false);
    };
    media.addEventListener('change', closeAtDesktop);
    window.addEventListener('resize', closeAtDesktop);
    return () => {
      media.removeEventListener('change', closeAtDesktop);
      window.removeEventListener('resize', closeAtDesktop);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const scrollY = window.scrollY;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.inset = `-${scrollY}px 0 0`;
    window.requestAnimationFrame(() => {
      drawerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
      closeButtonRef.current?.focus();
    });
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.inset = '';
      window.scrollTo({ top: scrollY, behavior: 'instant' });
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const close = () => setOpen(false);
  const overlay = open && typeof document !== 'undefined' ? createPortal(
    <div className="mobile-nav-overlay mobile-nav-overlay-v5">
      <button className="mobile-nav-backdrop" type="button" aria-label="Close navigation" onClick={close} />
      <aside ref={drawerRef} className="mobile-nav-drawer mobile-nav-drawer-v5" id={drawerId} role="dialog" aria-modal="true" aria-label="Site navigation">
        <div className="mobile-drawer-header">
          <a className="mobile-drawer-brand" href="/" onClick={close}>
            <img src={originalAssets.logo} alt="" width="58" height="58" />
            <span><strong>The Kut Shoppe</strong><small>Downtown Stroudsburg</small></span>
          </a>
          <button ref={closeButtonRef} className="mobile-nav-close" type="button" aria-label="Close navigation" onClick={close}><span aria-hidden="true" /></button>
        </div>

        <nav className="mobile-drawer-content mobile-drawer-content-v5" aria-label="Mobile navigation">
          <div className="mobile-primary-links mobile-primary-links-v5">
            {primaryNavigation.map(([label, href]) => {
              const current = isCurrentRoute(currentPath, href);
              return <a key={href} href={href} aria-current={current ? 'page' : undefined} onClick={close}>{label}<ArrowV5 /></a>;
            })}
          </div>
          <div className="mobile-booking-group mobile-booking-group-v5"><CustomerActions account={account} cartCount={cartCount} mobile onNavigate={close} /></div>
          <details className="mobile-visit-details">
            <summary>Hours and visit information <ArrowV5 /></summary>
            <div className="mobile-hours-card mobile-hours-card-detailed">
              <div className="mobile-hours-heading"><span>Shop hours</span><small>Walk-in reference</small></div>
              <dl>{shopHours.map((entry) => <div key={entry.days}><dt>{entry.days}</dt><dd>{entry.hours}</dd></div>)}</dl>
              <small>{shopHoursNote}</small>
              <a href="/visit" onClick={close}>Directions and visit details <ArrowV5 /></a>
            </div>
          </details>
          <a className="mobile-call-link" href={business.phoneHref} onClick={close}>Call {business.phone}</a>
        </nav>
      </aside>
    </div>,
    document.body,
  ) : null;

  return (
    <div className={`mobile-navigation${open ? ' is-open' : ''}`}>
      <button className="mobile-nav-trigger" type="button" aria-expanded={open} aria-controls={drawerId} onClick={() => setOpen(true)}>
        <span className="mobile-menu-icon" aria-hidden="true"><i /><i /></span><span>Menu</span>
      </button>
      {overlay}
    </div>
  );
}

function Header({ currentPath }: { currentPath: string }) {
  const [account, setAccount] = useState<PlatformAccount | null>(() => getPlatformSessionAccount());
  const [cartCount, setCartCount] = useState(() => readCart().reduce((total, item) => total + item.quantity, 0));

  useEffect(() => {
    const unsubscribeAuth = subscribeToPlatformAuth(() => setAccount(getPlatformSessionAccount()));
    const unsubscribeStore = subscribeToStorefrontChanges(() => setCartCount(readCart().reduce((total, item) => total + item.quantity, 0)));
    return () => { unsubscribeAuth(); unsubscribeStore(); };
  }, []);

  return (
    <>
      <div className="utility-bar"><div className="container utility-inner"><a className="utility-location" href="/visit"><span className="utility-marker" aria-hidden="true" />518 Main Street · Downtown Stroudsburg</a><span className="utility-hours">{shopHoursSummary} · {shopClosedSummary}</span><a className="utility-phone" href={business.phoneHref}>Call {business.phone}</a></div></div>
      <header className="site-header"><div className="container header-inner header-inner-branded">
        <a className="brand brand-lockup" href="/" aria-label="The Kut Shoppe home"><span className="brand-emblem"><img src={originalAssets.logo} alt="" width="76" height="76" /></span><span className="brand-copy"><strong>The Kut Shoppe</strong><small>Classic barbering · Modern styling</small></span></a>
        <div className="header-navigation-surface"><div className="menu-surface"><nav className="desktop-nav" aria-label="Primary navigation"><ul className="nav-list nav-list-branded">{primaryNavigation.map(([label, href]) => { const current = isCurrentRoute(currentPath, href); return <li key={href}><a href={href} aria-current={current ? 'page' : undefined}>{label}</a></li>; })}</ul></nav></div><div className="header-actions header-actions-direct"><a className="header-call" href={business.phoneHref} aria-label={`Call The Kut Shoppe at ${business.phone}`}><span className="header-call-label">Call the shop</span><strong>{business.phone}</strong></a><CustomerActions account={account} cartCount={cartCount} /></div></div>
        <MobileNavigation currentPath={currentPath} account={account} cartCount={cartCount} />
      </div></header>
    </>
  );
}

function Footer() {
  return (
    <footer className="site-footer footer-v6">
      <div className="container footer-v6-primary">
        <section className="footer-v6-brand">
          <img src={originalAssets.logo} alt="The Kut Shoppe" width="88" height="88" loading="lazy" decoding="async" />
          <div><p className="eyebrow">The Kut Shoppe</p><h2>A familiar chair on Main Street.</h2><p>Classic barbering, modern styling, and personal service in downtown Stroudsburg.</p><div className="footer-v6-actions"><a className="button" href="/book">Book now</a><a className="button button-secondary" href="/account">Account</a></div></div>
        </section>
        <section className="footer-v6-column"><h3>Visit</h3><strong>518 Main Street</strong><span>Stroudsburg, PA 18360</span><a href={business.phoneHref}>{business.phone}</a><a href="/visit">Directions and hours <ArrowV5 /></a></section>
        <nav className="footer-v6-column" aria-label="Explore The Kut Shoppe"><h3>Explore</h3><a href="/services">Services</a><a href="/gallery">Gallery</a><a href="/team">Crew</a><a href="/shop">Shop</a><a href="/reviews">Reviews</a></nav>
        <section className="footer-v6-column"><h3>Connect</h3>{socialLinks.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noopener noreferrer">{label} <span aria-hidden="true">↗</span></a>)}<span>{shopHoursSummary}</span><span>{shopClosedSummary}</span></section>
      </div>
      <div className="container footer-v6-bottom"><span>© {new Date().getFullYear()} The Kut Shoppe LLC</span><div><a href="/privacy">Privacy</a><a href="/terms">Terms</a><span>Platform by Designed to Breakthrough LLC</span></div></div>
    </footer>
  );
}

export function SiteLayoutV5({ children, currentPath }: { children: ReactNode; currentPath: string }) {
  return <div className="site-shell"><Header currentPath={currentPath} /><main id="main-content">{children}</main><Footer /></div>;
}
