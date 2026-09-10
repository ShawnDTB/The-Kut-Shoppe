import { useEffect, useRef, useState, type FormEvent } from 'react';
import { accountApi, AccountApiError } from '../data/customer-api';
import type { BookingAvailability, BookingOption } from '../shared/booking';

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const time = (value: string, zone: string) => new Intl.DateTimeFormat('en-US', { timeZone: zone, dateStyle: 'medium', timeStyle: 'long' }).format(new Date(value));
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Please try again.';
export function CustomerBooking({ onBack, onOpen }: { onBack: () => void; onOpen: (id: string) => void }) {
  const [options, setOptions] = useState<BookingOption[]>([]);
  const [choice, setChoice] = useState('');
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
  const pending = useRef<Record<string, string> | null>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    let active = true;
    void accountApi<{ options: BookingOption[] }>('/me/booking/options').then((data) => {
      if (active) { setOptions(data.options); setError(''); }
    }).catch((failure) => { if (active) setError(messageOf(failure)); }).finally(() => { if (active) setWorking(false); });
    return () => { active = false; };
  }, [attempt]);
  const option = choice === '' ? undefined : options[Number(choice)];
  const clearTimes = () => { setAvailability(null); setStartsAt(''); setReviewing(false); pending.current = null; setError(''); };
  const loadTimes = async (event: FormEvent) => {
    event.preventDefault(); if (!option || working) return;
    setWorking(true); clearTimes();
    try {
      const query = new URLSearchParams({ staffId: option.staffId, serviceId: option.serviceId, locationId: option.locationId, date });
      const data = await accountApi<BookingAvailability>(`/me/booking/availability?${query}`);
      setAvailability(data);
    } catch (failure) { setError(messageOf(failure)); }
    finally { setWorking(false); }
  };
  const submit = async () => {
    if (!availability || !startsAt || working) return;
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
    <button className="text-button" type="button" disabled={working} onClick={onBack}>Back to appointments</button>
    <h2 ref={heading} tabIndex={-1}>Request an appointment</h2>
    <p>Choose your service and professional, then check the available times. A request needs shop approval before your visit is confirmed.</p>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {!options.length ? <><p role="status">{working ? 'Loading appointment options…' : 'No website appointment options are available right now. You can still use the existing booking providers.'}</p><a className="button" href="/book">View booking options</a>{error ? <button className="text-button" disabled={working} onClick={() => { setWorking(true); setAttempt((value) => value + 1); }}>Try again</button> : null}</> : <>
      <form className="customer-form" onSubmit={(event) => void loadTimes(event)}>
        <fieldset disabled={working || reviewing || uncertain}>
          <label>Service, professional, and location<select required value={choice} onChange={(event) => { setChoice(event.target.value); clearTimes(); }}><option value="">Choose an option</option>{options.map((item, index) => <option key={`${item.staffId}-${item.serviceId}-${item.locationId}`} value={index}>{item.serviceName} · {item.professionalName} · {item.locationName} · {money(item.priceCents)}</option>)}</select></label>
          {option ? <p>{option.durationMinutes} minutes · Times use {option.timeZone}.</p> : null}
          <label>Appointment date<input required type="date" value={date} onChange={(event) => { setDate(event.target.value); clearTimes(); }} /></label>
          <button className="button button-secondary" type="submit">{working ? 'Checking times…' : 'Check available times'}</button>
        </fieldset>
      </form>
      {availability && !reviewing ? <div className="customer-booking-times"><h3>Available times</h3><p>These openings are not held while you choose. We check availability again when you submit.</p>
        {availability.slots.length ? <><fieldset className="customer-time-options" disabled={working}><legend>Choose a start time ({availability.option.timeZone})</legend>{availability.slots.map((item) => <label key={item.startsAt}><input type="radio" name="appointment-time" value={item.startsAt} checked={startsAt === item.startsAt} onChange={() => { setStartsAt(item.startsAt); pending.current = null; }} />{time(item.startsAt, availability.option.timeZone)}</label>)}</fieldset>
          <div className="customer-form"><label>Appointment note (optional)<textarea value={note} maxLength={500} rows={3} disabled={working} onChange={(event) => { setNote(event.target.value); pending.current = null; }} /><small>Share only what the professional needs for this visit. Do not include payment or sensitive account information.</small></label>
            <button className="button" disabled={!slot || working} onClick={() => setReviewing(true)}>Review request</button></div></> : <p role="status">No openings for this selection. Try another date or professional.</p>}
      </div> : null}
      {reviewing && availability && slot ? <section className="customer-booking-review"><h3>Review your request</h3><p><strong>{availability.option.serviceName}</strong> with {availability.option.professionalName}</p><p>{availability.option.locationName}<br />{time(slot.startsAt, availability.option.timeZone)} to {time(slot.endsAt, availability.option.timeZone)}</p><p>{availability.option.durationMinutes} minutes · {money(availability.option.priceCents)} recorded service price. No payment is collected here.</p>{note ? <p className="customer-record-note">Your note: {note}</p> : null}
        <p>Your request will appear in your appointments as awaiting approval. Check its status there; submitting does not confirm the visit.</p>
        {uncertain ? <p role="alert">We could not confirm whether the request was saved. Retry below to check the same request safely, or check your appointments before making another request.</p> : null}
        <div className="customer-form-actions">{!uncertain ? <button className="button button-secondary" disabled={working} onClick={() => setReviewing(false)}>Edit selection</button> : null}<button className="button" disabled={working} onClick={() => void submit()}>{working ? 'Saving request…' : uncertain ? 'Retry same request' : 'Submit appointment request'}</button></div>
      </section> : null}
    </>}
  </section>;
}
