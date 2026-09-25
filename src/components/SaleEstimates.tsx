import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AccountApiError, accountApi, downloadAccountDocument } from '../data/customer-api';
import { StaffAuthenticator } from './StaffAuthenticator';
import '../sale-estimates.css';
import type { EstimateInput, EstimatePage, EstimatePreview, SaleEstimate, SaleSourcePage } from '../shared/sales';

const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Please try again.';
const money = (value: number | null) => value === null ? 'Not yet determined' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100);
const date = (value: string, timeZone: string) => new Intl.DateTimeFormat('en-US', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
function estimateCents(value: string): number | null {
  const text = value.trim(); if (!text) return null;
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(text)) throw new Error('Use dollar amounts with no more than two decimal places.');
  const [dollars, fraction = ''] = text.split('.');
  const amount = Number(dollars) * 100 + Number(fraction.padEnd(2, '0'));
  if (amount > 100_000_000) throw new Error('This amount exceeds the sale limit.');
  return amount;
}
export function EstimateSummary({ estimate, finalized = false }: { estimate: SaleEstimate; finalized?: boolean }) {
  return <div className="sale-estimate-summary">
    <p><strong>{estimate.customerName}</strong></p>
    {estimate.appointmentId ? <p>Appointment {estimate.appointmentId}{estimate.appointmentTime ? ` · ${date(estimate.appointmentTime, estimate.timeZone)} (${estimate.timeZone})` : ''}</p> : null}
    {estimate.orderId ? <p>Order {estimate.orderId}</p> : null}
    <ul className="customer-order-items">{estimate.lines.map(line => <li key={line.id}><div><h4>{line.description}</h4>{line.professionalName ? <p>{line.professionalName}</p> : null}<p>{line.quantity} × {money(line.unitPriceCents)}{line.discountCents ? ` · Discount ${money(line.discountCents)}` : ''}</p></div><strong>{money(line.netCents)}</strong></li>)}</ul>
    <dl className="customer-order-totals">{([['Item subtotal', estimate.subtotalCents], ['Discount', estimate.discountCents], ['Items after discount', estimate.netCents], ['Tax', estimate.taxCents], ['Shipping', estimate.shippingCents], [finalized ? 'Sale total' : 'Estimated total', estimate.totalCents]] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}</dl>
    {estimate.discountReason ? <p>Discount: {estimate.discountReason}</p> : null}{estimate.chargeNote ? <p>Tax/shipping explanation: {estimate.chargeNote}</p> : null}
    {estimate.totalCents === null ? <p className="customer-notice">The final total is not yet determined. Confirm the outstanding charges with the shop.</p> : null}
    {!finalized ? <p className="customer-fine-print">An estimate does not request or record payment. Appointment confirmation, product availability and payment arrangements remain separate.</p> : null}
  </div>;
}
function SavedEstimate({ estimate, admin }: { estimate: SaleEstimate; admin: boolean }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const download = async () => {
    if (busy) return; setBusy(true); setError(''); setNotice('');
    try { await downloadAccountDocument(admin ? 'sales' : 'estimates', estimate.id); setNotice('Download started. Open the document to print or save as PDF.'); }
    catch (failure) { setError(messageOf(failure)); } finally { setBusy(false); }
  };
  return <li className="sale-estimate-record"><details><summary><strong>{estimate.customerName} · {money(estimate.totalCents)}</strong><span>Issued {date(estimate.createdAt, estimate.timeZone)} · Reference {estimate.id.slice(-8)}</span></summary>
    <EstimateSummary estimate={estimate} /><p className="customer-fine-print">Saved details at issue. Later appointment, product and account changes do not update this copy.</p>
    {admin ? <p><a href={`/account?view=counter&estimate=${encodeURIComponent(estimate.id)}`}>Review and finalize sale</a></p> : null}
    <button className="button button-secondary" disabled={busy} onClick={() => void download()}>{busy ? 'Preparing download…' : 'Download estimate'}</button>
    {error ? <p className="form-error" role="alert">{error}</p> : null}{notice ? <p role="status">{notice}</p> : null}
  </details></li>;
}
function EstimateHistory({ admin, revision }: { admin: boolean; revision: number }) {
  const [page, setPage] = useState<EstimatePage | null>(null); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0); const generation = useRef(0);
  const path = admin ? '/me/sales' : '/me/estimates';
  useEffect(() => {
    const current = ++generation.current;
    void accountApi<EstimatePage>(path).then(data => { if (current === generation.current) { setPage(data); setError(''); } })
      .catch(failure => { if (current === generation.current) { setPage(null); setError(messageOf(failure)); } });
    return () => { generation.current = current + 1; };
  }, [path, revision, attempt]);
  const more = async () => {
    if (!page?.nextCursor || busy) return; const current = generation.current; setBusy(true); setError('');
    try {
      const next = await accountApi<EstimatePage>(`${path}?cursor=${encodeURIComponent(page.nextCursor)}`);
      if (current === generation.current) setPage(prior => prior ? { items: [...prior.items, ...next.items.filter(item => !prior.items.some(old => old.id === item.id))], nextCursor: next.nextCursor } : next);
    } catch (failure) { if (current === generation.current) setError(messageOf(failure)); } finally { setBusy(false); }
  };
  return <section className="customer-security-section"><h3>Saved estimates</h3><p>Each copy keeps the amounts reviewed at issue. These are estimates, not invoices or payment receipts.</p>
    {error ? <p role="alert" className="form-error">{error}</p> : null}{!page && !error ? <p role="status">Loading estimates…</p> : null}
    {page ? <>{page.items.length ? <ul className="sale-estimate-list">{page.items.map(estimate => <SavedEstimate key={estimate.id} estimate={estimate} admin={admin} />)}</ul> : <p>No estimates have been issued {admin ? 'yet' : 'for your account'}.</p>}
      {page.nextCursor ? <button className="button button-secondary" disabled={busy} onClick={() => void more()}>{busy ? 'Loading…' : 'Load older estimates'}</button> : null}</> : null}
    <button className="text-button" disabled={busy} onClick={() => { setPage(null); setAttempt(value => value + 1); }}>Refresh saved estimates</button>
  </section>;
}
function SourcePicker({ kind, value, disabled, onChange }: { kind: 'appointment' | 'order'; value: string; disabled: boolean; onChange: (value: string) => void }) {
  const [page, setPage] = useState<SaleSourcePage | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void accountApi<SaleSourcePage>(`/me/sales/sources?kind=${kind}`).then(data => { if (active) { setPage(data); setError(''); } }).catch(failure => { if (active) setError(messageOf(failure)); });
    return () => { active = false; };
  }, [kind, attempt]);
  const more = async () => {
    if (!page?.nextCursor || busy) return; setBusy(true); setError('');
    try { const next = await accountApi<SaleSourcePage>(`/me/sales/sources?kind=${kind}&cursor=${encodeURIComponent(page.nextCursor)}`); setPage({ items: [...page.items, ...next.items.filter(item => !page.items.some(old => old.id === item.id))], nextCursor: next.nextCursor }); }
    catch (failure) { setError(messageOf(failure)); } finally { setBusy(false); }
  };
  return <div><label>{kind === 'appointment' ? 'Appointment' : 'Product order'}<select disabled={disabled || busy} value={value} onChange={event => onChange(event.target.value)}><option value="">No {kind}</option>
    {value && !page?.items.some(item => item.id === value) ? <option value={value}>Selected reference: {value}</option> : null}
    {page?.items.map(item => <option value={item.id} key={item.id}>{item.customerName} · {item.description} · {item.status.replaceAll('_', ' ')}</option>)}</select></label>
    {!page && !error ? <p role="status">Loading {kind} choices…</p> : null}{error ? <><p role="alert" className="form-error">{error}</p><button className="text-button" type="button" disabled={disabled || busy} onClick={() => setAttempt(current => current + 1)}>Retry choices</button></> : null}
    {page?.nextCursor ? <button className="text-button" type="button" disabled={disabled || busy} onClick={() => void more()}>Load older {kind === 'appointment' ? 'appointments' : 'orders'}</button> : null}
  </div>;
}
function SalesDesk() {
  const [appointmentId, setAppointment] = useState(() => new URLSearchParams(window.location.search).get('appointment') ?? '');
  const [orderId, setOrder] = useState(() => new URLSearchParams(window.location.search).get('order') ?? '');
  const [discount, setDiscount] = useState(''); const [discountReason, setDiscountReason] = useState('');
  const [tax, setTax] = useState(''); const [shipping, setShipping] = useState(''); const [chargeNote, setChargeNote] = useState('');
  const [review, setReview] = useState<{ preview: EstimatePreview; input: EstimateInput } | null>(null);
  const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState<string | null>(null); const locked = useRef(false);
  const preview = async (event: FormEvent) => {
    event.preventDefault(); if (locked.current) return; locked.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const input: EstimateInput = { appointmentId: appointmentId || null, orderId: orderId || null, discountCents: estimateCents(discount) ?? 0, discountReason,
        taxCents: estimateCents(tax), shippingCents: estimateCents(shipping), chargeNote };
      setReview({ input, preview: await accountApi<EstimatePreview>('/me/sales/preview', input) }); setPending(null);
    } catch (failure) { setError(messageOf(failure)); } finally { locked.current = false; setBusy(false); }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!review || locked.current) return; locked.current = true; setBusy(true); setError('');
    const requestKey = pending ?? crypto.randomUUID(); setPending(requestKey);
    try {
      const result = await accountApi<{ estimateId: string }>('/me/sales', { ...review.input, token: review.preview.token, requestKey, currentPassword: password });
      setNotice(`Estimate ${result.estimateId.slice(-8)} saved. No payment was requested or recorded.`); setReview(null); setPending(null); setRevision(value => value + 1);
    } catch (failure) {
      setError(messageOf(failure));
      if (failure instanceof AccountApiError && [400, 409].includes(failure.status)) { setPending(null); setReview(null); }
    } finally { setPassword(''); locked.current = false; setBusy(false); }
  };
  return <section aria-busy={busy}><h2>Sales preparation</h2><p>Prepare an itemized estimate from a visit, a product order, or both for the same customer. Prices come from the saved records.</p>
    {error ? <p className="form-error" role="alert">{error}</p> : null}{notice ? <p className="customer-notice" role="status">{notice}</p> : null}
    {review ? <form className="customer-form" onSubmit={event => void save(event)}><h3>Review estimate</h3><EstimateSummary estimate={review.preview.estimate} /><p>Saving keeps this copy and makes it available to the linked customer account. Guest copies can be downloaded by the shop.</p>
      <p>Review expires {date(review.preview.expiresAt, review.preview.estimate.timeZone)}. If a response is lost, retry this same save to recover its result.</p>
      <label>Your current password<input type="password" required maxLength={128} autoComplete="current-password" disabled={busy} value={password} onChange={event => setPassword(event.target.value)} /></label>
      <div className="customer-form-actions"><button className="button" disabled={busy}>{busy ? 'Saving…' : pending ? 'Retry saving estimate' : 'Save estimate'}</button>
        {!pending ? <button className="button button-secondary" type="button" disabled={busy} onClick={() => { setReview(null); setPassword(''); }}>Back to amounts</button> : null}</div>
    </form> : <form className="customer-form" onSubmit={event => void preview(event)}><fieldset disabled={busy}><legend>Choose saved records</legend>
      <SourcePicker kind="appointment" value={appointmentId} onChange={setAppointment} disabled={busy} /><SourcePicker kind="order" value={orderId} onChange={setOrder} disabled={busy} />
      <p>Guest visits and orders can be estimated separately. Combining them requires the same linked customer account.</p>
    </fieldset><fieldset disabled={busy}><legend>Discount and charges</legend><label>Discount ($)<input inputMode="decimal" maxLength={10} value={discount} onChange={event => setDiscount(event.target.value)} /></label>
      <label>Discount explanation (shown to customer)<input maxLength={200} value={discountReason} onChange={event => setDiscountReason(event.target.value)} /></label>
      <label>Tax ($, leave blank if unknown)<input inputMode="decimal" maxLength={10} value={tax} onChange={event => setTax(event.target.value)} /></label>
      <label>Shipping ($, shipping orders only)<input inputMode="decimal" maxLength={10} value={shipping} onChange={event => setShipping(event.target.value)} /></label>
      <label>Tax/shipping explanation (shown to customer)<textarea maxLength={300} value={chargeNote} onChange={event => setChargeNote(event.target.value)} /></label>
      <p>Enter a determined amount only. Blank tax and shipping-order charges remain unresolved; enter 0 only when zero is correct. This form does not calculate tax.</p>
    </fieldset><button className="button" disabled={busy || !appointmentId && !orderId}>{busy ? 'Preparing…' : 'Review estimate'}</button></form>}
    <EstimateHistory admin revision={revision} />
  </section>;
}
export function SalesPreparation() { return <StaffAuthenticator><SalesDesk /></StaffAuthenticator>; }
export function CustomerEstimates() { return <section><h2>Your estimates</h2><EstimateHistory admin={false} revision={0} /></section>; }
