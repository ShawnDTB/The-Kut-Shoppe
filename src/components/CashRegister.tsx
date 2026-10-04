import { useEffect, useRef, useState, type FormEvent } from 'react';
import { accountApi } from '../data/customer-api';
import { StaffAuthenticator } from './StaffAuthenticator';
import type { RegisterEntries, RegisterPage, RegisterSession, RegisterTotals } from '../shared/register';
import '../sale-estimates.css';

const money=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
const date=(value:string)=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
const message=(error:unknown)=>error instanceof Error?error.message:'Please try again.';
function amountOf(value:string){
  if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(value.trim()))throw new Error('Enter dollars with no more than two decimal places.');
  const [whole,fraction='']=value.trim().split('.');const amount=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if(amount>100_000_000)throw new Error('This amount exceeds the register limit.');return amount;
}
function Totals({totals}:{totals:RegisterTotals}){
  const rows=[['Opening cash',totals.openingCents],['Cash sales (including tips)',totals.paymentsCents],['Cash refunds',-totals.refundsCents],['Cash added',totals.paidInCents],['Cash removed',-totals.paidOutCents],['Deposits removed',-totals.depositsCents],['Expected in drawer',totals.expectedCents]] as const;
  return <dl className="customer-order-totals">{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}</dl>;
}
type Action='open'|'paid_in'|'paid_out'|'deposit'|'close';
type Draft={action:Action;registerId:string;amountCents:number;reason:string;token:string;requestKey:string};
const labels:Record<Action,string>={open:'Open register',paid_in:'Add cash',paid_out:'Remove cash',deposit:'Record deposit removal',close:'Close register'};
function RegisterForm({register,onChanged}:{register:RegisterSession|null;onChanged:()=>Promise<void>}){
  const [action,setAction]=useState<Action>(register?'paid_in':'open');const [amount,setAmount]=useState('');const [reason,setReason]=useState('');
  const [review,setReview]=useState<Draft|null>(null);const [password,setPassword]=useState('');const [pending,setPending]=useState(false);const [done,setDone]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const lock=useRef(false);
  const preview=(event:FormEvent)=>{
    event.preventDefault();setError('');
    try{
      const amountCents=amountOf(amount);const note=reason.trim();
      if(action!=='open'&&action!=='close'&&(!amountCents||!note))throw new Error('Enter a positive amount and an explanation.');
      if(action==='close'&&amountCents!==register!.totals.expectedCents&&!note)throw new Error('Explain the difference between counted and expected cash.');
      if(['paid_out','deposit'].includes(action)&&amountCents>register!.totals.expectedCents)throw new Error('The amount exceeds the expected cash in this drawer.');
      setReview({action,registerId:register?.id??'',amountCents,reason:note,token:action==='close'?register!.closeToken!:'',requestKey:crypto.randomUUID()});
    }catch(failure){setError(message(failure));}
  };
  const save=async(event:FormEvent)=>{
    event.preventDefault();if(!review||lock.current)return;lock.current=true;setBusy(true);setPending(true);setError('');
    try{await accountApi('/me/register',{...review,currentPassword:password});setDone(true);await onChanged();}
    catch(failure){setError(message(failure));}finally{setPassword('');setBusy(false);lock.current=false;}
  };
  return <section aria-busy={busy}>{error?<p className="form-error" role="alert">{error}</p>:null}{done?<><p role="status">Register action saved.</p><button className="button" onClick={()=>void onChanged().catch(failure=>setError(message(failure)))}>Reload register</button></>:review?<form className="customer-form" onSubmit={event=>void save(event)}><h3>Review: {labels[review.action]}</h3>
    <p><strong>{review.action==='close'?'Counted cash':review.action==='open'?'Opening cash':'Cash amount'}: {money(review.amountCents)}</strong></p>
    {review.action==='close'?<><p>Expected: {money(register!.totals.expectedCents)} · Variance: {money(review.amountCents-register!.totals.expectedCents)}</p><p>Coordinate with every cashier, finish pending transactions and count the drawer. New activity invalidates this closing review.</p></>:<p>{review.action==='open'?'Count all cash physically in the drawer, including the opening float. Earlier receipts are not added to this balance.':'Record cash already moved once. This records a physical cash movement; it does not initiate or verify a bank transfer.'}</p>}
    {review.reason?<p>Reason: {review.reason}</p>:null}
    {pending?<p className="customer-notice">A save was attempted. Retry this same action to recover its result. Do not move cash again; refresh the register to check recorded activity if the result is uncertain.</p>:null}
    <label>Your current password<input required type="password" autoComplete="current-password" maxLength={128} disabled={busy} value={password} onChange={event=>setPassword(event.target.value)}/></label>
    <button className="button" disabled={busy}>{busy?'Saving…':pending?'Retry same register action':'Confirm register action'}</button>
    {!pending?<button className="text-button" type="button" onClick={()=>{setReview(null);setPassword('');}}>Back to register details</button>:null}
  </form>:<form className="customer-form" onSubmit={preview}><h3>{register?'Cash adjustments and closing':'Open the Main Street register'}</h3>
    {register?<label>Register action<select value={action} onChange={event=>{setAction(event.target.value as Action);setAmount('');setReason('');}}>{(['paid_in','paid_out','deposit','close'] as const).map(kind=><option key={kind} value={kind}>{labels[kind]}</option>)}</select></label>:null}
    <label>{action==='close'?'Counted closing cash ($)':action==='open'?'Opening cash ($)':'Cash amount ($)'}<input required inputMode="decimal" maxLength={10} value={amount} onChange={event=>setAmount(event.target.value)}/></label>
    <label>Explanation<input maxLength={300} value={reason} onChange={event=>setReason(event.target.value)}/></label>
    <button className="button">Review register action</button>
  </form>}</section>;
}
function RegisterDesk(){
  const [data,setData]=useState<RegisterPage|null>(null);const [selected,setSelected]=useState<RegisterSession|null>(null);const [entries,setEntries]=useState<RegisterEntries|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [attempt,setAttempt]=useState(0);
  const requested=new URLSearchParams(window.location.search).get('register');
  const refresh=async()=>{
    const page=await accountApi<RegisterPage>('/me/register');const chosen=requested?(await accountApi<{register:RegisterSession}>(`/me/register/${encodeURIComponent(requested)}`)).register:page.open;
    const ledger=chosen?await accountApi<RegisterEntries>(`/me/register/${chosen.id}/entries`):null;
    setData(page);setSelected(chosen);setEntries(ledger);setError('');setAttempt(value=>value+1);
  };
  useEffect(()=>{
    let active=true;
    const load=async()=>{
      const page=await accountApi<RegisterPage>('/me/register');const chosen=requested?(await accountApi<{register:RegisterSession}>(`/me/register/${encodeURIComponent(requested)}`)).register:page.open;
      const ledger=chosen?await accountApi<RegisterEntries>(`/me/register/${chosen.id}/entries`):null;
      if(active){setData(page);setSelected(chosen);setEntries(ledger);setError('');}
    };
    void load().catch(failure=>{if(active)setError(message(failure));});return()=>{active=false;};
  },[requested]);
  const more=async(kind:'entries'|'history')=>{
    const cursor=kind==='entries'?entries?.nextCursor:data?.nextCursor;if(!cursor||busy)return;setBusy(true);setError('');
    try{
      if(kind==='entries'){
        const next=await accountApi<RegisterEntries>(`/me/register/${selected!.id}/entries?cursor=${encodeURIComponent(cursor)}`);
        setEntries(prior=>prior?{items:[...prior.items,...next.items.filter(item=>!prior.items.some(old=>old.id===item.id))],nextCursor:next.nextCursor}:next);
      }else{
        const next=await accountApi<RegisterPage>(`/me/register?cursor=${encodeURIComponent(cursor)}`);
        setData(prior=>prior?{...prior,items:[...prior.items,...next.items.filter(item=>!prior.items.some(old=>old.id===item.id))],nextCursor:next.nextCursor}:next);
      }
    }catch(failure){setError(message(failure));}finally{setBusy(false);}
  };
  return <section className="sale-estimate-summary"><h2>Cash register</h2><p>One shared Main Street drawer. Cash sales and shop-held tips enter the drawer; refunds, cash removals and deposits reduce it. These totals are not employee pay or verified bank settlements.</p>
    <p><a href="/account?view=counter">Sales & cash receipts</a>{requested?<> · <a href="/account?view=register">Current register</a></>:null}</p>
    {error?<p className="form-error" role="alert">{error}</p>:null}{!data&&!error?<p role="status">Loading register…</p>:null}
    {selected?<section><h3>{selected.close?'Closed':'Open'} register · {date(selected.openedAt)}</h3><Totals totals={selected.close?.totals??selected.totals}/>
      {selected.close?<p>Closed {date(selected.close.closedAt)} · Counted {money(selected.close.countedCents)} · <strong>Variance {money(selected.close.varianceCents)}</strong>{selected.close.reason?` · ${selected.close.reason}`:''}</p>:null}
    </section>:data?<p>No register is open. Count the cash currently in the drawer to begin.</p>:null}
    {data&&!requested?<RegisterForm key={`${data.open?.id??'new'}:${attempt}`} register={data.open} onChanged={refresh}/>:null}
    {entries?<section className="customer-security-section"><h3>Recorded activity</h3>{entries.items.length?<ul className="sale-estimate-list">{entries.items.map(entry=><li className="sale-estimate-record" key={entry.id}><strong>{entry.kind.replaceAll('_',' ')} · {money(entry.amountCents)}</strong><p>{date(entry.createdAt)}{entry.reason?` · ${entry.reason}`:''}</p>{entry.saleId?<a href={`/account?view=counter&sale=${encodeURIComponent(entry.saleId)}`}>Open sale and receipt</a>:null}</li>)}</ul>:<p>No cash movements recorded in this register.</p>}
      {entries.nextCursor?<button className="button button-secondary" disabled={busy} onClick={()=>void more('entries')}>Load older activity</button>:null}</section>:null}
    <section className="customer-security-section"><h3>Closed register history</h3>{data?.items.length?<ul className="sale-estimate-list">{data.items.map(item=><li className="sale-estimate-record" key={item.id}><a href={`/account?view=register&register=${encodeURIComponent(item.id)}`}>{date(item.openedAt)} · Counted {money(item.close!.countedCents)} · Variance {money(item.close!.varianceCents)}</a></li>)}</ul>:data?<p>No closed registers yet.</p>:null}
      {data?.nextCursor?<button className="button button-secondary" disabled={busy} onClick={()=>void more('history')}>Load older registers</button>:null}
    </section><button className="text-button" disabled={busy} onClick={()=>{setBusy(true);void refresh().catch(failure=>setError(message(failure))).finally(()=>setBusy(false));}}>Refresh register</button>
    <p className="customer-fine-print">Cash receipts created before register tracking stay in Sales & cash. They are not automatically added to a drawer. A closed register cannot be edited; document corrections in a new register with an explanation.</p>
  </section>;
}
export function CashRegister(){return <StaffAuthenticator><RegisterDesk/></StaffAuthenticator>;}
