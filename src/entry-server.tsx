import { renderToString } from 'react-dom/server';
import { App } from './App';
import { findRoute, routes, type RouteDefinition } from './data/site';

const staffRoutes: RouteDefinition[] = [
  {
    path: '/staff',
    label: 'Staff',
    title: 'Staff Dashboard | The Kut Shoppe',
    description: 'Private staff scheduling and operations workspace for The Kut Shoppe.',
    eyebrow: 'Staff platform',
    heading: 'Manage your chair.',
    intro: 'Private staff tools for schedules, appointments, earnings, and setup.',
    status: 'placeholder',
  },
  {
    path: '/staff/setup',
    label: 'Staff Setup',
    title: 'Staff Account Setup | The Kut Shoppe',
    description: 'Private onboarding for approved Kut Shoppe staff accounts.',
    eyebrow: 'Staff platform',
    heading: 'Set up your staff account.',
    intro: 'Configure your professional profile, services, schedule, and payout preferences.',
    status: 'placeholder',
  },
  {
    path: '/staff/calendar',
    label: 'Staff Calendar',
    title: 'Staff Calendar | The Kut Shoppe',
    description: 'Private appointment calendar for approved Kut Shoppe staff.',
    eyebrow: 'Staff platform',
    heading: 'Appointments and availability.',
    intro: 'Manage scheduled clients, walk-ins, time off, and open availability.',
    status: 'placeholder',
  },
  {
    path: '/staff/earnings',
    label: 'Staff Earnings',
    title: 'Staff Earnings | The Kut Shoppe',
    description: 'Private earnings ledger for approved Kut Shoppe staff.',
    eyebrow: 'Staff platform',
    heading: 'Earnings and completed services.',
    intro: 'Review completed services, adjustments, and payout calculations.',
    status: 'placeholder',
  },
  {
    path: '/staff/payouts',
    label: 'Staff Payouts',
    title: 'Staff Payouts | The Kut Shoppe',
    description: 'Private payout tracking for approved Kut Shoppe staff.',
    eyebrow: 'Staff platform',
    heading: 'Payout status and history.',
    intro: 'Track approved earnings and payments without storing bank information in the website.',
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
  return staffRoutes.find((route) => route.path === normalized) ?? findRoute(normalized);
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

export const staticRoutes = [...routes, ...staffRoutes];
