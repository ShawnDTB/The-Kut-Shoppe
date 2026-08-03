export type VerificationStatus =
  | 'verified-live-site'
  | 'verified-booking-platform'
  | 'requires-verification'
  | 'placeholder';

export type BookingType = 'barber' | 'styling';

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

export interface ServicePrice {
  name: string;
  price: string;
  duration: string;
}

export interface ServiceCategory {
  title: string;
  route: string;
  summary: string;
  bookingType: BookingType;
  prices: readonly ServicePrice[];
}

export const business = {
  name: 'The Kut Shoppe',
  legalName: 'The Kut Shoppe LLC',
  phone: '570-421-5887',
  phoneHref: 'tel:+15704215887',
  address: '518 Main Street, Stroudsburg, PA 18360',
  hoursStatus: 'requires-verification' as VerificationStatus,
  hoursNote:
    'Shop hours are a walk-in reference rather than a guaranteed staff schedule. Current professional availability is shown by the booking provider.',
  walkIns:
    'Walk-ins are welcome when availability allows; appointments are recommended.',
};

export const booksyUrl =
  'https://booksy.com/en-us/71309_the-kut-shoppe_braids-locs_34196_stroudsburg';

export const glossGeniusUrl = 'https://crownedbysteph.glossgenius.com';

export const bookingPaths = [
  {
    id: 'barber',
    type: 'barber' as BookingType,
    title: 'Book with a barber',
    shortTitle: 'Book with Barber',
    provider: 'Booksy',
    buttonLabel: 'Book with Barber',
    description:
      'Haircuts, fades, tapers, buzz cuts, bald cuts, line-ups, beard work, and related barber services.',
    href: booksyUrl,
    status: 'verified-booking-platform' as VerificationStatus,
  },
  {
    id: 'styling',
    type: 'styling' as BookingType,
    title: 'Book with the loctician',
    shortTitle: 'Book with Loctician',
    provider: 'GlossGenius',
    buttonLabel: 'Book with Loctician',
    description:
      'Loc maintenance, retwists, braids, twists, cornrows, consultations, and related services with Crowned by Steph.',
    href: glossGeniusUrl,
    status: 'verified-booking-platform' as VerificationStatus,
  },
] as const;

export function getBookingPath(type: BookingType) {
  return bookingPaths.find((path) => path.type === type)!;
}

export const services: readonly ServiceCategory[] = [
  {
    title: 'Kids cuts',
    route: '/services/kids-cuts',
    summary:
      'Booksy currently groups haircut services for children ages 3 through 12 into specialty cuts, buzz cuts, and head line-ups.',
    bookingType: 'barber',
    prices: [
      { name: 'KIDS SPECIALTY KUT', price: '$40', duration: '1 hr' },
      { name: 'KIDS BUZZ KUT', price: '$30', duration: '1 hr' },
      { name: 'KIDS LINE-UP (HEAD ONLY)', price: '$25', duration: '1 hr' },
    ],
  },
  {
    title: 'Adult and teen cuts',
    route: '/services/haircuts',
    summary:
      'Current Booksy services for clients age 13 and older include specialty, buzz, bald, and line-up options.',
    bookingType: 'barber',
    prices: [
      {
        name: 'SPECIALTY KUT (W/ FACIAL HAIR AND BEARD LINE-UP)',
        price: '$55',
        duration: '1 hr',
      },
      { name: 'SPECIALTY KUT', price: '$45', duration: '1 hr' },
      {
        name: 'BUZZ KUT (W/ FACIAL HAIR AND BEARD LINE-UP)',
        price: '$45',
        duration: '1 hr',
      },
      { name: 'BUZZ KUT', price: '$35', duration: '1 hr' },
      {
        name: 'BALD KUT (W/ FACIAL HAIR AND BEARD LINE-UPS)',
        price: '$45',
        duration: '1 hr',
      },
      { name: 'BALD KUT', price: '$35', duration: '1 hr' },
      { name: 'LINE-UP (HEAD & FACE ONLY)', price: '$30', duration: '1 hr' },
    ],
  },
  {
    title: 'Beard and line-up combinations',
    route: '/services/beards-shaves',
    summary:
      'Facial-hair and beard line-ups are currently offered as Booksy haircut combinations and as a head-and-face line-up.',
    bookingType: 'barber',
    prices: [
      {
        name: 'SPECIALTY KUT (W/ FACIAL HAIR AND BEARD LINE-UP)',
        price: '$55',
        duration: '1 hr',
      },
      {
        name: 'BUZZ KUT (W/ FACIAL HAIR AND BEARD LINE-UP)',
        price: '$45',
        duration: '1 hr',
      },
      {
        name: 'BALD KUT (W/ FACIAL HAIR AND BEARD LINE-UPS)',
        price: '$45',
        duration: '1 hr',
      },
      { name: 'LINE-UP (HEAD & FACE ONLY)', price: '$30', duration: '1 hr' },
    ],
  },
  {
    title: 'Locs, braids and styling',
    route: '/services/locs-braids',
    summary:
      'Crowned by Steph manages current loc, braid, twist, cornrow, consultation, and styling availability through GlossGenius.',
    bookingType: 'styling',
    prices: [],
  },
  {
    title: 'Color, washing and scalp care',
    route: '/services/color-scalp-care',
    summary:
      'Ask about color, washing, detangling, drying, and scalp-care availability through the loctician booking profile.',
    bookingType: 'styling',
    prices: [],
  },
] as const;

export const team = [
  {
    name: 'KasH The Fadeologist',
    shortName: 'KasH',
    specialty: 'Barber',
    bookingType: 'barber' as BookingType,
    bookingHref: booksyUrl,
    photo:
      'https://d2zdpiztbgorvt.cloudfront.net/region1/us/71309/resource_photos/8a19ffc9a20a4a7390f4d16f85b78c-the-kut-shoppe-the-fadeologist-51cc957c99aa484f8c00410c90d9cb-booksy.png',
  },
  {
    name: 'Mr. Glen The Kut Doctor.',
    shortName: 'Mr. Glen',
    specialty: 'Barber',
    bookingType: 'barber' as BookingType,
    bookingHref: booksyUrl,
    photo:
      'https://d2zdpiztbgorvt.cloudfront.net/region1/us/71309/resource_photos/3a9c106623504120b8a088c29d0e3f-the-kut-shoppe-llc-mr-glen-the-kut-doctor-98bb73c5c67f496a841ccd98e5ba58-booksy.png',
  },
  {
    name: 'Kris-P Fades',
    shortName: 'Kris-P',
    specialty: 'Barber',
    bookingType: 'barber' as BookingType,
    bookingHref: booksyUrl,
    photo:
      'https://d2zdpiztbgorvt.cloudfront.net/region1/us/71309/resource_photos/2641be68d2ff43ebadc05f03735b7f-the-kut-shoppe-kris-p-blendz-6f421a7edcab4aedb668d3ebcbd56b-booksy.jpeg',
  },
  {
    name: 'Crowned by Steph',
    shortName: 'Steph',
    specialty: 'Loctician',
    bookingType: 'styling' as BookingType,
    bookingHref: glossGeniusUrl,
    photo: null,
  },
] as const;

export const navigation = [
  ['Services', '/services'],
  ['Gallery', '/gallery'],
  ['Crew', '/team'],
  ['Shop', '/shop'],
] as const;

export const routes: RouteDefinition[] = [
  {
    path: '/',
    label: 'Home',
    title: 'The Kut Shoppe | Barbershop & Loc Care in Stroudsburg, PA',
    description:
      'Book current barbering services or loc, braid, and retwist services with Crowned by Steph in Stroudsburg.',
    eyebrow: 'Stroudsburg, Pennsylvania',
    heading: 'Precision cuts. Loc care. Right on Main Street.',
    intro:
      'A Main Street shop bringing barbers and a loctician together for clients across Stroudsburg and the Poconos.',
    status: 'verified-live-site',
  },
  {
    path: '/services',
    label: 'Services',
    title: 'Current Barbering & Loc Services | The Kut Shoppe',
    description:
      'View current barber service names and pricing, plus the booking path for Crowned by Steph.',
    eyebrow: 'Services',
    heading: 'Current services and booking options.',
    intro:
      'Barber pricing follows the public booking profile. Loc and braid availability is confirmed through Crowned by Steph.',
    status: 'verified-booking-platform',
  },
  {
    path: '/services/haircuts',
    label: 'Adult & Teen Cuts',
    title: 'Adult & Teen Haircuts in Stroudsburg | The Kut Shoppe',
    description:
      'View current pricing for specialty, buzz, bald, and line-up services at The Kut Shoppe.',
    eyebrow: 'Barber services',
    heading: 'Adult and teen cuts, exactly as currently listed.',
    intro:
      'Current public pricing is shown for reference. The booking profile remains the final source for availability and checkout details.',
    status: 'verified-booking-platform',
  },
  {
    path: '/services/beards-shaves',
    label: 'Beard & Line-Up Combos',
    title: 'Beard & Line-Up Combinations | The Kut Shoppe',
    description:
      'View current haircut combinations that include facial-hair and beard line-ups.',
    eyebrow: 'Barber services',
    heading: 'Haircut and facial-hair combinations.',
    intro:
      'These names and prices follow the current public service menu.',
    status: 'verified-booking-platform',
  },
  {
    path: '/services/kids-cuts',
    label: 'Kids Cuts',
    title: 'Kids Haircuts in Stroudsburg | The Kut Shoppe',
    description:
      'View current pricing for children ages 3 through 12 at The Kut Shoppe.',
    eyebrow: 'Barber services',
    heading: 'Current kids services for ages 3 through 12.',
    intro:
      'Choose a specialty cut, buzz cut, or head line-up, then continue to select a barber and available time.',
    status: 'verified-booking-platform',
  },
  {
    path: '/services/locs-braids',
    label: 'Locs & Braids',
    title: 'Locs, Braids & Retwists | Crowned by Steph',
    description:
      'Continue to Crowned by Steph for current loc, braid, twist, and retwist services.',
    eyebrow: 'Crowned by Steph',
    heading: 'Locs, braids, twists, and retwists.',
    intro:
      'Current services, pricing, policies, and availability are maintained through Crowned by Steph’s booking profile.',
    status: 'verified-booking-platform',
  },
  {
    path: '/services/color-scalp-care',
    label: 'Color & Hair Care',
    title: 'Color, Washing & Hair Care | The Kut Shoppe',
    description:
      'Check current color, washing, detangling, drying, and hair-care availability through the loctician.',
    eyebrow: 'Loc and hair care',
    heading: 'Care beyond the cut.',
    intro:
      'Continue to the loctician profile for current services, pricing, policies, and available appointment times.',
    status: 'verified-booking-platform',
  },
  {
    path: '/team',
    label: 'Crew',
    title: 'Meet The Kut Shoppe Crew | Stroudsburg',
    description:
      'Meet the barbers and loctician associated with The Kut Shoppe.',
    eyebrow: 'The crew',
    heading: 'Meet the professionals behind the shop.',
    intro:
      'Choose a professional and continue directly to the booking profile that manages their current availability.',
    status: 'verified-booking-platform',
  },
  {
    path: '/gallery',
    label: 'Gallery',
    title: 'Haircut, Loc & Braid Gallery | The Kut Shoppe',
    description:
      'Explore featured haircut, loc, braid, beard, and design work from The Kut Shoppe.',
    eyebrow: 'Portfolio',
    heading: 'Real work from the shop.',
    intro:
      'Browse a representative selection, then visit Instagram for current shop updates and recent work.',
    status: 'verified-live-site',
  },
  {
    path: '/shop',
    label: 'Shop',
    title: 'Shop Grooming & Hair-Care Products | The Kut Shoppe',
    description:
      'Explore the future online home for approved grooming, hair-care, accessory, and Kut Shoppe merchandise.',
    eyebrow: 'The Kut Shoppe store',
    heading: 'Products for the look between appointments.',
    intro:
      'The store is being structured for verified inventory, clear categories, secure checkout, and future customer accounts.',
    status: 'requires-verification',
  },
  {
    path: '/products',
    label: 'Products',
    title: 'Shop | The Kut Shoppe',
    description: 'Continue to The Kut Shoppe store.',
    eyebrow: 'Shop',
    heading: 'Continue to the shop.',
    intro: 'The product area now lives at /shop.',
    status: 'verified-live-site',
  },
  {
    path: '/account',
    label: 'Account',
    title: 'Customer Account | The Kut Shoppe',
    description:
      'Customer account access for future orders, saved details, and preferences.',
    eyebrow: 'Account',
    heading: 'Your future customer account.',
    intro:
      'Account access will become available when first-party online ordering is enabled.',
    status: 'placeholder',
  },
  {
    path: '/about',
    label: 'Crew',
    title: 'Meet The Kut Shoppe Crew | Stroudsburg',
    description: 'Continue to The Kut Shoppe crew page.',
    eyebrow: 'Crew',
    heading: 'Continue to the crew.',
    intro: 'The team experience now lives at /team.',
    status: 'verified-live-site',
  },
  {
    path: '/reviews',
    label: 'Reviews',
    title: 'Verified Client Reviews | The Kut Shoppe',
    description:
      'Read verified client feedback and visit The Kut Shoppe’s current barber booking profile.',
    eyebrow: 'Client trust',
    heading: 'A reputation built one appointment at a time.',
    intro:
      'The public barber booking profile currently shows a 5.0 rating from hundreds of verified client reviews.',
    status: 'verified-booking-platform',
  },
  {
    path: '/visit',
    label: 'Visit',
    title: 'Visit The Kut Shoppe | 518 Main Street, Stroudsburg',
    description:
      'Find The Kut Shoppe at 518 Main Street in Stroudsburg and review appointment guidance.',
    eyebrow: 'Visit',
    heading: 'Find us in downtown Stroudsburg.',
    intro:
      'Call or book before visiting. Walk-ins are welcomed when availability allows.',
    status: 'verified-live-site',
  },
  {
    path: '/book',
    label: 'Book',
    title: 'Book an Appointment | The Kut Shoppe',
    description:
      'Book barber services or loc, braid, and retwist services with Crowned by Steph.',
    eyebrow: 'Appointments',
    heading: 'Choose the professional service you need.',
    intro:
      'Choose the option that matches your appointment. Each professional maintains current availability and policies through their booking profile.',
    status: 'verified-booking-platform',
  },
  {
    path: '/contact',
    label: 'Contact',
    title: 'Contact The Kut Shoppe | Stroudsburg, PA',
    description:
      'Call The Kut Shoppe for service guidance, walk-in questions, or help finding the correct booking option.',
    eyebrow: 'Contact',
    heading: 'Call the shop when you need guidance.',
    intro:
      'For the fastest answer, call the shop directly or use the booking option for your service.',
    status: 'verified-live-site',
  },
  {
    path: '/privacy',
    label: 'Privacy',
    title: 'Privacy Policy | The Kut Shoppe',
    description: 'Read The Kut Shoppe website privacy policy.',
    eyebrow: 'Legal',
    heading: 'Privacy information.',
    intro:
      'Final privacy language will reflect the analytics, commerce, account, and contact services enabled for production.',
    status: 'placeholder',
  },
  {
    path: '/terms',
    label: 'Terms',
    title: 'Website Terms | The Kut Shoppe',
    description: 'Read The Kut Shoppe website terms.',
    eyebrow: 'Legal',
    heading: 'Website terms.',
    intro:
      'Final terms will distinguish this website from the policies maintained by external booking and future commerce providers.',
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
