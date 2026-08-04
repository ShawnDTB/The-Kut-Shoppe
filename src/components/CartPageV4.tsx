import { useEffect, useState } from 'react';
import {
  formatMoney,
  getAvailableStock,
  readCart,
  readProducts,
  subscribeToStorefrontChanges,
  updateCartQuantity,
  type CartItem,
  type ProductVariant,
  type StoreProduct,
} from '../data/storefront';

function ProductImage({ product, variant }: { product: StoreProduct; variant: ProductVariant }) {
  const image = product.images.find((item) => item.id === variant.imageId) ?? product.images[0];
  return image
    ? <img src={image.src} alt={image.alt || product.name} width="320" height="320" loading="lazy" decoding="async" />
    : <div className="commerce-product-placeholder" aria-hidden="true"><span>{product.category.slice(0, 1)}</span></div>;
}

function resolveLines(cart: CartItem[], products: StoreProduct[]) {
  return cart.flatMap((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    const variant = product?.variants.find((candidate) => candidate.id === item.variantId);
    return product && variant ? [{ item, product, variant }] : [];
  });
}

type CartLine = ReturnType<typeof resolveLines>[number];

function QuantityControl({ line, onChange }: { line: CartLine; onChange: (quantity: number) => void }) {
  const available = getAvailableStock(line.product, line.variant);
  return (
    <div className="cart-quantity-control" aria-label={`Quantity for ${line.product.name}`}>
      <button type="button" onClick={() => onChange(line.item.quantity - 1)} aria-label={`Decrease ${line.product.name} quantity`}>−</button>
      <input type="number" min="1" max={available} value={line.item.quantity} aria-label={`${line.product.name} quantity`} onChange={(event) => onChange(Number(event.target.value))} />
      <button type="button" disabled={line.item.quantity >= available} onClick={() => onChange(line.item.quantity + 1)} aria-label={`Increase ${line.product.name} quantity`}>+</button>
    </div>
  );
}

export function CartPageV4() {
  const [products, setProducts] = useState(() => readProducts());
  const [cart, setCart] = useState(() => readCart());

  useEffect(() => subscribeToStorefrontChanges(() => {
    setProducts(readProducts());
    setCart(readCart());
  }), []);

  const lines = resolveLines(cart, products);
  const subtotal = lines.reduce((total, line) => total + line.variant.priceCents * line.item.quantity, 0);

  return (
    <section className="section commerce-cart-page commerce-cart-page-v3 v4-cart-page platform-pattern platform-pattern-products">
      <div className="container route-wide">
        <a className="text-link commerce-back-link v4-cart-back" href="/shop">← Back to Shop</a>
        <header className="commerce-page-heading commerce-page-heading-compact v4-cart-heading">
          <div><h1>{lines.length ? 'Your cart.' : 'Your cart is empty.'}</h1><p>{lines.length ? 'Review quantities before checkout.' : 'Return to the Shop to add a product.'}</p></div>
        </header>

        {lines.length ? (
          <div className="commerce-cart-layout">
            <main className="commerce-cart-lines commerce-cart-lines-v3">
              {lines.map((line) => (
                <article key={`${line.product.id}-${line.variant.id}`}>
                  <a className="commerce-cart-image" href={`/shop/${line.product.slug}`}><ProductImage product={line.product} variant={line.variant} /></a>
                  <div className="commerce-cart-line-copy"><p className="eyebrow">{line.product.category}</p><h2>{line.product.name}</h2><p>{line.variant.name} · {formatMoney(line.variant.priceCents)} each</p><QuantityControl line={line} onChange={(quantity) => setCart(updateCartQuantity(line.product.id, line.variant.id, quantity))} /><button className="text-button" type="button" onClick={() => setCart(updateCartQuantity(line.product.id, line.variant.id, 0))}>Remove from cart</button></div>
                  <strong>{formatMoney(line.variant.priceCents * line.item.quantity)}</strong>
                </article>
              ))}
            </main>
            <aside className="commerce-order-summary commerce-order-summary-v3"><p className="eyebrow">Summary</p><dl><div><dt>Subtotal</dt><dd>{formatMoney(subtotal)}</dd></div><div><dt>Shipping and tax</dt><dd>Calculated next</dd></div></dl><a className="button" href="/checkout">Checkout</a></aside>
          </div>
        ) : <div className="commerce-empty-catalog"><a className="button" href="/shop">Browse products</a></div>}
      </div>
    </section>
  );
}
