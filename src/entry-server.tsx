import { renderToString } from 'react-dom/server';
import { App } from './App';
import { findRoute, routes } from './data/site';

function escapeAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function render(url: string) {
  const route = findRoute(url);
  const canonical = `https://www.thekutshoppe.com${route.path === '/' ? '' : route.path}`;
  const head = [
    `<title>${escapeAttribute(route.title)}</title>`,
    `<meta name="description" content="${escapeAttribute(route.description)}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:title" content="${escapeAttribute(route.title)}" />`,
    `<meta property="og:description" content="${escapeAttribute(route.description)}" />`,
    `<meta property="og:url" content="${canonical}" />`,
  ].join('\n    ');

  return {
    html: renderToString(<App url={url} />),
    head,
  };
}

export const staticRoutes = routes;
