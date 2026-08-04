import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getPlatformSessionAccount, isValidEmail } from '../data/auth-v2';
import { isValidPhone } from '../data/auth';
import { getCustomerProfileV5 } from '../data/account-profile-v5';
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

interface GoogleAddressComponentV5 { long_name: string; short_name: string; types: string[] }
interface GooglePlaceV5 { address_components?: GoogleAddressComponentV5[] }
interface GoogleAutocompleteV5 { addListener: (eventName: string, callback: () => void) => void; getPlace: () => GooglePlaceV5 }
interface GoogleMapsV5 { maps?: { places?: { Autocomplete: new (input: HTMLInputElement, options: Record<string, unknown>) => GoogleAutocompleteV5 } } }
declare global { interface Window { google?: GoogleMapsV5; __kutGooglePlacesPromise?: Promise<void> } }

type AddressV5 = { line1: string; line2: string; city: string; state: string; postalCode: string };

function ProductImage({ product, variant }: { product: StoreProduct; variant?: ProductVariant | null }) {
  const image = product.images.find((item) => item.id === variant?.imageId) ?? product.images[0];
  return image ? <img src={image.src} alt={image.alt || product.name} width="900" height="900" loading="lazy" decoding="async" /> : <div className="commerce-product-placeholder" aria-hidden="true"><span>{product.category.slice(0, 1)}</span></div>;
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
  return <div className="cart-quantity-control" aria-label={`Quantity for ${line.product.name}`}><button type="button" onClick={() => onChange(line.item.quantity - 1)} aria-label={`Decrease ${line.product.name} quantity`}>−</button><input type="number" min="1" max={available} value={line.item.quantity} aria-label={`${line.product.name} quantity`} onChange={(event) => onChange(Number(event.target.value))} /><button type="button" disabled={line.item.quantity >= available} onClick={() => onChange(line.item.quantity + 1)} aria-label={`Increase ${line.product.name} quantity`}>+</button></div>;
}

function CartDrawerV5({ open, products, cart, onClose, onCartChange }: { open: boolean; products: StoreProduct[]; cart: CartItem[]; onClose: () => void; onCartChange: (cart: CartItem[]) => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.documentElement.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.documentElement.style.overflow = 'hidden';
    window.requestAnimationFrame(() => closeRef.current?.focus());
    window.addEventListener('keydown', closeOnEscape);
    return () => { document.documentElement.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape); };
  }, [open, onClose]);
  if (!open || typeof document === 'undefined') return null;
  const lines = resolveLines(cart, products);
  const count = cart.reduce((total, item) => total + item.quantity, 0);
  const subtotal = lines.reduce((total, line) => total + line.variant.priceCents * line.item.quantity, 0);
  return createPortal(<div className="cart-drawer-v5" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-v5-title"><button className="cart-drawer-v5-backdrop" type="button" aria-label="Close cart" onClick={onClose} /><aside><header><div><p className="eyebrow">Your cart</p><h2 id="cart-drawer-v5-title">{count ? `${count} item${count === 1 ? '' : 's'}` : 'Cart is empty'}</h2></div><button ref={closeRef} type="button" aria-label="Close cart" onClick={onClose}>×</button></header><div className="cart-drawer-v5-lines">{lines.map((line) => <article key={`${line.product.id}-${line.variant.id}`}><div className="cart-drawer-v5-image"><ProductImage product={line.product} variant={line.variant} /></div><div><strong>{line.product.name}</strong><span>{line.variant.name}</span><QuantityControl line={line} onChange={(quantity) => onCartChange(updateCartQuantity(line.product.id, line.variant.id, quantity))} /><button className="text-button" type="button" onClick={() => onCartChange(updateCartQuantity(line.product.id, line.variant.id, 0))}>Remove</button></div><strong>{formatMoney(line.variant.priceCents * line.item.quantity)}</strong></article>)}{!lines.length ? <p>Add a product to see it here.</p> : null}</div><footer><div><span>Subtotal</span><strong>{formatMoney(subtotal)}</strong></div>{lines.length ? <><a className="button button-secondary" href="/cart">View cart</a><a className="button" href="/checkout">Checkout</a></> : <a className="button" href="/shop">Browse products</a>}</footer></aside></div>, document.body);
}

function loadGooglePlaces() {
  const key = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;
  if (!key || typeof window === 'undefined') return null;
  if (window.google?.maps?.places?.Autocomplete) return Promise.resolve();
  if (window.__kutGooglePlacesPromise) return window.__kutGooglePlacesPromise;
  window.__kutGooglePlacesPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-kut-google-places]');
    if (existing) { existing.addEventListener('load', () => resolve(), { once: true }); existing.addEventListener('error', () => reject(new Error('Address suggestions could not load.')), { once: true }); return; }
    const script = document.createElement('script');
    script.dataset.kutGooglePlaces = 'true';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Address suggestions could not load.'));
    document.head.appendChild(script);
  });
  return window.__kutGooglePlacesPromise;
}

function AddressAutocompleteV5({ value, onChange, error }: { value: AddressV5; onChange: (value: AddressV5) => void; error?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const hasGoogleKey = Boolean(import.meta.env.VITE_GOOGLE_PLACES_API_KEY);
  const [status, setStatus] = useState(hasGoogleKey ? 'Loading Google address suggestions…' : 'Google suggestions require the configured Places key. Browser autofill remains available.');

  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => {
    const loader = loadGooglePlaces();
    if (!loader) return undefined;
    let active = true;
    void loader.then(() => {
      if (!active || !inputRef.current || !window.google?.maps?.places?.Autocomplete) return;
      setStatus('Start typing and choose a suggested address.');
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, { types: ['address'], componentRestrictions: { country: 'us' }, fields: ['address_components'] });
      autocomplete.addListener('place_changed', () => {
        const components = autocomplete.getPlace().address_components ?? [];
        const component = (type: string, short = false) => { const item = components.find((entry) => entry.types.includes(type)); return item ? short ? item.short_name : item.long_name : ''; };
        onChangeRef.current({ ...valueRef.current, line1: `${component('street_number')} ${component('route')}`.trim(), city: component('locality') || component('postal_town') || component('sublocality'), state: component('administrative_area_level_1', true), postalCode: component('postal_code') });
        setStatus('Address selected. Review the populated city, state, and ZIP code.');
      });
    }).catch(() => setStatus('Google address suggestions could not load. Enter the address manually.'));
    return () => { active = false; };
  }, []);

  return <label className="catalog-form-wide"><span className="checkout-field-label">Street address <b aria-hidden="true">*</b></span><input ref={inputRef} required autoComplete="street-address" placeholder="Start typing a street address" aria-invalid={Boolean(error)} aria-describedby="checkout-address-status" value={value.line1} onChange={(event) => onChange({ ...value, line1: event.target.value })} />{error ? <small className="field-error">{error}</small> : null}<small id="checkout-address-status" className={`address-suggestion-status${hasGoogleKey ? ' is-ready' : ''}`}>{status}</small></label>;
}

function DeliveryIcon({ type }: { type: FulfillmentType }) {
  return <span className="checkout-method-icon" aria-hidden="true">{type === 'pickup' ? <svg viewBox="0 0 32 32"><path d="M5 14.5 16 6l11 8.5V27H5Z"/><path d="M11 27v-8h10v8"/></svg> : <svg viewBox="0 0 32 32"><path d="M3 8h17v15H3Z"/><path d="M20 13h5l4 5v5h-9Z"/><circle cx="9" cy="25" r="2.5"/><circle cx="24" cy="25" r="2.5"/></svg>}</span>;
}

function RequiredField({ children }: { children: string }) {
  return <span className="checkout-field-label">{children} <b aria-hidden="true">*</b></span>;
}

export function ProductDetailPageV5({ slug }: { slug: string }) {
  const [products, setProducts] = useState(() => readProducts());
  const [cart, setCart] = useState(() => readCart());
  const product = products.find((entry) => entry.slug === slug) ?? getProductBySlug(slug);
  const [selectedVariantId, setSelectedVariantId] = useState(() => product?.variants.find((variant) => variant.active)?.id ?? '');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => subscribeToStorefrontChanges(() => { setProducts(readProducts()); setCart(readCart()); }), []);
  if (!product || product.status !== 'published') return <section className="section commerce-product-page"><div className="container narrow-container"><div className="commerce-empty-catalog"><h1>Product not found.</h1><a className="button" href="/shop">Back to Shop</a></div></div></section>;
  const activeVariants = product.variants.filter((variant) => variant.active);
  const selectedVariant = activeVariants.find((variant) => variant.id === selectedVariantId) ?? activeVariants[0];
  const available = selectedVariant ? getAvailableStock(product, selectedVariant) : 0;
  const add = () => { if (!selectedVariant || available <= 0) return; const next = addToCart(product.id, selectedVariant.id, 1); setCart(next); setNotice(`${product.name}${selectedVariant.name !== 'Default' ? ` · ${selectedVariant.name}` : ''} added to your cart.`); setDrawerOpen(true); };
  return <section className="section commerce-product-page commerce-product-page-v5 platform-pattern platform-pattern-products"><div className="container route-wide"><div className="commerce-product-v5-topline"><a className="text-link" href="/shop">← Back to Shop</a></div>{notice ? <p className="commerce-action-notice" role="status">✓ {notice}</p> : null}<div className="commerce-product-detail commerce-product-detail-v5"><div className="commerce-product-gallery"><div className="commerce-product-primary-image"><ProductImage product={product} variant={selectedVariant} /></div></div><div className="commerce-product-detail-copy"><p className="eyebrow commerce-product-category-v6">{product.category}</p><h1>{product.name}</h1>{selectedVariant ? <div className="commerce-product-purchase commerce-product-purchase-v5"><div><strong>{formatMoney(selectedVariant.priceCents)}</strong><small>{available > 0 ? `${available} available` : 'Out of stock'}</small></div><button className="button" type="button" disabled={available <= 0} onClick={add}>Add to cart</button></div> : null}{activeVariants.length > 1 ? <fieldset className="commerce-variant-picker"><legend>Choose an option</legend>{activeVariants.map((variant) => <label className={selectedVariant?.id === variant.id ? 'is-selected' : ''} key={variant.id}><input type="radio" name="variant" checked={selectedVariant?.id === variant.id} onChange={() => { setSelectedVariantId(variant.id); setNotice(''); }} /><span><strong>{variant.name}</strong><small>{formatMoney(variant.priceCents)} · {getAvailableStock(product, variant)} available</small></span></label>)}</fieldset> : null}<p className="lede commerce-product-description-v5">{product.description}</p><div className="commerce-product-fulfillment">{product.pickupEnabled ? <span>Pickup at 518 Main Street</span> : null}{product.shippingEnabled ? <span>Shipping available</span> : null}</div>{product.amazonUrl ? <a className="button button-secondary" href={product.amazonUrl} target="_blank" rel="noopener noreferrer">Buy on Amazon <span aria-hidden="true">↗</span></a> : null}</div></div></div><CartDrawerV5 open={drawerOpen} products={products} cart={cart} onClose={() => setDrawerOpen(false)} onCartChange={setCart} /></section>;
}

function orderStages(order: StoreOrder) {
  return order.fulfillment === 'shipping'
    ? [['payment-required', 'Payment review'], ['accepted', 'Accepted'], ['preparing', 'Preparing'], ['shipped', 'Shipped'], ['completed', 'Complete']] as const
    : [['submitted', 'Submitted'], ['accepted', 'Accepted'], ['preparing', 'Preparing'], ['ready-for-pickup', 'Ready'], ['completed', 'Complete']] as const;
}

function shortReference(order: StoreOrder) {
  return order.id.replace(/^order-/, '').slice(0, 13).toUpperCase();
}

export function OrderReceiptV5({ order, products, accountMode = false, onClose }: { order: StoreOrder; products: StoreProduct[]; accountMode?: boolean; onClose?: () => void }) {
  const shipping = order.fulfillment === 'shipping';
  const stages = orderStages(order);
  const currentIndex = stages.findIndex(([status]) => status === order.status);
  const terminalStatus = ['declined', 'cancelled'].includes(order.status) ? order.status : '';
  const updated = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(order.updatedAt));

  return <section className="commerce-order-confirmation commerce-receipt-v5" aria-labelledby={`receipt-heading-${order.id}`}><div className="commerce-receipt-header"><div><p className="eyebrow">Order request receipt</p><h1 id={`receipt-heading-${order.id}`}>{shipping ? 'Shipping Request Received' : 'Pickup Request Received'}</h1><p>{shipping ? 'The shop will confirm inventory, delivery cost, tax, payment, and timing before accepting this request.' : 'The shop will review the request and send an update when it is accepted and ready for pickup.'}</p></div><button className="button button-secondary print-hidden" type="button" onClick={() => window.print()}>Print or save as PDF</button></div><dl className="commerce-receipt-meta"><div><dt>Reference</dt><dd className="commerce-receipt-reference" title={order.id}>{shortReference(order)}</dd></div><div><dt>Current status</dt><dd>{terminalStatus || order.status.replaceAll('-', ' ')}</dd></div><div><dt>Method</dt><dd>{shipping ? 'Shipping' : 'Main Street pickup'}</dd></div><div><dt>Last updated</dt><dd>{updated}</dd></div></dl>{terminalStatus ? <p className="form-error">This order was {terminalStatus}. Contact the shop when you need help with the record.</p> : <ol className="commerce-receipt-status" aria-label="Order progress">{stages.map(([status, label], index) => <li className={index < currentIndex ? 'is-complete' : index === currentIndex ? 'is-current' : ''} aria-current={index === currentIndex ? 'step' : undefined} key={status}>{label}</li>)}</ol>}<div className="commerce-receipt-lines">{order.items.map((item) => { const product = products.find((entry) => entry.id === item.productId); const variant = product?.variants.find((entry) => entry.id === item.variantId); return <article key={`${item.productId}-${item.variantId}`}>{product ? <div className="commerce-receipt-image"><ProductImage product={product} variant={variant} /></div> : null}<div><strong>{item.name}</strong><span>{item.variantName} · Quantity {item.quantity}</span><small>{item.sku}</small></div><strong>{formatMoney(item.unitPriceCents * item.quantity)}</strong></article>; })}</div>{shipping && order.shippingAddress ? <address><strong>Ship to</strong><span>{order.customer.name}</span><span>{order.shippingAddress.line1}</span>{order.shippingAddress.line2 ? <span>{order.shippingAddress.line2}</span> : null}<span>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</span>{order.trackingNumber ? <span>Tracking: {order.trackingNumber}</span> : null}</address> : <address><strong>Pickup location</strong><span>The Kut Shoppe</span><span>518 Main Street</span><span>Stroudsburg, PA 18360</span></address>}<dl className="commerce-receipt-totals"><div><dt>Subtotal</dt><dd>{formatMoney(order.subtotalCents)}</dd></div><div><dt>Shipping and tax</dt><dd>{shipping ? 'Pending confirmation' : 'Not included'}</dd></div></dl><p className="fine-print commerce-receipt-note">This is an order-request receipt, not proof of payment. A paid receipt or invoice is issued only after payment is completed.</p><div className="commerce-inline-actions print-hidden">{accountMode ? <button className="button" type="button" onClick={onClose}>Close order details</button> : <a className="button" href={`/account?order=${encodeURIComponent(order.id)}`}>View order in Account</a>}<a className="button button-secondary" href="/shop">Continue shopping</a></div></section>;
}

export function CheckoutPageV5() {
  const [products, setProducts] = useState(() => readProducts());
  const [cart, setCart] = useState(() => readCart());
  const account = getPlatformSessionAccount();
  const profile = account ? getCustomerProfileV5(account) : null;
  const [fulfillment, setFulfillment] = useState<FulfillmentType>('pickup');
  const [customer, setCustomer] = useState({ name: account?.name ?? '', email: account?.email ?? '', phone: profile?.phone ?? '' });
  const [address, setAddress] = useState<AddressV5>(() => profile?.address ?? { line1: '', line2: '', city: '', state: 'PA', postalCode: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<StoreOrder | null>(null);
  useEffect(() => subscribeToStorefrontChanges(() => { setProducts(readProducts()); setCart(readCart()); }), []);
  const lines = resolveLines(cart, products);
  const subtotal = lines.reduce((total, line) => total + line.variant.priceCents * line.item.quantity, 0);
  const supportsShipping = lines.length > 0 && lines.every((line) => line.product.shippingEnabled);
  const supportsPickup = lines.length > 0 && lines.every((line) => line.product.pickupEnabled);
  const effectiveFulfillment: FulfillmentType = fulfillment === 'pickup' && !supportsPickup && supportsShipping ? 'shipping' : fulfillment;
  const changeQuantity = (line: CartLine, quantity: number) => setCart(updateCartQuantity(line.product.id, line.variant.id, quantity));

  const validate = () => {
    const next: Record<string, string> = {};
    if (customer.name.trim().length < 2) next.name = 'Enter the full name for this order.';
    if (!isValidEmail(customer.email)) next.email = 'Enter a valid email address.';
    if (!isValidPhone(customer.phone)) next.phone = 'Enter a valid 10-digit mobile number.';
    if (effectiveFulfillment === 'shipping') {
      if (!address.line1.trim()) next.line1 = 'Enter the street address.';
      if (!address.city.trim()) next.city = 'Enter the city.';
      if (!address.state.trim()) next.state = 'Enter the state.';
      if (!/^\d{5}(?:-\d{4})?$/.test(address.postalCode.trim())) next.postalCode = 'Enter a valid ZIP code.';
    }
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) window.requestAnimationFrame(() => { const wrapper = document.querySelector<HTMLElement>(`[data-checkout-field="${first}"]`); wrapper?.scrollIntoView({ behavior: 'smooth', block: 'center' }); wrapper?.querySelector<HTMLElement>('input')?.focus(); });
    return !first;
  };

  const submit = () => {
    if (!lines.length || !validate()) return;
    const order = createOrder({ items: lines.map((line) => ({ productId: line.product.id, variantId: line.variant.id, name: line.product.name, variantName: line.variant.name, sku: line.variant.sku, quantity: line.item.quantity, unitPriceCents: line.variant.priceCents })), subtotalCents: subtotal, shippingCents: 0, taxCents: 0, totalCents: subtotal, fulfillment: effectiveFulfillment, customer, shippingAddress: effectiveFulfillment === 'shipping' ? address : null, trackingNumber: '', internalNote: '' });
    clearCart(); setCart([]); setSubmitted(order);
  };

  if (submitted) return <section className="section commerce-checkout-page platform-pattern platform-pattern-products"><div className="container route-wide"><OrderReceiptV5 order={submitted} products={products} /></div></section>;
  return <section className="section commerce-checkout-page commerce-checkout-page-v5 platform-pattern platform-pattern-products"><div className="container route-wide"><header className="commerce-page-heading commerce-page-heading-compact"><div><p className="eyebrow">Checkout</p><h1>Complete your order.</h1></div><a className="text-link" href="/cart">Back to cart</a></header>{lines.length ? <div className="commerce-checkout-layout commerce-checkout-layout-v5"><main className="commerce-checkout-form commerce-checkout-form-v5"><section><h2>Delivery method</h2><div className="checkout-method-grid"><label className={!supportsPickup ? 'is-disabled' : ''}><input type="radio" name="fulfillment" value="pickup" checked={effectiveFulfillment === 'pickup'} disabled={!supportsPickup} onChange={() => setFulfillment('pickup')} /><DeliveryIcon type="pickup" /><span><strong>Pick up in store</strong><small>Collect from 518 Main Street after the shop marks the request ready.</small></span></label><label className={!supportsShipping ? 'is-disabled' : ''}><input type="radio" name="fulfillment" value="shipping" checked={effectiveFulfillment === 'shipping'} disabled={!supportsShipping} onChange={() => setFulfillment('shipping')} /><DeliveryIcon type="shipping" /><span><strong>Ship my order</strong><small>Delivery cost, tax, payment, and timing are confirmed before acceptance.</small></span></label></div></section><section><h2>Contact</h2><div className="catalog-form-grid"><label data-checkout-field="name"><RequiredField>Full name</RequiredField><input required autoComplete="name" aria-invalid={Boolean(errors.name)} value={customer.name} onChange={(event) => { setCustomer({ ...customer, name: event.target.value }); setErrors({ ...errors, name: '' }); }} />{errors.name ? <small className="field-error">{errors.name}</small> : null}</label><label data-checkout-field="email"><RequiredField>Email</RequiredField><input required type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} value={customer.email} onChange={(event) => { setCustomer({ ...customer, email: event.target.value }); setErrors({ ...errors, email: '' }); }} />{errors.email ? <small className="field-error">{errors.email}</small> : null}</label><label data-checkout-field="phone"><RequiredField>Mobile phone</RequiredField><input required type="tel" autoComplete="tel" aria-invalid={Boolean(errors.phone)} value={customer.phone} onChange={(event) => { setCustomer({ ...customer, phone: event.target.value }); setErrors({ ...errors, phone: '' }); }} />{errors.phone ? <small className="field-error">{errors.phone}</small> : null}</label></div></section>{effectiveFulfillment === 'shipping' ? <section><h2>Shipping address</h2><div className="catalog-form-grid" data-checkout-field="line1"><AddressAutocompleteV5 value={address} onChange={(next) => { setAddress(next); setErrors({ ...errors, line1: '' }); }} error={errors.line1} /><label className="catalog-form-wide"><span className="sr-only">Apartment, suite, unit, or P.O. box</span><input autoComplete="address-line2" placeholder="Apt., suite, unit, or P.O. box (optional)" value={address.line2} onChange={(event) => setAddress({ ...address, line2: event.target.value })} /></label><label data-checkout-field="city"><RequiredField>City</RequiredField><input required autoComplete="address-level2" aria-invalid={Boolean(errors.city)} value={address.city} onChange={(event) => { setAddress({ ...address, city: event.target.value }); setErrors({ ...errors, city: '' }); }} />{errors.city ? <small className="field-error">{errors.city}</small> : null}</label><label data-checkout-field="state"><RequiredField>State</RequiredField><input required autoComplete="address-level1" aria-invalid={Boolean(errors.state)} value={address.state} onChange={(event) => { setAddress({ ...address, state: event.target.value }); setErrors({ ...errors, state: '' }); }} />{errors.state ? <small className="field-error">{errors.state}</small> : null}</label><label data-checkout-field="postalCode"><RequiredField>ZIP code</RequiredField><input required autoComplete="postal-code" inputMode="numeric" aria-invalid={Boolean(errors.postalCode)} value={address.postalCode} onChange={(event) => { setAddress({ ...address, postalCode: event.target.value }); setErrors({ ...errors, postalCode: '' }); }} />{errors.postalCode ? <small className="field-error">{errors.postalCode}</small> : null}</label></div></section> : null}{Object.values(errors).some(Boolean) ? <p className="form-error" role="alert">Complete the highlighted information before submitting.</p> : null}<p className="checkout-prototype-note">No card details are collected in this review build. Payment, tax, and final shipping charges are confirmed before acceptance.</p><button className="button" type="button" onClick={submit}>{effectiveFulfillment === 'pickup' ? 'Submit pickup request' : 'Submit shipping request'}</button></main><aside className="commerce-order-summary commerce-order-summary-v5"><p className="eyebrow">Order summary</p>{lines.map((line) => <article className="commerce-checkout-line commerce-checkout-line-v6" key={`${line.product.id}-${line.variant.id}`}><div className="commerce-receipt-image"><ProductImage product={line.product} variant={line.variant} /></div><div><strong>{line.product.name}</strong><small>{line.variant.name}</small><QuantityControl line={line} onChange={(quantity) => changeQuantity(line, quantity)} /><button className="text-button" type="button" onClick={() => changeQuantity(line, 0)}>Remove</button></div><strong>{formatMoney(line.variant.priceCents * line.item.quantity)}</strong></article>)}<dl><div><dt>Subtotal</dt><dd>{formatMoney(subtotal)}</dd></div><div><dt>Shipping and tax</dt><dd>{effectiveFulfillment === 'pickup' ? 'Not included' : 'Confirmed before payment'}</dd></div></dl></aside></div> : <div className="commerce-empty-catalog"><h2>Your cart is empty.</h2><a className="button" href="/shop">Browse products</a></div>}</div></section>;
}
