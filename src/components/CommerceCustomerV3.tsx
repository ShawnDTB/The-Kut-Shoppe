import { useEffect, useState } from 'react';
import { isValidEmail, getPlatformSessionAccount } from '../data/auth-v2';
import { isValidPhone } from '../data/auth';
import {
  addToCart,
  clearCart,
  createOrder,
  formatMoney,
  getAvailableStock,
  getProductBySlug,
  readCart,
  readProducts,
  subscribeToStorefrontChanges,
  updateCartQuantity,
  type CartItem,
  type FulfillmentType,
  type ProductVariant,
  type StoreOrder,
  type StoreProduct,
} from '../data/storefront';

function ProductImage({ product, variant }: { product: StoreProduct; variant?: ProductVariant | null }) {
  const image = product.images.find((item) => item.id === variant?.imageId) ?? product.images[0];
  return image
    ? <img src={image.src} alt={image.alt || product.name} width="900" height="900" loading="lazy" decoding="async" />
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
      <input
        type="number"
        min="1"
        max={available}
        value={line.item.quantity}
        aria-label={`${line.product.name} quantity`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <button type="button" disabled={line.item.quantity >= available} onClick={() => onChange(line.item.quantity + 1)} aria-label={`Increase ${line.product.name} quantity`}>+</button>
    </div>
  );
}

function CartDrawer({
  open,
  products,
  cart,
  onClose,
  onCartChange,
}: {
  open: boolean;
  products: StoreProduct[];
  cart: CartItem[];
  onClose: () => void;
  onCartChange: (cart: CartItem[]) => void;
}) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, onClose]);

  if (!open) return null;
  const lines = resolveLines(cart, products);
  const count = cart.reduce((total, item) => total + item.quantity, 0);
  const subtotal = lines.reduce((total, line) => total + line.variant.priceCents * line.item.quantity, 0);

  return (
    <div className="cart-drawer-v3" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-v3-title">
      <button className="cart-drawer-v3-backdrop" type="button" aria-label="Close cart" onClick={onClose} />
      <aside>
        <header><div><p className="eyebrow">Your cart</p><h2 id="cart-drawer-v3-title">{count ? `${count} item${count === 1 ? '' : 's'}` : 'Cart is empty'}</h2></div><button type="button" aria-label="Close cart" onClick={onClose}>×</button></header>
        <div className="cart-drawer-v3-lines">
          {lines.map((line) => <article key={`${line.product.id}-${line.variant.id}`}><div className="cart-drawer-v3-image"><ProductImage product={line.product} variant={line.variant} /></div><div><strong>{line.product.name}</strong><span>{line.variant.name}</span><QuantityControl line={line} onChange={(quantity) => onCartChange(updateCartQuantity(line.product.id, line.variant.id, quantity))} /><button className="text-button" type="button" onClick={() => onCartChange(updateCartQuantity(line.product.id, line.variant.id, 0))}>Remove</button></div><strong>{formatMoney(line.variant.priceCents * line.item.quantity)}</strong></article>)}
          {!lines.length ? <p>Add a product to see it here.</p> : null}
        </div>
        <footer><div><span>Subtotal</span><strong>{formatMoney(subtotal)}</strong></div>{lines.length ? <><a className="button" href="/cart">View cart</a><a className="button button-secondary" href="/checkout">Checkout</a></> : <a className="button" href="/shop">Browse products</a>}</footer>
      </aside>
    </div>
  );
}

export function ProductDetailPageV3({ slug }: { slug: string }) {
  const [products, setProducts] = useState(() => readProducts());
  const [cart, setCart] = useState(() => readCart());
  const product = products.find((entry) => entry.slug === slug) ?? getProductBySlug(slug);
  const [selectedVariantId, setSelectedVariantId] = useState(() => product?.variants.find((variant) => variant.active)?.id ?? '');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => subscribeToStorefrontChanges(() => {
    setProducts(readProducts());
    setCart(readCart());
  }), []);

  if (!product || product.status !== 'published') {
    return <section className="section commerce-product-page platform-pattern platform-pattern-products"><div className="container narrow-container"><div className="commerce-empty-catalog"><h1>Product not found.</h1><p>This product may no longer be published.</p><a className="button" href="/shop">Back to Shop</a></div></div></section>;
  }

  const activeVariants = product.variants.filter((variant) => variant.active);
  const selectedVariant = activeVariants.find((variant) => variant.id === selectedVariantId) ?? activeVariants[0];
  const available = selectedVariant ? getAvailableStock(product, selectedVariant) : 0;

  const add = () => {
    if (!selectedVariant || available <= 0) return;
    const next = addToCart(product.id, selectedVariant.id, 1);
    setCart(next);
    setNotice(`${product.name}${selectedVariant.name !== 'Default' ? ` · ${selectedVariant.name}` : ''} added to your cart.`);
    setDrawerOpen(true);
  };

  return (
    <section className="section commerce-product-page commerce-product-page-v3 platform-pattern platform-pattern-products">
      <div className="container route-wide">
        <a className="text-link commerce-back-link" href="/shop">← Back to Shop</a>
        {notice ? <p className="commerce-action-notice" role="status">✓ {notice}</p> : null}
        <div className="commerce-product-detail commerce-product-detail-v3">
          <div className="commerce-product-gallery"><div className="commerce-product-primary-image"><ProductImage product={product} variant={selectedVariant} /></div></div>
          <div className="commerce-product-detail-copy">
            <p className="eyebrow">{product.category}</p>
            <h1>{product.name}</h1>
            <p className="lede">{product.description}</p>
            {activeVariants.length > 1 ? <fieldset className="commerce-variant-picker"><legend>Choose an option</legend>{activeVariants.map((variant) => <label className={selectedVariant?.id === variant.id ? 'is-selected' : ''} key={variant.id}><input type="radio" name="variant" checked={selectedVariant?.id === variant.id} onChange={() => { setSelectedVariantId(variant.id); setNotice(''); }} /><span><strong>{variant.name}</strong><small>{formatMoney(variant.priceCents)} · {getAvailableStock(product, variant)} available</small></span></label>)}</fieldset> : null}
            {selectedVariant ? <div className="commerce-product-purchase"><div><strong>{formatMoney(selectedVariant.priceCents)}</strong><small>{available > 0 ? `${available} available` : 'Out of stock'}</small></div><button className="button" type="button" disabled={available <= 0} onClick={add}>Add to cart</button></div> : null}
            <div className="commerce-product-fulfillment">{product.pickupEnabled ? <span>Pickup at 518 Main Street</span> : null}{product.shippingEnabled ? <span>Shipping available</span> : null}</div>
            {product.amazonUrl ? <a className="button button-secondary" href={product.amazonUrl} target="_blank" rel="noopener noreferrer">Buy on Amazon <span aria-hidden="true">↗</span></a> : null}
          </div>
        </div>
      </div>
      <CartDrawer open={drawerOpen} products={products} cart={cart} onClose={() => setDrawerOpen(false)} onCartChange={setCart} />
    </section>
  );
}

export function CartPageV3() {
  const [products, setProducts] = useState(() => readProducts());
  const [cart, setCart] = useState(() => readCart());
  useEffect(() => subscribeToStorefrontChanges(() => { setProducts(readProducts()); setCart(readCart()); }), []);
  const lines = resolveLines(cart, products);
  const subtotal = lines.reduce((total, line) => total + line.variant.priceCents * line.item.quantity, 0);

  return (
    <section className="section commerce-cart-page commerce-cart-page-v3 platform-pattern platform-pattern-products">
      <div className="container route-wide">
        <header className="commerce-page-heading commerce-page-heading-compact"><div><p className="eyebrow">Cart</p><h1>{lines.length ? 'Review your items.' : 'Your cart is empty.'}</h1></div><a className="text-link" href="/shop">Continue shopping</a></header>
        {lines.length ? <div className="commerce-cart-layout"><main className="commerce-cart-lines commerce-cart-lines-v3">{lines.map((line) => <article key={`${line.product.id}-${line.variant.id}`}><a className="commerce-cart-image" href={`/shop/${line.product.slug}`}><ProductImage product={line.product} variant={line.variant} /></a><div className="commerce-cart-line-copy"><p className="eyebrow">{line.product.category}</p><h2>{line.product.name}</h2><p>{line.variant.name} · {formatMoney(line.variant.priceCents)} each</p><QuantityControl line={line} onChange={(quantity) => setCart(updateCartQuantity(line.product.id, line.variant.id, quantity))} /><button className="text-button" type="button" onClick={() => setCart(updateCartQuantity(line.product.id, line.variant.id, 0))}>Remove from cart</button></div><strong>{formatMoney(line.variant.priceCents * line.item.quantity)}</strong></article>)}</main><aside className="commerce-order-summary commerce-order-summary-v3"><p className="eyebrow">Summary</p><dl><div><dt>Subtotal</dt><dd>{formatMoney(subtotal)}</dd></div><div><dt>Shipping and tax</dt><dd>Calculated next</dd></div></dl><a className="button" href="/checkout">Checkout</a></aside></div> : <div className="commerce-empty-catalog"><p>Browse the current catalog and choose a product option to continue.</p><a className="button" href="/shop">Browse products</a></div>}
      </div>
    </section>
  );
}

export function CheckoutPageV3() {
  const [products, setProducts] = useState(() => readProducts());
  const [cart, setCart] = useState(() => readCart());
  const account = getPlatformSessionAccount();
  const [fulfillment, setFulfillment] = useState<FulfillmentType>('pickup');
  const [customer, setCustomer] = useState({ name: account?.name ?? '', email: account?.email ?? '', phone: '' });
  const [address, setAddress] = useState({ line1: '', line2: '', city: '', state: 'PA', postalCode: '' });
  const [submitted, setSubmitted] = useState<StoreOrder | null>(null);
  useEffect(() => subscribeToStorefrontChanges(() => { setProducts(readProducts()); setCart(readCart()); }), []);
  const lines = resolveLines(cart, products);
  const subtotal = lines.reduce((total, line) => total + line.variant.priceCents * line.item.quantity, 0);
  const supportsShipping = lines.length > 0 && lines.every((line) => line.product.shippingEnabled);
  const supportsPickup = lines.length > 0 && lines.every((line) => line.product.pickupEnabled);
  const effectiveFulfillment: FulfillmentType = fulfillment === 'pickup' && !supportsPickup && supportsShipping ? 'shipping' : fulfillment;
  const contactReady = customer.name.trim().length >= 2 && isValidEmail(customer.email) && isValidPhone(customer.phone);
  const addressReady = effectiveFulfillment === 'pickup' || Boolean(address.line1.trim() && address.city.trim() && address.state.trim() && address.postalCode.trim());

  const submit = () => {
    if (!contactReady || !addressReady || !lines.length) return;
    const order = createOrder({
      items: lines.map((line) => ({ productId: line.product.id, variantId: line.variant.id, name: line.product.name, variantName: line.variant.name, sku: line.variant.sku, quantity: line.item.quantity, unitPriceCents: line.variant.priceCents })),
      subtotalCents: subtotal,
      shippingCents: 0,
      taxCents: 0,
      totalCents: subtotal,
      fulfillment: effectiveFulfillment,
      customer,
      shippingAddress: effectiveFulfillment === 'shipping' ? address : null,
      trackingNumber: '',
      internalNote: '',
    });
    clearCart();
    setCart([]);
    setSubmitted(order);
  };

  if (submitted) return <section className="section commerce-checkout-page platform-pattern platform-pattern-products"><div className="container narrow-container"><div className="commerce-order-confirmation"><p className="eyebrow">Order received</p><h1>Request sent to the shop.</h1><p>{submitted.fulfillment === 'pickup' ? 'The shop will confirm when the order is accepted and ready for pickup.' : 'Shipping cost, tax, and payment must be confirmed before the order is accepted.'}</p><dl><div><dt>Reference</dt><dd>{submitted.id}</dd></div><div><dt>Status</dt><dd>{submitted.status.replaceAll('-', ' ')}</dd></div><div><dt>Subtotal</dt><dd>{formatMoney(submitted.subtotalCents)}</dd></div></dl><div className="commerce-inline-actions"><a className="button" href="/account">View Account</a><a className="button button-secondary" href="/shop">Continue shopping</a></div></div></div></section>;

  return (
    <section className="section commerce-checkout-page commerce-checkout-page-v3 platform-pattern platform-pattern-products">
      <div className="container route-wide">
        <header className="commerce-page-heading commerce-page-heading-compact"><div><p className="eyebrow">Checkout</p><h1>Complete your order.</h1></div><a className="text-link" href="/cart">Back to cart</a></header>
        {lines.length ? <div className="commerce-checkout-layout commerce-checkout-layout-v3">
          <main className="commerce-checkout-form commerce-checkout-form-v3">
            <section><h2>Delivery method</h2><div className="checkout-method-grid"><label className={!supportsPickup ? 'is-disabled' : ''}><input type="radio" name="fulfillment" value="pickup" checked={effectiveFulfillment === 'pickup'} disabled={!supportsPickup} onChange={() => setFulfillment('pickup')} /><span><strong>Pick up in store</strong><small>518 Main Street after the shop marks it ready.</small></span></label><label className={!supportsShipping ? 'is-disabled' : ''}><input type="radio" name="fulfillment" value="shipping" checked={effectiveFulfillment === 'shipping'} disabled={!supportsShipping} onChange={() => setFulfillment('shipping')} /><span><strong>Ship my order</strong><small>Shipping cost and tax are confirmed before payment.</small></span></label></div></section>
            <section><h2>Contact</h2><div className="catalog-form-grid"><label>Full name<input required autoComplete="name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></label><label>Email<input required type="email" autoComplete="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /></label><label>Mobile phone<input required type="tel" autoComplete="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></label></div></section>
            {effectiveFulfillment === 'shipping' ? <section><h2>Shipping address</h2><div className="catalog-form-grid"><label className="catalog-form-wide">Address<input required autoComplete="street-address" value={address.line1} onChange={(event) => setAddress({ ...address, line1: event.target.value })} /></label><label className="catalog-form-wide">Apartment or suite <span>Optional</span><input value={address.line2} onChange={(event) => setAddress({ ...address, line2: event.target.value })} /></label><label>City<input required value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} /></label><label>State<input required value={address.state} onChange={(event) => setAddress({ ...address, state: event.target.value })} /></label><label>ZIP code<input required inputMode="numeric" value={address.postalCode} onChange={(event) => setAddress({ ...address, postalCode: event.target.value })} /></label></div></section> : null}
            <p className="checkout-prototype-note">This preview records an order request. Live card payment will be added through a regulated processor before production checkout is enabled.</p>
            <button className="button" type="button" disabled={!contactReady || !addressReady} onClick={submit}>{effectiveFulfillment === 'pickup' ? 'Submit pickup request' : 'Submit shipping request'}</button>
          </main>
          <aside className="commerce-order-summary commerce-order-summary-v3"><p className="eyebrow">Order summary</p>{lines.map((line) => <div className="commerce-checkout-line" key={`${line.product.id}-${line.variant.id}`}><span>{line.item.quantity} × {line.product.name}<small>{line.variant.name}</small></span><strong>{formatMoney(line.variant.priceCents * line.item.quantity)}</strong></div>)}<dl><div><dt>Subtotal</dt><dd>{formatMoney(subtotal)}</dd></div><div><dt>Shipping and tax</dt><dd>{effectiveFulfillment === 'pickup' ? 'Not included' : 'Confirmed before payment'}</dd></div></dl></aside>
        </div> : <div className="commerce-empty-catalog"><h2>Your cart is empty.</h2><a className="button" href="/shop">Browse products</a></div>}
      </div>
    </section>
  );
}
