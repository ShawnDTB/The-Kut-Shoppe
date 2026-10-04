import { randomUUID } from 'node:crypto';
import { ApiError, type Env, type Statement } from './types';
import { allowFields, secretHash, stringField } from './security';
import { shippingAddress } from './customer-records';
import { requireStaffMfa, staffMfaGate } from './staff-mfa';
import type { StoreProduct, StoreOrder } from '../src/data/storefront';

type Rows<T> = { results: T[]; meta?: { changes: number } };
const gate = (admin: boolean) => `EXISTS (SELECT 1 FROM users u JOIN sessions se ON se.user_id=u.id WHERE u.id=? AND se.token_hash=? AND u.status='active' AND u.email_verified_at IS NOT NULL AND se.revoked_at IS NULL AND julianday(se.expires_at)>julianday('now') ${admin ? `AND u.role IN ('owner','admin','manager') AND ${staffMfaGate('se','u')}` : ''})`;
const number = (value: unknown, max = 100000000) => { if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > max) throw new ApiError(400, 'Use a valid non-negative whole number.'); return Number(value); };
const idField = (body: Record<string, unknown>, key: string) => { const value = stringField(body, key, 100, 1); if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new ApiError(400, 'Invalid identifier.'); return value; };
const object = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'Provide a valid object.'); return value as Record<string, unknown>; };
export function requireCommerce(env: Env) { if (env.COMMERCE_ENABLED !== 'true') throw new ApiError(503, 'Online product requests are not available in this environment.'); }
export async function requireCommerceAdmin(env: Env, user: string, session: string) {
  requireCommerce(env); await requireStaffMfa(env, user, session);
  if (!await env.DB.prepare(`SELECT id FROM users WHERE id=? AND role IN ('owner','admin','manager') AND status='active'`).bind(user).first()) throw new ApiError(403, 'Store management access is required.');
}
export async function catalog(env: Env, admin = false) {
  requireCommerce(env);
  const result = await env.DB.batch<Rows<Record<string, unknown>>>([
    env.DB.prepare("SELECT id,name,slug,category,description,base_sku AS baseSku,status,amazon_url AS amazonUrl,pickup_enabled AS pickupEnabled,shipping_enabled AS shippingEnabled,weight_ounces AS weightOunces,package_length_inches AS packageLengthInches,package_width_inches AS packageWidthInches,package_height_inches AS packageHeightInches,created_at AS createdAt,updated_at AS updatedAt FROM products" + (admin ? '' : " WHERE status='published'") + ' ORDER BY name,id LIMIT 501'),
    env.DB.prepare('SELECT v.id,v.product_id AS productId,v.name,v.sku,v.price_cents AS priceCents,' + (admin ? 'v.stock_on_hand' : 'MAX(0,v.stock_on_hand-v.stock_reserved)') + " AS stockOnHand,v.stock_reserved AS reserved,v.image_id AS imageId,v.active FROM product_variants v JOIN products p ON p.id=v.product_id" + (admin ? '' : " WHERE p.status='published' AND v.active=1")),
    env.DB.prepare("SELECT i.id,i.product_id AS productId,i.public_url AS src,i.alt_text AS alt FROM product_images i JOIN products p ON p.id=i.product_id" + (admin ? '' : " WHERE p.status='published'") + ' ORDER BY i.sort_order,i.id'),
    env.DB.prepare('SELECT value FROM commerce_revision WHERE id=1'),
  ]);
  if (result[0]!.results.length > 500) throw new ApiError(503, 'The product catalog needs pagination before adding more products.');
  const products = result[0]!.results.map((p) => ({ ...p, skuManuallyEdited: true, pickupEnabled: Boolean(p.pickupEnabled), shippingEnabled: Boolean(p.shippingEnabled), amazonUrl: p.amazonUrl ?? '',
    variants: result[1]!.results.filter((v) => v.productId === p.id).map(v => ({ id:v.id,name:v.name,sku:v.sku,priceCents:v.priceCents,stockOnHand:v.stockOnHand,imageId:v.imageId,active:Boolean(v.active) })),
    images: result[2]!.results.filter((v) => v.productId === p.id).map(v => ({ id:v.id,src:v.src,alt:v.alt,source:'url' })),
  })) as unknown as StoreProduct[];
  return { products, revision: Number(result[3]!.results[0]!.value) };
}
async function commit(env: Env, user: string, session: string, revision: number, admin: boolean, kind: string, build: (receipt: string) => Statement[], condition?: { sql: string; values: unknown[] }) {
  const receipt = randomUUID(); const now = new Date().toISOString();
  const result = await env.DB.batch<Rows<unknown>>([
    env.DB.prepare(`INSERT INTO commerce_receipts(id,user_id,kind,created_at) SELECT ?,?,?,? WHERE (SELECT value FROM commerce_revision WHERE id=1)=? AND ${gate(admin)} AND (${condition?.sql ?? '1'})`).bind(receipt, user, kind, now, revision, user, session, ...(condition?.values ?? [])),
    ...build(receipt),
    env.DB.prepare("INSERT INTO audit_events(id,actor_user_id,action,entity_type,entity_id,created_at) SELECT ?,?,?,'commerce',?,? WHERE EXISTS(SELECT 1 FROM commerce_receipts WHERE id=?)").bind(randomUUID(), user, kind, receipt, now, receipt),
  ]);
  if (result[0]?.meta?.changes !== 1) throw new ApiError(409, 'The catalog, inventory, order, or your access changed. Refresh and try again.');
}
const claimed = 'EXISTS(SELECT 1 FROM commerce_receipts WHERE id=?)';
export async function saveProduct(env: Env, user: string, session: string, body: Record<string, unknown>) {
  await requireCommerceAdmin(env, user, session); allowFields(body, ['product','revision']);
  const revision = number(body.revision); const p = body.product as Record<string, unknown>;
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new ApiError(400, 'Provide a product.');
  allowFields(p, ['id','name','slug','category','description','baseSku','status','pickupEnabled','shippingEnabled','variants','imageUrl','imageAlt']);
  const id = idField(p, 'id'); const name = stringField(p,'name',150,2); const slug = idField(p,'slug'); const sku = stringField(p,'baseSku',80,1);
  const category = stringField(p,'category',40,1); if (!['Accessories','Books','Grooming','Hair care','Merchandise','Tools'].includes(category)) throw new ApiError(400,'Choose a product category.');
  const description = stringField(p,'description',2000); const status = stringField(p,'status',20,1); if (!['draft','published','archived'].includes(status)) throw new ApiError(400,'Choose a publication status.');
  if (typeof p.pickupEnabled !== 'boolean' || typeof p.shippingEnabled !== 'boolean' || (!p.pickupEnabled && !p.shippingEnabled && status==='published')) throw new ApiError(400,'Choose pickup or shipping for a published product.');
  if (!Array.isArray(p.variants) || !p.variants.length || p.variants.length>10) throw new ApiError(400,'Use between one and ten variants.');
  const variants = p.variants.map((value: unknown) => { const v = object(value); allowFields(v,['id','name','sku','priceCents','stockOnHand','active']); if (typeof v.active!=='boolean') throw new ApiError(400,'Choose variant availability.'); return { id:idField(v,'id'),name:stringField(v,'name',100,1),sku:stringField(v,'sku',80,1),price:number(v.priceCents),stock:number(v.stockOnHand,100000),active:v.active }; });
  if (new Set(variants.map(v=>v.id)).size!==variants.length || new Set(variants.map(v=>v.sku)).size!==variants.length) throw new ApiError(400,'Variants need unique IDs and SKUs.');
  const url = stringField(p,'imageUrl',1000); const alt = stringField(p,'imageAlt',200);
  if (url && (!/^https:\/\/(www\.thekutshoppe\.com|d2zdpiztbgorvt\.cloudfront\.net)\//.test(url) || !alt)) throw new ApiError(400,'Use an HTTPS image from the shop or its current image CDN, with alternative text.');
  const existing = await env.DB.prepare('SELECT id,product_id AS productId,stock_reserved AS reserved FROM product_variants WHERE product_id=? OR id IN ('+variants.map(()=>'?').join(',')+')').bind(id,...variants.map(v=>v.id)).all<{id:string;productId:string;reserved:number}>();
  for (const old of existing.results) { const next=variants.find(v=>v.id===old.id); if (old.productId!==id || !next || next.stock<old.reserved) throw new ApiError(409,'Keep existing variants and enough stock for reserved orders. Deactivate variants instead of deleting them.'); }
  const now=new Date().toISOString();
  await commit(env,user,session,revision,true,'product_saved',receipt=>[
    env.DB.prepare(`INSERT INTO products(id,name,slug,category,description,base_sku,status,pickup_enabled,shipping_enabled,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ${claimed} ON CONFLICT(id) DO UPDATE SET name=excluded.name,slug=excluded.slug,category=excluded.category,description=excluded.description,base_sku=excluded.base_sku,status=excluded.status,pickup_enabled=excluded.pickup_enabled,shipping_enabled=excluded.shipping_enabled,updated_at=excluded.updated_at`).bind(id,name,slug,category,description,sku,status,Number(p.pickupEnabled),Number(p.shippingEnabled),now,now,receipt),
    ...variants.map(v=>env.DB.prepare(`INSERT INTO product_variants(id,product_id,name,sku,price_cents,stock_on_hand,active,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,? WHERE ${claimed} ON CONFLICT(id) DO UPDATE SET name=excluded.name,sku=excluded.sku,price_cents=excluded.price_cents,stock_on_hand=excluded.stock_on_hand,active=excluded.active,updated_at=excluded.updated_at`).bind(v.id,id,v.name,v.sku,v.price,v.stock,Number(v.active),now,now,receipt)),
    env.DB.prepare(`DELETE FROM product_images WHERE product_id=? AND ${claimed}`).bind(id,receipt),
    ...(url?[env.DB.prepare(`INSERT INTO product_images(id,product_id,storage_key,public_url,alt_text,created_at) SELECT ?,?,'',?,?,? WHERE ${claimed}`).bind(`${id}-image`,id,url,alt,now,receipt)]:[]),
  ]);
  return { message:'Product saved.' };
}
export async function createOrder(env: Env,user:string,session:string,body:Record<string,unknown>) {
  requireCommerce(env); allowFields(body,['requestKey','items','fulfillment','customer','shippingAddress']); const key=idField(body,'requestKey');
  if (!Array.isArray(body.items)||!body.items.length||body.items.length>20) throw new ApiError(400,'Use one to twenty cart lines.');
  const items=body.items.map((value:unknown)=>{const v=object(value);allowFields(v,['variantId','quantity','unitPriceCents']);return {id:idField(v,'variantId'),qty:number(v.quantity,99),price:number(v.unitPriceCents)};}).sort((a,b)=>a.id.localeCompare(b.id));
  if(items.some(v=>!v.qty)||new Set(items.map(v=>v.id)).size!==items.length)throw new ApiError(400,'Use unique variants with positive quantities.');
  const fulfillment=stringField(body,'fulfillment',10,1);if(!['pickup','shipping'].includes(fulfillment))throw new ApiError(400,'Choose pickup or shipping.');
  const customer=body.customer as Record<string,unknown>;if(!customer||typeof customer!=='object')throw new ApiError(400,'Provide contact details.');allowFields(customer,['name','phone']);
  const name=stringField(customer,'name',100,2);const phone=stringField(customer,'phone',30,7);
  if (!/^\d{10,15}$/.test(phone.replace(/\D/g,''))) throw new ApiError(400,'Provide a valid contact phone number.');
  let address:{line1:string;line2:string;city:string;state:string;postalCode:string}|null=null;
  if(fulfillment==='shipping'){const a=body.shippingAddress as Record<string,unknown>;if(!a||typeof a!=='object')throw new ApiError(400,'Provide a shipping address.');allowFields(a,['line1','line2','city','state','postalCode']);address={line1:stringField(a,'line1',150,1),line2:stringField(a,'line2',100),city:stringField(a,'city',100,1),state:stringField(a,'state',2,2),postalCode:stringField(a,'postalCode',10,5)};if(!/^\d{5}(?:-\d{4})?$/.test(address.postalCode))throw new ApiError(400,'Check the ZIP code.');}
  const fingerprint=secretHash(env,JSON.stringify({items,fulfillment,name,phone,address}));
  const replay=async()=>{const old=await env.DB.prepare('SELECT id,request_fingerprint AS fingerprint FROM orders WHERE customer_user_id=? AND request_key=?').bind(user,key).first<{id:string;fingerprint:string}>();if(old&&old.fingerprint!==fingerprint)throw new ApiError(409,'This request key was already used for a different order.');return old;};
  const old=await replay();if(old)return {orderId:old.id};
  const snapshot=await env.DB.batch<Rows<Record<string,unknown>>>([env.DB.prepare('SELECT value FROM commerce_revision WHERE id=1'),env.DB.prepare("SELECT v.id,v.name,v.sku,v.price_cents AS price,v.stock_on_hand-v.stock_reserved AS available,p.name AS product,p.pickup_enabled AS pickup,p.shipping_enabled AS shipping FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.status='published' AND v.active=1")]);
  const lines=items.map(item=>{const row=snapshot[1]!.results.find(v=>v.id===item.id);if(!row||!row[fulfillment]||Number(row.available)<item.qty||row.price!==item.price)throw new ApiError(409,'A product price, fulfillment option or available quantity changed. Refresh the cart.');return {...item,row};});
  const total=lines.reduce((sum,v)=>sum+v.qty*v.price,0);if(total>100000000)throw new ApiError(400,'Order total is too large.');const id=randomUUID();const now=new Date().toISOString();
  try{await commit(env,user,session,Number(snapshot[0]!.results[0]!.value),false,'order_requested',receipt=>[
    env.DB.prepare(`INSERT INTO orders(id,customer_user_id,guest_name,guest_email,guest_phone,status,fulfillment_type,subtotal_cents,total_cents,shipping_address_json,request_key,request_fingerprint,created_at,updated_at) SELECT ?,?,?,(SELECT email FROM users WHERE id=?),?,?,?,?,?,?,?,?,?,? WHERE ${claimed}`).bind(id,user,name,user,phone,fulfillment==='shipping'?'payment_required':'submitted',fulfillment,total,total,address?JSON.stringify(address):null,key,fingerprint,now,now,receipt),
    ...lines.flatMap(v=>[env.DB.prepare(`INSERT INTO order_items(id,order_id,variant_id,product_name,variant_name,sku,quantity,unit_price_cents,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE ${claimed}`).bind(randomUUID(),id,v.id,v.row.product,v.row.name,v.row.sku,v.qty,v.price,now,receipt),env.DB.prepare(`UPDATE product_variants SET stock_reserved=stock_reserved+?,updated_at=? WHERE id=? AND ${claimed}`).bind(v.qty,now,v.id,receipt)]),
  ]);}catch(error){const saved=await replay();if(saved)return {orderId:saved.id};throw error;}
  return {orderId:id};
}
export async function adminOrders(env:Env,user:string,session:string){
  await requireCommerceAdmin(env,user,session);
  const result=await env.DB.batch<Rows<Record<string,unknown>>>([env.DB.prepare(`SELECT o.*,u.email AS account_email,
    (SELECT s.id FROM finalized_sales s WHERE s.order_id=o.id ORDER BY EXISTS(SELECT 1 FROM cash_sale_events e WHERE e.sale_id=s.id AND e.kind='void'),s.created_at DESC,s.id DESC LIMIT 1) AS sale_id,
    (SELECT CASE WHEN EXISTS(SELECT 1 FROM cash_sale_events e WHERE e.sale_id=s.id AND e.kind='void') THEN 'void'
      WHEN EXISTS(SELECT 1 FROM cash_sale_events e WHERE e.sale_id=s.id AND e.kind='refund') THEN 'refunded'
      WHEN EXISTS(SELECT 1 FROM cash_sale_events e WHERE e.sale_id=s.id AND e.kind='payment') THEN 'paid' ELSE 'unpaid' END
      FROM finalized_sales s WHERE s.order_id=o.id ORDER BY EXISTS(SELECT 1 FROM cash_sale_events e WHERE e.sale_id=s.id AND e.kind='void'),s.created_at DESC,s.id DESC LIMIT 1) AS financial_state
    FROM orders o LEFT JOIN users u ON u.id=o.customer_user_id WHERE ${gate(true)} ORDER BY CASE WHEN o.status IN ('completed','declined','cancelled','refunded') THEN 1 ELSE 0 END,o.created_at DESC,o.id DESC LIMIT 101`).bind(user,session),env.DB.prepare(`SELECT i.*,v.product_id FROM order_items i JOIN product_variants v ON v.id=i.variant_id WHERE ${gate(true)}`).bind(user,session),env.DB.prepare('SELECT value FROM commerce_revision WHERE id=1')]);
  return {revision:Number(result[2]!.results[0]!.value),more:result[0]!.results.length>100,orders:result[0]!.results.slice(0,100).map(o=>({id:o.id,canProcess:Boolean(o.request_key),saleId:o.sale_id??null,financialState:o.financial_state??'not_finalized',status:String(o.status).replaceAll('_','-'),fulfillment:o.fulfillment_type,subtotalCents:o.subtotal_cents,totalCents:o.total_cents,shippingCents:o.shipping_cents,taxCents:o.tax_cents,customer:{name:o.guest_name??'',email:o.account_email??o.guest_email??'',phone:o.guest_phone??''},shippingAddress:shippingAddress(o.shipping_address_json?String(o.shipping_address_json):null),trackingNumber:o.tracking_number??'',internalNote:'',ownerActionRequired:Boolean(o.owner_action_required),createdAt:o.created_at,updatedAt:o.updated_at,items:result[1]!.results.filter(i=>i.order_id===o.id).map(i=>({productId:i.product_id,variantId:i.variant_id,name:i.product_name,variantName:i.variant_name,sku:i.sku,quantity:i.quantity,unitPriceCents:i.unit_price_cents}))})) as unknown as Array<StoreOrder & {canProcess:boolean;saleId:string|null;financialState:string}>};
}
export async function withdrawOrder(env: Env, user: string, session: string, id: string, updatedAt: string) {
  requireCommerce(env);
  const read = async () => {
    const rows = await env.DB.batch<Rows<Record<string, unknown>>>([
      env.DB.prepare('SELECT status,updated_at,request_key,customer_withdrawn_from FROM orders WHERE id=? AND customer_user_id=?').bind(id, user),
      env.DB.prepare('SELECT value FROM commerce_revision WHERE id=1'),
    ]);
    const order = rows[0]!.results[0];
    if (!order) throw new ApiError(404, 'This order is not available in your account.');
    return { order, revision: Number(rows[1]!.results[0]!.value) };
  };
  const replay = (order: Record<string, unknown>) => order.status === 'cancelled' && order.customer_withdrawn_from === updatedAt;
  const snapshot = await read();
  if (replay(snapshot.order)) return { message: 'Your order request is already withdrawn.' };
  if (!snapshot.order.request_key || !['submitted','payment_required'].includes(String(snapshot.order.status)) || snapshot.order.updated_at !== updatedAt) {
    throw new ApiError(409, 'This request changed or the shop has started processing it. Refresh the order; contact the shop for further changes.');
  }
  const now = new Date().toISOString();
  try {
    await commit(env, user, session, snapshot.revision, false, 'customer_order_withdrawn', receipt => [
      env.DB.prepare(`UPDATE orders SET status='cancelled',customer_withdrawn_from=?,owner_action_required=0,updated_at=? WHERE id=? AND customer_user_id=? AND ${claimed}`).bind(updatedAt, now, id, user, receipt),
      env.DB.prepare(`UPDATE product_variants SET stock_reserved=stock_reserved-(SELECT SUM(i.quantity) FROM order_items i WHERE i.order_id=? AND i.variant_id=product_variants.id),updated_at=?
        WHERE id IN (SELECT variant_id FROM order_items WHERE order_id=?) AND ${claimed}`).bind(id, now, id, receipt),
    ]);
  } catch (error) {
    if (!replay((await read()).order)) throw error;
  }
  return { message: 'Order request withdrawn. Reserved items have been released. No refund was processed.' };
}
export async function processOrder(env:Env,user:string,session:string,id:string,body:Record<string,unknown>){
  await requireCommerceAdmin(env,user,session);allowFields(body,['status','revision','trackingNumber']);const revision=number(body.revision);const status=stringField(body,'status',30,1).replaceAll('-','_');const tracking=stringField(body,'trackingNumber',150);
  const order=await env.DB.prepare('SELECT status,fulfillment_type AS fulfillment FROM orders WHERE id=? AND request_key IS NOT NULL').bind(id).first<{status:string;fulfillment:string}>();if(!order)throw new ApiError(404,'Order request not found.');
  const next:Record<string,string[]>={submitted:['accepted','declined','cancelled'],payment_required:['accepted','declined','cancelled'],accepted:['preparing','cancelled'],preparing:[order.fulfillment==='pickup'?'ready_for_pickup':'shipped','cancelled'],ready_for_pickup:['completed','cancelled'],shipped:['completed']};
  if(!next[order.status]?.includes(status)||status==='shipped'&&!tracking)throw new ApiError(400,'Choose a valid next status and provide tracking for shipping.');
  if (['cancelled','declined'].includes(status) && await env.DB.prepare(`SELECT id FROM finalized_sales s WHERE s.order_id=?
    AND NOT EXISTS(SELECT 1 FROM cash_sale_events e WHERE e.sale_id=s.id AND e.kind IN ('void','refund'))`).bind(id).first()) {
    throw new ApiError(409,'Void the unpaid sale or record its full cash refund before cancelling this order. A refund does not automatically restock merchandise.');
  }
  const items=await env.DB.prepare('SELECT variant_id AS id,quantity FROM order_items WHERE order_id=?').bind(id).all<{id:string;quantity:number}>();const now=new Date().toISOString();const release=['declined','cancelled','completed'].includes(status);
  await commit(env,user,session,revision,true,'order_processed',receipt=>[
    env.DB.prepare(`UPDATE orders SET status=?,tracking_number=?,owner_action_required=0,updated_at=? WHERE id=? AND ${claimed}`).bind(status,tracking,now,id,receipt),
    ...(release?items.results.map(i=>env.DB.prepare(`UPDATE product_variants SET stock_reserved=stock_reserved-?,stock_on_hand=stock_on_hand-?,updated_at=? WHERE id=? AND ${claimed}`).bind(i.quantity,status==='completed'?i.quantity:0,now,i.id,receipt)):[]),
  ], {
    sql: `EXISTS(SELECT 1 FROM orders WHERE id=? AND status=? AND fulfillment_type=?)
      AND (? NOT IN ('cancelled','declined') OR NOT EXISTS(SELECT 1 FROM finalized_sales s WHERE s.order_id=?
        AND NOT EXISTS(SELECT 1 FROM cash_sale_events e WHERE e.sale_id=s.id AND e.kind IN ('void','refund'))))`,
    values: [id,order.status,order.fulfillment,status,id],
  });return {message:'Order updated.'};
}
