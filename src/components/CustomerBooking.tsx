import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { accountApi, AccountApiError, getCustomerSession, subscribeToCustomerSession } from '../data/customer-api';
import type { BookingAvailability, BookingOption } from '../shared/booking';
import { CustomerAccount } from './CustomerAccount';
import { bookingPaths } from '../data/site';

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const time = (value: string, zone: string) => new Intl.DateTimeFormat('en-US', { timeZone: zone, dateStyle: 'medium', timeStyle: 'long' }).format(new Date(value));
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Please try again.';
export function CustomerBooking({ onBack, onOpen }: { onBack: () => void; onOpen: (id: string) => void }) {
  const account = useSyncExternalStore(subscribeToCustomerSession, getCustomerSession, () => null);
  const apiRoot = account ? '/me/booking' : '/booking';
  const [week, setWeek] = useState(0);
  const [matches, setMatches] = useState<BookingAvailability[]>([]);
  const [options, setOptions] = useState<BookingOption[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [date, setDate] = useState('');
  const [availability, setAvailability] = useState<BookingAvailability | null>(null);
  const [startsAt, setStartsAt] = useState('');
  const [note, setNote] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [working, setWorking] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [uncertain, setUncertain] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const preselected = useRef(false);
  const pending = useRef<Record<string, string> | null>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    let active = true;
    void accountApi<{ options: BookingOption[] }>(`${apiRoot}/options`).then((data) => {
      if (active) { setOptions(data.options); setError(''); const preferred = new URLSearchParams(window.location.search); const match = data.options.find(item => item.staffId === preferred.get('barber') && (!preferred.get('service') || item.serviceId === preferred.get('service'))); if (match && !preselected.current) { preselected.current=true; setServiceId(match.serviceId); setStaffId(match.staffId); setLocationId(match.locationId); } }
    }).catch((failure) => { if (active) setError(messageOf(failure)); }).finally(() => { if (active) setWorking(false); });
    return () => { active = false; };
  }, [attempt, apiRoot]);
  const services = options.filter((item, index) => options.findIndex((other) => other.serviceId === item.serviceId) === index);
  const professionals = options.filter((item, index) => item.serviceId === serviceId && options.findIndex((other) => other.serviceId === serviceId && other.staffId === item.staffId) === index);
  const locations = options.filter((item) => item.serviceId === serviceId && (staffId === 'any' || item.staffId === staffId)).filter((item,index,all)=>all.findIndex(other=>other.locationId===item.locationId)===index);
  const option = locations.find((item) => item.locationId === locationId);
  const dateParts = option ? new Intl.DateTimeFormat('en-CA', { timeZone: option.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()) : [];
  const today = option ? `${dateParts.find((part) => part.type === 'year')!.value}-${dateParts.find((part) => part.type === 'month')!.value}-${dateParts.find((part) => part.type === 'day')!.value}` : '';
  const dates = today ? Array.from({ length: 7 }, (_, index) => { const day = new Date(`${today}T12:00:00Z`); day.setUTCDate(day.getUTCDate() + week * 7 + index); return { key: day.toISOString().slice(0, 10), label: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(day) }; }) : [];
  const clearTimes = () => { setAvailability(null); setMatches([]); setStartsAt(''); setReviewing(false); pending.current = null; setError(''); };
  const loadTimes = async (event: FormEvent) => {
    event.preventDefault(); if (!option || working) return;
    setWorking(true); clearTimes();
    try {
      const candidates = staffId === 'any' ? options.filter(item=>item.serviceId===serviceId && item.locationId===locationId) : [option];
      const results = await Promise.allSettled(candidates.map(item=>accountApi<BookingAvailability>(`${apiRoot}/availability?${new URLSearchParams({staffId:item.staffId,serviceId:item.serviceId,locationId:item.locationId,date})}`)));
      const available = results.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);
      if (!available.length) throw new Error('No availability could be loaded for this date. Try another date.');
      if (results.some(result=>result.status==='rejected')) setError('Some professionals could not be checked for this date. Showing the available results.');
      setMatches(available); setAvailability(available[0]!);
    } catch (failure) { setError(messageOf(failure)); }
    finally { setWorking(false); }
  };
  const submit = async () => {
    if (!account || !availability || !startsAt || working) return;
    setWorking(true); setError('');
    pending.current ??= { staffId: availability.option.staffId, serviceId: availability.option.serviceId,
      locationId: availability.option.locationId, date: availability.date, startsAt, note, quote: availability.quote, requestKey: crypto.randomUUID() };
    try {
      const result = await accountApi<{ appointmentId: string }>('/me/booking/requests', pending.current);
      onOpen(result.appointmentId);
    } catch (failure) {
      setError(messageOf(failure));
      const unknownOutcome = !(failure instanceof AccountApiError) || failure.status === 0 || failure.status >= 500;
      setUncertain(unknownOutcome);
      if (!unknownOutcome) { pending.current = null; setReviewing(false); setAvailability(null); setStartsAt(''); }
    } finally { setWorking(false); }
  };
  const slot = availability?.slots.find((item) => item.startsAt === startsAt);
  return <section className="customer-booking" aria-busy={working}>
    <button className="text-button" type="button" disabled={working} onClick={onBack}>Back to your account</button>
    <h2 ref={heading} tabIndex={-1}>Request an appointment</h2>
    <p>Choose your service and professional, then check the available times. A request needs shop approval before your visit is confirmed.</p>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {!options.length ? <><p role="status">{working ? 'Loading appointment options…' : 'No website appointment options are available right now. You can still use the existing booking providers.'}</p><div className="customer-form-actions">{bookingPaths.map((path) => <a key={path.id} className="button button-secondary" href={path.href} rel="noopener noreferrer">Continue to {path.provider}</a>)}</div>{error ? <button className="text-button" disabled={working} onClick={() => { setWorking(true); setAttempt((value) => value + 1); }}>Try again</button> : null}</> : <>
      <form className="customer-form" onSubmit={(event) => void loadTimes(event)}>
        <fieldset disabled={working || reviewing || uncertain}>
          <legend>1. Choose your service</legend>
          <div className="customer-choice-grid">{services.map((item) => <label className="customer-choice" key={item.serviceId}><input required type="radio" name="booking-service" value={item.serviceId} checked={serviceId === item.serviceId} onChange={() => { setServiceId(item.serviceId); setStaffId(''); setLocationId(''); setDate(''); clearTimes(); }} /><span><strong>{item.serviceName}</strong><small>From {money(Math.min(...options.filter((other) => other.serviceId === item.serviceId).map((other) => other.priceCents)))}</small></span></label>)}</div>
          {serviceId ? <><h3>2. Choose your professional</h3><div className="customer-choice-grid">{professionals.length > 1 ? <label className="customer-choice"><input required type="radio" name="booking-professional" checked={staffId==='any'} onChange={()=>{setStaffId('any');const first=professionals[0];setLocationId(first?.locationId??'');setDate('');clearTimes();}}/><span><strong>Any available professional</strong><small>Compare openings for this service</small></span></label> : null}{professionals.map((item) => <label className="customer-choice" key={item.staffId}><input required type="radio" name="booking-professional" value={item.staffId} checked={staffId === item.staffId} onChange={() => { setStaffId(item.staffId); const matches = options.filter((other) => other.staffId === item.staffId && other.serviceId === serviceId); setLocationId(matches.length === 1 ? matches[0]!.locationId : ''); setDate(''); clearTimes(); }} /><span><strong>{item.professionalName}</strong><small>{item.durationMinutes} minutes · from {money(Math.min(...options.filter((other) => other.serviceId === serviceId && other.staffId === item.staffId).map((other) => other.priceCents)))}</small></span></label>)}</div></> : null}
          {staffId ? <label>Location<select required value={locationId} onChange={(event) => { setLocationId(event.target.value); setDate(''); clearTimes(); }}><option value="">Choose a location</option>{locations.map((item) => <option key={item.locationId} value={item.locationId}>{item.locationName}</option>)}</select></label> : null}
          {option ? <><h3>3. Choose your date</h3><p>{option.serviceName} with {staffId==='any'?'any available professional':option.professionalName} · {option.durationMinutes} minutes · {money(option.priceCents)}<br />{option.locationName} · Times use {option.timeZone}.</p>
          <div className="customer-form-actions"><button type="button" className="text-button" disabled={week===0} onClick={()=>setWeek(value=>value-1)}>Previous week</button><button type="button" className="text-button" disabled={week>=12} onClick={()=>setWeek(value=>value+1)}>Next week</button></div><div className="customer-date-shortcuts" role="group" aria-label="Appointment week">{dates.map((day) => <button key={day.key} type="button" aria-pressed={date === day.key} onClick={() => { setDate(day.key); clearTimes(); }}>{day.label}</button>)}</div>
          <label>Appointment date<input required type="date" min={today} value={date} onChange={(event) => { setDate(event.target.value); clearTimes(); }} /></label>
          <button className="button button-secondary" type="submit">{working ? 'Checking times…' : 'Check available times'}</button></> : null}
        </fieldset>
      </form>
      {availability && !reviewing ? <div className="customer-booking-times"><h3>4. Choose your time</h3><p>These openings are not held while you choose. We check availability again when you submit.</p>
        {matches.some(match=>match.slots.length) ? <><fieldset className="customer-time-options" disabled={working}><legend>Choose a start time ({availability.option.timeZone})</legend>{matches.flatMap(match=>match.slots.map(item=>({item,match}))).sort((a,b)=>a.item.startsAt.localeCompare(b.item.startsAt)||a.match.option.professionalName.localeCompare(b.match.option.professionalName)).map(({item,match}) => <label key={`${match.option.staffId}-${item.startsAt}`}><input type="radio" name="appointment-time" value={item.startsAt} checked={startsAt === item.startsAt && availability.option.staffId===match.option.staffId} onChange={() => { setAvailability(match); setStartsAt(item.startsAt); pending.current = null; }} />{time(item.startsAt, match.option.timeZone)} · {match.option.professionalName} · {money(match.option.priceCents)}</label>)}</fieldset>
          <div className="customer-form"><label>Appointment note (optional)<textarea value={note} maxLength={500} rows={3} disabled={working} onChange={(event) => { setNote(event.target.value); pending.current = null; }} /><small>Share only what the professional needs for this visit. Do not include payment or sensitive account information.</small></label>
            <button className="button" disabled={!slot || working} onClick={() => setReviewing(true)}>Review request</button></div></> : <p role="status">No openings for this selection. Try another date or professional.</p>}
      </div> : null}
      {reviewing && availability && slot ? <section className="customer-booking-review"><h3>Review your request</h3><p><strong>{availability.option.serviceName}</strong> with {availability.option.professionalName}</p><p>{availability.option.locationName}<br />{time(slot.startsAt, availability.option.timeZone)} to {time(slot.endsAt, availability.option.timeZone)}</p><p>{availability.option.durationMinutes} minutes · {money(availability.option.priceCents)} recorded service price. No payment is collected here.</p>{note ? <p className="customer-record-note">Your note: {note}</p> : null}
        <p>Your request will appear in your appointments as awaiting approval. Check its status there; submitting does not confirm the visit.</p>
        {uncertain ? <p role="alert">We could not confirm whether the request was saved. Retry below to check the same request safely, or check your appointments before making another request.</p> : null}
        {!account ? <div className="customer-booking-signin"><h3>Sign in or create an account to send this request</h3><p>Your selection stays here while you verify your email. Availability is checked again when you submit.</p><CustomerAccount /></div> : null}<div className="customer-form-actions">{!uncertain ? <button className="button button-secondary" disabled={working} onClick={() => setReviewing(false)}>Edit selection</button> : null}<button className="button" disabled={working || !account} onClick={() => void submit()}>{working ? 'Saving request…' : uncertain ? 'Retry same request' : 'Submit appointment request'}</button></div>
      </section> : null}
    </>}
  </section>;
}
