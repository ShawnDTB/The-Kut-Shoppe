import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root')!;
const app = (
  <StrictMode>
    <App url={window.location.pathname} />
  </StrictMode>
);

// `npm run dev` serves index.html as-is, so <!--app-html--> is never
// replaced with prerendered markup and #root has no element children.
// Only the production build (via scripts/prerender.mjs) fills it in, so
// hydrateRoot is reserved for that real prerendered output; dev falls back
// to a plain client render to avoid a guaranteed hydration mismatch. The
// `import.meta.env.DEV` check is statically replaced with `false` in
// production, so Vite dead-code-eliminates this whole branch (including the
// createRoot import) from the production bundle — zero cost there.
if (import.meta.env.DEV && container.children.length === 0) {
  const { createRoot } = await import('react-dom/client');
  createRoot(container).render(app);
} else {
  hydrateRoot(container, app);
}
