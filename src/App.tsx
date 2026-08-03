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
import { findRoute } from './data/site';
import { HomePage } from './components/HomePage';
import { SiteLayout } from './components/Layout';
import { BookPage, RoutePage } from './components/Pages';

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

  const route = findRoute(url);
  const normalizedUrl = url !== '/' ? url.replace(/\/$/, '') : url;
  const redirect = legacyRedirects[normalizedUrl];

  return (
    <SiteLayout currentPath={route.path}>
      {redirect ? (
        <ClientRedirect to={redirect} />
      ) : route.path === '/' ? (
        <HomePage />
      ) : route.path === '/book' ? (
        <BookPage />
      ) : (
        <RoutePage url={url} />
      )}
    </SiteLayout>
  );
}
