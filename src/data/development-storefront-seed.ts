import { readProducts, saveProduct, type StoreProduct } from './storefront';

const previewSeedKey = 'kut-shoppe.preview-products-seeded.v1';
const previewTimestamp = '2026-08-03T00:00:00.000Z';

function previewImage(label: string, subtitle: string, mark: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 700" role="img" aria-label="${label}">
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#171717"/>
        <stop offset="1" stop-color="#080808"/>
      </linearGradient>
      <pattern id="pole" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
        <rect width="80" height="80" fill="transparent"/>
        <rect width="16" height="80" fill="#f3f3f3" opacity=".05"/>
        <rect x="40" width="10" height="80" fill="#9e1b2b" opacity=".18"/>
      </pattern>
    </defs>
    <rect width="900" height="700" fill="url(#background)"/>
    <rect width="900" height="700" fill="url(#pole)"/>
    <rect x="58" y="58" width="784" height="584" fill="none" stroke="#f3f3f3" stroke-opacity=".2"/>
    <text x="450" y="300" text-anchor="middle" fill="#f3f3f3" font-family="Georgia, serif" font-size="160">${mark}</text>
    <text x="450" y="430" text-anchor="middle" fill="#f3f3f3" font-family="Arial, sans-serif" font-size="42" font-weight="700" letter-spacing="4">${label.toUpperCase()}</text>
    <text x="450" y="485" text-anchor="middle" fill="#a8a8a8" font-family="Arial, sans-serif" font-size="24" letter-spacing="3">${subtitle.toUpperCase()}</text>
    <text x="450" y="575" text-anchor="middle" fill="#d6a2a8" font-family="Arial, sans-serif" font-size="18" letter-spacing="4">LOCAL PREVIEW PRODUCT</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const previewProducts: StoreProduct[] = [
  {
    id: 'preview-product-pomade',
    slug: 'preview-matte-pomade',
    name: 'Preview Matte Pomade',
    category: 'Grooming',
    description: 'Development-only sample product used to test a single-option purchase, pickup, shipping, cart quantity, and checkout.',
    baseSku: 'TKS-PREVIEW-POMADE',
    skuManuallyEdited: true,
    images: [{ id: 'preview-image-pomade', src: previewImage('Matte Pomade', 'Grooming', 'P'), alt: 'Preview graphic for a matte pomade test product', source: 'url' }],
    amazonUrl: '',
    pickupEnabled: true,
    shippingEnabled: true,
    weightOunces: 4,
    packageLengthInches: 4,
    packageWidthInches: 4,
    packageHeightInches: 3,
    status: 'published',
    variants: [{ id: 'preview-variant-pomade', name: '4 oz jar', sku: 'TKS-PREVIEW-POMADE-4OZ', priceCents: 1499, stockOnHand: 12, imageId: 'preview-image-pomade', active: true }],
    createdAt: previewTimestamp,
    updatedAt: previewTimestamp,
  },
  {
    id: 'preview-product-durag',
    slug: 'preview-satin-durag',
    name: 'Preview Satin Durag',
    category: 'Accessories',
    description: 'Development-only sample with multiple colors so option selection, variant inventory, product detail, and cart behavior can be reviewed.',
    baseSku: 'TKS-PREVIEW-DURAG',
    skuManuallyEdited: true,
    images: [{ id: 'preview-image-durag', src: previewImage('Satin Durag', 'Accessories', 'D'), alt: 'Preview graphic for a satin durag test product', source: 'url' }],
    amazonUrl: '',
    pickupEnabled: true,
    shippingEnabled: true,
    weightOunces: 3,
    packageLengthInches: 8,
    packageWidthInches: 6,
    packageHeightInches: 1,
    status: 'published',
    variants: [
      { id: 'preview-variant-durag-black', name: 'Black', sku: 'TKS-PREVIEW-DURAG-BLK', priceCents: 999, stockOnHand: 8, imageId: 'preview-image-durag', active: true },
      { id: 'preview-variant-durag-burgundy', name: 'Burgundy', sku: 'TKS-PREVIEW-DURAG-BUR', priceCents: 1099, stockOnHand: 5, imageId: 'preview-image-durag', active: true },
      { id: 'preview-variant-durag-silver', name: 'Silver', sku: 'TKS-PREVIEW-DURAG-SLV', priceCents: 1099, stockOnHand: 4, imageId: 'preview-image-durag', active: true },
    ],
    createdAt: previewTimestamp,
    updatedAt: previewTimestamp,
  },
  {
    id: 'preview-product-comb',
    slug: 'preview-wide-tooth-comb',
    name: 'Preview Wide-Tooth Comb',
    category: 'Tools',
    description: 'Development-only single-option tool used to review compact product cards, inventory limits, pickup, and direct add-to-cart behavior.',
    baseSku: 'TKS-PREVIEW-COMB',
    skuManuallyEdited: true,
    images: [{ id: 'preview-image-comb', src: previewImage('Wide-Tooth Comb', 'Tools', 'C'), alt: 'Preview graphic for a wide-tooth comb test product', source: 'url' }],
    amazonUrl: '',
    pickupEnabled: true,
    shippingEnabled: false,
    weightOunces: 2,
    packageLengthInches: 9,
    packageWidthInches: 3,
    packageHeightInches: 1,
    status: 'published',
    variants: [{ id: 'preview-variant-comb', name: 'Black', sku: 'TKS-PREVIEW-COMB-BLK', priceCents: 699, stockOnHand: 16, imageId: 'preview-image-comb', active: true }],
    createdAt: previewTimestamp,
    updatedAt: previewTimestamp,
  },
  {
    id: 'preview-product-oil',
    slug: 'preview-beard-conditioning-oil',
    name: 'Preview Beard Conditioning Oil',
    category: 'Grooming',
    description: 'Development-only product used to test size variants, price ranges, stock differences, shipping eligibility, and order review.',
    baseSku: 'TKS-PREVIEW-BEARDOIL',
    skuManuallyEdited: true,
    images: [{ id: 'preview-image-oil', src: previewImage('Beard Oil', 'Grooming', 'B'), alt: 'Preview graphic for a beard conditioning oil test product', source: 'url' }],
    amazonUrl: '',
    pickupEnabled: true,
    shippingEnabled: true,
    weightOunces: 4,
    packageLengthInches: 5,
    packageWidthInches: 3,
    packageHeightInches: 3,
    status: 'published',
    variants: [
      { id: 'preview-variant-oil-one', name: '1 oz', sku: 'TKS-PREVIEW-BEARDOIL-1OZ', priceCents: 1199, stockOnHand: 9, imageId: 'preview-image-oil', active: true },
      { id: 'preview-variant-oil-two', name: '2 oz', sku: 'TKS-PREVIEW-BEARDOIL-2OZ', priceCents: 1899, stockOnHand: 6, imageId: 'preview-image-oil', active: true },
    ],
    createdAt: previewTimestamp,
    updatedAt: previewTimestamp,
  },
];

export function isDevelopmentPreviewProduct(product: StoreProduct) {
  return product.id.startsWith('preview-product-');
}

export function ensureDevelopmentStorefrontSeed() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  if (readProducts().length || window.localStorage.getItem(previewSeedKey)) return false;
  previewProducts.forEach((product) => saveProduct(product));
  window.localStorage.setItem(previewSeedKey, 'seeded');
  return true;
}
