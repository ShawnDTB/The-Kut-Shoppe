import { useMemo, useState, useEffect } from 'react';
import {
  createProductDraft,
  deleteProduct,
  deleteProductPreset,
  generateProductSku,
  generateVariantSku,
  productCategories,
  productIdeaTemplates,
  readProductPresets,
  readProducts,
  saveProduct,
  saveProductPreset,
  subscribeToStorefrontChanges,
  type ProductImage,
  type ProductPreset,
  type ProductStatus,
  type ProductVariant,
  type StoreProduct,
} from '../data/storefront';

const maxImages = 4;
const maxImageBytes = 1_500_000;

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
