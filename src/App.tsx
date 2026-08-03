import './styles.css';
import './refinement.css';
import './route-refinement.css';
import './navigation.css';
import './menu-wordmark.css';
import { findRoute } from './data/site';
import { HomePage } from './components/HomePage';
import { SiteLayout } from './components/Layout';
import { BookPage, RoutePage } from './components/Pages';

interface AppProps {
  url: string;
}

export function App({ url }: AppProps) {
  const route = findRoute(url);

  return (
    <SiteLayout currentPath={route.path}>
      {route.path === '/' ? (
        <HomePage />
      ) : route.path === '/book' ? (
        <BookPage />
      ) : (
        <RoutePage url={url} />
      )}
    </SiteLayout>
  );
}
