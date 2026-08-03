import { useEffect } from 'react';
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
import { findRoute } from './data/site';
import { HomePage } from './components/HomePage';
import { SiteLayout } from './components/Layout';
import { RoutePage } from './components/Pages';
import { ShopPage } from './components/CustomerPlatformPages';
import { InternalBookingPage } from './components/InternalBookingPage';
import { StaffPlatformPage } from './components/StaffPlatformPages';
import { CustomerAccountPrototype } from './components/CustomerAccountPrototype';

interface AppProps {
  url: string;
}

const legacyRedirects: Record<string, string> = {
  '/about': '/team',
  '/products': '/shop',
};

function ClientRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return (
    <section className="section page-hero ornament-section ornament-bg-3">
      <div className="container narrow-container">
        <p className="eyebrow">Redirecting</p>
        <h1>This content has moved.</h1>
        <a className="button" href={to}>Continue</a>
      </div>
    </section>
  );
}

function useHomepageHashNavigation(url: string) {
  useEffect(() => {
    if (url !== '/') return;

    const scrollToHash = () => {
      const id = window.location.hash.slice(1);
      if (!id) return;

      window.requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
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
  const layoutPath = isStaffRoute ? '/staff' : route.path;

  return (
    <SiteLayout currentPath={layoutPath}>
      {redirect ? (
        <ClientRedirect to={redirect} />
      ) : normalizedUrl === '/' ? (
        <HomePage />
      ) : normalizedUrl === '/book' ? (
        <InternalBookingPage />
      ) : normalizedUrl === '/shop' ? (
        <ShopPage />
      ) : normalizedUrl === '/account' ? (
        <CustomerAccountPrototype />
      ) : isStaffRoute ? (
        <StaffPlatformPage path={normalizedUrl} />
      ) : (
        <RoutePage url={url} />
      )}
    </SiteLayout>
  );
}
