import { useEffect, useState } from 'react';
import {
  addToCart,
  formatMoney,
  getAvailableStock,
  productCategories,
  readCart,
  readProducts,
  subscribeToStorefrontChanges,
  type CartItem,
  type ProductCategory,
  type StoreProduct,
} from '../data/storefront';

type CategoryFilter = 'All' | ProductCategory;

function productPrice(product: StoreProduct) {
  const prices = product.variants.filter((variant) => variant.active).map((variant) => variant.priceCents);
  if (!prices.length) return 'Unavailable';
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  return minimum === maximum ? formatMoney(minimum) : `${formatMoney(minimum)}–${formatMoney(maximum)}`;
}

function productImage(product: StoreProduct) {
  return product.images[0] ?? null;
}

function cartQuantity(cart: CartItem[], productId: string) {
  return cart.filter((item) => item.productId === productId).reduce((total, item) => total + item.quantity, 0);
}

export function StorefrontV2() {
  const [products, setProducts] = useState(() => readProducts().filter((product) => product.status === 'published'));
  const [cart, setCart] = useState(() => readCart());
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [message, setMessage] = useState('');
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => subscribeToStorefrontChanges(() => {
    setProducts(readProducts().filter((product) => product.status === 'published'));
    setCart(readCart());
  }), []);

  const filtered = category === 'All' ? products : products.filter((product) => product.category === category);
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const resolvedCart = cart.flatMap((item) => {
    const product = products.find((entry) => entry.id === item.productId) ?? readProducts().find((entry) => entry.id === item.productId);
    const variant = product?.variants.find((entry) => entry.id === item.variantId);
    return product && variant ? [{ ...item, product, variant }] : [];
  });
  const subtotal = resolvedCart.reduce((total, item) => total + item.variant.priceCents * item.quantity, 0);

  const quickAdd = (product: StoreProduct) => {
    const active = product.variants.filter((variant) => variant.active && getAvailableStock(product, variant) > 0);
    if (active.length !== 1) {
      window.location.assign(`/shop/${product.slug}`);
      return;
    }
    const variant = active[0];
    if (!variant) return;
    const next = addToCart(product.id, variant.id, 1);
    setCart(next);
    setMessage(`${product.name}${variant.name !== 'Default' ? ` · ${variant.name}` : ''} added to your cart.`);
    setCartOpen(true);
  };

  return (
    <section className="section storefront-v2-page platform-pattern platform-pattern-products">
      <div className="container route-wide">
        <header className="storefront-v2-header">
          <div><p className="eyebrow">The Kut Shoppe Shop</p><h1>Products from the shop.</h1><p>Grooming, hair care, accessories, books and approved Kut Shoppe merchandise.</p></div>
          <button className="storefront-v2-cart-button" type="button" onClick={() => setCartOpen(true)}><span>Cart</span><strong>{cartCount}</strong></button>
        </header>

        <nav className="storefront-v2-filters" aria-label="Product categories">
          <button className={category === 'All' ? 'is-active' : ''} type="button" onClick={() => setCategory('All')}>All <span>{products.length}</span></button>
          {productCategories.map((item) => {
            const count = products.filter((product) => product.category === item).length;
            if (!count) return null;
            return <button className={category === item ? 'is-active' : ''} type="button" key={item} onClick={() => setCategory(item)}>{item} <span>{count}</span></button>;
          })}
        </nav>

        {message ? <div className="storefront-v2-toast" role="status"><span>{message}</span><button type="button" onClick={() => setMessage('')} aria-label="Dismiss cart message">×</button></div> : null}

        {filtered.length ? (
          <div className="storefront-v2-grid">
            {filtered.map((product) => {
              const image = productImage(product);
              const activeVariants = product.variants.filter((variant) => variant.active);
              const available = activeVariants.reduce((total, variant) => total + getAvailableStock(product, variant), 0);
              const inCart = cartQuantity(cart, product.id);
              return (
                <article className="storefront-v2-card" key={product.id}>
                  <a className="storefront-v2-media" href={`/shop/${product.slug}`} aria-label={`View ${product.name}`}>
                    {image ? <img src={image.src} alt={image.alt || product.name} loading="lazy" decoding="async" /> : <span aria-hidden="true">{product.category.slice(0, 1)}</span>}
                    {inCart ? <strong>{inCart} in cart</strong> : null}
                  </a>
                  <div className="storefront-v2-card-copy">
                    <div><p className="eyebrow">{product.category}</p><h2><a href={`/shop/${product.slug}`}>{product.name}</a></h2></div>
                    <p>{product.description}</p>
                    <div className="storefront-v2-product-meta"><strong>{productPrice(product)}</strong><span>{activeVariants.length > 1 ? `${activeVariants.length} options` : activeVariants[0]?.name !== 'Default' ? activeVariants[0]?.name : 'One option'}</span></div>
                    <div className="storefront-v2-badges">{product.pickupEnabled ? <span>Pickup</span> : null}{product.shippingEnabled ? <span>Shipping</span> : null}{available <= 0 ? <span>Out of stock</span> : null}</div>
                    <div className="storefront-v2-card-actions"><a className="button button-secondary" href={`/shop/${product.slug}`}>{activeVariants.length > 1 ? 'Choose options' : 'View product'}</a><button className="button" type="button" disabled={available <= 0} onClick={() => quickAdd(product)}>{activeVariants.length > 1 ? 'Select option' : inCart ? 'Add another' : 'Add to cart'}</button></div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="storefront-v2-empty"><p className="eyebrow">Current catalog</p><h2>{products.length ? 'No products match this category.' : 'Products are being prepared.'}</h2><p>{products.length ? 'Choose another category to continue browsing.' : 'The shop will publish verified products, prices and inventory here as they become available.'}</p>{products.length ? <button className="button button-secondary" type="button" onClick={() => setCategory('All')}>View all products</button> : null}</div>
        )}
      </div>

      {cartOpen ? <div className="storefront-v2-cart" role="dialog" aria-modal="true" aria-labelledby="storefront-cart-heading"><button className="storefront-v2-cart-backdrop" type="button" aria-label="Close cart preview" onClick={() => setCartOpen(false)} /><aside><header><div><p className="eyebrow">Your cart</p><h2 id="storefront-cart-heading">{cartCount ? `${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Your cart is empty'}</h2></div><button type="button" onClick={() => setCartOpen(false)} aria-label="Close cart preview">×</button></header>{resolvedCart.length ? <div className="storefront-v2-cart-items">{resolvedCart.map((item) => <article key={`${item.productId}-${item.variantId}`}><div><strong>{item.product.name}</strong><span>{item.variant.name}</span><small>Quantity {item.quantity}</small></div><strong>{formatMoney(item.variant.priceCents * item.quantity)}</strong></article>)}</div> : <p>Add a published product to see it here.</p>}<footer><div><span>Subtotal</span><strong>{formatMoney(subtotal)}</strong></div><a className="button" href="/cart">View cart</a><button className="button button-secondary" type="button" onClick={() => setCartOpen(false)}>Continue shopping</button></footer></aside></div> : null}
    </section>
  );
}
