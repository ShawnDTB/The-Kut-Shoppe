import { accountApi } from './customer-api';
import type { StoreProduct, ProductVariant, CartItem, StoreOrder } from './storefront';
export type { StoreProduct, ProductVariant, CartItem, StoreOrder, ProductCategory, FulfillmentType } from './storefront';
export const productCategories = ['Accessories','Books','Grooming','Hair care','Merchandise','Tools'] as const;
export const formatMoney = (cents:number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
let products:StoreProduct[]=[];
const listeners=new Set<()=>void>();
const key='kut-shoppe.live-cart.v1';
const notify=()=>listeners.forEach(fn=>fn());
export async function loadCatalog(){const data=await accountApi<{products:StoreProduct[]}>('/catalog');products=data.products;notify();}
export const readProducts=()=>products;
export const getProductBySlug=(slug:string)=>products.find(p=>p.slug===slug)??null;
export const getAvailableStock=(_product:StoreProduct,variant:ProductVariant)=>variant.active?variant.stockOnHand:0;
export function readCart():CartItem[]{try{const value:unknown=JSON.parse(window.localStorage.getItem(key)??'[]');if(!Array.isArray(value))return [];return value.filter((v):v is CartItem=>v&&typeof v.productId==='string'&&typeof v.variantId==='string'&&Number.isInteger(v.quantity)&&v.quantity>0&&v.quantity<=99).slice(0,20);}catch{return [];}}
function save(cart:CartItem[]){window.localStorage.setItem(key,JSON.stringify(cart));notify();return cart;}
export const clearCart=()=>save([]);
export function updateCartQuantity(productId:string,variantId:string,quantity:number){if(!Number.isInteger(quantity))return readCart();const next=readCart().filter(i=>i.variantId!==variantId);const product=products.find(p=>p.id===productId);const variant=product?.variants.find(v=>v.id===variantId);if(quantity>0&&product&&variant&&variant.active)next.push({productId,variantId,quantity:Math.min(quantity,99,variant.stockOnHand)});return save(next.filter(i=>i.quantity>0));}
export function addToCart(productId:string,variantId:string,quantity=1){const cart=readCart();if(cart.length>=20&&!cart.some(i=>i.variantId===variantId))throw new Error('Your cart has reached twenty different items.');return updateCartQuantity(productId,variantId,(cart.find(i=>i.variantId===variantId)?.quantity??0)+quantity);}
export function subscribeToStorefrontChanges(fn:()=>void){listeners.add(fn);const sync=(event:StorageEvent)=>{if(event.key===key)fn();};window.addEventListener('storage',sync);return ()=>{listeners.delete(fn);window.removeEventListener('storage',sync);};}
export async function createOrder(input:Omit<StoreOrder,'id'|'status'|'ownerActionRequired'|'createdAt'|'updatedAt'>,requestKey:string){
  const {orderId}=await accountApi<{orderId:string}>('/me/orders/request',{requestKey,items:input.items.map(i=>({variantId:i.variantId,quantity:i.quantity,unitPriceCents:i.unitPriceCents})),fulfillment:input.fulfillment,customer:{name:input.customer.name,phone:input.customer.phone},shippingAddress:input.shippingAddress});
  clearCart();return orderId;
}
