import { useEffect, useMemo, useState } from 'react';
import { getSessionAccount, isValidEmail, isValidPhone } from '../data/auth';
import {
  addToCart,
  consumeStorefrontFlash,
  createOrder,
  createProductDraft,
  deleteProduct,
  deleteProductPreset,
  formatMoney,
  generateProductSku,
  generateVariantSku,
  getAvailableStock,
  getProductBySlug,
  productCategories,
  productIdeaTemplates,
  readCart,
  readOrders,
  readProductPresets,
  readProducts,
  saveProduct,
  saveProductPreset,
  setStorefrontFlash,
  subscribeToStorefrontChanges,
  updateCartQuantity,
  updateOrder,
  type CartItem,
  type FulfillmentType,
  type ProductImage,
  type ProductPreset,
  type ProductStatus,
  type ProductVariant,
  type StoreOrder,
  type StoreProduct,
} from '../data/storefront';
import { business } from '../data/site';

const maxImages = 4;
const maxImageBytes = 1_500_000;

function ProductImageView({ product, imageId }: { product: StoreProduct; imageId?: string | null }) {
  const image = product.images.find((item) => item.id === imageId) ?? product.images[0];
  return image ? (
    <img src={image.src} alt={image.alt || product.name} width="900" height="900" loading="lazy" decoding="async" />
  ) : (
    <div className="commerce-product-placeholder" aria-hidden="true"><span>{product.category.slice(0, 2).toUpperCase()}</span></div>
  );
}

function findProductLine(item: CartItem, products: StoreProduct[]) {
  const product = products.find((candidate) => candidate.id === item.productId);
  const variant = product?.variants.find((candidate) => candidate.id === item.variantId);
  return product && variant ? { item, product, variant } : null;
}

function StorefrontNotice({ message }: { message: string }) {
  return message ? <div className="commerce-action-notice" role="status"><span aria-hidden="true">✓</span>{message}</div> : null;
}

export function CommerceStorefrontPage() {
  const [products, setProducts] = useState<StoreProduct[]>(() => readProducts());
  const [cart, setCart] = useState<CartItem[]>(() => readCart());
  const [notice, setNotice] = useState(() => consumeStorefrontFlash());

  useEffect(() => subscribeToStorefrontChanges(() => {
    setProducts(readProducts());
    setCart(readCart());
  }), []);

  const published = products.filter((product) => product.status === 'published');
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  const quickAdd = (product: StoreProduct) => {
    const active = product.variants.filter((variant) => variant.active);
    if (active.length !== 1) return;
    const variant = active[0];
    if (!variant || getAvailableStock(product, variant) <= 0) return;
    setCart(addToCart(product.id, variant.id));
    setNotice(`${product.name}${variant.name !== 'Default' ? `, ${variant.name}` : ''} was added to your cart.`);
  };

  return (
    <section className="section commerce-storefront-page platform-pattern platform-pattern-products">
      <div className="container route-wide">
        <header className="commerce-storefront-hero">
          <div><p className="eyebrow">The Kut Shoppe store</p><h1>Shop what the crew actually carries.</h1><p className="lede">Published inventory can be reserved for pickup or prepared for shipping. Colors, sizes, and editions stay grouped as variants of one product.</p></div>
          <a className="commerce-cart-link" href="/cart"><span>Cart</span><strong>{cartCount}</strong></a>
        </header>
        <StorefrontNotice message={notice} />

        {published.length ? (
          <div className="commerce-product-grid">
            {published.map((product) => {
              const active = product.variants.filter((variant) => variant.active);
              const totalAvailable = active.reduce((total, variant) => total + getAvailableStock(product, variant), 0);
              const prices = active.map((variant) => variant.priceCents);
              const minPrice = prices.length ? Math.min(...prices) : 0;
              const maxPrice = prices.length ? Math.max(...prices) : 0;
              return (
                <article className="commerce-product-card" key={product.id}>
                  <a className="commerce-product-media" href={`/shop/${product.slug}`}><ProductImageView product={product} /></a>
                  <div className="commerce-product-copy">
                    <p className="eyebrow">{product.category}</p>
                    <h2><a href={`/shop/${product.slug}`}>{product.name}</a></h2>
                    <p>{product.description}</p>
                    <div className="commerce-product-fulfillment">{product.pickupEnabled ? <span>Pickup</span> : null}{product.shippingEnabled ? <span>Shipping</span> : null}{active.length > 1 ? <span>{active.length} options</span> : null}</div>
                    <div className="commerce-product-footer">
                      <div><strong>{minPrice === maxPrice ? formatMoney(minPrice) : `${formatMoney(minPrice)} to ${formatMoney(maxPrice)}`}</strong><small>{totalAvailable > 0 ? `${totalAvailable} available` : 'Out of stock'}</small></div>
                      {active.length === 1 ? <button className="button" type="button" disabled={totalAvailable <= 0} onClick={() => quickAdd(product)}>Add to cart</button> : <a className="button" href={`/shop/${product.slug}`}>Choose options</a>}
                    </div>
                    {product.amazonUrl ? <a className="text-link" href={product.amazonUrl} target="_blank" rel="noopener noreferrer">Also available on Amazon <span aria-hidden="true">↗</span></a> : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="commerce-empty-catalog"><p className="eyebrow">Catalog setup</p><h2>No products have been published yet.</h2><p>The product manager can enter the shop’s real book inventory, durags, combs, picks, gels, and approved hair-care items without exposing unfinished records.</p><a className="button" href="/admin/products">Open product manager</a></div>
        )}

        <section className="commerce-storefront-support"><div><p className="eyebrow">In-store shopping</p><h2>See what is available on Main Street.</h2><p>Call before visiting when you need a specific color, variant, or quantity.</p></div><div className="commerce-inline-actions"><a className="button" href={business.phoneHref}>Call {business.phone}</a><a className="button button-secondary" href="/visit">Plan your visit</a></div></section>
      </div>
    </section>
  );
}

export function ProductDetailPage({ slug }: { slug: string }) {
  const [product, setProduct] = useState<StoreProduct | null>(() => getProductBySlug(slug));
  const [cart, setCart] = useState<CartItem[]>(() => readCart());
  const [selectedVariantId, setSelectedVariantId] = useState(() => getProductBySlug(slug)?.variants.find((variant) => variant.active)?.id ?? '');
  const [selectedImageId, setSelectedImageId] = useState<string | null>(() => getProductBySlug(slug)?.images[0]?.id ?? null);
  const [notice, setNotice] = useState('');

  useEffect(() => subscribeToStorefrontChanges(() => {
    const next = getProductBySlug(slug);
    setProduct(next);
    setCart(readCart());
  }), [slug]);

  if (!product || product.status !== 'published') {
    return <section className="section commerce-storefront-page"><div className="container narrow-container"><div className="commerce-empty-catalog"><h1>Product not found.</h1><p>This product may still be a draft or may no longer be available.</p><a className="button" href="/shop">Back to Shop</a></div></div></section>;
  }

  const activeVariants = product.variants.filter((variant) => variant.active);
  const selectedVariant = activeVariants.find((variant) => variant.id === selectedVariantId) ?? activeVariants[0];
  const available = selectedVariant ? getAvailableStock(product, selectedVariant) : 0;

  const add = () => {
    if (!selectedVariant || available <= 0) return;
    setCart(addToCart(product.id, selectedVariant.id));
    setNotice(`${product.name}${selectedVariant.name !== 'Default' ? `, ${selectedVariant.name}` : ''} was added to your cart.`);
  };

  return (
    <section className="section commerce-product-page platform-pattern platform-pattern-products">
      <div className="container route-wide">
        <a className="text-link commerce-back-link" href="/shop">← Back to Shop</a>
        <StorefrontNotice message={notice} />
        <div className="commerce-product-detail">
          <div className="commerce-product-gallery">
            <div className="commerce-product-primary-image"><ProductImageView product={product} imageId={selectedImageId ?? selectedVariant?.imageId} /></div>
            {product.images.length > 1 ? <div className="commerce-product-thumbnails">{product.images.map((image) => <button className={selectedImageId === image.id ? 'is-selected' : ''} type="button" key={image.id} onClick={() => setSelectedImageId(image.id)}><img src={image.src} alt="" width="140" height="140" /></button>)}</div> : null}
          </div>
          <div className="commerce-product-detail-copy">
            <p className="eyebrow">{product.category}</p><h1>{product.name}</h1><p className="lede">{product.description}</p>
            {activeVariants.length > 1 ? <fieldset className="commerce-variant-picker"><legend>Choose an option</legend>{activeVariants.map((variant) => <label className={selectedVariant?.id === variant.id ? 'is-selected' : ''} key={variant.id}><input type="radio" name="variant" checked={selectedVariant?.id === variant.id} onChange={() => { setSelectedVariantId(variant.id); setSelectedImageId(variant.imageId); setNotice(''); }} /><span><strong>{variant.name}</strong><small>{formatMoney(variant.priceCents)} · {getAvailableStock(product, variant)} available</small></span></label>)}</fieldset> : null}
            {selectedVariant ? <div className="commerce-product-purchase"><div><strong>{formatMoney(selectedVariant.priceCents)}</strong><small>{available > 0 ? `${available} available` : 'Out of stock'}</small></div><button className="button" type="button" disabled={available <= 0} onClick={add}>Add to cart</button></div> : null}
            <div className="commerce-product-fulfillment">{product.pickupEnabled ? <span>Pickup at 518 Main Street</span> : null}{product.shippingEnabled ? <span>Shipping available</span> : null}</div>
            {product.amazonUrl ? <a className="button button-secondary" href={product.amazonUrl} target="_blank" rel="noopener noreferrer">Buy on Amazon <span aria-hidden="true">↗</span></a> : null}
            <a className="commerce-cart-link inline" href="/cart"><span>View cart</span><strong>{cart.reduce((total, item) => total + item.quantity, 0)}</strong></a>
          </div>
        </div>
      </div>
    </section>
  );
}

function createImageId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `image-${crypto.randomUUID()}`;
  return `image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function newVariant(baseSku: string, index: number): ProductVariant {
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? `variant-${crypto.randomUUID()}` : `variant-${Date.now()}-${index}`,
    name: `Option ${index + 1}`,
    sku: generateVariantSku(baseSku, `Option ${index + 1}`, index),
    priceCents: 0,
    stockOnHand: 0,
    imageId: null,
    active: true,
  };
}

export function CatalogAdminPage() {
  const [products, setProducts] = useState<StoreProduct[]>(() => readProducts());
  const [presets, setPresets] = useState<ProductPreset[]>(() => readProductPresets());
  const [draft, setDraft] = useState<StoreProduct>(() => createProductDraft());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [presetName, setPresetName] = useState('');

  useEffect(() => subscribeToStorefrontChanges(() => {
    setProducts(readProducts());
    setPresets(readProductPresets());
  }), []);

  const updateAutomaticSku = (next: StoreProduct, name = next.name, category = next.category) => {
    if (next.skuManuallyEdited) return { ...next, name, category };
    const baseSku = generateProductSku(category, name, Math.max(1, products.findIndex((product) => product.id === next.id) + 1));
    return {
      ...next,
      name,
      category,
      baseSku,
      slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      variants: next.variants.map((variant, index) => ({ ...variant, sku: generateVariantSku(baseSku, variant.name, index) })),
    };
  };

  const applyPreset = (preset: ProductPreset) => {
    const next = createProductDraft(preset);
    setDraft(next);
    setMessage(`${preset.name} fields were loaded. Add the exact product details before publishing.`);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addVariant = () => setDraft((current) => ({ ...current, variants: [...current.variants, newVariant(current.baseSku, current.variants.length)] }));
  const updateVariant = (variantId: string, patch: Partial<ProductVariant>) => setDraft((current) => ({ ...current, variants: current.variants.map((variant) => variant.id === variantId ? { ...variant, ...patch } : variant) }));
  const removeVariant = (variantId: string) => setDraft((current) => ({ ...current, variants: current.variants.filter((variant) => variant.id !== variantId) }));

  const readImageFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError('');
    const remaining = maxImages - draft.images.length;
    const selected = Array.from(files).slice(0, remaining);
    if (selected.some((file) => file.size > maxImageBytes)) {
      setError('Each image must be 1.5 MB or smaller in this browser prototype. Production uploads will use optimized object storage.');
      return;
    }

    const images = await Promise.all(selected.map((file) => new Promise<ProductImage>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ id: createImageId(), src: String(reader.result), alt: draft.name ? `${draft.name} product image` : file.name, source: 'upload' });
      reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
      reader.readAsDataURL(file);
    })));
    setDraft((current) => ({ ...current, images: [...current.images, ...images] }));
  };

  const addImageUrl = () => {
    if (!imageUrl.trim() || draft.images.length >= maxImages) return;
    setDraft((current) => ({ ...current, images: [...current.images, { id: createImageId(), src: imageUrl.trim(), alt: current.name ? `${current.name} product image` : 'Product image', source: 'url' }] }));
    setImageUrl('');
  };

  const publishErrors = useMemo(() => {
    const errors: string[] = [];
    if (!draft.name.trim()) errors.push('Product name');
    if (!draft.description.trim()) errors.push('Description');
    if (!draft.baseSku.trim()) errors.push('Base SKU');
    if (!draft.images.length) errors.push('At least one product image');
    if (!draft.variants.length) errors.push('At least one variant');
    if (draft.variants.some((variant) => !variant.name.trim() || !variant.sku.trim() || variant.priceCents <= 0 || variant.stockOnHand < 0)) errors.push('Complete variant names, SKUs, prices, and inventory');
    if (!draft.pickupEnabled && !draft.shippingEnabled) errors.push('Pickup or shipping');
    if (draft.shippingEnabled && [draft.weightOunces, draft.packageLengthInches, draft.packageWidthInches, draft.packageHeightInches].some((value) => value <= 0)) errors.push('Shipping weight and package dimensions');
    return errors;
  }, [draft]);

  const persist = (status: ProductStatus) => {
    if (status === 'published' && publishErrors.length) {
      setError(`Complete: ${publishErrors.join(', ')}.`);
      return;
    }
    const saved = saveProduct({ ...draft, status });
    setProducts(readProducts());
    if (status === 'published') {
      setStorefrontFlash(`${saved.name} was published.`);
      window.location.assign(`/shop/${saved.slug}`);
      return;
    }
    setMessage(`${saved.name || 'Product'} draft was saved.`);
    setDraft(createProductDraft());
  };

  const savePreset = () => {
    const saved = saveProductPreset(draft, presetName);
    setPresets(readProductPresets());
    setPresetName('');
    setMessage(`${saved.name} was saved as a reusable preset.`);
  };

  const edit = (product: StoreProduct) => {
    setDraft(structuredClone(product));
    setMessage(`Editing ${product.name}.`);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="section catalog-admin-page platform-pattern platform-pattern-products">
      <div className="container route-wide">
        <header className="catalog-admin-header"><div><p className="eyebrow">Store administration</p><h1>Build one product, then define its options.</h1><p className="lede">Products such as durags stay together while colors and materials are managed as variants with their own SKU, price, image, and stock.</p></div><div className="catalog-admin-links"><a href="/admin/orders">Manage orders</a><a href="/shop">View Shop</a></div></header>
        {message ? <p className="catalog-save-message" role="status">{message}</p> : null}{error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="catalog-admin-layout">
          <main className="catalog-editor-panel">
            <div className="catalog-editor-heading"><div><p className="eyebrow">Product editor</p><h2>{draft.name || 'New product'}</h2></div><button className="text-button" type="button" onClick={() => { setDraft(createProductDraft()); setMessage(''); setError(''); }}>Clear form</button></div>
            <div className="catalog-form-grid">
              <label>Product name <span aria-hidden="true">*</span><input required value={draft.name} onChange={(event) => setDraft(updateAutomaticSku(draft, event.target.value, draft.category))} /></label>
              <label>Category <span aria-hidden="true">*</span><select value={draft.category} onChange={(event) => setDraft(updateAutomaticSku(draft, draft.name, event.target.value as StoreProduct['category']))}>{productCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
              <label>Base SKU <span aria-hidden="true">*</span><input value={draft.baseSku} onChange={(event) => setDraft({ ...draft, baseSku: event.target.value.toUpperCase(), skuManuallyEdited: true })} /><small>Generated from category and product name. Editable.</small></label>
              <label>Amazon URL, optional<input type="url" value={draft.amazonUrl} onChange={(event) => setDraft({ ...draft, amazonUrl: event.target.value })} /></label>
              <label className="catalog-form-wide">Description <span aria-hidden="true">*</span><textarea rows={5} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
            </div>

            <section className="catalog-image-manager">
              <div className="catalog-editor-heading"><div><p className="eyebrow">Product photography</p><h3>Upload up to {maxImages} images</h3></div><span>{draft.images.length}/{maxImages}</span></div>
              <input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={draft.images.length >= maxImages} onChange={(event) => { void readImageFiles(event.target.files); event.target.value = ''; }} />
              <div className="catalog-image-url"><label>Or use an approved image URL<input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} /></label><button type="button" disabled={!imageUrl.trim() || draft.images.length >= maxImages} onClick={addImageUrl}>Add URL</button></div>
              {draft.images.length ? <div className="catalog-image-list">{draft.images.map((image) => <article key={image.id}><img src={image.src} alt="" width="160" height="160" /><label>Alt text<input value={image.alt} onChange={(event) => setDraft({ ...draft, images: draft.images.map((item) => item.id === image.id ? { ...item, alt: event.target.value } : item) })} /></label><button type="button" onClick={() => setDraft({ ...draft, images: draft.images.filter((item) => item.id !== image.id), variants: draft.variants.map((variant) => variant.imageId === image.id ? { ...variant, imageId: null } : variant) })}>Remove</button></article>)}</div> : <p className="fine-print">Product pages use uploaded or approved images. The production system will move uploads to optimized object storage instead of browser storage.</p>}
            </section>

            <section className="catalog-variant-editor">
              <div className="catalog-editor-heading"><div><p className="eyebrow">Variants</p><h3>Colors, sizes, materials, or editions</h3></div><button type="button" onClick={addVariant}>Add variant</button></div>
              {draft.variants.map((variant, index) => (
                <article key={variant.id}>
                  <label>Option name<input value={variant.name} onChange={(event) => { const name = event.target.value; updateVariant(variant.id, { name, sku: generateVariantSku(draft.baseSku, name, index) }); }} /></label>
                  <label>Variant SKU<input value={variant.sku} onChange={(event) => updateVariant(variant.id, { sku: event.target.value.toUpperCase() })} /></label>
                  <label>Price<input type="number" min="0" step="0.01" value={(variant.priceCents / 100).toString()} onChange={(event) => updateVariant(variant.id, { priceCents: Math.round(Number(event.target.value) * 100) })} /></label>
                  <label>Quantity<input type="number" min="0" step="1" value={variant.stockOnHand} onChange={(event) => updateVariant(variant.id, { stockOnHand: Math.max(0, Number(event.target.value)) })} /></label>
                  <label>Variant image<select value={variant.imageId ?? ''} onChange={(event) => updateVariant(variant.id, { imageId: event.target.value || null })}><option value="">Primary product image</option>{draft.images.map((image, imageIndex) => <option value={image.id} key={image.id}>Image {imageIndex + 1}</option>)}</select></label>
                  <label className="catalog-active-toggle"><input type="checkbox" checked={variant.active} onChange={(event) => updateVariant(variant.id, { active: event.target.checked })} /> Active</label>
                  <button className="text-button danger" type="button" disabled={draft.variants.length === 1} onClick={() => removeVariant(variant.id)}>Remove variant</button>
                </article>
              ))}
            </section>

            <fieldset className="catalog-fulfillment-fieldset"><legend>Fulfillment</legend><label><input type="checkbox" checked={draft.pickupEnabled} onChange={(event) => setDraft({ ...draft, pickupEnabled: event.target.checked })} /><span><strong>In-store pickup</strong><small>Owner approval is required before the order becomes accepted.</small></span></label><label><input type="checkbox" checked={draft.shippingEnabled} onChange={(event) => setDraft({ ...draft, shippingEnabled: event.target.checked })} /><span><strong>Shipping</strong><small>Requires dimensions and payment before acceptance.</small></span></label></fieldset>
            {draft.shippingEnabled ? <div className="catalog-form-grid catalog-shipping-grid"><label>Weight, ounces<input type="number" min="0" step="0.1" value={draft.weightOunces} onChange={(event) => setDraft({ ...draft, weightOunces: Number(event.target.value) })} /></label><label>Length, inches<input type="number" min="0" step="0.1" value={draft.packageLengthInches} onChange={(event) => setDraft({ ...draft, packageLengthInches: Number(event.target.value) })} /></label><label>Width, inches<input type="number" min="0" step="0.1" value={draft.packageWidthInches} onChange={(event) => setDraft({ ...draft, packageWidthInches: Number(event.target.value) })} /></label><label>Height, inches<input type="number" min="0" step="0.1" value={draft.packageHeightInches} onChange={(event) => setDraft({ ...draft, packageHeightInches: Number(event.target.value) })} /></label></div> : null}

            <div className="catalog-preset-save"><label>Preset name<input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Example: Standard durag" /></label><button type="button" disabled={!presetName.trim()} onClick={savePreset}>Save current fields as preset</button></div>
            <div className="catalog-editor-actions"><button className="button button-secondary" type="button" onClick={() => persist('draft')}>Save draft</button><button className="button" type="button" onClick={() => persist('published')}>Publish product</button></div>
            {publishErrors.length ? <p className="fine-print">Publishing still requires: {publishErrors.join(', ')}.</p> : null}
          </main>

          <aside className="catalog-admin-sidebar">
            <section><p className="eyebrow">Quick-start templates</p><div className="catalog-idea-list">{productIdeaTemplates.map((preset) => <button type="button" key={preset.id} onClick={() => applyPreset(preset)}><strong>{preset.name}</strong><small>{preset.category}</small><span>Use template →</span></button>)}</div></section>
            <section><p className="eyebrow">Saved presets</p>{presets.length ? <div className="catalog-record-list">{presets.map((preset) => <article key={preset.id}><div><strong>{preset.name}</strong><small>{preset.category}</small></div><div><button type="button" onClick={() => applyPreset(preset)}>Use</button><button type="button" onClick={() => setPresets(deleteProductPreset(preset.id))}>Delete</button></div></article>)}</div> : <p>No saved presets yet.</p>}</section>
            <section><p className="eyebrow">Catalog records</p>{products.length ? <div className="catalog-record-list">{products.map((product) => <article key={product.id}><div><strong>{product.name || 'Untitled draft'}</strong><small>{product.status} · {product.variants.length} variant{product.variants.length === 1 ? '' : 's'}</small></div><div>{product.status === 'published' ? <a href={`/shop/${product.slug}`}>View</a> : null}<button type="button" onClick={() => edit(product)}>Edit</button><button type="button" onClick={() => setProducts(deleteProduct(product.id))}>Delete</button></div></article>)}</div> : <p>No catalog records yet.</p>}</section>
          </aside>
        </div>
      </div>
    </section>
  );
}

export function CartPage() {
  const [products, setProducts] = useState<StoreProduct[]>(() => readProducts());
  const [cart, setCart] = useState<CartItem[]>(() => readCart());
  useEffect(() => subscribeToStorefrontChanges(() => { setProducts(readProducts()); setCart(readCart()); }), []);
  const lines = cart.map((item) => findProductLine(item, products)).filter((line): line is NonNullable<ReturnType<typeof findProductLine>> => Boolean(line));
  const subtotal = lines.reduce((total, line) => total + line.variant.priceCents * line.item.quantity, 0);

  return (
    <section className="section commerce-cart-page platform-pattern platform-pattern-products"><div className="container route-wide"><header className="commerce-page-heading"><div><p className="eyebrow">Your cart</p><h1>Review products and options.</h1></div><a className="text-link" href="/shop">Continue shopping</a></header>{lines.length ? <div className="commerce-cart-layout"><main className="commerce-cart-lines">{lines.map(({ item, product, variant }) => <article key={`${product.id}-${variant.id}`}><a className="commerce-cart-image" href={`/shop/${product.slug}`}><ProductImageView product={product} imageId={variant.imageId} /></a><div><p className="eyebrow">{product.category}</p><h2>{product.name}</h2><p>{variant.name} · {formatMoney(variant.priceCents)} each</p><button type="button" onClick={() => setCart(updateCartQuantity(product.id, variant.id, 0))}>Remove</button></div><label>Quantity<input type="number" min="1" max={getAvailableStock(product, variant)} value={item.quantity} onChange={(event) => setCart(updateCartQuantity(product.id, variant.id, Number(event.target.value)))} /></label><strong>{formatMoney(variant.priceCents * item.quantity)}</strong></article>)}</main><aside className="commerce-order-summary"><p className="eyebrow">Order summary</p><dl><div><dt>Subtotal</dt><dd>{formatMoney(subtotal)}</dd></div><div><dt>Shipping</dt><dd>Calculated during fulfillment</dd></div><div><dt>Tax</dt><dd>Calculated before payment</dd></div></dl><a className="button" href="/checkout">Continue to checkout</a><p className="fine-print">Submitting checkout creates an order request. The shop must accept it before pickup or shipping is confirmed.</p></aside></div> : <div className="commerce-empty-catalog"><h2>Your cart is empty.</h2><p>Add a published product and choose its option to continue.</p><a className="button" href="/shop">Browse products</a></div>}</div></section>
  );
}

export function CheckoutPage() {
  const [products, setProducts] = useState<StoreProduct[]>(() => readProducts());
  const [cart, setCart] = useState<CartItem[]>(() => readCart());
  const sessionAccount = getSessionAccount();
  const [fulfillment, setFulfillment] = useState<FulfillmentType>('pickup');
  const [customer, setCustomer] = useState({ name: sessionAccount?.name ?? '', email: sessionAccount?.email ?? '', phone: sessionAccount?.phone ?? '' });
  const [address, setAddress] = useState({ line1: '', line2: '', city: '', state: 'PA', postalCode: '' });
  const [submitted, setSubmitted] = useState<StoreOrder | null>(null);
  useEffect(() => subscribeToStorefrontChanges(() => { setProducts(readProducts()); setCart(readCart()); }), []);
  const lines = cart.map((item) => findProductLine(item, products)).filter((line): line is NonNullable<ReturnType<typeof findProductLine>> => Boolean(line));
  const subtotal = lines.reduce((total, line) => total + line.variant.priceCents * line.item.quantity, 0);
  const supportsShipping = lines.length > 0 && lines.every((line) => line.product.shippingEnabled);
  const supportsPickup = lines.length > 0 && lines.every((line) => line.product.pickupEnabled);
  const contactReady = customer.name.trim().length >= 2 && isValidEmail(customer.email) && isValidPhone(customer.phone);
  const addressReady = fulfillment === 'pickup' || Boolean(address.line1.trim() && address.city.trim() && address.state.trim() && address.postalCode.trim());

  const submit = () => {
    if (!contactReady || !addressReady || !lines.length) return;
    const order = createOrder({
      items: lines.map(({ item, product, variant }) => ({ productId: product.id, variantId: variant.id, name: product.name, variantName: variant.name, sku: variant.sku, quantity: item.quantity, unitPriceCents: variant.priceCents })),
      subtotalCents: subtotal,
      shippingCents: 0,
      taxCents: 0,
      totalCents: subtotal,
      fulfillment,
      customer,
      shippingAddress: fulfillment === 'shipping' ? address : null,
      trackingNumber: '',
      internalNote: '',
    });
    setSubmitted(order);
    setCart([]);
  };

  if (submitted) return <section className="section commerce-checkout-page platform-pattern platform-pattern-products"><div className="container narrow-container"><div className="commerce-order-confirmation"><p className="eyebrow">Order request submitted</p><h1>The shop still needs to accept it.</h1><p>{submitted.fulfillment === 'shipping' ? 'Shipping payment, taxes, and rate confirmation remain required before the order can be accepted.' : 'Inventory is reserved while the owner reviews the pickup request.'}</p><dl><div><dt>Reference</dt><dd>{submitted.id}</dd></div><div><dt>Status</dt><dd>{submitted.status.replaceAll('-', ' ')}</dd></div><div><dt>Subtotal</dt><dd>{formatMoney(submitted.subtotalCents)}</dd></div><div><dt>Fulfillment</dt><dd>{submitted.fulfillment}</dd></div></dl><div className="commerce-inline-actions"><a className="button" href="/account">View order in Account</a><a className="button button-secondary" href="/shop">Continue shopping</a></div></div></div></section>;

  return <section className="section commerce-checkout-page platform-pattern platform-pattern-products"><div className="container route-wide"><header className="commerce-page-heading"><div><p className="eyebrow">Checkout</p><h1>Submit the order for shop review.</h1></div><a className="text-link" href="/cart">Back to cart</a></header>{lines.length ? <div className="commerce-checkout-layout"><main className="commerce-checkout-form"><fieldset><legend>Fulfillment</legend><label className={!supportsPickup ? 'is-disabled' : ''}><input type="radio" name="fulfillment" value="pickup" checked={fulfillment === 'pickup'} disabled={!supportsPickup} onChange={() => setFulfillment('pickup')} /><span><strong>In-store pickup</strong><small>Pick up at 518 Main Street after the owner marks the order ready.</small></span></label><label className={!supportsShipping ? 'is-disabled' : ''}><input type="radio" name="fulfillment" value="shipping" checked={fulfillment === 'shipping'} disabled={!supportsShipping} onChange={() => setFulfillment('shipping')} /><span><strong>Shipping</strong><small>Rates, taxes, and compliant payment are required before acceptance.</small></span></label></fieldset><section><h2>Contact information</h2><div className="catalog-form-grid"><label>Full name<input required value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></label><label>Email<input required type="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /></label><label>Mobile phone<input required type="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></label></div></section>{fulfillment === 'shipping' ? <section><h2>Shipping address</h2><div className="catalog-form-grid"><label className="catalog-form-wide">Address<input required value={address.line1} onChange={(event) => setAddress({ ...address, line1: event.target.value })} /></label><label className="catalog-form-wide">Apartment or suite<input value={address.line2} onChange={(event) => setAddress({ ...address, line2: event.target.value })} /></label><label>City<input required value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} /></label><label>State<input required value={address.state} onChange={(event) => setAddress({ ...address, state: event.target.value })} /></label><label>ZIP code<input required value={address.postalCode} onChange={(event) => setAddress({ ...address, postalCode: event.target.value })} /></label></div></section> : null}<div className="commerce-payment-boundary"><strong>No card details are collected in this build.</strong><p>The product, cart, inventory, fulfillment, order, and account experience is owned by The Kut Shoppe. Card settlement and automated payouts still require regulated financial rails.</p></div><button className="button" type="button" disabled={!contactReady || !addressReady} onClick={submit}>Submit order request</button></main><aside className="commerce-order-summary"><p className="eyebrow">Order summary</p>{lines.map(({ item, product, variant }) => <div className="commerce-checkout-line" key={`${product.id}-${variant.id}`}><span>{item.quantity} × {product.name}<small>{variant.name}</small></span><strong>{formatMoney(variant.priceCents * item.quantity)}</strong></div>)}<dl><div><dt>Subtotal</dt><dd>{formatMoney(subtotal)}</dd></div><div><dt>Shipping and tax</dt><dd>Pending review</dd></div></dl><p className="fine-print">The owner must accept the order before its status changes to accepted, preparing, ready, or shipped.</p></aside></div> : <div className="commerce-empty-catalog"><h2>Your cart is empty.</h2><a className="button" href="/shop">Browse products</a></div>}</div></section>;
}

function OrderActions({ order, onUpdated }: { order: StoreOrder; onUpdated: () => void }) {
  const [tracking, setTracking] = useState(order.trackingNumber);
  const changeStatus = (status: StoreOrder['status']) => { updateOrder(order.id, { status, ownerActionRequired: false, trackingNumber: tracking }); onUpdated(); };
  return <div className="order-admin-actions"><button type="button" onClick={() => changeStatus('accepted')}>Accept</button><button type="button" onClick={() => changeStatus('preparing')}>Preparing</button>{order.fulfillment === 'pickup' ? <button type="button" onClick={() => changeStatus('ready-for-pickup')}>Ready for pickup</button> : <><label>Tracking<input value={tracking} onChange={(event) => setTracking(event.target.value)} /></label><button type="button" disabled={!tracking.trim()} onClick={() => changeStatus('shipped')}>Mark shipped</button></>}<button type="button" onClick={() => changeStatus('completed')}>Complete</button><button className="danger" type="button" onClick={() => changeStatus('declined')}>Decline</button></div>;
}

export function OrderAdminPage() {
  const [orders, setOrders] = useState<StoreOrder[]>(() => readOrders());
  const [filter, setFilter] = useState<'all' | StoreOrder['status']>('all');
  useEffect(() => subscribeToStorefrontChanges(() => setOrders(readOrders())), []);
  const visible = orders.filter((order) => filter === 'all' || order.status === filter);
  return <section className="section order-admin-page platform-pattern platform-pattern-products"><div className="container route-wide"><header className="catalog-admin-header"><div><p className="eyebrow">Order administration</p><h1>Owner approval controls fulfillment.</h1><p className="lede">Customer checkout creates a request. This queue is where inventory, payment readiness, pickup, and shipping status become official.</p></div><a className="button button-secondary" href="/admin/products">Manage products</a></header><div className="calendar-filters"><label>Status<select value={filter} onChange={(event) => setFilter(event.target.value as 'all' | StoreOrder['status'])}><option value="all">All statuses</option><option value="submitted">Submitted</option><option value="payment-required">Payment required</option><option value="accepted">Accepted</option><option value="preparing">Preparing</option><option value="ready-for-pickup">Ready for pickup</option><option value="shipped">Shipped</option><option value="completed">Completed</option><option value="declined">Declined</option><option value="cancelled">Cancelled</option></select></label></div>{visible.length ? <div className="order-admin-list">{visible.map((order) => <article key={order.id}><header><div><p className="eyebrow">{order.fulfillment}</p><h2>{order.customer.name}</h2><p>{order.customer.email} · {order.customer.phone}</p></div><span className={`order-status order-status-${order.status}`}>{order.status.replaceAll('-', ' ')}</span></header><div className="order-admin-items">{order.items.map((item) => <div key={`${item.productId}-${item.variantId}`}><span>{item.quantity} × {item.name}<small>{item.variantName} · {item.sku}</small></span><strong>{formatMoney(item.unitPriceCents * item.quantity)}</strong></div>)}</div><footer><strong>{formatMoney(order.totalCents)}</strong><small>{new Date(order.createdAt).toLocaleString()}</small></footer><OrderActions order={order} onUpdated={() => setOrders(readOrders())} /></article>)}</div> : <div className="commerce-empty-catalog"><h2>No matching orders.</h2></div>}</div></section>;
}
