export type CommerceStatus = 'catalog-preparation' | 'ready' | 'disabled';
export type PlatformStatus = 'available-now' | 'in-development' | 'requires-approval';

export interface ShopCategory {
  slug: string;
  name: string;
  description: string;
  status: CommerceStatus;
}

export interface PlatformCapability {
  title: string;
  description: string;
  status: PlatformStatus;
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

export const shopLaunchCapabilities: readonly PlatformCapability[] = [
  {
    title: 'Verified catalog',
    description: 'Only products confirmed by The Kut Shoppe will be published with approved photos, details, and pricing.',
    status: 'in-development',
  },
  {
    title: 'Secure checkout',
    description: 'Payment, tax, fulfillment, refund, and privacy requirements will be completed before online orders open.',
    status: 'in-development',
  },
  {
    title: 'Clear fulfillment',
    description: 'Pickup, shipping, and inventory rules will be displayed only after the shop approves how each option works.',
    status: 'requires-approval',
  },
] as const;

export const accountCapabilities: readonly PlatformCapability[] = [
  {
    title: 'Orders and receipts',
    description: 'Review completed online orders and the information provided during checkout.',
    status: 'in-development',
  },
  {
    title: 'Saved checkout details',
    description: 'Optionally save approved contact and delivery information for a faster future checkout.',
    status: 'in-development',
  },
  {
    title: 'Fulfillment updates',
    description: 'Follow pickup or shipping progress when those fulfillment options are approved and enabled.',
    status: 'requires-approval',
  },
  {
    title: 'Product preferences',
    description: 'Return to approved products and reorder eligible items when the verified catalog supports it.',
    status: 'in-development',
  },
] as const;

export const accountBoundary =
  'Appointments remain with each professional’s current booking profile. They will not appear inside a Kut Shoppe account unless a secure integration is approved later.';

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
