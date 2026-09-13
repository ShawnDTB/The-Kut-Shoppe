import { useEffect, useRef, useState } from 'react';
import { accountApi } from '../data/customer-api';
import { business } from '../data/site';
import type { ProfessionalAccess } from '../shared/staff';
import type { StaffVisit, StaffVisitsPage, StaffVisitSummary } from '../shared/staff-visits';
import { StaffAuthenticator } from './StaffAuthenticator';
import { AppointmentRescheduling } from './AppointmentRescheduling';

const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Please try again.';
const status = (value: string) => ({ confirmed: 'Confirmed', reschedule_proposed: 'Change proposed', checked_in: 'Checked in', in_service: 'In service' })[value] ?? value.replaceAll('_', ' ');
const time = (value: string | null, zone: string) => {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Time needs review';
  try { return new Intl.DateTimeFormat('en-US', { timeZone: zone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  catch { return 'Time zone needs review'; }
};
function VisitDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [visit, setVisit] = useState<StaffVisit | null>(null); const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    let active = true;
    void accountApi<{ visit: StaffVisit }>(`/me/professional/visits/${encodeURIComponent(id)}`).then((data) => { if (active) { setVisit(data.visit); setError(''); } })
      .catch((failure) => { if (active) { setVisit(null); setError(messageOf(failure)); } });
    return () => { active = false; };
  }, [id, attempt]);
  return <section className="customer-record-detail"><button className="text-button" onClick={onBack}>Back to your visits</button><h2 ref={heading} tabIndex={-1}>Appointment details</h2>
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    {visit ? <><p className="customer-status">{status(visit.status)}</p><h3>{visit.customerName} · {visit.serviceName}</h3>
      <dl className="customer-detail-facts"><div><dt>Scheduled visit</dt><dd>{time(visit.startsAt, visit.timeZone)} to {time(visit.endsAt, visit.timeZone)}</dd></div><div><dt>Location</dt><dd>{visit.locationName} ({visit.timeZone})</dd></div><div><dt>Recorded service price</dt><dd>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(visit.priceCents / 100)}</dd></div></dl>
      {visit.customerNote ? <section><h3>Customer’s note</h3><p className="customer-record-note">{visit.customerNote}</p></section> : null}
      {visit.status === 'confirmed' && visit.source === 'website' ? <AppointmentRescheduling id={id} professional onSaved={() => setAttempt(value => value + 1)} /> : null}
      {visit.proposedStartsAt || visit.proposedEndsAt ? <section className="customer-notice"><h3>Proposed time awaiting agreement</h3><p>{time(visit.proposedStartsAt, visit.timeZone)} to {time(visit.proposedEndsAt, visit.timeZone)}</p><p>Confirm arrangements with the shop before treating a proposed time as the scheduled visit.</p></section> : null}
      <p>For a cancellation or schedule change, <a href={business.phoneHref}>contact the shop</a>.</p>
    </> : !error ? <p role="status">Loading appointment…</p> : null}
    <button className="text-button" onClick={() => { setVisit(null); setAttempt((value) => value + 1); }}>Refresh appointment</button>
  </section>;
}
function VisitList() {
  const [items, setItems] = useState<StaffVisitSummary[]>([]); const [cursor, setCursor] = useState<string | null>(null); const [next, setNext] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null); const [attempt, setAttempt] = useState(0); const [working, setWorking] = useState(true);
  const [error, setError] = useState(''); const [needsReview, setNeedsReview] = useState(0);
  useEffect(() => {
    let active = true;
    void accountApi<StaffVisitsPage>(`/me/professional/visits${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`).then((data) => {
      if (!active) return;
      setItems((previous) => { const existing = cursor ? previous : []; const ids = new Set(existing.map((item) => item.id)); return [...existing, ...data.items.filter((item) => !ids.has(item.id))]; });
      setNext(data.nextCursor); setNeedsReview(data.needsTimeReview); setError('');
    }).catch((failure) => { if (active) { setItems([]); setNext(null); setNeedsReview(0); setError(messageOf(failure)); } }).finally(() => { if (active) setWorking(false); });
    return () => { active = false; };
  }, [cursor, attempt]);
  const refresh = () => { setSelected(null); setCursor(null); setNext(null); setItems([]); setWorking(true); setAttempt((value) => value + 1); };
  if (selected) return <VisitDetail key={selected} id={selected} onBack={refresh} />;
  return <section aria-busy={working}><h2>Your upcoming and active visits</h2><p>Your assigned website bookings and walk-ins, ordered by scheduled start. Continue checking your existing booking provider for external appointments.</p>
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    {needsReview ? <p className="customer-notice">{needsReview} assigned {needsReview === 1 ? 'visit needs' : 'visits need'} a time review. <a href={business.phoneHref}>Contact the shop</a> to resolve the schedule.</p> : null}
    <ul className="customer-records">{items.map((item) => <li key={item.id}><div><p className="customer-status">{status(item.status)}</p><h3>{item.customerName} · {item.serviceName}</h3><p>{time(item.startsAt, item.timeZone)} · {item.locationName} ({item.timeZone})</p></div><button className="button button-secondary" onClick={() => setSelected(item.id)}>View visit</button></li>)}</ul>
    <p role="status">{working ? 'Loading visits…' : !items.length && !error ? 'No upcoming or active timed visits are assigned to you.' : `${items.length} visits shown.`}</p>
    <div className="customer-form-actions">{next ? <button className="button button-secondary" disabled={working} onClick={() => { setWorking(true); setCursor(next); }}>Load more visits</button> : null}<button className="text-button" disabled={working} onClick={refresh}>Refresh visits</button></div>
  </section>;
}
export function StaffVisits() {
  const [access, setAccess] = useState<ProfessionalAccess | null>(null); const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void accountApi<ProfessionalAccess>('/me/professional').then((data) => { if (active) { setAccess(data); setError(''); } }).catch((failure) => { if (active) setError(messageOf(failure)); });
    return () => { active = false; };
  }, [attempt]);
  if (error) return <section><p role="alert">{error}</p><button className="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button></section>;
  if (!access) return <p role="status">Checking professional access…</p>;
  if (access.state !== 'approved') return <section><h2>Your visits</h2><p>An approved professional profile is required.</p><a href="/account?view=professional-setup">Open professional setup</a></section>;
  if (!access.enabled) return <p>Professional appointment access is not open yet.</p>;
  return <StaffAuthenticator><VisitList /></StaffAuthenticator>;
}
