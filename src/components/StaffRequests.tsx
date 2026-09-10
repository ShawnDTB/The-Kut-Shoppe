import { useEffect, useRef, useState, type FormEvent } from 'react';
import { accountApi } from '../data/customer-api';
import { business } from '../data/site';
import type { ProfessionalAccess, StaffQueue, StaffRequest } from '../shared/staff';

const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Please try again.';
const time = (value: string | null, zone: string) => {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Time not set';
  try { return new Intl.DateTimeFormat('en-US', { timeZone: zone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  catch { return 'Time zone needs review'; }
};
function RequestDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [request, setRequest] = useState<StaffRequest | null>(null);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(true); const [attempt, setAttempt] = useState(0);
  const [action, setAction] = useState<'confirm' | 'decline' | null>(null);
  const [password, setPassword] = useState('');
  const key = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    let active = true;
    void accountApi<{ request: StaffRequest }>(`/me/professional/requests/${encodeURIComponent(id)}`).then((data) => {
      if (active) { setRequest(data.request); setError(''); }
    }).catch((failure) => { if (active) setError(messageOf(failure)); }).finally(() => { if (active) setWorking(false); });
    return () => { active = false; };
  }, [id, attempt]);
  const refresh = () => { setWorking(true); setPassword(''); setAction(null); key.current = null; setAttempt((value) => value + 1); };
  const decide = async (event: FormEvent) => {
    event.preventDefault(); if (!request || !action || working) return;
    setWorking(true); setError(''); setNotice(''); key.current ??= crypto.randomUUID();
    try {
      const data = await accountApi<{ request: StaffRequest; message: string }>(`/me/professional/requests/${encodeURIComponent(id)}`, {
        action, updatedAt: request.updatedAt, decisionKey: key.current, currentPassword: password,
      });
      setRequest(data.request); setNotice(data.message); setAction(null); key.current = null;
    } catch (failure) { setError(`${messageOf(failure)} You can retry the same decision or refresh to check its current status.`); }
    finally { setWorking(false); setPassword(''); }
  };
  return <section className="customer-record-detail" aria-busy={working}>
    <button className="text-button" disabled={working} onClick={onBack}>Back to request queue</button>
    <h2 ref={heading} tabIndex={-1}>Appointment request</h2>
    {error ? <p className="form-error" role="alert">{error}</p> : null}{notice ? <p className="customer-notice" role="status">{notice}</p> : null}
    {working ? <p role="status">Updating request…</p> : null}
    {request ? <><p className="customer-status">{request.status.replaceAll('_', ' ')}</p><h3>{request.customerName} · {request.serviceName}</h3>
      <dl className="customer-detail-facts"><div><dt>Requested visit</dt><dd>{time(request.startsAt, request.timeZone)} to {time(request.endsAt, request.timeZone)}</dd></div><div><dt>Location</dt><dd>{request.locationName} ({request.timeZone})</dd></div><div><dt>Recorded service price</dt><dd>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(request.priceCents / 100)}</dd></div></dl>
      {request.customerNote ? <section><h3>Customer’s note</h3><p className="customer-record-note">{request.customerNote}</p></section> : null}
      {request.status === 'requested' ? action ? <form className="customer-form customer-security-section" onSubmit={(event) => void decide(event)}>
        <h3>{action === 'confirm' ? 'Confirm this appointment?' : 'Decline this request?'}</h3><p>{action === 'confirm' ? 'This accepts the visit at the requested time and recorded price. Availability is checked again before saving.' : 'This declines the request and releases its opening. It does not process a payment or refund.'}</p>
        <p>The customer will see the saved status in their account. An email notice is queued separately.</p>
        <label>Your current password<input type="password" autoComplete="current-password" required maxLength={128} value={password} disabled={working} onChange={(event) => setPassword(event.target.value)} /></label>
        <div className="customer-form-actions"><button className="button" disabled={working}>{working ? 'Saving…' : action === 'confirm' ? 'Confirm appointment' : 'Decline request'}</button><button className="button button-secondary" type="button" disabled={working} onClick={refresh}>Refresh before changing decision</button></div>
      </form> : <div className="customer-form-actions"><button className="button" disabled={working || !request.startsAt || !request.endsAt} onClick={() => setAction('confirm')}>Review confirmation</button><button className="button button-secondary" disabled={working} onClick={() => setAction('decline')}>Review decline</button></div> : <p>This request has been resolved. Refresh the queue to continue.</p>}
    </> : null}
    <button className="text-button" disabled={working} onClick={refresh}>Refresh request</button>
  </section>;
}
function Queue() {
  const [items, setItems] = useState<StaffRequest[]>([]); const [cursor, setCursor] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null); const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState(''); const [working, setWorking] = useState(true); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void accountApi<StaffQueue>(`/me/professional/requests${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`).then((data) => {
      if (!active) return;
      setItems((previous) => {
        const current = cursor ? previous : []; const ids = new Set(current.map((item) => item.id));
        return [...current, ...data.items.filter((item) => !ids.has(item.id))];
      }); setNext(data.nextCursor); setError('');
    }).catch((failure) => { if (active) setError(messageOf(failure)); }).finally(() => { if (active) setWorking(false); });
    return () => { active = false; };
  }, [cursor, attempt]);
  const refresh = () => { setWorking(true); setCursor(null); setNext(null); setItems([]); setAttempt((value) => value + 1); };
  if (selected) return <RequestDetail key={selected} id={selected} onBack={() => { setSelected(null); refresh(); }} />;
  return <section aria-busy={working}><h2>Your appointment requests</h2><p>Requests assigned to your professional profile, oldest first. Review each request before confirming the visit.</p>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <ul className="customer-records">{items.map((item) => <li key={item.id}><div><h3>{item.customerName} · {item.serviceName}</h3><p>{time(item.startsAt, item.timeZone)} · {item.locationName}</p></div><button className="button button-secondary" onClick={() => setSelected(item.id)}>Review request</button></li>)}</ul>
    <p role="status">{working ? 'Loading requests…' : items.length ? `${items.length} requests shown.` : error ? '' : 'No requests are awaiting your response.'}</p>
    <div className="customer-form-actions">{next && !error ? <button className="button button-secondary" disabled={working} onClick={() => { setWorking(true); setCursor(next); }}>Load more requests</button> : null}<button className="text-button" disabled={working} onClick={refresh}>Refresh queue</button>{error && cursor ? <button className="text-button" disabled={working} onClick={() => { setWorking(true); setAttempt((value) => value + 1); }}>Retry loading more</button> : null}</div>
  </section>;
}
export function StaffRequests() {
  const [access, setAccess] = useState<ProfessionalAccess | null>(null); const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void accountApi<ProfessionalAccess>('/me/professional').then((data) => { if (active) { setAccess(data); setError(''); } })
      .catch((failure) => { if (active) setError(messageOf(failure)); });
    return () => { active = false; };
  }, [attempt]);
  if (error) return <section><p role="alert" className="form-error">{error}</p><button className="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button></section>;
  if (!access) return <p role="status">Checking professional access…</p>;
  if (access.state === 'approved' && access.enabled) return <Queue />;
  const messages = { not_eligible: 'This account does not have professional access.', setup_required: 'Your professional setup needs to be completed and approved by the shop.', pending_review: 'Your professional profile is awaiting shop approval.', disabled: 'Your professional profile is currently disabled.', approved: 'Professional request management is not open yet.' };
  return <section><h2>Professional access</h2><p>{messages[access.state]}</p><p>Your personal appointments, profile, and security controls remain available.</p><a href={business.phoneHref}>Contact the shop</a></section>;
}
