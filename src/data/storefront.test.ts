// Tests for the commerce data layer: cart quantity math against real stock
// levels, stock reservation accounting, and the order creation/update
// lifecycle (including the pickup-vs-shipping initial status split that
// /admin/orders and the customer Orders tab both depend on).
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addToCart,
  createOrder,
  createProductDraft,
  getAvailableStock,
  getReservedQuantity,
  readCart,
  readOrders,
  saveProduct,
  updateCartQuantity,
  updateOrder,
  type StoreOrder,
  type StoreProduct,
} from './storefront';

beforeEach(() => {
  localStorage.clear();
});

function seedProduct(stockOnHand: number): StoreProduct {
  const draft = createProductDraft();
  draft.name = 'Beard Oil';
  draft.status = 'published';
  const variant = draft.variants[0];
  if (!variant) throw new Error('test setup: draft has no default variant');
  variant.priceCents = 1800;
  variant.stockOnHand = stockOnHand;
  return saveProduct(draft);
}

describe('addToCart / updateCartQuantity respect available stock', () => {
  it('adds up to the requested quantity when stock allows', () => {
    const product = seedProduct(5);
    const variant = product.variants[0]!;
    addToCart(product.id, variant.id, 2);
    expect(readCart()).toEqual([{ productId: product.id, variantId: variant.id, quantity: 2 }]);
  });

  it('caps quantity at available stock rather than overselling', () => {
    const product = seedProduct(2);
    const variant = product.variants[0]!;
    addToCart(product.id, variant.id, 5);
    expect(readCart()[0]?.quantity).toBe(2);
  });

  it('does nothing when stock is exhausted', () => {
    const product = seedProduct(0);
    const variant = product.variants[0]!;
    addToCart(product.id, variant.id, 1);
    expect(readCart()).toEqual([]);
  });

  it('updateCartQuantity removes the line when set to 0', () => {
    const product = seedProduct(5);
    const variant = product.variants[0]!;
    addToCart(product.id, variant.id, 3);
    updateCartQuantity(product.id, variant.id, 0);
    expect(readCart()).toEqual([]);
  });

  it('adding the same variant twice accumulates quantity, capped by stock', () => {
    const product = seedProduct(3);
    const variant = product.variants[0]!;
    addToCart(product.id, variant.id, 2);
    addToCart(product.id, variant.id, 2);
    expect(readCart()[0]?.quantity).toBe(3);
  });
});

describe('stock reservation accounting', () => {
  function order(productId: string, variantId: string, quantity: number, status: StoreOrder['status']): StoreOrder {
    const now = new Date().toISOString();
    return {
      id: `order-${Math.random().toString(36).slice(2)}`,
      items: [{ productId, variantId, name: 'Beard Oil', variantName: 'Default', sku: 'SKU-1', quantity, unitPriceCents: 1800 }],
      subtotalCents: quantity * 1800,
      shippingCents: 0,
      taxCents: 0,
      totalCents: quantity * 1800,
      fulfillment: 'pickup',
      customer: { name: 'Jordan Visitor', email: 'jordan@example.com', phone: '5705551234' },
      shippingAddress: null,
      status,
      ownerActionRequired: true,
      trackingNumber: '',
      internalNote: '',
      createdAt: now,
      updatedAt: now,
    };
  }

  it('counts quantity from active orders (submitted/accepted/etc.) as reserved', () => {
    const product = seedProduct(10);
    const variant = product.variants[0]!;
    const orders = [order(product.id, variant.id, 4, 'accepted')];
    expect(getReservedQuantity(product.id, variant.id, orders)).toBe(4);
    expect(getAvailableStock(product, variant, orders)).toBe(6);
  });

  it('does not count declined or cancelled orders as reserved', () => {
    const product = seedProduct(10);
    const variant = product.variants[0]!;
    const orders = [order(product.id, variant.id, 4, 'declined'), order(product.id, variant.id, 3, 'cancelled')];
    expect(getReservedQuantity(product.id, variant.id, orders)).toBe(0);
    expect(getAvailableStock(product, variant, orders)).toBe(10);
  });

  it('never reports negative available stock when reservations exceed stock on hand', () => {
    const product = seedProduct(2);
    const variant = product.variants[0]!;
    const orders = [order(product.id, variant.id, 5, 'submitted')];
    expect(getAvailableStock(product, variant, orders)).toBe(0);
  });
});

describe('createOrder / updateOrder lifecycle', () => {
  function orderInput(fulfillment: StoreOrder['fulfillment']): Parameters<typeof createOrder>[0] {
    return {
      items: [{ productId: 'p1', variantId: 'v1', name: 'Beard Oil', variantName: 'Default', sku: 'SKU-1', quantity: 1, unitPriceCents: 1800 }],
      subtotalCents: 1800,
      shippingCents: fulfillment === 'shipping' ? 600 : 0,
      taxCents: 0,
      totalCents: fulfillment === 'shipping' ? 2400 : 1800,
      fulfillment,
      customer: { name: 'Jordan Visitor', email: 'Jordan@Example.com', phone: '(570) 555-1234' },
      shippingAddress: fulfillment === 'shipping' ? { line1: '1 Main St', line2: '', city: 'Stroudsburg', state: 'PA', postalCode: '18360' } : null,
      trackingNumber: '',
      internalNote: '',
    };
  }

  it('starts a pickup order as "submitted"', () => {
    const order = createOrder(orderInput('pickup'));
    expect(order.status).toBe('submitted');
  });

  it('starts a shipping order as "payment-required"', () => {
    const order = createOrder(orderInput('shipping'));
    expect(order.status).toBe('payment-required');
  });

  it('normalizes the customer email/phone on the saved order', () => {
    const order = createOrder(orderInput('pickup'));
    expect(order.customer.email).toBe('jordan@example.com');
  });

  it('clears the cart when an order is created', () => {
    const product = seedProduct(5);
    const variant = product.variants[0]!;
    addToCart(product.id, variant.id, 2);
    expect(readCart()).toHaveLength(1);
    createOrder(orderInput('pickup'));
    expect(readCart()).toEqual([]);
  });

  it('updateOrder transitions status and is visible via readOrders()', () => {
    const order = createOrder(orderInput('pickup'));
    const updated = updateOrder(order.id, { status: 'ready-for-pickup' });
    expect(updated?.status).toBe('ready-for-pickup');
    expect(readOrders().find((item) => item.id === order.id)?.status).toBe('ready-for-pickup');
  });

  it('updateOrder returns null for an unknown order id', () => {
    expect(updateOrder('not-a-real-order', { status: 'accepted' })).toBeNull();
  });
});
