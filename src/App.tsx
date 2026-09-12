import { lazy, Suspense, useEffect, useSyncExternalStore, type ReactNode } from 'react';
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
import './booking-platform.css';
import './account-prototype.css';
import './commerce-platform.css';
import './platform-theme.css';
import './auth-v2.css';
import './navigation-v2-fixes.css';
import './booking-v2.css';
import './storefront-v2.css';
import './staff-onboarding-v2.css';
import './visual-accessibility-v2.css';
import './polish-round-2.css';
import './polish-round-3.css';
import './polish-round-3-fixes.css';
import './polish-round-4.css';
import './polish-round-5.css';
import './polish-round-6.css';
import './stabilization-v7.css';
import './customer-account.css';
import './visual-system.css';
import { findRoute } from './data/site';
import { localPlatformPreview } from './data/runtime';
import { CustomerAccount } from './components/CustomerAccount';
import { ProductionBooking } from './components/ProductionAccess';
import { LiveCommerce } from './components/LiveCommerce';
import { HomePage } from './components/HomePage';
import { SiteLayout } from './components/Layout';
import { RoutePage } from './components/Pages';
import { ReviewsPageV4 } from './components/ReviewsPageV4';

const LocalPlatformPreview = import.meta.env.DEV ? lazy(() => import('./components/LocalPlatformPreview')) : null;

interface AppProps { url: string }

const legacyRedirects: Record<string, string> = {
  '/about': '/team',
  '/products': '/shop',
  '/login': '/account',
  '/booking': '/book',
  '/staff/login': '/account',
  '/admin/access': '/account',
};

const subscribeToHydration = () => () => undefined;
const getHydratedSnapshot = () => true;
const getServerSnapshot = () => false;

function ClientPlatform({ children }: { children: ReactNode }) {
  return useSyncExternalStore(subscribeToHydration, getHydratedSnapshot, getServerSnapshot) ? children : null;
}

function ClientRedirect({ to }: { to: string }) {
  useEffect(() => { window.location.replace(to); }, [to]);
  return <a href={to}>Continue</a>;
}

function useHomepageHashNavigation(url: string) {
  useEffect(() => {
    if (url !== '/') return;
    const scrollToHash = () => {
      const id = window.location.hash.slice(1);
      if (id) window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };
    scrollToHash();
    window.addEventListener('hashchange', scrollToHash);
    return () => window.removeEventListener('hashchange', scrollToHash);
  }, [url]);
}

function useDevelopmentStorefrontSeed() {
  useEffect(() => {
    if (import.meta.env.DEV && localPlatformPreview) {
      void import('./data/development-storefront-seed').then(({ ensureDevelopmentStorefrontSeed }) => ensureDevelopmentStorefrontSeed());
    }
  }, []);
}

export function App({ url }: AppProps) {
  useHomepageHashNavigation(url);
  useDevelopmentStorefrontSeed();
  const normalizedUrl = url !== '/' ? url.replace(/\/$/, '') : url;
  const route = findRoute(normalizedUrl);
  const redirect = legacyRedirects[normalizedUrl];
  const isStaffRoute = normalizedUrl === '/staff' || normalizedUrl.startsWith('/staff/');
  const isAdminRoute = normalizedUrl.startsWith('/admin/');
  const productMatch = normalizedUrl.match(/^\/shop\/([^/]+)$/);
  const operational = ['/account', '/dashboard', '/book', '/book/walk-in', '/shop', '/cart', '/checkout'].includes(normalizedUrl) || isStaffRoute || isAdminRoute || Boolean(productMatch);
  const layoutPath = normalizedUrl === '/dashboard' || normalizedUrl === '/account'
    ? '/account'
    : isStaffRoute
      ? '/account'
      : isAdminRoute || normalizedUrl === '/cart' || normalizedUrl === '/checkout' || productMatch
        ? '/shop'
        : route.path;

  return <SiteLayout currentPath={layoutPath}>{redirect ? <ClientRedirect to={redirect} />
    : normalizedUrl === '/' ? <HomePage />
    : import.meta.env.DEV && localPlatformPreview && LocalPlatformPreview && operational ? <ClientPlatform><Suspense fallback={<p role="status">Opening local preview…</p>}><LocalPlatformPreview path={normalizedUrl} /></Suspense></ClientPlatform>
    : normalizedUrl === '/admin/products' || normalizedUrl === '/admin/orders' ? <ClientPlatform><LiveCommerce path={normalizedUrl} /></ClientPlatform>
    : normalizedUrl === '/account' || normalizedUrl === '/dashboard' || isStaffRoute || isAdminRoute ? <ClientPlatform><CustomerAccount /></ClientPlatform>
    : normalizedUrl === '/book' || normalizedUrl.startsWith('/book/') ? <ProductionBooking />
    : normalizedUrl === '/shop' || productMatch || normalizedUrl === '/cart' || normalizedUrl === '/checkout' ? <ClientPlatform><LiveCommerce path={normalizedUrl} /></ClientPlatform>
    : normalizedUrl === '/reviews' ? <ReviewsPageV4 />
    : <RoutePage url={url} />}</SiteLayout>;
}
