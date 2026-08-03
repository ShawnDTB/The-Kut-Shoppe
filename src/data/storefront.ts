import { normalizeEmail, normalizePhone } from './auth';
import { queueNotification, subscribeToPlatformChanges } from './notifications';

export const productCategories = [
  'Accessories',
  'Books',
  'Grooming',
  'Hair care',
  'Merchandise',
  'Tools',
] as const;

export type ProductCategory = typeof productCategories[number];
export type ProductStatus = 'draft' | 'published' | 'archived';
export type FulfillmentType = 'pickup' | 'shipping';
export type OrderStatus =
  | 'submitted'
  | 'accepted'
  | 'payment-required'
  | 'preparing'
  | 'ready-for-pickup'
  | 'shipped'
  | 'completed'
  | 'declined'
  | 'cancelled';

export interface ProductImage {
  id: string;
  src: string;
  alt: string;
  source: 'upload' | 'url';
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  stockOnHand: number;
  imageId: string | null;
  active: boolean;
}

export interface StoreProduct {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  description: string;
  baseSku: string;
  skuManuallyEdited: boolean;
  images: ProductImage[];
  amazonUrl: string;
  pickupEnabled: boolean;
  shippingEnabled: boolean;
  weightOunces: number;
  packageLengthInches: number;
  packageWidthInches: number;
  packageHeightInches: number;
  status: ProductStatus;
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductPreset {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  pickupEnabled: boolean;
  shippingEnabled: boolean;
  variantNames: string[];
  createdAt: string;
}

export interface CartItem {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface StoreOrder {
  id: string;
  items: Array<{
    productId: string;
    variantId: string;
    name: string;
    variantName: string;
    sku: string;
    quantity: number;
    unitPriceCents: number;
  }>;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  fulfillment: FulfillmentType;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  shippingAddress: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
  } | null;
  status: OrderStatus;
  ownerActionRequired: boolean;
  trackingNumber: string;
  internalNote: string;
  createdAt: string;
  updatedAt: string;
}

export const productIdeaTemplates: ProductPreset[] = [
  {
    id: 'template-accessory',
    name: 'Durag or wearable accessory',
    category: 'Accessories',
    description: '',
    pickupEnabled: true,
    shippingEnabled: true,
    variantNames: ['New color'],
    createdAt: '',
  },
  {
    id: 'template-book',
    name: 'Book inventory',
    category: 'Books',
    description: '',
    pickupEnabled: true,
    shippingEnabled: true,
    variantNames: ['Paperback'],
    createdAt: '',
  },
  {
    id: 'template-gel',
    name: 'Gel or styling product',
    category: 'Hair care',
    description: '',
    pickupEnabled: true,
    shippingEnabled: true,
    variantNames: ['Default'],
    createdAt: '',
  },
  {
    id: 'template-comb',
    name: 'Comb',
    category: 'Tools',
    description: '',
    pickupEnabled: true,
    shippingEnabled: true,
    variantNames: ['Default'],
    createdAt: '',
  },
  {
    id: 'template-pick',
    name: 'Hair pick',
    category: 'Tools',
    description: '',
    pickupEnabled: true,
    shippingEnabled: true,
    variantNames: ['Default'],
    createdAt: '',
  },
].sort((a, b) => a.name.localeCompare(b.name));

export const storefrontStorageKeys = {
  products: 'kut-shoppe.products.v2',
  presets: 'kut-shoppe.product-presets.v2',
  cart: 'kut-shoppe.cart.v2',
  orders: 'kut-shoppe.orders.v2',
  flash: 'kut-shoppe.storefront-flash.v2',
} as const;

const activeReservationStatuses = new Set<OrderStatus>([
  'submitted',
  'accepted',
  'payment-required',
  'preparing',
  'ready-for-pickup',
  'shipped',
]);

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'product';
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('kut-shoppe-platform-change'));
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

const categoryCodes: Record<ProductCategory, string> = {
  Accessories: 'ACC',
  Books: 'BOK',
  Grooming: 'GRM',
  'Hair care': 'HRC',
  Merchandise: 'MER',
  Tools: 'TLS',
};

function productNameCode(name: string) {
  const compact = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (compact || 'ITEM').slice(0, 5).padEnd(5, 'X');
}

export function generateProductSku(category: ProductCategory, name: string, sequence = 1) {
  return `TKS-${categoryCodes[category]}-${productNameCode(name)}-${String(sequence).padStart(3, '0')}`;
}

export function generateVariantSku(baseSku: string, variantName: string, index: number) {
  const variantCode = productNameCode(variantName).slice(0, 4);
  return `${baseSku}-${variantCode}-${String(index + 1).padStart(2, '0')}`;
}

function createVariant(name: string, baseSku: string, index: number): ProductVariant {
  return {
    id: createId('variant'),
    name,
    sku: generateVariantSku(baseSku, name, index),
    priceCents: 0,
    stockOnHand: 0,
    imageId: null,
    active: true,
  };
}

export function createProductDraft(preset?: ProductPreset): StoreProduct {
  const name = preset?.name === 'Book inventory' ? '' : preset?.name ?? '';
  const category = preset?.category ?? 'Accessories';
  const baseSku = generateProductSku(category, name, 1);
  const now = new Date().toISOString();
  const variantNames = preset?.variantNames.length ? preset.variantNames : ['Default'];

  return {
    id: createId('product'),
    slug: slugify(name),
    name,
    category,
    description: preset?.description ?? '',
    baseSku,
    skuManuallyEdited: false,
    images: [],
    amazonUrl: '',
    pickupEnabled: preset?.pickupEnabled ?? true,
    shippingEnabled: preset?.shippingEnabled ?? false,
    weightOunces: 0,
    packageLengthInches: 0,
    packageWidthInches: 0,
    packageHeightInches: 0,
    status: 'draft',
    variants: variantNames.map((variantName, index) => createVariant(variantName, baseSku, index)),
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeProduct(product: StoreProduct): StoreProduct {
  const baseSku = product.baseSku || generateProductSku(product.category, product.name, 1);
  const variants = product.variants?.length
    ? product.variants
    : [createVariant('Default', baseSku, 0)];

  return {
    ...product,
    slug: product.slug || slugify(product.name),
    baseSku,
    skuManuallyEdited: product.skuManuallyEdited ?? false,
    images: product.images ?? [],
    variants,
    createdAt: product.createdAt ?? product.updatedAt,
  };
}

export function readProducts() {
  return readJson<StoreProduct[]>(storefrontStorageKeys.products, [])
    .map(normalizeProduct)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function uniqueSlug(product: StoreProduct, products: StoreProduct[]) {
  const base = slugify(product.name);
  let candidate = base;
  let index = 2;
  while (products.some((item) => item.id !== product.id && item.slug === candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  return candidate;
}

export function saveProduct(product: StoreProduct) {
  const products = readProducts();
  const normalized: StoreProduct = {
    ...normalizeProduct(product),
    slug: uniqueSlug(product, products),
    updatedAt: new Date().toISOString(),
  };
  const next = [...products.filter((item) => item.id !== product.id), normalized]
    .sort((a, b) => a.name.localeCompare(b.name));
  writeJson(storefrontStorageKeys.products, next);
  return normalized;
}

export function deleteProduct(productId: string) {
  const next = readProducts().filter((product) => product.id !== productId);
  writeJson(storefrontStorageKeys.products, next);
  return next;
}

export function getProductBySlug(slug: string) {
  return readProducts().find((product) => product.slug === slug) ?? null;
}

export function readProductPresets() {
  return readJson<ProductPreset[]>(storefrontStorageKeys.presets, [])
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function saveProductPreset(product: StoreProduct, presetName: string) {
  const preset: ProductPreset = {
    id: createId('preset'),
    name: presetName.trim() || `${product.category} preset`,
    category: product.category,
    description: product.description,
    pickupEnabled: product.pickupEnabled,
    shippingEnabled: product.shippingEnabled,
    variantNames: product.variants.map((variant) => variant.name),
    createdAt: new Date().toISOString(),
  };
  writeJson(storefrontStorageKeys.presets, [...readProductPresets(), preset]);
  return preset;
}

export function deleteProductPreset(presetId: string) {
  const next = readProductPresets().filter((preset) => preset.id !== presetId);
  writeJson(storefrontStorageKeys.presets, next);
  return next;
}

export function readCart() {
  return readJson<CartItem[]>(storefrontStorageKeys.cart, []);
}

export function saveCart(cart: CartItem[]) {
  writeJson(storefrontStorageKeys.cart, cart);
  return cart;
}

export function readOrders() {
  return readJson<StoreOrder[]>(storefrontStorageKeys.orders, [])
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getReservedQuantity(productId: string, variantId: string, orders = readOrders()) {
  return orders
    .filter((order) => activeReservationStatuses.has(order.status))
    .flatMap((order) => order.items)
    .filter((item) => item.productId === productId && item.variantId === variantId)
    .reduce((total, item) => total + item.quantity, 0);
}

export function getAvailableStock(product: StoreProduct, variant: ProductVariant, orders = readOrders()) {
  return Math.max(0, variant.stockOnHand - getReservedQuantity(product.id, variant.id, orders));
}

export function addToCart(productId: string, variantId: string, quantity = 1) {
  const product = readProducts().find((item) => item.id === productId);
  const variant = product?.variants.find((item) => item.id === variantId);
  if (!product || !variant) return readCart();

  const available = getAvailableStock(product, variant);
  if (available <= 0) return readCart();

  const cart = readCart();
  const existing = cart.find((item) => item.productId === productId && item.variantId === variantId);
  const desired = Math.min(available, (existing?.quantity ?? 0) + quantity);
  const next = existing
    ? cart.map((item) => item.productId === productId && item.variantId === variantId ? { ...item, quantity: desired } : item)
    : [...cart, { productId, variantId, quantity: Math.min(quantity, available) }];
  return saveCart(next);
}

export function updateCartQuantity(productId: string, variantId: string, quantity: number) {
  const product = readProducts().find((item) => item.id === productId);
  const variant = product?.variants.find((item) => item.id === variantId);
  const cart = readCart();
  if (!product || !variant || quantity <= 0) {
    return saveCart(cart.filter((item) => !(item.productId === productId && item.variantId === variantId)));
  }

  const available = getAvailableStock(product, variant);
  const next = cart.map((item) => (
    item.productId === productId && item.variantId === variantId
      ? { ...item, quantity: Math.max(1, Math.min(quantity, available)) }
      : item
  ));
  return saveCart(next);
}

export function clearCart() {
  return saveCart([]);
}

function queueOrderNotification(order: StoreOrder) {
  const templates: Partial<Record<OrderStatus, 'order-submitted' | 'order-accepted' | 'order-ready' | 'order-shipped' | 'order-declined'>> = {
    submitted: 'order-submitted',
    'payment-required': 'order-submitted',
    accepted: 'order-accepted',
    'ready-for-pickup': 'order-ready',
    shipped: 'order-shipped',
    declined: 'order-declined',
  };
  const template = templates[order.status];
  if (!template) return;

  const subject = order.status === 'submitted' || order.status === 'payment-required'
    ? 'The Kut Shoppe received your order request'
    : order.status === 'accepted'
      ? 'The Kut Shoppe accepted your order'
      : order.status === 'ready-for-pickup'
        ? 'Your Kut Shoppe order is ready for pickup'
        : order.status === 'shipped'
          ? 'Your Kut Shoppe order has shipped'
          : 'Update about your Kut Shoppe order';
  const message = `${order.customer.name}, order ${order.id} is now ${order.status.replaceAll('-', ' ')}.`;

  queueNotification({
    channel: 'email',
    template,
    recipient: order.customer.email,
    subject,
    message,
    relatedType: 'order',
    relatedId: order.id,
  });
  queueNotification({
    channel: 'sms',
    template,
    recipient: order.customer.phone,
    subject,
    message,
    relatedType: 'order',
    relatedId: order.id,
  });
}

export function saveOrder(order: StoreOrder) {
  const normalized: StoreOrder = {
    ...order,
    customer: {
      ...order.customer,
      email: normalizeEmail(order.customer.email),
      phone: normalizePhone(order.customer.phone),
    },
    updatedAt: new Date().toISOString(),
  };
  const orders = readOrders();
  const next = [...orders.filter((item) => item.id !== normalized.id), normalized];
  writeJson(storefrontStorageKeys.orders, next);
  clearCart();
  queueOrderNotification(normalized);
  return normalized;
}

export function createOrder(input: Omit<StoreOrder, 'id' | 'status' | 'ownerActionRequired' | 'createdAt' | 'updatedAt'>) {
  const now = new Date().toISOString();
  const order: StoreOrder = {
    ...input,
    id: createId('order'),
    status: input.fulfillment === 'shipping' ? 'payment-required' : 'submitted',
    ownerActionRequired: true,
    createdAt: now,
    updatedAt: now,
  };
  return saveOrder(order);
}

export function updateOrder(orderId: string, patch: Partial<StoreOrder>) {
  const current = readOrders().find((order) => order.id === orderId);
  if (!current) return null;
  const next: StoreOrder = {
    ...current,
    ...patch,
    id: current.id,
    updatedAt: new Date().toISOString(),
  };
  const orders = readOrders();
  writeJson(storefrontStorageKeys.orders, [...orders.filter((order) => order.id !== orderId), next]);
  if (patch.status && patch.status !== current.status) queueOrderNotification(next);
  return next;
}

export function setStorefrontFlash(message: string) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(storefrontStorageKeys.flash, message);
}

export function consumeStorefrontFlash() {
  if (typeof window === 'undefined') return '';
  const message = window.sessionStorage.getItem(storefrontStorageKeys.flash) ?? '';
  window.sessionStorage.removeItem(storefrontStorageKeys.flash);
  return message;
}

export function subscribeToStorefrontChanges(callback: () => void) {
  return subscribeToPlatformChanges(callback);
}
