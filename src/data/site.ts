export type VerificationStatus =
  | 'verified-live-site'
  | 'verified-booking-platform'
  | 'requires-verification'
  | 'placeholder';

export interface RouteDefinition {
  path: string;
  label: string;
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  intro: string;
  status: VerificationStatus;
}

export const business = {
  name: 'The Kut Shoppe',
  legalName: 'The Kut Shoppe LLC',
  phone: '570-421-5887',
  phoneHref: 'tel:+15704215887',
  address: '518 Main Street, Stroudsburg, PA 18360',
  hoursStatus: 'requires-verification' as VerificationStatus,
  hoursNote:
    'The homepage, linked Booksy profile, and public listings do not present one consistent fixed schedule. Professional availability is shown during booking.',
  walkIns:
    'Walk-ins are welcome when availability allows; appointments are recommended.',
};

export const booksyUrl =
  'https://booksy.com/en-us/71309_the-kut-shoppe_barber-shop_34196_stroudsburg';

export const bookingPaths = [
  {
    id: 'barber',
    title: 'Book a barber',
    description:
      'Haircuts, fades, tapers, buzz cuts, bald cuts, line-ups, beard work, and related barber services.',
    href: booksyUrl,
    status: 'verified-live-site' as VerificationStatus,
  },
  {
    id: 'styling',
    title: 'Book locs, braids or styling',
    description:
      'Loc maintenance, retwists, braids, twists, cornrows, consultations, and related styling services.',
    href: booksyUrl,
    status: 'requires-verification' as VerificationStatus,
  },
] as const;

export const services = [
  {
    title: 'Haircuts',
    route: '/services/haircuts',
    summary:
      'Scissor cuts, fades, tapers, Caesar cuts, buzz cuts, bald cuts, afros, flattops, mohawks, and shape-ups.',
    prices: [
      ['Scissor cut', '$40'],
      ['Afro, flattop or mohawk', '$40'],
      ['Fade or taper', '$35'],
      ['Caesar cut', '$30'],
      ['Bald cut', '$30'],
      ['Hairline or face shape-up', '$25'],
    ],
  },
  {
    title: 'Kids and senior cuts',
    route: '/services/kids-cuts',
    summary:
      'Age-appropriate haircut options with the same focus on precision and a comfortable shop experience.',
    prices: [
      ['Scissor cut', '$35'],
      ['Afro, flattop or mohawk', '$35'],
      ['Fade or taper', '$30'],
      ['Caesar cut', '$25'],
      ['Bald cut', '$25'],
      ['Hairline or face shape-up', '$25'],
    ],
  },
  {
    title: 'Beards and shaving',
    route: '/services/beards-shaves',
    summary:
      'Beard trims, facial-hair line-ups, shape-ups, and straight-razor services listed by the current website.',
    prices: [],
  },
  {
    title: 'Locs, braids and twists',
    route: '/services/locs-braids',
    summary:
      'Loc retwists, starter locs, cornrows, braids, two-strand twists, and consultations.',
    prices: [
      ['Loc retwist', '$85+'],
      ['Cornrows', '$75+'],
      ['Braids', '$85+'],
      ['Two-strand twist', '$80+'],
      ['Starter locs', '$120+'],
      ['Consultation', '$20'],
    ],
  },
  {
    title: 'Color and scalp care',
    route: '/services/color-scalp-care',
    summary:
      'Hair coloring, washing, detangling, blow-drying, scalp treatments, and related care listed on the live homepage.',
    prices: [],
  },
] as const;

export const team = [
  {
    name: 'Kash The Fadeologist',
    note: 'Role, biography, specialties, photography, social profile, and direct booking URL require approval.',
  },
  {
    name: 'Mr. Glen The Kut Doctor',
    note: 'Exact styling and punctuation vary between public sources and require approval.',
  },
  {
    name: 'Kris-P Fades',
    note: 'Recent Booksy reviews reference Kris-P Blendz; confirm the current public professional name.',
  },
  {
    name: 'Crowned by Steph',
    note: 'Profile details, photography, specialties, social profile, and direct booking URL require approval.',
  },
] as const;

export const navigation = [
  ['Services', '/services'],
  ['Team', '/team'],
  ['Gallery', '/gallery'],
  ['Reviews', '/reviews'],
  ['About', '/about'],
  ['Visit', '/visit'],
] as const;

export const routes: RouteDefinition[] = [
  {
    path: '/',
    label: 'Home',
    title: 'The Kut Shoppe | Barbershop & Styling in Stroudsburg, PA',
    description:
      'Book precision haircuts, fades, locs, braids, twists, and modern styling at The Kut Shoppe on Main Street in Stroudsburg.',
    eyebrow: 'Stroudsburg, Pennsylvania',
    heading: 'Precision cuts. Modern styling. Right on Main Street.',
    intro:
      'A neighborhood shop bringing barbering and styling professionals together for clients across Stroudsburg and the Poconos.',
    status: 'verified-live-site',
  },
  {
    path: '/services',
    label: 'Services',
    title: 'Haircuts, Locs, Braids & Grooming Services | The Kut Shoppe',
    description:
      'Explore barbering and styling services available through The Kut Shoppe in Stroudsburg.',
    eyebrow: 'Services',
    heading: 'Find the right service and booking path.',
    intro:
      'Browse service categories carried over from the current website. Final appointment pricing and availability are confirmed on Booksy.',
    status: 'verified-live-site',
  },
  {
    path: '/services/haircuts',
    label: 'Haircuts',
    title: 'Haircuts in Stroudsburg | The Kut Shoppe',
    description:
      'Scissor cuts, fades, tapers, buzz cuts, bald cuts, shape-ups, and more at The Kut Shoppe.',
    eyebrow: 'Barber services',
    heading: 'Haircuts shaped around your style.',
    intro:
      'The current service menu includes classic cuts, modern fades, detailed shape-ups, and specialty haircut options.',
    status: 'verified-live-site',
  },
  {
    path: '/services/beards-shaves',
    label: 'Beards & Shaves',
    title: 'Beard Trims & Shaving Services | The Kut Shoppe',
    description:
      'Explore beard, shape-up, line-up, and straight-razor services at The Kut Shoppe.',
    eyebrow: 'Barber services',
    heading: 'Clean lines and finished details.',
    intro:
      'Beard trims, facial-hair line-ups, shape-ups, and shaving services are represented on the current website.',
    status: 'verified-live-site',
  },
  {
    path: '/services/kids-cuts',
    label: 'Kids Cuts',
    title: 'Kids & Senior Haircuts in Stroudsburg | The Kut Shoppe',
    description:
      'View haircut options for kids and seniors at The Kut Shoppe in Stroudsburg.',
    eyebrow: 'Family-friendly service',
    heading: 'Comfortable cuts for every generation.',
    intro:
      'The Kut Shoppe serves a broad range of clients, including children and seniors.',
    status: 'verified-live-site',
  },
  {
    path: '/services/locs-braids',
    label: 'Locs & Braids',
    title: 'Locs, Braids, Cornrows & Twists | The Kut Shoppe',
    description:
      'Book loc retwists, starter locs, braids, cornrows, twists, and consultations in Stroudsburg.',
    eyebrow: 'Styling services',
    heading: 'Loc and braid services with a clear booking path.',
    intro:
      'Current offerings include loc maintenance, starter locs, cornrows, braids, two-strand twists, and consultations.',
    status: 'verified-live-site',
  },
  {
    path: '/services/color-scalp-care',
    label: 'Color & Scalp Care',
    title: 'Hair Color & Scalp Care | The Kut Shoppe',
    description:
      'Learn about hair coloring, washing, scalp treatments, and related styling services at The Kut Shoppe.',
    eyebrow: 'Hair care',
    heading: 'Color and care beyond the cut.',
    intro:
      'The current homepage references hair coloring, washing stations, scalp treatments, detangling, blow-drying, and related services.',
    status: 'verified-live-site',
  },
  {
    path: '/team',
    label: 'Team',
    title: 'Meet The Kut Shoppe Team | Stroudsburg',
    description:
      'Meet the barbering and styling professionals currently referenced by The Kut Shoppe.',
    eyebrow: 'The crew',
    heading: 'Choose the professional who fits your service.',
    intro:
      'Team names are carried over from the current site. Profile details remain unpublished until each professional approves them.',
    status: 'requires-verification',
  },
  {
    path: '/gallery',
    label: 'Gallery',
    title: 'Haircut, Loc & Styling Gallery | The Kut Shoppe',
    description:
      'Explore featured haircut, loc, braid, beard, and styling work from The Kut Shoppe.',
    eyebrow: 'Portfolio',
    heading: 'Real work from the shop.',
    intro:
      'The existing gallery will be migrated into an organized, optimized portfolio after image ownership and professional attribution are confirmed.',
    status: 'requires-verification',
  },
  {
    path: '/products',
    label: 'Products',
    title: 'Grooming Products | The Kut Shoppe',
    description:
      'Find approved grooming products and the correct purchasing destination for The Kut Shoppe.',
    eyebrow: 'Products',
    heading: 'Verified products only.',
    intro:
      'The placeholder WooCommerce products will not be migrated. This page will link only to approved Kut Shoppe products or an approved external store.',
    status: 'requires-verification',
  },
  {
    path: '/about',
    label: 'About',
    title: 'About The Kut Shoppe | Stroudsburg Barbershop',
    description:
      'Learn about The Kut Shoppe’s welcoming neighborhood atmosphere and relationship-focused approach.',
    eyebrow: 'About the shop',
    heading: 'More than a chair and a haircut.',
    intro:
      'The Kut Shoppe emphasizes a welcoming atmosphere, professional service, and long-term relationships with clients across the Pocono area.',
    status: 'verified-live-site',
  },
  {
    path: '/reviews',
    label: 'Reviews',
    title: 'Verified Client Reviews | The Kut Shoppe',
    description:
      'Read verified client feedback and visit The Kut Shoppe’s current review platforms.',
    eyebrow: 'Client trust',
    heading: 'A reputation built one appointment at a time.',
    intro:
      'Review excerpts will be selected from verifiable public sources and attributed accurately before production launch.',
    status: 'requires-verification',
  },
  {
    path: '/visit',
    label: 'Visit',
    title: 'Visit The Kut Shoppe | 518 Main Street, Stroudsburg',
    description:
      'Find The Kut Shoppe at 518 Main Street in Stroudsburg, Pennsylvania, and review appointment guidance.',
    eyebrow: 'Visit',
    heading: 'Find us in downtown Stroudsburg.',
    intro:
      'Call or use the booking page before visiting. Walk-ins are welcomed when availability allows.',
    status: 'verified-live-site',
  },
  {
    path: '/book',
    label: 'Book',
    title: 'Book an Appointment | The Kut Shoppe',
    description:
      'Choose the correct barber or styling booking path for The Kut Shoppe.',
    eyebrow: 'Appointments',
    heading: 'Start with the service you need.',
    intro:
      'Choose barbering or loc and styling services. You will continue to the external booking provider to select a professional and available time.',
    status: 'verified-live-site',
  },
  {
    path: '/contact',
    label: 'Contact',
    title: 'Contact The Kut Shoppe | Stroudsburg, PA',
    description:
      'Call The Kut Shoppe or send a general business inquiry. Booking requests should use the appointment page.',
    eyebrow: 'Contact',
    heading: 'Questions that are not appointment requests.',
    intro:
      'The initial contact experience will collect only the minimum information required and will not replace Booksy.',
    status: 'requires-verification',
  },
  {
    path: '/privacy',
    label: 'Privacy',
    title: 'Privacy Policy | The Kut Shoppe',
    description: 'Read The Kut Shoppe website privacy policy.',
    eyebrow: 'Legal',
    heading: 'Privacy policy placeholder.',
    intro:
      'Final privacy language requires approval after analytics, contact-form processing, and service providers are selected.',
    status: 'placeholder',
  },
  {
    path: '/terms',
    label: 'Terms',
    title: 'Website Terms | The Kut Shoppe',
    description: 'Read The Kut Shoppe website terms.',
    eyebrow: 'Legal',
    heading: 'Website terms placeholder.',
    intro:
      'Final website terms and any cancellation-policy references require business review before production publication.',
    status: 'placeholder',
  },
];

export const notFoundRoute: RouteDefinition = {
  path: '/404',
  label: 'Not Found',
  title: 'Page Not Found | The Kut Shoppe',
  description: 'The requested page could not be found.',
  eyebrow: '404',
  heading: 'That page is no longer in the chair.',
  intro: 'Use the navigation to continue or return to the homepage.',
  status: 'verified-live-site',
};

export function findRoute(pathname: string): RouteDefinition {
  const normalized = pathname !== '/' ? pathname.replace(/\/$/, '') : pathname;
  return routes.find((route) => route.path === normalized) ?? notFoundRoute;
}
