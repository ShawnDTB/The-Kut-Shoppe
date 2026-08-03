export type ProductStatus = 'draft' | 'published' | 'archived';
export type FulfillmentType = 'pickup' | 'shipping';
export type OrderStatus = 'pickup-confirmed' | 'payment-required' | 'cancelled' | 'completed';

export interface StoreProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  sku: string;
  priceCents: number;
  stockOnHand: number;
  imageUrl: string;
  amazonUrl: string;
  pickupEnabled: boolean;
  shippingEnabled: boolean;
  weightOunces: number;
  packageLengthInches: number;
  packageWidthInches: number;
  packageHeightInches: number;
  status: ProductStatus;
  updatedAt: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface StoreOrder {
  id: string;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
  }>;
  subtotalCents: number;
  fulfillment: FulfillmentType;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  shippingAddress?: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
  };
  status: OrderStatus;
  createdAt: string;
}

export const productIdeaTemplates = [
  {
    name: 'Existing book inventory',
    category: 'Books',
    guidance: 'Add the exact title, author credit, Amazon URL, direct-sale price, on-hand quantity, weight, and cover image.',
  },
  {
    name: 'Durags',
    category: 'Accessories',
    guidance: 'Create separate variants or products for each approved color, material, and price.',
  },
  {
    name: 'Combs',
    category: 'Tools',
    guidance: 'Record brand, style, price, quantity, and whether the item can ship.',
  },
  {
    name: 'Hair picks',
    category: 'Tools',
    guidance: 'Record brand, material, price, quantity, and fulfillment options.',
  },
  {
    name: 'Hair gels and care products',
    category: 'Hair care',
    guidance: 'Record exact product name, size, ingredients or manufacturer details, price, and inventory.',
  },
] as const;

export const storefrontStorageKeys = {
  products: 'kut-shoppe.products.v1',
  cart: 'kut-shoppe.cart.v1',
  orders: 'kut-shoppe.orders.v1',
} as const;

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
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function readProducts() {
  return readJson<StoreProduct[]>(storefrontStorageKeys.products, []);
}

export function saveProduct(product: StoreProduct) {
  const products = readProducts();
  const next = [...products.filter((item) => item.id !== product.id), product];
  writeJson(storefrontStorageKeys.products, next);
  return next;
}

export function deleteProduct(productId: string) {
  const next = readProducts().filter((product) => product.id !== productId);
  writeJson(storefrontStorageKeys.products, next);
  return next;
}

export function createProductDraft(): StoreProduct {
  return {
    id: `product-${Date.now()}`,
    name: '',
    category: 'Books',
    description: '',
    sku: '',
    priceCents: 0,
    stockOnHand: 0,
    imageUrl: '',
    amazonUrl: '',
    pickupEnabled: true,
    shippingEnabled: false,
    weightOunces: 0,
    packageLengthInches: 0,
    packageWidthInches: 0,
    packageHeightInches: 0,
    status: 'draft',
    updatedAt: new Date().toISOString(),
  };
}

export function readCart() {
  return readJson<CartItem[]>(storefrontStorageKeys.cart, []);
}

function clampCartToInventory(cart: CartItem[]) {
  const products = new Map(readProducts().map((product) => [product.id, product]));

  return cart.flatMap((item) => {
    const product = products.get(item.productId);
    if (!product || product.status !== 'published' || product.stockOnHand <= 0) return [];

    return [{
      productId: item.productId,
      quantity: Math.min(Math.max(1, Math.floor(item.quantity)), product.stockOnHand),
    }];
  });
}

export function saveCart(cart: CartItem[]) {
  const next = clampCartToInventory(cart);
  writeJson(storefrontStorageKeys.cart, next);
  return next;
}

export function addToCart(productId: string, quantity = 1) {
  const cart = readCart();
  const existing = cart.find((item) => item.productId === productId);
  const next = existing
    ? cart.map((item) => item.productId === productId ? { ...item, quantity: item.quantity + quantity } : item)
    : [...cart, { productId, quantity }];
  return saveCart(next);
}

export function updateCartQuantity(productId: string, quantity: number) {
  const next = quantity <= 0
    ? readCart().filter((item) => item.productId !== productId)
    : readCart().map((item) => item.productId === productId ? { ...item, quantity } : item);
  return saveCart(next);
}

export function clearCart() {
  return saveCart([]);
}

export function readOrders() {
  return readJson<StoreOrder[]>(storefrontStorageKeys.orders, []);
}

export function saveOrder(order: StoreOrder) {
  const next = [...readOrders(), order];
  writeJson(storefrontStorageKeys.orders, next);
  clearCart();
  return next;
}
