import { useEffect, useRef, useState, type FormEvent } from 'react';
import { accountApi } from '../data/customer-api';
import { StaffAuthenticator } from './StaffAuthenticator';
import type { BookingAvailability, BookingOption } from '../shared/booking';
import type { FrontDeskPage, WalkInVisit } from '../shared/front-desk';

const label = (value: string) => value.replaceAll('_', ' ');
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100);
const when = (value: string, timeZone: string) => new Intl.DateTimeFormat('en-US', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const today = (timeZone: string) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
function Desk() {
  const [options, setOptions] = useState<BookingOption[]>([]); const [visits, setVisits] = useState<FrontDeskPage | null>(null);
  const [attempt, setAttempt] = useState(0); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [selection, setSelection] = useState('');
  const [available, setAvailable] = useState<BookingAvailability | null>(null); const [startsAt, setStartsAt] = useState('');
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [password, setPassword] = useState('');
  const [review, setReview] = useState<{ path: string; body: Record<string, unknown>; summary: string } | null>(null);
  const pending = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all([accountApi<{ options: BookingOption[] }>('/me/front-desk/options'), accountApi<FrontDeskPage>('/me/front-desk/visits')])
      .then(([services, page]) => { if (active) { setOptions(services.options); setVisits(page); setError(''); } })
      .catch(failure => { if (active) { setError(failure instanceof Error ? failure.message : 'Please try again.'); setVisits(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  const refresh = () => { setLoading(true); setReview(null); setAvailable(null); setStartsAt(''); setPassword(''); pending.current = null; setAttempt(value => value + 1); };
  const option = options[Number(selection)];
  const findTimes = async () => {
    if (!option || selection === '' || busy) return;
    setBusy(true); setError(''); setAvailable(null); setStartsAt('');
    try { setAvailable(await accountApi<BookingAvailability>(`/me/front-desk/availability?${new URLSearchParams({ staffId: option.staffId, serviceId: option.serviceId, locationId: option.locationId, date: today(option.timeZone) })}`)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Please try again.'); }
    finally { setBusy(false); }
  };
  const createReview = (event: FormEvent) => {
    event.preventDefault(); if (!available || !startsAt || busy) return;
    const { option } = available;
    setReview({ path: '/me/front-desk/visits', body: { staffId: option.staffId, serviceId: option.serviceId, locationId: option.locationId, date: available.date, startsAt, quote: available.quote, name, phone },
      summary: `${name} · ${option.serviceName} with ${option.professionalName} · ${when(startsAt, option.timeZone)} (${option.timeZone}) · ${money(option.priceCents)}` });
  };
  const progress = (visit: WalkInVisit, action: string) => setReview({ path: `/me/front-desk/visits/${encodeURIComponent(visit.id)}`, body: { action, updatedAt: visit.updatedAt }, summary: `${visit.name} · ${visit.serviceName}: ${label(visit.status)} → ${label(action)}` });
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!review || busy) return;
    setBusy(true); setError(''); pending.current ??= { ...review.body, requestKey: crypto.randomUUID() };
    try { await accountApi(review.path, { ...pending.current, currentPassword: password }); setNotice('Visit saved. No payment has been recorded.'); setName(''); setPhone(''); refresh(); }
    catch (failure) { setError(`${failure instanceof Error ? failure.message : 'Please try again.'} Retry the same action or refresh to check its status.`); }
    finally { setBusy(false); setPassword(''); }
  };
  const actions: Record<string, string[]> = { confirmed: ['checked_in','cancelled','no_show'], checked_in: ['in_service','cancelled'], in_service: ['completed'] };
  return <section aria-busy={busy || loading}><h2>Front desk</h2><p>Schedule today’s guest walk-ins and track their visit. A customer account or email address is not required.</p>
    {error ? <p className="form-error" role="alert">{error}</p> : null}{notice ? <p className="customer-notice" role="status">{notice}</p> : null}{loading ? <p role="status">Loading front desk…</p> : null}
    {visits && !loading ? <>
      {review ? <form className="customer-form customer-security-section" onSubmit={event => void save(event)}><h3>Review visit action</h3><p>{review.summary}</p><p>This updates the appointment only. It does not collect cash or charge a card.</p><label>Your current password<input type="password" autoComplete="current-password" required maxLength={128} disabled={busy} value={password} onChange={event => setPassword(event.target.value)} /></label><div className="customer-form-actions"><button className="button" disabled={busy}>{busy ? 'Saving…' : 'Confirm visit action'}</button><button className="button button-secondary" type="button" disabled={busy} onClick={refresh}>Refresh before changing action</button></div></form> : <form className="customer-form" onSubmit={createReview}>
        <h3>Add a walk-in</h3><label>Guest name<input value={name} required maxLength={100} disabled={busy} onChange={event => setName(event.target.value)} /></label><label>Contact phone (optional)<input type="tel" maxLength={30} value={phone} disabled={busy} onChange={event => setPhone(event.target.value)} /></label>
        <label>Service and professional<select value={selection} required disabled={busy} onChange={event => { setSelection(event.target.value); setAvailable(null); setStartsAt(''); }}><option value="">Choose a service and professional</option>{options.map((item, index) => <option key={`${item.staffId}-${item.serviceId}-${item.locationId}`} value={index}>{item.serviceName} · {item.professionalName} · {item.locationName} · {money(item.priceCents)}</option>)}</select></label>
        <button className="button button-secondary" type="button" disabled={busy || selection === ''} onClick={() => void findTimes()}>Find today’s openings</button>
        {available ? <><p>Times for {available.date} ({available.option.timeZone}). Availability is checked again when saved.</p>{available.slots.length ? <fieldset className="customer-time-options"><legend>Choose an opening</legend>{available.slots.map(slot => <label key={slot.startsAt}><input type="radio" required name="walk-in-time" checked={startsAt === slot.startsAt} disabled={busy} onChange={() => setStartsAt(slot.startsAt)} />{when(slot.startsAt, available.option.timeZone)}</label>)}</fieldset> : <p>No openings remain today. A guest should not be promised a reserved time without an available opening.</p>}<button className="button" disabled={busy || !startsAt}>Review walk-in</button></> : null}
      </form>}
      <section className="customer-security-section"><h3>Active and recently updated walk-ins</h3>{visits.more ? <p className="customer-notice">Showing the first 100 visits. Additional history requires shop support.</p> : null}<ul className="customer-records">{visits.items.map(visit => <li key={visit.id}><div><h4>{visit.name} · {visit.serviceName}</h4><p>{visit.professionalName} · {when(visit.startsAt, visit.timeZone)} ({visit.timeZone})</p><p>{label(visit.status)} · Recorded price {money(visit.priceCents)}</p><div className="customer-form-actions">{(actions[visit.status] ?? []).map(action => <button className="button button-secondary" key={action} disabled={busy || Boolean(review)} onClick={() => progress(visit, action)}>{label(action)}</button>)}</div></div></li>)}</ul>{!visits.items.length ? <p>No active or recently updated walk-ins.</p> : null}</section>
    </> : null}<button className="text-button" disabled={busy || loading} onClick={refresh}>Refresh front desk</button>
  </section>;
}
export function FrontDesk() { return <StaffAuthenticator><Desk /></StaffAuthenticator>; }
