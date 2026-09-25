import { useEffect, useRef, useState, type FormEvent } from 'react';
import { accountApi, downloadAccountDocument } from '../data/customer-api';
import type { CashReceipt, CounterPage, FinalizedSale, ReceiptPage } from '../shared/counter';
import type { SaleEstimate } from '../shared/sales';
import type { RegisterPage } from '../shared/register';
import { EstimateSummary } from './SaleEstimates';
import { StaffAuthenticator } from './StaffAuthenticator';

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Please try again.';
const date = (value: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
function cashCents(value: string): number {
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(value.trim())) throw new Error('Enter dollars with no more than two decimal places.');
  const [dollars, fraction = ''] = value.trim().split('.');
  const result = Number(dollars) * 100 + Number(fraction.padEnd(2, '0'));
  if (result > 100_000_000) throw new Error('This amount exceeds the sale limit.');
  return result;
}
function Receipt({ receipt, admin }: { receipt: CashReceipt; admin: boolean }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const download = async () => {
    if (busy) return; setBusy(true); setError(''); setMessage('');
    try { await downloadAccountDocument(admin ? 'cash-receipts' : 'receipts', receipt.id); setMessage('Download started. Open the document to print or save as PDF.'); }
    catch (failure) { setError(messageOf(failure)); } finally { setBusy(false); }
  };
  return <li className="sale-estimate-record"><details><summary><strong>{receipt.kind === 'payment' ? 'Cash payment' : receipt.kind === 'refund' ? 'Cash refund' : 'Unpaid sale voided'} · {money(receipt.amountCents)}</strong><span>{date(receipt.createdAt)} · Receipt {receipt.id.slice(-8)}</span></summary>
    <EstimateSummary estimate={receipt.sale} finalized />
    <p>Tip: {money(receipt.tipCents)} · {receipt.kind === 'refund' ? 'Refunded' : 'Recorded'}: {money(receipt.amountCents)}</p>
    {receipt.kind === 'payment' ? <p>Cash received: {money(receipt.cashReceivedCents)} · Change: {money(receipt.changeCents)}</p> : null}
    {receipt.reason ? <p>Reason: {receipt.reason}</p> : null}
    {receipt.originalReceiptId ? <p>Original payment receipt: {receipt.originalReceiptId}</p> : null}
    <button className="button button-secondary" disabled={busy} onClick={() => void download()}>{busy ? 'Preparing…' : 'Download receipt'}</button>
    {message ? <p role="status">{message}</p> : null}{error ? <p role="alert" className="form-error">{error}</p> : null}
  </details></li>;
}
export function CustomerReceipts() {
  const [page, setPage] = useState<ReceiptPage | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void accountApi<ReceiptPage>('/me/receipts').then(result => { if (active) { setPage(result); setError(''); } }).catch(failure => { if (active) setError(messageOf(failure)); });
    return () => { active = false; };
  }, [attempt]);
  const more = async () => {
    if (!page?.nextCursor || busy) return; setBusy(true); setError('');
    try { const next = await accountApi<ReceiptPage>(`/me/receipts?cursor=${encodeURIComponent(page.nextCursor)}`); setPage({ items: [...page.items, ...next.items.filter(item => !page.items.some(old => old.id === item.id))], nextCursor: next.nextCursor }); }
    catch (failure) { setError(messageOf(failure)); } finally { setBusy(false); }
  };
  return <section><h2>Your receipts</h2><p>Cash payments and refunds recorded by the shop for your account. Booking confirmations and estimates are available in their own sections.</p>
    {error ? <p role="alert" className="form-error">{error}</p> : null}{!page && !error ? <p role="status">Loading receipts…</p> : null}
    {page ? page.items.length ? <ul className="sale-estimate-list">{page.items.map(receipt => <Receipt key={receipt.id} receipt={receipt} admin={false} />)}</ul> : <p>No payment receipts have been recorded for your account.</p> : null}
    {page?.nextCursor ? <button className="button button-secondary" disabled={busy} onClick={() => void more()}>Load older receipts</button> : null}
    <button className="text-button" disabled={busy} onClick={() => { setPage(null); setAttempt(value => value + 1); }}>Refresh receipts</button>
  </section>;
}
type CashAction = { action: 'payment' | 'refund' | 'void'; cashReceivedCents: number; tipCents: number; reason: string; requestKey: string; registerId: string };
function CashActions({ sale, onChanged }: { sale: FinalizedSale; onChanged: () => Promise<void> }) {
  const [action, setAction] = useState<CashAction['action']>(sale.state === 'paid' ? 'refund' : 'payment');
  const [received, setReceived] = useState(''); const [tip, setTip] = useState('0'); const [reason, setReason] = useState('');
  const [review, setReview] = useState<CashAction | null>(null); const [pending, setPending] = useState(false); const [done, setDone] = useState(false);
  const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false);
  if (sale.state === 'void' || sale.state === 'refunded') return <p>This sale is closed. Its original records remain available below.</p>;
  const paid = sale.receipts.find(receipt => receipt.kind === 'payment');
  const amount = review?.action === 'refund' ? paid!.amountCents : review?.action === 'void' ? 0 : sale.totalCents + (review?.tipCents ?? 0);
  const preview = async (event: FormEvent) => {
    event.preventDefault(); if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try {
      const input: CashAction = { action, cashReceivedCents: action === 'payment' ? cashCents(received) : 0, tipCents: action === 'payment' ? cashCents(tip) : 0, reason: reason.trim(), requestKey: crypto.randomUUID(), registerId: '' };
      if (action === 'payment' && input.cashReceivedCents < sale.totalCents + input.tipCents) throw new Error('Cash received must cover the full sale and tip.');
      if (action !== 'payment' && !input.reason) throw new Error('Enter a reason for this action.');
      if(action!=='void'){
        const register=await accountApi<RegisterPage>('/me/register');
        if(!register.open)throw new Error('Open the cash register before reviewing a payment or refund.');
        if(action==='refund'&&register.open.totals.expectedCents<paid!.amountCents)throw new Error('The register needs more cash before this refund. Record cash added, then review again.');
        input.registerId=register.open.id;
      }
      setReview(input);
    } catch (failure) { setError(messageOf(failure)); } finally {lock.current=false;setBusy(false);}
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!review || lock.current) return; lock.current = true; setBusy(true); setError(''); setPending(true);
    try { await accountApi(`/me/counter/${sale.id}`, { ...review, currentPassword: password }); setDone(true); await onChanged(); }
    catch (failure) { setError(messageOf(failure)); }
    finally { setPassword(''); setBusy(false); lock.current = false; }
  };
  return <div aria-busy={busy}>{error ? <p role="alert" className="form-error">{error}</p> : null}{done ? <><p role="status">Cash record saved. Refresh to see the receipt.</p><button className="button" onClick={() => void onChanged().catch(failure => setError(messageOf(failure)))}>Refresh sale</button></> : review ? <form className="customer-form" onSubmit={event => void save(event)}><h3>Review {review.action === 'payment' ? 'cash payment' : review.action === 'refund' ? 'full cash refund' : 'unpaid sale void'}</h3>
    <p><strong>{review.action === 'refund' ? 'Return to customer' : 'Amount to record'}: {money(amount)}</strong></p>
    {review.action === 'payment' ? <p>Tip: {money(review.tipCents)} · Received: {money(review.cashReceivedCents)} · Change due: <strong>{money(review.cashReceivedCents - amount)}</strong></p> : <p>Reason: {review.reason}</p>}
    <p>{review.action === 'payment' ? 'Save only after collecting cash and giving the correct change. Coordinate with other cashiers before collecting.' : review.action === 'refund' ? 'Save only after returning the full payment, including the tip, in cash. Inventory and order status are handled separately.' : 'This cancels the unpaid sale. No cash moves, and the visit/order remains unchanged.'}</p>
    {pending ? <p className="customer-notice">A save was attempted. Retry this same action to recover its result, or refresh the sale to check its receipts. Do not collect or return cash again.</p> : null}
    <label>Your current password<input type="password" required maxLength={128} autoComplete="current-password" value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></label>
    <button className="button" disabled={busy}>{busy ? 'Saving…' : pending ? 'Retry same cash action' : 'Confirm cash record'}</button>
    {!pending ? <button type="button" className="text-button" disabled={busy} onClick={() => { setReview(null); setPassword(''); }}>Back to cash details</button> : null}
  </form> : <form className="customer-form" onSubmit={event=>void preview(event)}><h3>{sale.state === 'paid' ? 'Full cash refund' : 'Record cash or void sale'}</h3>
    {sale.state === 'unpaid' ? <label>Action<select value={action} onChange={event => setAction(event.target.value as CashAction['action'])}><option value="payment">Collect cash</option><option value="void">Void unpaid sale</option></select></label> : <p>Refund the complete original payment of {money(paid!.amountCents)}, including {money(paid!.tipCents)} in tips.</p>}
    {action === 'payment' ? <><label>Cash received ($)<input required inputMode="decimal" maxLength={10} value={received} onChange={event => setReceived(event.target.value)} /></label>
      {sale.estimate.lines.some(line => line.kind === 'service' && line.professionalId) ? <label>Service tip ($)<input required inputMode="decimal" maxLength={10} value={tip} onChange={event => setTip(event.target.value)} /></label> : null}</> : <label>Reason (shown on receipt)<input required maxLength={300} value={reason} onChange={event => setReason(event.target.value)} /></label>}
    <button className="button" disabled={busy}>{busy?'Reviewing…':'Review cash action'}</button></form>}</div>;
}
function CounterDesk() {
  const [page, setPage] = useState<CounterPage | null>(null); const [sale, setSale] = useState<FinalizedSale | null>(null); const [estimate, setEstimate] = useState<SaleEstimate | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [password, setPassword] = useState(''); const [attempt, setAttempt] = useState(0); const [version, setVersion] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const query = new URLSearchParams(window.location.search); const id = query.get('sale'); const estimateId = query.get('estimate');
      const data = await accountApi<CounterPage>('/me/counter');
      const selected = id ? (await accountApi<{ sale: FinalizedSale }>(`/me/counter/${encodeURIComponent(id)}`)).sale : null;
      const original = !id && estimateId ? (await accountApi<{ estimate: SaleEstimate }>(`/me/sales/${encodeURIComponent(estimateId)}`)).estimate : null;
      if (active) { setPage(data); setSale(selected); setEstimate(original); setError(''); setVersion(value => value + 1); }
    };
    void load().catch(failure => { if (active) setError(messageOf(failure)); });
    return () => { active = false; };
  }, [attempt]);
  const open = async (id: string) => {
    const result = await accountApi<{ sale: FinalizedSale }>(`/me/counter/${encodeURIComponent(id)}`);
    setSale(result.sale); setEstimate(null); setVersion(value => value + 1); setError('');
    window.history.replaceState({}, '', `/account?view=counter&sale=${encodeURIComponent(id)}`);
    const data = await accountApi<CounterPage>('/me/counter'); setPage(data);
  };
  const finalize = async (event: FormEvent) => {
    event.preventDefault(); if (!estimate || lock.current) return; lock.current = true; setBusy(true); setError('');
    try { const result = await accountApi<{ saleId: string }>('/me/counter', { estimateId: estimate.id, currentPassword: password }); await open(result.saleId); }
    catch (failure) { setError(messageOf(failure)); } finally { setPassword(''); setBusy(false); lock.current = false; }
  };
  const more = async () => {
    if (!page?.nextCursor || busy) return; setBusy(true);
    try { const next = await accountApi<CounterPage>(`/me/counter?cursor=${encodeURIComponent(page.nextCursor)}`); setPage({ items: [...page.items, ...next.items.filter(item => !page.items.some(old => old.id === item.id))], nextCursor: next.nextCursor }); }
    catch (failure) { setError(messageOf(failure)); } finally { setBusy(false); }
  };
  return <section><h2>Sales & cash</h2><p>Finalize completed services and accepted pickup orders, then record cash collected at the shop. Card payments are not connected.</p>
    <p><a href="/account?view=register">Open or reconcile the cash register</a> · <a href="/account?view=sales">Prepare a sale estimate</a> · <a href="/admin/orders">Manage order fulfillment</a></p>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {estimate ? <form className="customer-form" onSubmit={event => void finalize(event)}><h3>Finalize reviewed estimate</h3><EstimateSummary estimate={estimate} />
      <p>This fixes the item prices, discount and charges for the sale. It does not record payment. All charges must be determined, services completed and pickup orders accepted first.</p>
      <label>Your current password<input required type="password" maxLength={128} autoComplete="current-password" disabled={busy} value={password} onChange={event => setPassword(event.target.value)} /></label>
      <button className="button" disabled={busy || estimate.totalCents === null}>{busy ? 'Finalizing…' : 'Finalize sale'}</button></form> : null}
    {sale ? <section className="customer-security-section"><h3>Sale {sale.id.slice(-8)} · {sale.state}</h3><EstimateSummary estimate={sale.estimate} finalized />
      <CashActions key={`${sale.id}:${version}`} sale={sale} onChanged={() => open(sale.id)} />
      <h3>Sale records</h3>{sale.receipts.length ? <ul className="sale-estimate-list">{sale.receipts.map(receipt => <Receipt key={receipt.id} receipt={receipt} admin />)}</ul> : <p>No cash has been recorded for this sale.</p>}
    </section> : null}
    <section className="customer-security-section"><h3>Recent sales</h3>{!page && !error ? <p role="status">Loading sales…</p> : null}
      {page?.items.length ? <ul className="sale-estimate-list">{page.items.map(item => <li className="sale-estimate-record" key={item.id}><a href={`/account?view=counter&sale=${encodeURIComponent(item.id)}`}>{item.estimate.customerName} · {money(item.totalCents)} · {item.state}</a><p>{date(item.createdAt)} · Sale {item.id.slice(-8)}</p></li>)}</ul> : page ? <p>No finalized sales yet. Start with a saved estimate.</p> : null}
      {page?.nextCursor ? <button className="button button-secondary" disabled={busy} onClick={() => void more()}>Load older sales</button> : null}
      <button className="text-button" disabled={busy} onClick={() => setAttempt(value => value + 1)}>Refresh sales and receipts</button>
    </section></section>;
}
export function CashCounter() { return <StaffAuthenticator><CounterDesk /></StaffAuthenticator>; }
