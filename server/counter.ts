import { randomUUID } from 'node:crypto';
import { ApiError, type Env } from './types';
import { allowFields, secretHash, stringField } from './security';
import { requireFrontDesk } from './front-desk';
import { cashGate as gate, authorizeCash as authorize } from './cash-access';
import { openRegisterSql, registerBalanceSql } from './register';
import { estimateDetail, prepare, signed, pageCursor } from './sales';
import { cents } from './sale-amounts';
import type { CashReceipt, CounterPage, FinalizedSale, ReceiptPage } from '../src/shared/counter';
import type { SaleEstimate } from '../src/shared/sales';

export async function finalizeSale(env:Env,actor:string,session:string,body:Record<string,unknown>) {
 allowFields(body,['estimateId','currentPassword']); const hash=await authorize(env,actor,session,body);
 const estimateId=stringField(body,'estimateId',128,1);
 const existing=await env.DB.prepare(`SELECT id FROM finalized_sales WHERE estimate_id=? AND ${gate}`).bind(estimateId,actor,session).first<{id:string}>();
 if(existing)return {saleId:existing.id};
 const estimate=await estimateDetail(env,actor,session,true,estimateId);
 if(estimate.totalCents===null || estimate.taxCents===null || estimate.shippingCents===null)throw new ApiError(409,'Determine all tax and shipping charges before finalizing.');
 const input={appointmentId:estimate.appointmentId,orderId:estimate.orderId,discountCents:estimate.discountCents,discountReason:estimate.discountReason,taxCents:estimate.taxCents,shippingCents:estimate.shippingCents,chargeNote:estimate.chargeNote};
 const current=await prepare(env,actor,session,input);
 const {id: ignoredId,createdAt: ignoredDate,...original}=estimate;
 void ignoredId; void ignoredDate;
 if(JSON.stringify(current.estimate)!==JSON.stringify(original))throw new ApiError(409,'The estimate no longer matches the visit/order. Issue a new estimate first.');
 const id=randomUUID();const now=new Date().toISOString();
 // Source checks and revision checks share the insert transaction. A source
 // cannot be billed again unless its previous unpaid sale was explicitly voided.
 await env.DB.batch([
  env.DB.prepare(`INSERT INTO finalized_sales(id,estimate_id,actor_user_id,customer_user_id,appointment_id,order_id,snapshot_json,total_cents,created_at)
   SELECT ?,?,?,?,?,?,?,?,? WHERE ${gate} AND EXISTS(SELECT 1 FROM account_credentials WHERE user_id=? AND password_hash=?)
   AND (SELECT version FROM booking_revision WHERE id=1)=? AND (SELECT value FROM commerce_revision WHERE id=1)=?
   AND (? IS NULL OR EXISTS(SELECT 1 FROM appointments WHERE id=? AND status='completed'))
   AND (? IS NULL OR EXISTS(SELECT 1 FROM orders WHERE id=? AND request_key IS NOT NULL AND fulfillment_type='pickup' AND status IN ('accepted','preparing','ready_for_pickup','completed')))
   AND NOT EXISTS(SELECT 1 FROM finalized_sales old WHERE (old.appointment_id=? OR old.order_id=?)
    AND NOT EXISTS(SELECT 1 FROM cash_sale_events v WHERE v.sale_id=old.id AND v.kind='void'))
   ON CONFLICT DO NOTHING`).bind(id,estimateId,actor,current.customerId,estimate.appointmentId,estimate.orderId,JSON.stringify(estimate),estimate.totalCents,now,actor,session,actor,hash,current.bookingRevision,current.commerceRevision,estimate.appointmentId,estimate.appointmentId,estimate.orderId,estimate.orderId,estimate.appointmentId,estimate.orderId),
  env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,action,entity_type,entity_id,created_at) SELECT ?,?,'sale_finalized','sale',?,? WHERE EXISTS(SELECT 1 FROM finalized_sales WHERE id=?)`).bind(randomUUID(),actor,id,now,id),
 ]);
 const result=await env.DB.prepare(`SELECT id FROM finalized_sales WHERE estimate_id=? AND ${gate}`).bind(estimateId,actor,session).first<{id:string}>();
 if(!result)throw new ApiError(409,'Only completed services and accepted pickup orders can be finalized. A source may already be billed, or your access changed.');
 return {saleId:result.id};
}
export async function counterSale(env:Env,actor:string,session:string,id:string):Promise<FinalizedSale> {
 await requireFrontDesk(env,actor,session);
 const rows=await env.DB.batch<{results:Record<string,unknown>[]}>([
  env.DB.prepare(`SELECT id,estimate_id AS estimateId,snapshot_json AS snapshot,total_cents AS totalCents,created_at AS createdAt FROM finalized_sales WHERE id=? AND ${gate}`).bind(id,actor,session),
  env.DB.prepare(`SELECT snapshot_json AS snapshot FROM cash_sale_events WHERE sale_id=? AND ${gate} ORDER BY created_at,id`).bind(id,actor,session),
 ]);
 const sale=rows[0]!.results[0]; if(!sale)throw new ApiError(404,'Sale not found.');
 const receipts=rows[1]!.results.map(r=>JSON.parse(String(r.snapshot)) as CashReceipt);
 return {id:String(sale.id),estimateId:String(sale.estimateId),createdAt:String(sale.createdAt),estimate:JSON.parse(String(sale.snapshot)) as SaleEstimate,totalCents:Number(sale.totalCents),
  state:receipts.some(r=>r.kind==='void')?'void':receipts.some(r=>r.kind==='refund')?'refunded':receipts.some(r=>r.kind==='payment')?'paid':'unpaid',receipts};
}
export async function recordCash(env:Env,actor:string,session:string,id:string,body:Record<string,unknown>) {
 allowFields(body,['action','cashReceivedCents','tipCents','reason','requestKey','currentPassword','registerId']);
 const hash=await authorize(env,actor,session,body); const action=stringField(body,'action',10,1);
 if(!['payment','refund','void'].includes(action))throw new ApiError(400,'Choose payment, refund or void.');
 const registerId=body.registerId===undefined?'':stringField(body,'registerId',128);
 const received=cents(body.cashReceivedCents); const tip=cents(body.tipCents); const reason=stringField(body,'reason',300);
 const key=stringField(body,'requestKey',36,36);
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(key))throw new ApiError(400,'Review this cash action again.');
 if(action!=='payment' && (!reason || received || tip))throw new ApiError(400,'Explain a refund/void and leave cash received and new tip at zero.');
 const fingerprint=secretHash(env,JSON.stringify({id,action,received,tip,reason,registerId}));
 const replay=async()=>{
  const row=await env.DB.prepare(`SELECT id,fingerprint,EXISTS(SELECT 1 FROM cash_register_entries r WHERE r.cash_event_id=cash_sale_events.id) AS registered FROM cash_sale_events WHERE actor_user_id=? AND request_key=? AND ${gate}`).bind(actor,key,actor,session).first<{id:string;fingerprint:string;registered:number}>();
  const legacyFingerprint=secretHash(env,JSON.stringify({id,action,received,tip,reason}));
  if(row&&row.fingerprint!==fingerprint&&(row.registered||registerId||row.fingerprint!==legacyFingerprint))throw new ApiError(409,'This action key was already used with different details.');
  return row?{receiptId:row.id}:null;
 };
 const prior=await replay();if(prior)return prior;
 if(action!=='void'&&!registerId)throw new ApiError(400,'Open the cash register and review this cash action again.');
 const sale=await counterSale(env,actor,session,id);const paid=sale.receipts.find(r=>r.kind==='payment');
 const concurrent=await replay();if(concurrent)return concurrent;
 if(action==='refund'?sale.state!=='paid':sale.state!=='unpaid')throw new ApiError(409,'This sale has already changed. Refresh its records.');
 if(tip&&!sale.estimate.lines.some(line=>line.kind==='service'&&line.professionalId))throw new ApiError(400,'Tips require a recorded service professional.');
 const amount=action==='refund'?paid!.amountCents:action==='void'?0:cents(sale.totalCents+tip);
 if(action==='payment'&&received<amount)throw new ApiError(400,'Cash received must cover the full sale and tip. Split payments are not supported yet.');
 const receiptId=randomUUID(); const now=new Date().toISOString();
 const receipt:CashReceipt={id:receiptId,saleId:id,createdAt:now,kind:action as CashReceipt['kind'],sale:sale.estimate,amountCents:amount,tipCents:action==='refund'?paid!.tipCents:tip,cashReceivedCents:received,changeCents:action==='payment'?received-amount:0,reason,originalReceiptId:action==='refund'?paid!.id:null,
  sellerName:paid?.sellerName??'The Kut Shoppe',sellerAddress:paid?.sellerAddress??'518 Main Street, Stroudsburg, PA 18360'};
 await env.DB.batch([
  env.DB.prepare(`INSERT INTO cash_sale_events(id,sale_id,actor_user_id,request_key,fingerprint,kind,amount_cents,tip_cents,snapshot_json,created_at)
   SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${gate} AND EXISTS(SELECT 1 FROM account_credentials WHERE user_id=? AND password_hash=?)
   AND (?='void' OR (${openRegisterSql('?')} AND (?!='refund' OR ${registerBalanceSql('?')}>=?)))
   AND NOT EXISTS(SELECT 1 FROM cash_sale_events WHERE sale_id=? AND kind IN ('refund','void'))
   AND (?='refund' AND EXISTS(SELECT 1 FROM cash_sale_events WHERE sale_id=? AND id=? AND kind='payment')
        OR ?!='refund' AND NOT EXISTS(SELECT 1 FROM cash_sale_events WHERE sale_id=? AND kind='payment'))
   ON CONFLICT DO NOTHING`).bind(receiptId,id,actor,key,fingerprint,action,amount,receipt.tipCents,JSON.stringify(receipt),now,actor,session,actor,hash,action,registerId,action,registerId,amount,id,action,id,paid?.id??null,action,id),
  ...(action==='void'?[]:[env.DB.prepare(`INSERT INTO cash_register_entries(id,register_id,cash_event_id,kind,amount_cents,reason,created_at)
    SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM cash_sale_events WHERE id=?)`).bind(randomUUID(),registerId,receiptId,action,action==='refund'?-amount:amount,reason,now,receiptId)]),
  env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,action,entity_type,entity_id,created_at) SELECT ?,?,?,'sale',?,? WHERE EXISTS(SELECT 1 FROM cash_sale_events WHERE id=?)`).bind(randomUUID(),actor,`cash_${action}_recorded`,id,now,receiptId),
 ]);
 const result=await replay();if(!result)throw new ApiError(409,'The sale/register changed, available cash is insufficient, or your access changed. Refresh before accepting or returning cash.');return result;
}
export async function counterPage(env:Env,actor:string,session:string,value:string|null):Promise<CounterPage> {
 await requireFrontDesk(env,actor,session);const scope=`counter:${actor}`;const cursor=pageCursor(env,scope,value);
 // One snapshot query keeps the page consistent without a batch per sale.
 const {results}=await env.DB.prepare(`SELECT s.id,s.created_at AS at,s.estimate_id AS estimateId,s.snapshot_json AS snapshot,s.total_cents AS totalCents,
  (SELECT json_group_array(json(e.snapshot_json)) FROM cash_sale_events e WHERE e.sale_id=s.id) AS receipts
  FROM finalized_sales s WHERE ${gate} ${cursor?'AND (s.created_at,s.id)<(?,?)':''} ORDER BY s.created_at DESC,s.id DESC LIMIT 26`).bind(actor,session,...(cursor?[cursor.at,cursor.id]:[])).all<{id:string;at:string;estimateId:string;snapshot:string;totalCents:number;receipts:string}>();
 const rows=results.slice(0,25);const last=rows.at(-1);
 return {items:rows.map(r=>{
  const receipts=JSON.parse(r.receipts) as CashReceipt[];
  return {id:r.id,estimateId:r.estimateId,createdAt:r.at,estimate:JSON.parse(r.snapshot) as SaleEstimate,totalCents:r.totalCents,receipts,
   state:receipts.some(e=>e.kind==='void')?'void':receipts.some(e=>e.kind==='refund')?'refunded':receipts.some(e=>e.kind==='payment')?'paid':'unpaid'};
 }),nextCursor:results.length>25&&last?signed(env,scope,{id:last.id,at:last.at}):null};
}
export async function receiptDetail(env:Env,actor:string,session:string,id:string,admin:boolean):Promise<CashReceipt> {
 if(admin)await requireFrontDesk(env,actor,session);
 const row=await env.DB.prepare(`SELECT e.snapshot_json AS snapshot FROM cash_sale_events e JOIN finalized_sales s ON s.id=e.sale_id WHERE e.id=? AND ${admin?gate:"s.customer_user_id=? AND e.kind!='void'"}`).bind(id,...(admin?[actor,session]:[actor])).first<{snapshot:string}>();
 if(!row)throw new ApiError(404,'Receipt not found.');return JSON.parse(row.snapshot) as CashReceipt;
}
export async function receiptPage(env:Env,actor:string,value:string|null):Promise<ReceiptPage> {
 const scope=`receipts:${actor}`;const cursor=pageCursor(env,scope,value);
 const {results}=await env.DB.prepare(`SELECT e.id,e.created_at AS at,e.snapshot_json AS snapshot FROM cash_sale_events e JOIN finalized_sales s ON s.id=e.sale_id
  WHERE s.customer_user_id=? AND e.kind!='void' ${cursor?'AND (e.created_at,e.id)<(?,?)':''} ORDER BY e.created_at DESC,e.id DESC LIMIT 26`).bind(actor,...(cursor?[cursor.at,cursor.id]:[])).all<{id:string;at:string;snapshot:string}>();
 const rows=results.slice(0,25);const last=rows.at(-1);return {items:rows.map(r=>JSON.parse(r.snapshot) as CashReceipt),nextCursor:results.length>25&&last?signed(env,scope,{id:last.id,at:last.at}):null};
}
