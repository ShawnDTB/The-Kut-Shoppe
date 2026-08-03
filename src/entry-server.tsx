import { renderToString } from 'react-dom/server';
import { App } from './App';
import { findRoute, routes, type RouteDefinition } from './data/site';

const commerceWorkflowRoutes: RouteDefinition[] = [
  {
    path: '/cart',
    label: 'Cart',
    title: 'Shopping Cart | The Kut Shoppe',
    description: 'Review products selected from The Kut Shoppe store.',
    eyebrow: 'Shop',
    heading: 'Your cart.',
    intro: 'Review product quantities and continue to fulfillment.',
    status: 'placeholder',
  },
  {
    path: '/checkout',
    label: 'Checkout',
    title: 'Checkout | The Kut Shoppe',
    description: 'Choose pickup or shipping for a Kut Shoppe order.',
    eyebrow: 'Shop',
    heading: 'Checkout.',
    intro: 'Confirm customer and fulfillment information.',
    status: 'placeholder',
  },
  {
    path: '/admin/products',
    label: 'Product Manager',
    title: 'Product Manager | The Kut Shoppe',
    description: 'Private catalog management for The Kut Shoppe.',
    eyebrow: 'Administration',
    heading: 'Manage the verified catalog.',
    intro: 'Create, review, and publish approved store inventory.',
    status: 'placeholder',
  },
];

function escapeAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function resolveRoute(url: string) {
  const normalized = url !== '/' ? url.replace(/\/$/, '') : url;
  return commerceWorkflowRoutes.find((route) => route.path === normalized) ?? findRoute(normalized);
}

export function render(url: string) {
  const route = resolveRoute(url);
  const canonical = `https://www.thekutshoppe.com${route.path === '/' ? '' : route.path}`;
  const robots = route.status === 'placeholder'
    ? '<meta name="robots" content="noindex, follow" />'
    : '<meta name="robots" content="index, follow" />';
  const head = [
    `<title>${escapeAttribute(route.title)}</title>`,
    `<meta name="description" content="${escapeAttribute(route.description)}" />`,
    robots,
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

export const staticRoutes = [...routes, ...commerceWorkflowRoutes];
