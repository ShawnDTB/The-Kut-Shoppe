import { useEffect, useState } from 'react';
import {
  deleteProduct,
  formatMoney,
  productCategories,
  readProducts,
  saveProduct,
  subscribeToStorefrontChanges,
  type ProductVariant,
  type StoreProduct,
} from '../data/storefront';
import { CatalogAdminPage } from './CommercePlatformPages';

function ExistingProductEditor({ product, onSaved }: { product: StoreProduct; onSaved: () => void }) {
  const [draft, setDraft] = useState(() => structuredClone(product));
  const [message, setMessage] = useState('');
  const updateVariant = (variantId: string, patch: Partial<ProductVariant>) => setDraft((current) => ({ ...current, variants: current.variants.map((variant) => variant.id === variantId ? { ...variant, ...patch } : variant) }));
  const save = () => {
    if (!draft.name.trim() || !draft.description.trim()) { setMessage('Product name and description are required.'); return; }
    saveProduct({ ...draft, updatedAt: new Date().toISOString() });
    setMessage(`${draft.name} was updated.`);
    onSaved();
  };
  return <section className="product-admin-v5-editor"><div className="product-admin-v5-toolbar"><a className="text-link" href="/admin/products">← Back to catalog</a><span>{draft.status}</span></div><div className="catalog-editor-heading"><div><p className="eyebrow">Edit existing product</p><h1>{draft.name}</h1></div><a className="button button-secondary" href={`/shop/${draft.slug}`}>View product</a></div><div className="staff-v5-fields"><label>Product name <span aria-hidden="true">*</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as StoreProduct['category'] })}>{productCategories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as StoreProduct['status'] })}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label><label>Base SKU<input value={draft.baseSku} onChange={(event) => setDraft({ ...draft, baseSku: event.target.value.toUpperCase(), skuManuallyEdited: true })} /></label><label className="staff-v5-wide">Description <span aria-hidden="true">*</span><textarea rows={4} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label></div><section className="product-admin-v5-variants"><div><p className="eyebrow">Variants and inventory</p><h2>Options customers can buy</h2></div>{draft.variants.map((variant) => <article key={variant.id}><label>Option<input value={variant.name} onChange={(event) => updateVariant(variant.id, { name: event.target.value })} /></label><label>SKU<input value={variant.sku} onChange={(event) => updateVariant(variant.id, { sku: event.target.value.toUpperCase() })} /></label><label>Price<input type="number" min="0" step="0.01" value={(variant.priceCents / 100).toString()} onChange={(event) => updateVariant(variant.id, { priceCents: Math.round(Number(event.target.value) * 100) })} /></label><label>Inventory<input type="number" min="0" step="1" value={variant.stockOnHand} onChange={(event) => updateVariant(variant.id, { stockOnHand: Math.max(0, Number(event.target.value)) })} /></label><label className="product-admin-v5-active"><input type="checkbox" checked={variant.active} onChange={(event) => updateVariant(variant.id, { active: event.target.checked })} /> Active</label></article>)}</section><fieldset className="catalog-fulfillment-fieldset"><legend>Fulfillment</legend><label><input type="checkbox" checked={draft.pickupEnabled} onChange={(event) => setDraft({ ...draft, pickupEnabled: event.target.checked })} /><span><strong>In-store pickup</strong></span></label><label><input type="checkbox" checked={draft.shippingEnabled} onChange={(event) => setDraft({ ...draft, shippingEnabled: event.target.checked })} /><span><strong>Shipping</strong></span></label></fieldset>{message ? <p className={message.endsWith('updated.') ? 'success-message' : 'form-error'} role="status">{message}</p> : null}<button className="button" type="button" onClick={save}>Save product changes</button></section>;
}

export function ProductAdminHubV5() {
  const [products, setProducts] = useState(() => readProducts());
  useEffect(() => subscribeToStorefrontChanges(() => setProducts(readProducts())), []);
  const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const productId = params.get('product');
  if (mode === 'new') return <CatalogAdminPage />;
  const editing = productId ? products.find((product) => product.id === productId) ?? null : null;
  if (editing) return <section className="section product-admin-v5 platform-pattern platform-pattern-products"><div className="container route-wide"><ExistingProductEditor product={editing} onSaved={() => setProducts(readProducts())} /></div></section>;
  return <section className="section product-admin-v5 platform-pattern platform-pattern-products"><div className="container route-wide"><header className="catalog-admin-header"><div><p className="eyebrow">Product management</p><h1>Catalog and inventory.</h1><p className="lede">Review existing products first. Create a new product only when the catalog needs another listing.</p></div><div className="catalog-admin-links"><a className="button" href="/admin/products?mode=new">New product</a><a className="button button-secondary" href="/admin/orders">Manage orders</a><a className="button button-secondary" href="/shop">View Shop</a></div></header>{products.length ? <div className="product-admin-v5-list">{products.map((product) => { const inventory = product.variants.reduce((total, variant) => total + variant.stockOnHand, 0); const prices = product.variants.map((variant) => variant.priceCents); return <article key={product.id}><div className="product-admin-v5-record-heading"><div><p className="eyebrow">{product.category}</p><h2>{product.name || 'Untitled draft'}</h2><span className={`order-status order-status-${product.status === 'published' ? 'accepted' : 'submitted'}`}>{product.status}</span></div><div><a className="button button-secondary" href={`/admin/products?product=${product.id}`}>Edit</a>{product.status === 'published' ? <a className="button button-secondary" href={`/shop/${product.slug}`}>View</a> : null}</div></div><dl><div><dt>Variants</dt><dd>{product.variants.length}</dd></div><div><dt>Inventory</dt><dd>{inventory}</dd></div><div><dt>Price</dt><dd>{prices.length ? `${formatMoney(Math.min(...prices))}${Math.min(...prices) !== Math.max(...prices) ? `–${formatMoney(Math.max(...prices))}` : ''}` : 'Not set'}</dd></div><div><dt>Fulfillment</dt><dd>{[product.pickupEnabled ? 'Pickup' : '', product.shippingEnabled ? 'Shipping' : ''].filter(Boolean).join(' · ') || 'Not set'}</dd></div></dl><button className="text-button danger" type="button" onClick={() => setProducts(deleteProduct(product.id))}>Delete product</button></article>; })}</div> : <div className="commerce-empty-catalog"><h2>No products yet.</h2><a className="button" href="/admin/products?mode=new">Create the first product</a></div>}</div></section>;
}
