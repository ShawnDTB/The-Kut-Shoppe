import { useState, type FormEvent } from 'react';
import { getPlatformSessionAccount, isValidEmail } from '../data/auth-v2';
import { isValidPhone, normalizePhone } from '../data/auth';
import { barberServiceOptions, createAppointmentRequest, type PlatformAppointment } from '../data/platform';
import { BookingV6 } from './BookingV6';

function todayInShopTime() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts();
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function BookingV7() {
  const editing = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('appointment');
  if (!editing) return <BookingV6 />;
  return <section className="section platform-pattern platform-pattern-booking"><div className="container narrow-container"><div className="booking-v2-confirmation"><p className="eyebrow">Appointment protection</p><h1>Online changes are temporarily paused.</h1><p>Your current appointment was not changed. Call the shop to request another opening.</p><div className="booking-v2-complete-actions"><a className="button" href="/account?view=appointments">Appointments</a><a className="button button-secondary" href="tel:+15704215887">Call 570-421-5887</a></div></div></div></section>;
}

export function WalkInEntryV7() {
  const account = getPlatformSessionAccount();
  const [error, setError] = useState('');
  const [created, setCreated] = useState<PlatformAppointment | null>(null);
  if (!account || account.role === 'customer') return <section className="section platform-pattern platform-pattern-staff"><div className="container narrow-container"><div className="staff-empty-state"><p className="eyebrow">Staff access required</p><h1>Sign in before adding a walk-in.</h1><a className="button" href="/account">Account / Login</a></div></div></section>;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const service = barberServiceOptions.find((item) => item.id === data.get('service'));
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim().toLowerCase();
    const phone = String(data.get('phone') ?? '');
    if (!service || name.length < 2) return setError('Enter the customer and service.');
    if (!isValidEmail(email)) return setError('Enter a valid email address.');
    if (!isValidPhone(phone)) return setError('Enter a valid 10-digit phone number.');
    setCreated(createAppointmentRequest({ serviceId: service.id, serviceName: service.name, price: service.price, priceCents: service.priceCents, durationMinutes: service.durationMinutes, requestedBarberId: 'any', assignedBarberId: null, barberName: 'Any available barber', date: todayInShopTime(), time: 'Waiting list', startMinutes: 0, endMinutes: service.durationMinutes, proposedDate: null, proposedTime: null, proposedStartMinutes: null, customerName: name, customerEmail: email, customerPhone: normalizePhone(phone), phoneVerified: false, accountPreference: 'guest', source: 'walk-in', customerNote: String(data.get('note') ?? '').trim(), staffNote: `Added by ${account.name}` }));
    setError('');
  };

  if (created) return <section className="section platform-pattern platform-pattern-staff"><div className="container narrow-container"><div className="booking-v2-confirmation"><p className="eyebrow">Walk-in added</p><h1>{created.customerName} is on today’s waitlist.</h1><div className="booking-v2-complete-actions"><a className="button" href="/staff/waitlist">Open waitlist</a><button className="button button-secondary" type="button" onClick={() => setCreated(null)}>Add another</button></div></div></div></section>;

  return <section className="section platform-pattern platform-pattern-staff"><div className="container narrow-container"><form className="booking-v2-panel booking-v4-panel" onSubmit={submit}><p className="eyebrow">Staff waitlist</p><h1>Add a walk-in customer.</h1><div className="booking-v2-fields booking-v4-fields"><label className="booking-v2-wide"><span>Service</span><select name="service" defaultValue={barberServiceOptions[0]?.id}>{barberServiceOptions.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.price}</option>)}</select></label><label><span>Name</span><input name="name" autoComplete="name" required /></label><label><span>Email</span><input name="email" type="email" autoComplete="email" required /></label><label><span>Mobile phone</span><input name="phone" type="tel" autoComplete="tel" required /></label><label className="booking-v2-wide"><span>Note <small>Optional</small></span><textarea name="note" rows={3} /></label></div>{error ? <p className="form-error" role="alert">{error}</p> : null}<div className="booking-v2-submit-row"><button className="button" type="submit">Add to waitlist</button><a className="button button-secondary" href="/staff/waitlist">Cancel</a></div></form></div></section>;
}
