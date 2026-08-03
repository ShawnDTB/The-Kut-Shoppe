import { useEffect, useMemo, useState } from 'react';
import {
  addToCart,
  createProductDraft,
  deleteProduct,
  formatMoney,
  productIdeaTemplates,
  readCart,
  readOrders,
  readProducts,
  saveOrder,
  saveProduct,
  updateCartQuantity,
  type CartItem,
  type FulfillmentType,
  type StoreOrder,
  type StoreProduct,
} from '../data/storefront';
import { business } from '../data/site';

function ProductImage({ product }: { product: StoreProduct }) {
  return product.imageUrl ? (
    <img src={product.imageUrl} alt={product.name} width="720" height="720" loading="lazy" decoding="async" />
  ) : (
    <div className="commerce-product-placeholder" aria-hidden="true">
      <span>{product.category.slice(0, 2).toUpperCase()}</span>
    </div>
  );
}

export function CommerceStorefrontPage() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    setProducts(readProducts());
    setCart(readCart());
  }, []);

  const published = products.filter((product) => product.status === 'published');
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  const handleAdd = (product: StoreProduct) => {
    if (product.stockOnHand <= 0) return;
    setCart(addToCart(product.id));
  };

  return (
    <section className="section commerce-storefront-page">
      <div className="container route-wide">
        <header className="commerce-storefront-hero">
          <div>
            <p className="eyebrow">The Kut Shoppe store</p>
            <h1>Products from the shop, available your way.</h1>
            <p className="lede">Browse approved inventory for in-store pickup or shipping. Only products entered and published by the shop appear here.</p>
          </div>
          <a className="commerce-cart-link" href="/cart"><span>Cart</span><strong>{cartCount}</strong></a>
        </header>

        {published.length ? (
          <div className="commerce-product-grid">
            {published.map((product) => (
              <article className="commerce-product-card" key={product.id}>
                <div className="commerce-product-media"><ProductImage product={product} /></div>
                <div className="commerce-product-copy">
                  <p className="eyebrow">{product.category}</p>
                  <h2>{product.name}</h2>
                  <p>{product.description}</p>
                  <div className="commerce-product-fulfillment">
                    {product.pickupEnabled ? <span>Pickup</span> : null}
                    {product.shippingEnabled ? <span>Shipping</span> : null}
                  </div>
                  <div className="commerce-product-footer">
                    <div><strong>{formatMoney(product.priceCents)}</strong><small>{product.stockOnHand > 0 ? `${product.stockOnHand} available` : 'Out of stock'}</small></div>
                    <button className="button" type="button" disabled={product.stockOnHand <= 0} onClick={() => handleAdd(product)}>Add to cart</button>
                  </div>
                  {product.amazonUrl ? <a className="text-link" href={product.amazonUrl} target="_blank" rel="noopener noreferrer">Also available on Amazon <span aria-hidden="true">↗</span></a> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="commerce-empty-catalog">
            <p className="eyebrow">Catalog setup</p>
            <h2>No products have been published yet.</h2>
            <p>The shop administrator can enter the book, durags, combs, hair picks, gels, and other approved inventory without exposing incomplete listings to customers.</p>
            <a className="button" href="/admin/products">Open product manager</a>
          </div>
        )}

        <section className="commerce-storefront-support">
          <div><p className="eyebrow">In-store shopping</p><h2>See what is available on Main Street.</h2><p>Call before visiting when you are looking for a specific item or quantity.</p></div>
          <div className="commerce-inline-actions"><a className="button" href={business.phoneHref}>Call {business.phone}</a><a className="button button-secondary" href="/visit">Plan your visit</a></div>
        </section>
      </div>
    </section>
  );
}

export function CatalogAdminPage() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [draft, setDraft] = useState<StoreProduct>(() => createProductDraft());
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => setProducts(readProducts()), []);

  const publishReady = Boolean(
    draft.name.trim()
    && draft.description.trim()
    && draft.sku.trim()
    && draft.priceCents > 0
    && draft.stockOnHand >= 0
    && (draft.pickupEnabled || draft.shippingEnabled)
    && (!draft.shippingEnabled || (draft.weightOunces > 0 && draft.packageLengthInches > 0 && draft.packageWidthInches > 0 && draft.packageHeightInches > 0)),
  );

  const persist = (status: StoreProduct['status']) => {
    const product = { ...draft, status, updatedAt: new Date().toISOString() };
    setProducts(saveProduct(product));
    setDraft(createProductDraft());
    setSavedMessage(status === 'published' ? 'Product published to the local storefront.' : 'Draft saved locally.');
  };

  const editProduct = (product: StoreProduct) => {
    setDraft({ ...product });
    setSavedMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeProduct = (productId: string) => {
    setProducts(deleteProduct(productId));
    if (draft.id === productId) setDraft(createProductDraft());
  };

  return (
    <section className="section catalog-admin-page">
      <div className="container route-wide">
        <header className="catalog-admin-header">
          <div><p className="eyebrow">Store administration</p><h1>Build the verified catalog.</h1><p className="lede">Enter the exact information for each item. Drafts stay private until the product is complete and published.</p></div>
          <span>Development branch</span>
        </header>

        <div className="catalog-admin-layout">
          <main className="catalog-editor-panel">
            <div className="catalog-editor-heading"><div><p className="eyebrow">Product editor</p><h2>{draft.name || 'New product'}</h2></div><button className="text-button" type="button" onClick={() => setDraft(createProductDraft())}>Clear form</button></div>
            {savedMessage ? <p className="catalog-save-message" role="status">{savedMessage}</p> : null}

            <div className="catalog-form-grid">
              <label>Product name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <label>Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option>Books</option><option>Accessories</option><option>Tools</option><option>Hair care</option><option>Grooming</option><option>Merchandise</option></select></label>
              <label>SKU<input value={draft.sku} onChange={(event) => setDraft({ ...draft, sku: event.target.value })} /></label>
              <label>Price<input type="number" min="0" step="0.01" value={(draft.priceCents / 100).toString()} onChange={(event) => setDraft({ ...draft, priceCents: Math.round(Number(event.target.value) * 100) })} /></label>
              <label>Quantity on hand<input type="number" min="0" step="1" value={draft.stockOnHand} onChange={(event) => setDraft({ ...draft, stockOnHand: Number(event.target.value) })} /></label>
              <label>Product image URL<input type="url" value={draft.imageUrl} onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })} /></label>
              <label className="catalog-form-wide">Description<textarea rows={5} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
              <label className="catalog-form-wide">Amazon URL, optional<input type="url" value={draft.amazonUrl} onChange={(event) => setDraft({ ...draft, amazonUrl: event.target.value })} /></label>
            </div>

            <fieldset className="catalog-fulfillment-fieldset">
              <legend>Fulfillment</legend>
              <label><input type="checkbox" checked={draft.pickupEnabled} onChange={(event) => setDraft({ ...draft, pickupEnabled: event.target.checked })} /><span><strong>In-store pickup</strong><small>Reserve for pickup at 518 Main Street.</small></span></label>
              <label><input type="checkbox" checked={draft.shippingEnabled} onChange={(event) => setDraft({ ...draft, shippingEnabled: event.target.checked })} /><span><strong>Shipping</strong><small>Requires weight and package dimensions.</small></span></label>
            </fieldset>

            {draft.shippingEnabled ? (
              <div className="catalog-form-grid catalog-shipping-grid">
                <label>Weight, ounces<input type="number" min="0" step="0.1" value={draft.weightOunces} onChange={(event) => setDraft({ ...draft, weightOunces: Number(event.target.value) })} /></label>
                <label>Length, inches<input type="number" min="0" step="0.1" value={draft.packageLengthInches} onChange={(event) => setDraft({ ...draft, packageLengthInches: Number(event.target.value) })} /></label>
                <label>Width, inches<input type="number" min="0" step="0.1" value={draft.packageWidthInches} onChange={(event) => setDraft({ ...draft, packageWidthInches: Number(event.target.value) })} /></label>
                <label>Height, inches<input type="number" min="0" step="0.1" value={draft.packageHeightInches} onChange={(event) => setDraft({ ...draft, packageHeightInches: Number(event.target.value) })} /></label>
              </div>
            ) : null}

            <div className="catalog-editor-actions">
              <button className="button button-secondary" type="button" onClick={() => persist('draft')}>Save draft</button>
              <button className="button" type="button" disabled={!publishReady} onClick={() => persist('published')}>Publish product</button>
            </div>
            {!publishReady ? <p className="fine-print">Publishing requires a name, description, SKU, price, fulfillment method, and shipping measurements when shipping is enabled.</p> : null}
          </main>

          <aside className="catalog-admin-sidebar">
            <section>
              <p className="eyebrow">Known inventory groups</p>
              <div className="catalog-idea-list">{productIdeaTemplates.map((idea) => <article key={idea.name}><strong>{idea.name}</strong><small>{idea.category}</small><p>{idea.guidance}</p></article>)}</div>
            </section>
            <section>
              <p className="eyebrow">Catalog records</p>
              {products.length ? <div className="catalog-record-list">{products.map((product) => <article key={product.id}><div><strong>{product.name || 'Untitled draft'}</strong><small>{product.status} · {product.stockOnHand} in stock</small></div><div><button type="button" onClick={() => editProduct(product)}>Edit</button><button type="button" onClick={() => removeProduct(product.id)}>Delete</button></div></article>)}</div> : <p>No catalog records yet.</p>}
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
}

export function CartPage() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    setProducts(readProducts());
    setCart(readCart());
  }, []);

  const lines = cart.map((item) => ({ item, product: products.find((product) => product.id === item.productId) })).filter((line): line is { item: CartItem; product: StoreProduct } => Boolean(line.product));
  const subtotal = lines.reduce((total, line) => total + line.product.priceCents * line.item.quantity, 0);

  const changeQuantity = (productId: string, quantity: number) => setCart(updateCartQuantity(productId, quantity));

  return (
    <section className="section commerce-cart-page">
      <div className="container route-wide">
        <header className="commerce-page-heading"><div><p className="eyebrow">Your cart</p><h1>Review your products.</h1></div><a className="text-link" href="/shop">Continue shopping</a></header>
        {lines.length ? (
          <div className="commerce-cart-layout">
            <main className="commerce-cart-lines">
              {lines.map(({ item, product }) => (
                <article key={product.id}>
                  <div className="commerce-cart-image"><ProductImage product={product} /></div>
                  <div><p className="eyebrow">{product.category}</p><h2>{product.name}</h2><p>{formatMoney(product.priceCents)} each</p><button type="button" onClick={() => changeQuantity(product.id, 0)}>Remove</button></div>
                  <label>Quantity<input type="number" min="1" max={product.stockOnHand} value={item.quantity} onChange={(event) => changeQuantity(product.id, Number(event.target.value))} /></label>
                  <strong>{formatMoney(product.priceCents * item.quantity)}</strong>
                </article>
              ))}
            </main>
            <aside className="commerce-order-summary"><p className="eyebrow">Order summary</p><dl><div><dt>Subtotal</dt><dd>{formatMoney(subtotal)}</dd></div><div><dt>Shipping</dt><dd>Calculated later</dd></div><div><dt>Tax</dt><dd>Calculated later</dd></div></dl><a className="button" href="/checkout">Continue to checkout</a><p className="fine-print">Pickup orders can be recorded without online payment in this prototype. Shipping requires payment and rate integration before launch.</p></aside>
          </div>
        ) : (
          <div className="commerce-empty-catalog"><h2>Your cart is empty.</h2><p>Add a published product from the shop to continue.</p><a className="button" href="/shop">Browse products</a></div>
        )}
      </div>
    </section>
  );
}

export function CheckoutPage() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [fulfillment, setFulfillment] = useState<FulfillmentType>('pickup');
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '' });
  const [address, setAddress] = useState({ line1: '', line2: '', city: '', state: 'PA', postalCode: '' });
  const [confirmation, setConfirmation] = useState<StoreOrder | null>(null);

  useEffect(() => {
    setProducts(readProducts());
    setCart(readCart());
  }, []);

  const lines = cart.map((item) => ({ item, product: products.find((product) => product.id === item.productId) })).filter((line): line is { item: CartItem; product: StoreProduct } => Boolean(line.product));
  const subtotal = lines.reduce((total, line) => total + line.product.priceCents * line.item.quantity, 0);
  const pickupAvailable = lines.length > 0 && lines.every((line) => line.product.pickupEnabled);
  const shippingAvailable = lines.length > 0 && lines.every((line) => line.product.shippingEnabled);
  const contactReady = Boolean(customer.name && customer.email && customer.phone);
  const addressReady = fulfillment === 'pickup' || Boolean(address.line1 && address.city && address.state && address.postalCode);

  useEffect(() => {
    if (!pickupAvailable && shippingAvailable) setFulfillment('shipping');
  }, [pickupAvailable, shippingAvailable]);

  const placeOrder = () => {
    if (!contactReady || !addressReady || !lines.length) return;
    const order: StoreOrder = {
      id: `order-${Date.now()}`,
      items: lines.map(({ item, product }) => ({ productId: product.id, name: product.name, quantity: item.quantity, unitPriceCents: product.priceCents })),
      subtotalCents: subtotal,
      fulfillment,
      customer,
      shippingAddress: fulfillment === 'shipping' ? address : undefined,
      status: fulfillment === 'pickup' ? 'pickup-confirmed' : 'payment-required',
      createdAt: new Date().toISOString(),
    };
    saveOrder(order);
    if (fulfillment === 'pickup') {
      for (const { item, product } of lines) saveProduct({ ...product, stockOnHand: Math.max(0, product.stockOnHand - item.quantity), updatedAt: new Date().toISOString() });
    }
    setCart([]);
    setConfirmation(order);
  };

  if (confirmation) {
    return (
      <section className="section commerce-checkout-page"><div className="container narrow-container"><div className="commerce-confirmation"><p className="eyebrow">Order recorded</p><h1>{confirmation.fulfillment === 'pickup' ? 'Your pickup request is confirmed.' : 'Your shipping order is waiting for payment.'}</h1><p className="lede">Reference {confirmation.id}</p><dl><div><dt>Order total</dt><dd>{formatMoney(confirmation.subtotalCents)}</dd></div><div><dt>Fulfillment</dt><dd>{confirmation.fulfillment}</dd></div><div><dt>Status</dt><dd>{confirmation.status}</dd></div></dl><div className="commerce-inline-actions"><a className="button" href="/account">View account</a><a className="button button-secondary" href="/shop">Return to shop</a></div></div></div></section>
    );
  }

  return (
    <section className="section commerce-checkout-page">
      <div className="container route-wide">
        <header className="commerce-page-heading"><div><p className="eyebrow">Checkout</p><h1>Choose pickup or shipping.</h1></div></header>
        {lines.length ? (
          <div className="commerce-checkout-layout">
            <main>
              <section className="commerce-checkout-panel"><p className="eyebrow">Fulfillment</p><div className="commerce-fulfillment-options"><label className={fulfillment === 'pickup' ? 'is-selected' : ''}><input type="radio" name="fulfillment" value="pickup" checked={fulfillment === 'pickup'} disabled={!pickupAvailable} onChange={() => setFulfillment('pickup')} /><span><strong>In-store pickup</strong><small>{business.address}</small></span></label><label className={fulfillment === 'shipping' ? 'is-selected' : ''}><input type="radio" name="fulfillment" value="shipping" checked={fulfillment === 'shipping'} disabled={!shippingAvailable} onChange={() => setFulfillment('shipping')} /><span><strong>Shipping</strong><small>Payment and live rates required before production.</small></span></label></div></section>
              <section className="commerce-checkout-panel"><p className="eyebrow">Contact</p><div className="commerce-form-grid"><label>Full name<input autoComplete="name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></label><label>Email<input type="email" autoComplete="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /></label><label>Phone<input type="tel" autoComplete="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></label></div></section>
              {fulfillment === 'shipping' ? <section className="commerce-checkout-panel"><p className="eyebrow">Shipping address</p><div className="commerce-form-grid"><label className="commerce-form-wide">Address<input autoComplete="address-line1" value={address.line1} onChange={(event) => setAddress({ ...address, line1: event.target.value })} /></label><label className="commerce-form-wide">Apartment, suite, optional<input autoComplete="address-line2" value={address.line2} onChange={(event) => setAddress({ ...address, line2: event.target.value })} /></label><label>City<input autoComplete="address-level2" value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} /></label><label>State<input autoComplete="address-level1" value={address.state} onChange={(event) => setAddress({ ...address, state: event.target.value })} /></label><label>Postal code<input autoComplete="postal-code" value={address.postalCode} onChange={(event) => setAddress({ ...address, postalCode: event.target.value })} /></label></div></section> : null}
            </main>
            <aside className="commerce-order-summary"><p className="eyebrow">Order summary</p>{lines.map(({ item, product }) => <div className="checkout-summary-line" key={product.id}><span>{item.quantity} × {product.name}</span><strong>{formatMoney(product.priceCents * item.quantity)}</strong></div>)}<dl><div><dt>Subtotal</dt><dd>{formatMoney(subtotal)}</dd></div></dl><button className="button" type="button" disabled={!contactReady || !addressReady} onClick={placeOrder}>{fulfillment === 'pickup' ? 'Confirm pickup order' : 'Save shipping order for payment'}</button><p className="fine-print">No card details are collected in this branch.</p></aside>
          </div>
        ) : <div className="commerce-empty-catalog"><h2>Your cart is empty.</h2><a className="button" href="/shop">Return to shop</a></div>}
      </div>
    </section>
  );
}

export function CommerceAccountPage() {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  useEffect(() => setOrders(readOrders()), []);
  const totalSpent = useMemo(() => orders.filter((order) => order.status === 'completed' || order.status === 'pickup-confirmed').reduce((total, order) => total + order.subtotalCents, 0), [orders]);

  return (
    <section className="section commerce-account-page">
      <div className="container route-wide">
        <header className="commerce-page-heading"><div><p className="eyebrow">Customer account</p><h1>Appointments and purchases will meet here.</h1><p className="lede">This branch focuses on catalog, cart, checkout, and order history. The booking branch will merge barber appointments into the same secured account.</p></div></header>
        <div className="commerce-account-stats"><article><small>Orders</small><strong>{orders.length}</strong></article><article><small>Recorded value</small><strong>{formatMoney(totalSpent)}</strong></article><article><small>Authentication</small><strong>Pending</strong></article></div>
        <section className="commerce-account-orders"><div className="catalog-editor-heading"><div><p className="eyebrow">Order history</p><h2>Your orders</h2></div><a className="button" href="/shop">Shop products</a></div>{orders.length ? <div className="commerce-order-list">{orders.map((order) => <article key={order.id}><div><strong>{order.id}</strong><small>{new Date(order.createdAt).toLocaleString()}</small></div><div><span>{order.fulfillment}</span><span>{order.status}</span></div><strong>{formatMoney(order.subtotalCents)}</strong></article>)}</div> : <div className="commerce-empty-catalog"><h3>No orders yet.</h3><p>Pickup and shipping orders created in this browser will appear here.</p></div>}</section>
      </div>
    </section>
  );
}
