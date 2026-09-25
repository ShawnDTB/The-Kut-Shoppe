import { randomUUID } from 'node:crypto';
import { ApiError, type Env, type Statement } from './types';
import { allowFields, secretHash, stringField } from './security';
import { requireFrontDesk } from './front-desk';
import { cashGate as gate, authorizeCash } from './cash-access';
import { cents } from './sale-amounts';
import { signed, decoded, pageCursor } from './sales';
import type { RegisterTotals, RegisterSession, RegisterPage, RegisterClose, RegisterEntries } from '../src/shared/register';

// Only internal aliases are interpolated. Amounts and identifiers are bound.
export const openRegisterSql = (id: string) => `EXISTS(SELECT 1 FROM cash_register_sessions r WHERE r.id=${id}
  AND NOT EXISTS(SELECT 1 FROM cash_register_closures c WHERE c.register_id=r.id))`;
export const registerBalanceSql = (id: string) => `(SELECT rb.opening_cents+COALESCE((SELECT SUM(be.amount_cents) FROM cash_register_entries be WHERE be.register_id=rb.id),0) FROM cash_register_sessions rb WHERE rb.id=${id})`;
const selectRegister = `SELECT r.id,r.created_at AS openedAt,r.opening_cents AS openingCents,c.snapshot_json AS closed,
  COALESCE((SELECT SUM(e.amount_cents) FROM cash_register_entries e WHERE e.register_id=r.id AND e.kind='payment'),0) AS paymentsCents,
  COALESCE((SELECT -SUM(e.amount_cents) FROM cash_register_entries e WHERE e.register_id=r.id AND e.kind='refund'),0) AS refundsCents,
  COALESCE((SELECT SUM(e.amount_cents) FROM cash_register_entries e WHERE e.register_id=r.id AND e.kind='paid_in'),0) AS paidInCents,
  COALESCE((SELECT -SUM(e.amount_cents) FROM cash_register_entries e WHERE e.register_id=r.id AND e.kind='paid_out'),0) AS paidOutCents,
  COALESCE((SELECT -SUM(e.amount_cents) FROM cash_register_entries e WHERE e.register_id=r.id AND e.kind='deposit'),0) AS depositsCents,
  (SELECT COUNT(*) FROM cash_register_entries e WHERE e.register_id=r.id) AS entryCount,
  ${registerBalanceSql('r.id')} AS expectedCents
  FROM cash_register_sessions r LEFT JOIN cash_register_closures c ON c.register_id=r.id`;
type Row = RegisterTotals & {id:string;openedAt:string;closed:string|null};
type CloseReview = {id:string;entryCount:number;expectedCents:number;expiresAt:string};
function sessionOf(env: Env, actor: string, session: string, row: Row): RegisterSession {
  const {id,openedAt,closed,...totals}=row;
  return {id,openedAt,totals,close:closed?JSON.parse(closed) as RegisterClose:null,
    closeToken:closed?null:signed(env,`register-close:${actor}:${session}`,{id,entryCount:totals.entryCount,expectedCents:totals.expectedCents,expiresAt:new Date(Date.now()+600000).toISOString()})};
}
export async function registerDetail(env:Env,actor:string,session:string,id:string):Promise<RegisterSession> {
  await requireFrontDesk(env,actor,session);
  const row=await env.DB.prepare(`${selectRegister} WHERE r.id=? AND ${gate}`).bind(id,actor,session).first<Row>();
  if(!row)throw new ApiError(404,'Register not found.');return sessionOf(env,actor,session,row);
}
export async function registerPage(env:Env,actor:string,session:string,value:string|null):Promise<RegisterPage> {
  await requireFrontDesk(env,actor,session);const scope=`registers:${actor}`;const cursor=pageCursor(env,scope,value);
  const rows=await env.DB.batch<{results:Row[]}>([
    env.DB.prepare(`${selectRegister} WHERE c.register_id IS NULL AND ${gate} LIMIT 1`).bind(actor,session),
    env.DB.prepare(`${selectRegister} WHERE c.register_id IS NOT NULL AND ${gate} ${cursor?'AND (r.created_at,r.id)<(?,?)':''} ORDER BY r.created_at DESC,r.id DESC LIMIT 26`).bind(actor,session,...(cursor?[cursor.at,cursor.id]:[])),
  ]);
  const history=rows[1]!.results.slice(0,25);const last=history.at(-1);
  return {open:rows[0]!.results[0]?sessionOf(env,actor,session,rows[0]!.results[0]):null,
    items:history.map(row=>sessionOf(env,actor,session,row)),nextCursor:rows[1]!.results.length>25&&last?signed(env,scope,{at:last.openedAt,id:last.id}):null};
}
export async function registerEntries(env:Env,actor:string,session:string,id:string,value:string|null):Promise<RegisterEntries> {
  await registerDetail(env,actor,session,id);const scope=`register-entries:${actor}:${id}`;const cursor=pageCursor(env,scope,value);
  const {results}=await env.DB.prepare(`SELECT e.id,e.kind,e.amount_cents AS amountCents,e.reason,e.created_at AS createdAt,e.cash_event_id AS receiptId,c.sale_id AS saleId
    FROM cash_register_entries e LEFT JOIN cash_sale_events c ON c.id=e.cash_event_id WHERE e.register_id=? AND ${gate}
    ${cursor?'AND (e.created_at,e.id)<(?,?)':''} ORDER BY e.created_at DESC,e.id DESC LIMIT 26`).bind(id,actor,session,...(cursor?[cursor.at,cursor.id]:[])).all<RegisterEntries['items'][number]>();
  const items=results.slice(0,25);const last=items.at(-1);return {items,nextCursor:results.length>25&&last?signed(env,scope,{at:last.createdAt,id:last.id}):null};
}
export async function registerAction(env:Env,actor:string,session:string,body:Record<string,unknown>) {
  allowFields(body,['action','registerId','amountCents','reason','token','requestKey','currentPassword']);
  const hash=await authorizeCash(env,actor,session,body);const kind=stringField(body,'action',10,1);
  if(!['open','paid_in','paid_out','deposit','close'].includes(kind))throw new ApiError(400,'Choose a register action.');
  const amount=cents(body.amountCents);const reason=stringField(body,'reason',300);const key=stringField(body,'requestKey',36,36);
  const requested=stringField(body,'registerId',128);const token=stringField(body,'token',2048);
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(key))throw new ApiError(400,'Review the register action again.');
  if(kind==='open' ? Boolean(requested||token) : !requested)throw new ApiError(400,'Choose the current register.');
  if(kind!=='open'&&kind!=='close'&&(!amount||!reason||token))throw new ApiError(400,'Enter a positive amount and an explanation.');
  const fingerprint=secretHash(env,JSON.stringify({kind,amount,reason,requested,token}));
  const replay=async()=>{
    const row=await env.DB.prepare(`SELECT id,register_id AS registerId,fingerprint FROM register_operations WHERE actor_user_id=? AND request_key=? AND ${gate}`).bind(actor,key,actor,session).first<{id:string;registerId:string;fingerprint:string}>();
    if(row&&row.fingerprint!==fingerprint)throw new ApiError(409,'This request was already used with different register details.');
    return row?{operationId:row.id,registerId:row.registerId}:null;
  };
  const old=await replay();if(old)return old;
  const id=randomUUID();const registerId=kind==='open'?randomUUID():requested;const now=new Date().toISOString();
  let condition:string;let values:unknown[];let writes:Statement[];
  const claimed=`EXISTS(SELECT 1 FROM register_operations WHERE id=?)`;
  if(kind==='open') {
    condition=`NOT EXISTS(SELECT 1 FROM cash_register_sessions r WHERE NOT EXISTS(SELECT 1 FROM cash_register_closures c WHERE c.register_id=r.id))`;values=[];
    writes=[env.DB.prepare(`INSERT INTO cash_register_sessions(id,opening_operation_id,opening_cents,created_at) SELECT ?,?,?,? WHERE ${claimed}`).bind(registerId,id,amount,now,id)];
  } else if(kind==='close') {
    const review=decoded<CloseReview>(env,`register-close:${actor}:${session}`,token);
    const current=await registerDetail(env,actor,session,registerId);const concurrent=await replay();if(concurrent)return concurrent;
    if(current.close||review.id!==registerId||review.entryCount!==current.totals.entryCount||review.expectedCents!==current.totals.expectedCents||!(Date.parse(review.expiresAt)>Date.now()))throw new ApiError(409,'Cash activity changed or this review expired. Refresh the register and recount before closing.');
    if(amount!==current.totals.expectedCents&&!reason)throw new ApiError(400,'Explain the difference between counted and expected cash.');
    const snapshot:RegisterClose={id:registerId,openedAt:current.openedAt,closedAt:now,totals:current.totals,countedCents:amount,varianceCents:amount-current.totals.expectedCents,reason};
    condition=`${openRegisterSql('?')} AND (SELECT COUNT(*) FROM cash_register_entries WHERE register_id=?)=? AND ${registerBalanceSql('?')}=? AND julianday(?)>julianday('now')`;
    values=[registerId,registerId,review.entryCount,registerId,review.expectedCents,review.expiresAt];
    writes=[env.DB.prepare(`INSERT INTO cash_register_closures(register_id,operation_id,snapshot_json,created_at) SELECT ?,?,?,? WHERE ${claimed}`).bind(registerId,id,JSON.stringify(snapshot),now,id)];
  } else {
    condition=`${openRegisterSql('?')} AND (?='paid_in' OR ${registerBalanceSql('?')}>=?)`;
    values=[registerId,kind,registerId,amount];
    writes=[env.DB.prepare(`INSERT INTO cash_register_entries(id,register_id,operation_id,kind,amount_cents,reason,created_at) SELECT ?,?,?,?,?,?,? WHERE ${claimed}`).bind(randomUUID(),registerId,id,kind,kind==='paid_in'?amount:-amount,reason,now,id)];
  }
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO register_operations(id,register_id,actor_user_id,request_key,fingerprint,kind,amount_cents,reason,created_at)
      SELECT ?,?,?,?,?,?,?,?,? WHERE ${gate} AND EXISTS(SELECT 1 FROM account_credentials WHERE user_id=? AND password_hash=?) AND ${condition} ON CONFLICT DO NOTHING`).bind(id,registerId,actor,key,fingerprint,kind,amount,reason,now,actor,session,actor,hash,...values),
    ...writes,
    env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,action,entity_type,entity_id,created_at) SELECT ?,?,?,'cash_register',?,? WHERE ${claimed}`).bind(randomUUID(),actor,`register_${kind}`,registerId,now,id),
  ]);
  const result=await replay();if(!result)throw new ApiError(409,'The register changed, available cash is insufficient, or your access changed. Refresh before handling cash again.');return result;
}
