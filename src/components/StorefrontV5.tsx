import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getPlatformSessionAccount,
  hasPlatformCapability,
  subscribeToPlatformAuth,
  type PlatformAccount,
} from '../data/auth-v2';
import {
  addToCart,
  formatMoney,
  getAvailableStock,
  productCategories,
  readCart,
  readProducts,
  subscribeToStorefrontChanges,
  updateCartQuantity,
  type CartItem,
  type ProductCategory,
  type StoreProduct,
} from '../data/storefront';

type CategoryFilter = 'All' | ProductCategory;
function isPreviewProduct(product: StoreProduct) { return product.id.startsWith('preview-product-'); }
function productPrice(product: StoreProduct) { const prices = product.variants.filter((variant) => variant.active).map((variant) => variant.priceCents); if (!prices.length) return 'Unavailable'; const min = Math.min(...prices); const max = Math.max(...prices); return min === max ? formatMoney(min) : `${formatMoney(min)}–${formatMoney(max)}`; }
function cartQuantity(cart: CartItem[], productId: string) { return cart.filter((item) => item.productId === productId).reduce((total, item) => total + item.quantity, 0); }

export function StorefrontV5() {
  const [products, setProducts] = useState(() => readProducts().filter((product) => product.status === 'published'));
  const [cart, setCart] = useState(() => readCart());
  const [account, setAccount] = useState<PlatformAccount | null>(() => getPlatformSessionAccount());
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [message, setMessage] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const unsubscribeStore = subscribeToStorefrontChanges(() => { setProducts(readProducts().filter((product) => product.status === 'published')); setCart(readCart()); });
    const unsubscribeAuth = subscribeToPlatformAuth(() => setAccount(getPlatformSessionAccount()));
    return () => { unsubscribeStore(); unsubscribeAuth(); };
  }, []);
  useEffect(() => {
    if (!cartOpen) return undefined;
    const previous = document.documentElement.style.overflow;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setCartOpen(false); };
    document.documentElement.style.overflow = 'hidden';
    window.requestAnimationFrame(() => closeRef.current?.focus());
    window.addEventListener('keydown', close);
    return () => { document.documentElement.style.overflow = previous; window.removeEventListener('keydown', close); };
  }, [cartOpen]);

  const canManageProducts = hasPlatformCapability(account, 'manage-products');
  const canManageOrders = hasPlatformCapability(account, 'manage-orders');
  const filtered = category === 'All' ? products : products.filter((product) => product.category === category);
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const resolvedCart = cart.flatMap((item) => { const product = readProducts().find((entry) => entry.id === item.productId); const variant = product?.variants.find((entry) => entry.id === item.variantId); return product && variant ? [{ ...item, product, variant }] : []; });
  const subtotal = resolvedCart.reduce((total, item) => total + item.variant.priceCents * item.quantity, 0);
  const quickAdd = (product: StoreProduct) => { const active = product.variants.filter((variant) => variant.active && getAvailableStock(product, variant) > 0); if (active.length !== 1) { window.location.assign(`/shop/${product.slug}`); return; } const variant = active[0]; if (!variant) return; setCart(addToCart(product.id, variant.id, 1)); setMessage(`${product.name}${variant.name !== 'Default' ? ` · ${variant.name}` : ''} added to your cart.`); setCartOpen(true); };

  const drawer = cartOpen && typeof document !== 'undefined' ? createPortal(<div className="storefront-v2-cart storefront-v5-cart" role="dialog" aria-modal="true" aria-labelledby="storefront-cart-heading"><button className="storefront-v2-cart-backdrop" type="button" aria-label="Close cart preview" onClick={() => setCartOpen(false)} /><aside><header><div><p className="eyebrow">Your cart</p><h2 id="storefront-cart-heading">{cartCount ? `${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Your cart is empty'}</h2></div><button ref={closeRef} type="button" onClick={() => setCartOpen(false)} aria-label="Close cart preview">×</button></header>{resolvedCart.length ? <div className="storefront-v2-cart-items">{resolvedCart.map((item) => <article key={`${item.productId}-${item.variantId}`}><div><strong>{item.product.name}</strong><span>{item.variant.name}</span><div className="storefront-v2-cart-controls"><button type="button" onClick={() => setCart(updateCartQuantity(item.productId, item.variantId, item.quantity - 1))}>−</button><input type="number" min="1" max={getAvailableStock(item.product, item.variant)} value={item.quantity} aria-label={`${item.product.name} quantity`} onChange={(event) => setCart(updateCartQuantity(item.productId, item.variantId, Number(event.target.value)))} /><button type="button" disabled={item.quantity >= getAvailableStock(item.product, item.variant)} onClick={() => setCart(updateCartQuantity(item.productId, item.variantId, item.quantity + 1))}>+</button><button className="text-button" type="button" onClick={() => setCart(updateCartQuantity(item.productId, item.variantId, 0))}>Remove</button></div></div><strong>{formatMoney(item.variant.priceCents * item.quantity)}</strong></article>)}</div> : <p>Add a published product to see it here.</p>}<footer><div><span>Subtotal</span><strong>{formatMoney(subtotal)}</strong></div>{resolvedCart.length ? <><a className="button button-secondary" href="/cart">View cart</a><a className="button" href="/checkout">Checkout</a></> : <button className="button" type="button" onClick={() => setCartOpen(false)}>Continue shopping</button>}</footer></aside></div>, document.body) : null;

  return <section className="section storefront-v2-page platform-pattern platform-pattern-products"><div className="container route-wide"><header className="storefront-v2-header storefront-v2-header-compact"><div className="storefront-v2-title"><p className="eyebrow">The Kut Shoppe Shop</p><h1>Products</h1><p>Grooming, hair care, accessories, books, tools, and Kut Shoppe merchandise.</p></div>{canManageProducts || canManageOrders ? <nav className="storefront-v2-management" aria-label="Store management">{canManageProducts ? <a href="/admin/products">Manage products</a> : null}{canManageOrders ? <a href="/admin/orders">Manage orders</a> : null}</nav> : null}</header><div className="storefront-v2-catalog-bar"><nav className="storefront-v2-filters" aria-label="Product categories"><button className={category === 'All' ? 'is-active' : ''} type="button" onClick={() => setCategory('All')}>All <span>{products.length}</span></button>{productCategories.map((item) => { const count = products.filter((product) => product.category === item).length; return count ? <button className={category === item ? 'is-active' : ''} type="button" key={item} onClick={() => setCategory(item)}>{item} <span>{count}</span></button> : null; })}</nav>{import.meta.env.DEV && products.some(isPreviewProduct) ? <p className="storefront-v2-preview-note">Preview products are local test records and can be edited or deleted from Manage Products.</p> : null}</div>{message ? <div className="storefront-v2-toast" role="status"><span>{message}</span><button type="button" onClick={() => setMessage('')} aria-label="Dismiss cart message">×</button></div> : null}{filtered.length ? <div className="storefront-v2-grid">{filtered.map((product) => { const image = product.images[0]; const activeVariants = product.variants.filter((variant) => variant.active); const available = activeVariants.reduce((total, variant) => total + getAvailableStock(product, variant), 0); const inCart = cartQuantity(cart, product.id); return <article className={isPreviewProduct(product) ? 'storefront-v2-card is-preview' : 'storefront-v2-card'} key={product.id}><a className="storefront-v2-media" href={`/shop/${product.slug}`}>{image ? <img src={image.src} alt={image.alt || product.name} loading="lazy" decoding="async" /> : <span aria-hidden="true">{product.category.slice(0, 1)}</span>}{isPreviewProduct(product) ? <em>Preview</em> : null}{inCart ? <strong>{inCart} in cart</strong> : null}</a><div className="storefront-v2-card-copy"><div><p className="eyebrow">{product.category}</p><h2><a href={`/shop/${product.slug}`}>{product.name}</a></h2></div><p>{product.description}</p><div className="storefront-v2-product-meta"><strong>{productPrice(product)}</strong><span>{activeVariants.length > 1 ? `${activeVariants.length} options` : activeVariants[0]?.name !== 'Default' ? activeVariants[0]?.name : 'One option'}</span></div><div className="storefront-v2-badges">{product.pickupEnabled ? <span>Pickup</span> : null}{product.shippingEnabled ? <span>Shipping</span> : null}{available <= 0 ? <span>Out of stock</span> : null}</div><div className="storefront-v2-card-actions"><a className="button button-secondary" href={`/shop/${product.slug}`}>{activeVariants.length > 1 ? 'Choose options' : 'View details'}</a><button className="button" type="button" disabled={available <= 0} onClick={() => quickAdd(product)}>{activeVariants.length > 1 ? 'Select option' : inCart ? 'Add another' : 'Add to cart'}</button></div></div></article>; })}</div> : <div className="storefront-v2-empty"><h2>No products are published yet.</h2>{canManageProducts ? <a className="button" href="/admin/products">Manage products</a> : null}</div>}</div>{drawer}</section>;
}
