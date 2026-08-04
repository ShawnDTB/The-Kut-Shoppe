import { renderToString } from 'react-dom/server';
import { App } from './App';
import { findRoute, routes, type RouteDefinition } from './data/site';

const platformRoutes: RouteDefinition[] = [
  {
    path: '/book/walk-in',
    label: 'Walk-in List',
    title: 'Join the Walk-In List | The Kut Shoppe',
    description: 'Request a last-minute barber opening or let The Kut Shoppe propose another appointment time.',
    eyebrow: 'Walk-ins',
    heading: 'Let the next open chair find you.',
    intro: 'Join the waiting list for barber service in downtown Stroudsburg.',
    status: 'requires-verification',
  },
  {
    path: '/cart',
    label: 'Cart',
    title: 'Your Cart | The Kut Shoppe',
    description: 'Review selected Kut Shoppe products and product variants.',
    eyebrow: 'Shop',
    heading: 'Review your cart.',
    intro: 'Confirm products, options, and quantities before checkout.',
    status: 'placeholder',
  },
  {
    path: '/checkout',
    label: 'Checkout',
    title: 'Checkout | The Kut Shoppe',
    description: 'Submit a pickup or shipping order request to The Kut Shoppe.',
    eyebrow: 'Shop',
    heading: 'Submit your order request.',
    intro: 'Orders remain pending until reviewed by the shop.',
    status: 'placeholder',
  },
  {
    path: '/account',
    label: 'Account',
    title: 'Customer Account | The Kut Shoppe',
    description: 'Private customer access to barber appointments, waitlist requests, orders, and updates.',
    eyebrow: 'Customer account',
    heading: 'Appointments and orders in one place.',
    intro: 'Verified customer tools for The Kut Shoppe.',
    status: 'placeholder',
  },
  {
    path: '/admin/access',
    label: 'Owner Access',
    title: 'Owner Access | The Kut Shoppe',
    description: 'Development-only owner access for local platform review.',
    eyebrow: 'Administration',
    heading: 'Local owner access.',
    intro: 'Unavailable in production builds.',
    status: 'placeholder',
  },
  {
    path: '/admin/products',
    label: 'Product Administration',
    title: 'Product Administration | The Kut Shoppe',
    description: 'Private catalog and inventory management for The Kut Shoppe.',
    eyebrow: 'Administration',
    heading: 'Manage products and variants.',
    intro: 'Private shop administration tools.',
    status: 'placeholder',
  },
  {
    path: '/admin/orders',
    label: 'Order Administration',
    title: 'Order Administration | The Kut Shoppe',
    description: 'Private order review and fulfillment management for The Kut Shoppe.',
    eyebrow: 'Administration',
    heading: 'Review and fulfill customer orders.',
    intro: 'Private shop administration tools.',
    status: 'placeholder',
  },
  {
    path: '/staff',
    label: 'Staff',
    title: 'Staff Dashboard | The Kut Shoppe',
    description: 'Private staff scheduling and operations workspace for The Kut Shoppe.',
    eyebrow: 'Staff platform',
    heading: 'Manage your chair.',
    intro: 'Private staff tools for appointments, schedules, earnings, and payouts.',
    status: 'placeholder',
  },
  {
    path: '/staff/login',
    label: 'Staff Login',
    title: 'Staff Login | The Kut Shoppe',
    description: 'Verified access to The Kut Shoppe staff platform.',
    eyebrow: 'Staff platform',
    heading: 'Sign in to your chair.',
    intro: 'Private staff access.',
    status: 'placeholder',
  },
  {
    path: '/staff/setup',
    label: 'Staff Setup',
    title: 'Staff Account Setup | The Kut Shoppe',
    description: 'Private onboarding for approved Kut Shoppe staff accounts.',
    eyebrow: 'Staff platform',
    heading: 'Set up your staff account.',
    intro: 'Configure professional details, services, schedule, booking rules, and payout preferences.',
    status: 'placeholder',
  },
  {
    path: '/staff/settings',
    label: 'Staff Settings',
    title: 'Staff Settings | The Kut Shoppe',
    description: 'Private staff profile, availability, and service settings.',
    eyebrow: 'Staff platform',
    heading: 'Manage staff settings.',
    intro: 'Private staff access.',
    status: 'placeholder',
  },
  {
    path: '/staff/calendar',
    label: 'Staff Calendar',
    title: 'Staff Calendar | The Kut Shoppe',
    description: 'Private day, week, and month appointment calendar for approved staff.',
    eyebrow: 'Staff platform',
    heading: 'Appointments and availability.',
    intro: 'Manage scheduled clients and open availability.',
    status: 'placeholder',
  },
  {
    path: '/staff/requests',
    label: 'Appointment Requests',
    title: 'Appointment Requests | The Kut Shoppe',
    description: 'Private approval queue for customer appointment requests.',
    eyebrow: 'Staff platform',
    heading: 'Review appointment requests.',
    intro: 'Private staff access.',
    status: 'placeholder',
  },
  {
    path: '/staff/waitlist',
    label: 'Waitlist',
    title: 'Walk-In Waitlist | The Kut Shoppe',
    description: 'Private staff queue for walk-ins and last-minute appointment requests.',
    eyebrow: 'Staff platform',
    heading: 'Manage the waiting list.',
    intro: 'Private staff access.',
    status: 'placeholder',
  },
  {
    path: '/staff/earnings',
    label: 'Staff Earnings',
    title: 'Staff Earnings | The Kut Shoppe',
    description: 'Private earnings ledger for approved Kut Shoppe staff.',
    eyebrow: 'Staff platform',
    heading: 'Earnings and completed services.',
    intro: 'Private staff access.',
    status: 'placeholder',
  },
  {
    path: '/staff/payouts',
    label: 'Staff Payouts',
    title: 'Staff Payouts | The Kut Shoppe',
    description: 'Private payout tracking for approved Kut Shoppe staff.',
    eyebrow: 'Staff platform',
    heading: 'Payout status and history.',
    intro: 'Private staff access.',
    status: 'placeholder',
  },
  {
    path: '/staff/notifications',
    label: 'Notifications',
    title: 'Message Outbox | The Kut Shoppe',
    description: 'Private transactional email and SMS activity for The Kut Shoppe staff.',
    eyebrow: 'Staff platform',
    heading: 'Review customer message activity.',
    intro: 'Private staff access.',
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

function normalizeUrl(url: string) {
  const path = url.split('?')[0]?.split('#')[0] ?? '/';
  return path !== '/' ? path.replace(/\/$/, '') : path;
}

function resolveRoute(url: string) {
  const normalized = normalizeUrl(url);
  const platformRoute = platformRoutes.find((route) => route.path === normalized);
  if (platformRoute) return platformRoute;
  if (/^\/shop\/[^/]+$/.test(normalized)) {
    return {
      path: normalized,
      label: 'Product',
      title: 'Product Details | The Kut Shoppe',
      description: 'View product details, available variants, pickup, and shipping options from The Kut Shoppe.',
      eyebrow: 'Shop',
      heading: 'Product details.',
      intro: 'Verified product information from The Kut Shoppe.',
      status: 'requires-verification',
    } satisfies RouteDefinition;
  }
  return findRoute(normalized);
}

export function render(url: string) {
  const route = resolveRoute(url);
  const canonical = `https://www.thekutshoppe.com${route.path === '/' ? '' : route.path}`;
  const robots = route.status === 'placeholder'
    ? '<meta name="robots" content="noindex, nofollow" />'
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

export const staticRoutes = [...routes, ...platformRoutes];
