import { useEffect, useState } from 'react';
import { CartDrawerV5 } from './LiveCommerceCustomerV5';
import {
  getPlatformSessionAccount,
  hasPlatformCapability,
  subscribeToPlatformAuth,
  type PlatformAccount,
} from '../data/commerce-identity';
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
} from '../data/live-storefront';

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

  useEffect(() => {
    const unsubscribeStore = subscribeToStorefrontChanges(() => { setProducts(readProducts().filter((product) => product.status === 'published')); setCart(readCart()); });
    const unsubscribeAuth = subscribeToPlatformAuth(() => setAccount(getPlatformSessionAccount()));
    return () => { unsubscribeStore(); unsubscribeAuth(); };
  }, []);

  const canManageProducts = hasPlatformCapability(account, 'manage-products');
  const canManageOrders = hasPlatformCapability(account, 'manage-orders');
  const filtered = category === 'All' ? products : products.filter((product) => product.category === category);
  const quickAdd = (product: StoreProduct) => { const active = product.variants.filter((variant) => variant.active && getAvailableStock(product, variant) > 0); if (active.length !== 1) { window.location.assign(`/shop/${product.slug}`); return; } const variant = active[0]; if (!variant) return; try { setCart(addToCart(product.id, variant.id, 1)); } catch(error) { setMessage(error instanceof Error?error.message:'Unable to add this item.'); return; } setMessage(`${product.name}${variant.name !== 'Default' ? ` · ${variant.name}` : ''} added to your cart.`); setCartOpen(true); };

  const drawer = <CartDrawerV5 open={cartOpen} products={products} cart={cart} onClose={() => setCartOpen(false)} onCartChange={setCart} />;

  return <section className="section storefront-v2-page platform-pattern platform-pattern-products"><div className="container route-wide"><header className="storefront-v2-header storefront-v2-header-compact"><div className="storefront-v2-title"><p className="eyebrow">The Kut Shoppe Shop</p><h1>Products</h1><p>Grooming, hair care, accessories, books, tools, and Kut Shoppe merchandise.</p></div>{canManageProducts || canManageOrders ? <nav className="storefront-v2-management" aria-label="Store management">{canManageProducts ? <a href="/admin/products">Manage products</a> : null}{canManageOrders ? <a href="/admin/orders">Manage orders</a> : null}</nav> : null}</header><div className="storefront-v2-catalog-bar"><nav className="storefront-v2-filters" aria-label="Product categories"><button className={category === 'All' ? 'is-active' : ''} type="button" aria-pressed={category === 'All'} onClick={() => setCategory('All')}>All <span>{products.length}</span></button>{productCategories.map((item) => { const count = products.filter((product) => product.category === item).length; return count ? <button className={category === item ? 'is-active' : ''} type="button" aria-pressed={category === item} key={item} onClick={() => setCategory(item)}>{item} <span>{count}</span></button> : null; })}</nav>{import.meta.env.DEV && products.some(isPreviewProduct) ? <p className="storefront-v2-preview-note">Preview products are local test records and can be edited or deleted from Manage Products.</p> : null}</div>{message ? <div className="storefront-v2-toast" role="status"><span>{message}</span><button type="button" onClick={() => setMessage('')} aria-label="Dismiss cart message">×</button></div> : null}{filtered.length ? <div className="storefront-v2-grid">{filtered.map((product) => { const image = product.images[0]; const activeVariants = product.variants.filter((variant) => variant.active); const available = activeVariants.reduce((total, variant) => total + getAvailableStock(product, variant), 0); const inCart = cartQuantity(cart, product.id); return <article className={isPreviewProduct(product) ? 'storefront-v2-card is-preview' : 'storefront-v2-card'} key={product.id}><a className="storefront-v2-media" aria-label={`View ${product.name}`} href={`/shop/${product.slug}`}>{image ? <img src={image.src} alt={image.alt || product.name} width="640" height="640" loading="lazy" decoding="async" /> : <span aria-hidden="true">{product.category.slice(0, 1)}</span>}{isPreviewProduct(product) ? <em>Preview</em> : null}{inCart ? <strong>{inCart} in cart</strong> : null}</a><div className="storefront-v2-card-copy"><div><p className="eyebrow">{product.category}</p><h2><a href={`/shop/${product.slug}`}>{product.name}</a></h2></div><p>{product.description}</p><div className="storefront-v2-product-meta"><strong>{productPrice(product)}</strong><span>{activeVariants.length > 1 ? `${activeVariants.length} options` : activeVariants[0]?.name !== 'Default' ? activeVariants[0]?.name : 'One option'}</span></div><div className="storefront-v2-badges">{product.pickupEnabled ? <span>Pickup</span> : null}{product.shippingEnabled ? <span>Shipping</span> : null}{available <= 0 ? <span>Out of stock</span> : null}</div><div className="storefront-v2-card-actions"><a className="button button-secondary" href={`/shop/${product.slug}`}>{activeVariants.length > 1 ? 'Choose options' : 'View details'}</a><button className="button" type="button" disabled={available <= 0} aria-label={`${activeVariants.length > 1 ? 'Choose options for' : 'Add to cart:'} ${product.name}`} onClick={() => quickAdd(product)}>{activeVariants.length > 1 ? 'Select option' : inCart ? 'Add another' : 'Add to cart'}</button></div></div></article>; })}</div> : <div className="storefront-v2-empty"><h2>The shelves are being stocked.</h2><p>Check back for products, or <a href="/contact">contact the shop</a> for availability.</p>{canManageProducts ? <a className="button" href="/admin/products">Manage products</a> : null}</div>}</div>{drawer}</section>;
}
