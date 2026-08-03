export type CommerceStatus = 'catalog-preparation' | 'ready' | 'disabled';

export interface ShopCategory {
  slug: string;
  name: string;
  description: string;
  status: CommerceStatus;
}

export const shopCategories: readonly ShopCategory[] = [
  {
    slug: 'grooming',
    name: 'Grooming',
    description: 'Beard, shave, finishing, and maintenance products approved by the shop.',
    status: 'catalog-preparation',
  },
  {
    slug: 'hair-care',
    name: 'Hair care',
    description: 'Cleansing, conditioning, scalp, loc, braid, and styling care products.',
    status: 'catalog-preparation',
  },
  {
    slug: 'accessories',
    name: 'Accessories',
    description: 'Approved tools and accessories for maintaining the finished look.',
    status: 'catalog-preparation',
  },
  {
    slug: 'merchandise',
    name: 'Kut Shoppe merchandise',
    description: 'Shop-branded apparel and merchandise when approved inventory is available.',
    status: 'catalog-preparation',
  },
] as const;

export const commerceRoutes = {
  shop: '/shop',
  category: '/shop/category/:slug',
  product: '/shop/product/:slug',
  cart: '/cart',
  checkout: '/checkout',
  account: '/account',
} as const;

export const commerceReadiness = {
  inventoryVerified: false,
  paymentsConfigured: false,
  shippingConfigured: false,
  taxConfigured: false,
  accountEnabled: false,
} as const;
