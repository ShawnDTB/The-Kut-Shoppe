const mediaRoot = '/media';
const galleryRoot = '/media';

export const originalAssets = {
  logo: `${mediaRoot}/a2e8fdecb672406ba74a28a19b4063-the-kut-shoppe-llc-logo-5175fdd512c54b42b4da939b84353a-booksy.webp`,
  hero: [
    `${mediaRoot}/Screenshot_20221226_011226.webp`,
    `${mediaRoot}/Screenshot_20221226_010224.webp`,
    `${mediaRoot}/116349555_2729516800613989_1244638744107863079_n.webp`,
    `${mediaRoot}/248722629_609910650359815_1940157589140309591_n.webp`,
  ],
  introPhoto: `${mediaRoot}/Screenshot-3.webp`,
  trustPhoto: `${mediaRoot}/Screenshot-2.webp`,
  productsPhoto: `${mediaRoot}/displaycasxe.webp`,
  firstDivider: `${mediaRoot}/shaving-accessories-and-tools-in-barber-shop-VSFV5XH.webp`,
  secondDivider: `${mediaRoot}/tattooed-barber-trimming-bearded-man-with-shaving-SGQDLF4.webp`,
} as const;

export const featureItems = [
  {
    icon: `${mediaRoot}/3-Icon.webp`,
    title: 'Skilled veteran professionals',
    text: 'Services for a diverse range of clients, from kids and seniors to women and longtime regulars.',
  },
  {
    icon: `${mediaRoot}/2-Icon.webp`,
    title: 'A customized grooming experience',
    text: 'Fades, tapers, locs, cornrows, braids, twists, shape-ups, beard work, and more through one Main Street shop.',
  },
  {
    icon: `${mediaRoot}/1-Icon.webp`,
    title: 'Hair care beyond the appointment',
    text: 'A selection of grooming and hair-care products is promoted through the shop for at-home maintenance.',
  },
] as const;

export const serviceHighlights = [
  {
    title: 'Haircuts',
    route: '/services/haircuts',
    icon: 'scissors',
    description: 'Scissor cuts, afros, flattops, mohawks, fades, tapers, Caesars, buzz cuts, shape-ups, and bald cuts.',
  },
  {
    title: 'Shaving',
    route: '/services/beards-shaves',
    icon: 'razor',
    description: 'Straight-razor detailing and clean facial line-ups for a sharper finished look.',
  },
  {
    title: 'Beard trims',
    route: '/services/beards-shaves',
    icon: 'beard',
    description: 'Facial-hair shape-ups and line-ups designed to complement a fresh cut or fade.',
  },
  {
    title: 'Hair coloring',
    route: '/services/color-scalp-care',
    icon: 'color',
    description: 'One-step and two-step color services, with additional options discussed during booking or consultation.',
  },
  {
    title: 'Scalp treatments',
    route: '/services/color-scalp-care',
    icon: 'scalp',
    description: 'Hair washing, scalp care, detangling, blow-drying, and related treatments beyond the cut itself.',
  },
  {
    title: 'Locs and styling',
    route: '/services/locs-braids',
    icon: 'locs',
    description: 'Locs, retwists, cornrows, twists, braids, washing, detangling, trims, silk presses, and more.',
  },
] as const;

export const galleryItems = [
  {
    src: `${galleryRoot}/Taper-1.webp`,
    title: 'Clean taper',
    category: 'Fades and tapers',
    alt: 'Clean taper haircut from The Kut Shoppe gallery',
  },
  {
    src: `${galleryRoot}/Scissorcut.webp`,
    title: 'Classic scissor cut',
    category: 'Classic cuts',
    alt: 'Classic scissor haircut from The Kut Shoppe gallery',
  },
  {
    src: `${galleryRoot}/Design-1.webp`,
    title: 'Custom design',
    category: 'Designs and details',
    alt: 'Custom hair design from The Kut Shoppe gallery',
  },
  {
    src: `${galleryRoot}/Bald-and-Beard-1.webp`,
    title: 'Bald cut and beard detail',
    category: 'Beards and details',
    alt: 'Bald cut and beard work from The Kut Shoppe gallery',
  },
  {
    src: `${galleryRoot}/Braid-Locs-11.webp`,
    title: 'Loc styling',
    category: 'Locs and styling',
    alt: 'Loc styling from The Kut Shoppe gallery',
  },
  {
    src: `${galleryRoot}/Braids-Locs-1.webp`,
    title: 'Braided style',
    category: 'Braids and styling',
    alt: 'Braided hairstyle from The Kut Shoppe gallery',
  },
  {
    src: `${galleryRoot}/Caesar_Buzzcut-1.webp`,
    title: 'Kids Caesar cut',
    category: 'Kids cuts',
    alt: 'Kids Caesar or buzz cut from The Kut Shoppe gallery',
  },
  {
    src: `${galleryRoot}/KidsFade-1.webp`,
    title: 'Kids fade',
    category: 'Kids cuts',
    alt: 'Kids fade from The Kut Shoppe gallery',
  },
  {
    src: `${galleryRoot}/FirstCutCertificate-3.webp`,
    title: 'First cut certificate',
    category: 'First cuts',
    alt: 'First haircut certificate experience from The Kut Shoppe gallery',
  },
] as const;

export const teamPortraits = [
  `${mediaRoot}/b521fb91846b4912bcf89cb676f6fe-the-kut-shoppe-llc-inspiration-6d4b772c52f84dcb8af50f0766a068-booksy.webp`,
  `${mediaRoot}/fa1a7071815a4526b184301c3e7080-the-kut-shoppe-llc-inspiration-27244e73fa644d338ae5080ebaf27c-booksy.webp`,
  `${mediaRoot}/279b398b746b47c3b584ff26907608-the-kut-shoppe-llc-inspiration-18a0bfc98974498999b18db892b5ad-booksy.webp`,
  `${mediaRoot}/14becf6b3de4465fab8cf78acce292-the-kut-shoppe-llc-inspiration-0604d68ee1534f7387d707b8df3b50-booksy.webp`,
] as const;

export const shopStandards = [
  'A clean cape for each client',
  'Work surfaces disinfected between appointments',
  'Hand-washing access and disposable supplies when possible',
  'Contactless payment options',
  'Time to discuss the cut, style, and finished look',
] as const;
