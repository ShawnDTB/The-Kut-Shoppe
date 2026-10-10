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
import './mobile-navigation.css';
import { findRoute } from './data/site';
import { localPlatformPreview, publicLaunch } from './data/runtime';
import { LaunchPlaceholder } from './components/LaunchPlaceholder';
import { HomePage } from './components/HomePage';
import { SiteLayout } from './components/Layout';
import { RoutePage } from './components/Pages';
import { ReviewsPageV4 } from './components/ReviewsPageV4';

const LocalPlatformPreview = import.meta.env.DEV ? lazy(() => import('./components/LocalPlatformPreview')) : null;
const CustomerAccount = import.meta.env.PROD && import.meta.env.VITE_PUBLIC_LAUNCH !== 'false' ? null : lazy(() => import('./components/CustomerAccount').then(module => ({ default: module.CustomerAccount })));
const LiveAccounts = lazy(() => import('./components/LiveAccounts').then(module => ({ default: module.LiveAccounts })));
const LiveCommerce = import.meta.env.PROD && import.meta.env.VITE_PUBLIC_LAUNCH !== 'false' ? null : lazy(() => import('./components/LiveCommerce').then(module => ({ default: module.LiveCommerce })));

const ProductionBooking = import.meta.env.PROD && import.meta.env.VITE_PUBLIC_LAUNCH !== 'false' ? null : lazy(() => import('./components/ProductionAccess').then(module => ({ default: module.ProductionBooking })));

interface AppProps { url: string }

const legacyRedirects: Record<string, string> = {
  '/about': '/team',
  '/products': '/shop',
  '/login': '/account',
  '/booking': '/book',
  '/staff/login': '/account',
};

const subscribeToHydration = () => () => undefined;
const getHydratedSnapshot = () => true;
const getServerSnapshot = () => false;

function ClientPlatform({ children, placeholder = null }: { children: ReactNode; placeholder?: ReactNode }) {
  return useSyncExternalStore(subscribeToHydration, getHydratedSnapshot, getServerSnapshot) ? <Suspense fallback={<p className="container" role="status">Opening your workspace…</p>}>{children}</Suspense> : placeholder;
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
      if (id) window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }));
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
  const operational = ['/account', '/dashboard', '/book', '/book/walk-in', '/shop', '/cart', '/checkout'].includes(normalizedUrl) || isStaffRoute || isAdminRoute || normalizedUrl.startsWith('/book/') || normalizedUrl.startsWith('/shop/');
  const layoutPath = normalizedUrl === '/dashboard' || normalizedUrl === '/account'
    ? '/account'
    : isStaffRoute || isAdminRoute
      ? '/account'
      : normalizedUrl === '/cart' || normalizedUrl === '/checkout' || productMatch
        ? '/shop'
        : route.path;

  return <SiteLayout currentPath={layoutPath}>{redirect ? <ClientRedirect to={redirect} />
    : publicLaunch && (normalizedUrl === '/account' || normalizedUrl === '/dashboard') ? <ClientPlatform placeholder={<section className="section customer-account"><div className="container"><h1>Your Kut Shoppe account</h1><p role="status">Opening secure account access…</p><noscript>Enable JavaScript to sign in. You can still book through our booking page.</noscript></div></section>}><LiveAccounts /></ClientPlatform>
    : publicLaunch && operational ? <LaunchPlaceholder kind={normalizedUrl.startsWith('/book') ? 'booking' : normalizedUrl.startsWith('/shop') || normalizedUrl === '/cart' || normalizedUrl === '/checkout' ? 'shop' : 'account'} />
    : normalizedUrl === '/' ? <HomePage />
    : import.meta.env.DEV && localPlatformPreview && LocalPlatformPreview && operational ? <ClientPlatform><Suspense fallback={<p role="status">Opening local preview…</p>}><LocalPlatformPreview path={normalizedUrl} /></Suspense></ClientPlatform>
    : LiveCommerce && (normalizedUrl === '/admin/products' || normalizedUrl === '/admin/orders') ? <ClientPlatform><LiveCommerce path={normalizedUrl} /></ClientPlatform>
    : CustomerAccount && (normalizedUrl === '/account' || normalizedUrl === '/dashboard' || isStaffRoute || isAdminRoute) ? <ClientPlatform><CustomerAccount /></ClientPlatform>
    : ProductionBooking && (normalizedUrl === '/book' || normalizedUrl.startsWith('/book/')) ? <Suspense fallback={<p role="status">Opening booking…</p>}><ProductionBooking /></Suspense>
    : LiveCommerce && (normalizedUrl === '/shop' || productMatch || normalizedUrl === '/cart' || normalizedUrl === '/checkout') ? <ClientPlatform><LiveCommerce path={normalizedUrl} /></ClientPlatform>
    : normalizedUrl === '/reviews' ? <ReviewsPageV4 />
    : <RoutePage url={url} />}</SiteLayout>;
}
