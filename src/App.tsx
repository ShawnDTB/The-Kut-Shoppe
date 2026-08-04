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
import { findRoute } from './data/site';
import { HomePage } from './components/HomePage';
import { SiteLayoutV5 } from './components/LayoutV5';
import { RoutePage } from './components/Pages';
import { BookingV5 } from './components/BookingV5';
import { StaffPlatformPage } from './components/StaffPlatformPages';
import { StaffOnboardingV5 } from './components/StaffOnboardingV5';
import { StaffSettingsV5 } from './components/StaffSettingsV5';
import { AccountAccessV5 } from './components/AccountAccessV5';
import { RoleDashboardV5 } from './components/RoleDashboardV5';
import { ReviewsPageV4 } from './components/ReviewsPageV4';
import { CartPageV4 } from './components/CartPageV4';
import { StorefrontV5 } from './components/StorefrontV5';
import { AdminGuard } from './components/AdminAccess';
import { ProductAdminHubV5 } from './components/ProductAdminHubV5';
import { OrderAdminV5 } from './components/OrderAdminV5';
import { CheckoutPageV5, ProductDetailPageV5 } from './components/CommerceCustomerV5';

interface AppProps { url: string }

const legacyRedirects: Record<string, string> = {
  '/about': '/team',
  '/products': '/shop',
  '/login': '/account',
  '/booking': '/book',
  '/book/walk-in': '/book',
  '/staff/login': '/account',
  '/admin/access': '/account',
};

const subscribeToHydration = () => () => undefined;
const getHydratedSnapshot = () => true;
const getServerSnapshot = () => false;

function ClientPlatform({ children, label }: { children: ReactNode; label: string }) {
  const hydrated = useSyncExternalStore(subscribeToHydration, getHydratedSnapshot, getServerSnapshot);
  if (!hydrated) return <section className="section platform-loading-state platform-pattern platform-pattern-tools"><div className="container narrow-container"><div className="staff-empty-state"><p className="eyebrow">The Kut Shoppe platform</p><h1>Opening {label}.</h1></div></div></section>;
  return children;
}

function ClientRedirect({ to }: { to: string }) {
  useEffect(() => { window.location.replace(to); }, [to]);
  return <section className="section page-hero ornament-section ornament-bg-3"><div className="container narrow-container"><p className="eyebrow">Redirecting</p><h1>This content has moved.</h1><a className="button" href={to}>Continue</a></div></section>;
}

function useHomepageHashNavigation(url: string) {
  useEffect(() => {
    if (url !== '/') return;
    const scrollToHash = () => { const id = window.location.hash.slice(1); if (id) window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })); };
    scrollToHash();
    window.addEventListener('hashchange', scrollToHash);
    return () => window.removeEventListener('hashchange', scrollToHash);
  }, [url]);
}

function useDevelopmentStorefrontSeed() {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    void import('./data/development-storefront-seed').then(({ ensureDevelopmentStorefrontSeed }) => ensureDevelopmentStorefrontSeed());
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
  const layoutPath = normalizedUrl === '/dashboard' || normalizedUrl === '/account' ? '/account' : isStaffRoute ? '/account' : isAdminRoute || normalizedUrl === '/cart' || normalizedUrl === '/checkout' || productMatch ? '/shop' : route.path;

  return <SiteLayoutV5 currentPath={layoutPath}>
    {redirect ? <ClientRedirect to={redirect} />
      : normalizedUrl === '/' ? <HomePage />
      : normalizedUrl === '/book' ? <ClientPlatform label="booking"><BookingV5 /></ClientPlatform>
      : normalizedUrl === '/reviews' ? <ReviewsPageV4 />
      : normalizedUrl === '/shop' ? <ClientPlatform label="the Shop"><StorefrontV5 /></ClientPlatform>
      : productMatch ? <ClientPlatform label="this product"><ProductDetailPageV5 slug={decodeURIComponent(productMatch[1] ?? '')} /></ClientPlatform>
      : normalizedUrl === '/cart' ? <ClientPlatform label="your cart"><CartPageV4 /></ClientPlatform>
      : normalizedUrl === '/checkout' ? <ClientPlatform label="checkout"><CheckoutPageV5 /></ClientPlatform>
      : normalizedUrl === '/account' ? <ClientPlatform label="your Account"><AccountAccessV5 /></ClientPlatform>
      : normalizedUrl === '/dashboard' ? <ClientPlatform label="your dashboard"><RoleDashboardV5 /></ClientPlatform>
      : normalizedUrl === '/staff/setup' ? <ClientPlatform label="professional setup"><StaffOnboardingV5 /></ClientPlatform>
      : normalizedUrl === '/staff/settings' ? <ClientPlatform label="staff settings"><StaffSettingsV5 /></ClientPlatform>
      : normalizedUrl === '/admin/products' ? <ClientPlatform label="product administration"><AdminGuard><ProductAdminHubV5 /></AdminGuard></ClientPlatform>
      : normalizedUrl === '/admin/orders' ? <ClientPlatform label="order administration"><AdminGuard><OrderAdminV5 /></AdminGuard></ClientPlatform>
      : isStaffRoute ? <ClientPlatform label="the staff portal"><StaffPlatformPage path={normalizedUrl} /></ClientPlatform>
      : <RoutePage url={url} />}
  </SiteLayoutV5>;
}
