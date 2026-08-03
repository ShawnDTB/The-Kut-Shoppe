import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import './styles.css';
import './refinement.css';
import './route-refinement.css';
import './navigation.css';
import './menu-wordmark.css';
import './compact-home.css';
import './ux-performance.css';
import './mobile-provider.css';
import './owner-polish.css';
import './hero-focus.css';
import './location-map.css';
import './usability-cleanup.css';
import './owner-refinement.css';
import './menu-final.css';
import './final-owner-cleanup.css';
import './customer-final-pass.css';
import './final-detail-pass.css';
import './final-mobile-performance-pass.css';
import './customer-platform.css';
import './booking-platform.css';
import './account-prototype.css';
import './commerce-platform.css';
import './platform-theme.css';
import { findRoute } from './data/site';
import { HomePage } from './components/HomePage';
import { SiteLayout } from './components/Layout';
import { RoutePage } from './components/Pages';
import { InternalBookingPage, WalkInRequestPage } from './components/InternalBookingPage';
import { StaffPlatformPage } from './components/StaffPlatformPages';
import { CustomerAccountPrototype } from './components/CustomerAccountPrototype';
import { AdminAccessPage, AdminGuard } from './components/AdminAccess';
import {
  CartPage,
  CatalogAdminPage,
  CheckoutPage,
  CommerceStorefrontPage,
  OrderAdminPage,
  ProductDetailPage,
} from './components/CommercePlatformPages';

interface AppProps {
  url: string;
}

const legacyRedirects: Record<string, string> = {
  '/about': '/team',
  '/products': '/shop',
  '/login': '/account',
  '/booking': '/book',
};

const subscribeToHydration = () => () => undefined;
const getHydratedSnapshot = () => true;
const getServerSnapshot = () => false;

function ClientPlatform({ children, label }: { children: ReactNode; label: string }) {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerSnapshot,
  );

  if (!hydrated) {
    return (
      <section className="section platform-loading-state platform-pattern platform-pattern-tools">
        <div className="container narrow-container">
          <div className="staff-empty-state"><p className="eyebrow">The Kut Shoppe platform</p><h1>Opening {label}.</h1></div>
        </div>
      </section>
    );
  }

  return children;
}

function ClientRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return (
    <section className="section page-hero ornament-section ornament-bg-3">
      <div className="container narrow-container"><p className="eyebrow">Redirecting</p><h1>This content has moved.</h1><a className="button" href={to}>Continue</a></div>
    </section>
  );
}

function useHomepageHashNavigation(url: string) {
  useEffect(() => {
    if (url !== '/') return;
    const scrollToHash = () => {
      const id = window.location.hash.slice(1);
      if (!id) return;
      window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };
    scrollToHash();
    window.addEventListener('hashchange', scrollToHash);
    return () => window.removeEventListener('hashchange', scrollToHash);
  }, [url]);
}

export function App({ url }: AppProps) {
  useHomepageHashNavigation(url);

  const normalizedUrl = url !== '/' ? url.replace(/\/$/, '') : url;
  const route = findRoute(normalizedUrl);
  const redirect = legacyRedirects[normalizedUrl];
  const isStaffRoute = normalizedUrl === '/staff' || normalizedUrl.startsWith('/staff/');
  const isAdminRoute = normalizedUrl.startsWith('/admin/');
  const productMatch = normalizedUrl.match(/^\/shop\/([^/]+)$/);
  const layoutPath = isStaffRoute
    ? '/staff'
    : isAdminRoute || normalizedUrl === '/cart' || normalizedUrl === '/checkout' || productMatch
      ? '/shop'
      : route.path;

  return (
    <SiteLayout currentPath={layoutPath}>
      {redirect ? (
        <ClientRedirect to={redirect} />
      ) : normalizedUrl === '/' ? (
        <HomePage />
      ) : normalizedUrl === '/book' ? (
        <InternalBookingPage />
      ) : normalizedUrl === '/book/walk-in' ? (
        <WalkInRequestPage />
      ) : normalizedUrl === '/shop' ? (
        <ClientPlatform label="the current Shop"><CommerceStorefrontPage /></ClientPlatform>
      ) : productMatch ? (
        <ClientPlatform label="this product"><ProductDetailPage slug={decodeURIComponent(productMatch[1] ?? '')} /></ClientPlatform>
      ) : normalizedUrl === '/cart' ? (
        <ClientPlatform label="your cart"><CartPage /></ClientPlatform>
      ) : normalizedUrl === '/checkout' ? (
        <ClientPlatform label="checkout"><CheckoutPage /></ClientPlatform>
      ) : normalizedUrl === '/account' ? (
        <ClientPlatform label="your Account"><CustomerAccountPrototype /></ClientPlatform>
      ) : normalizedUrl === '/admin/access' ? (
        <ClientPlatform label="development owner access"><AdminAccessPage /></ClientPlatform>
      ) : normalizedUrl === '/admin/products' ? (
        <ClientPlatform label="product administration"><AdminGuard><CatalogAdminPage /></AdminGuard></ClientPlatform>
      ) : normalizedUrl === '/admin/orders' ? (
        <ClientPlatform label="order administration"><AdminGuard><OrderAdminPage /></AdminGuard></ClientPlatform>
      ) : isStaffRoute ? (
        <ClientPlatform label="the staff portal"><StaffPlatformPage path={normalizedUrl} /></ClientPlatform>
      ) : (
        <RoutePage url={url} />
      )}
    </SiteLayout>
  );
}
