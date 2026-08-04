import { useState } from 'react';
import { getPlatformSessionAccount, isValidEmail } from '../data/auth-v2';
import { isValidPhone, normalizePhone } from '../data/auth';
import { barberServiceOptions, createAppointmentRequest, type PlatformAppointment } from '../data/platform';
import { BookingV6 } from './BookingV6';

type WalkInCustomer = { name: string; email: string; phone: string; note: string };

function todayInShopTime() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts();
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function BookingV7() {
  const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  if (!params.has('appointment')) return <BookingV6 />;
  return <section className="section booking-v7-safety platform-pattern platform-pattern-booking"><div className="container narrow-container"><div className="booking-v2-confirmation"><p className="eyebrow">Appointment protection</p><h1>Online appointment changes are temporarily paused.</h1><p>Your current appointment has not been changed. Call the shop to request a different opening while protected pending-change records are completed.</p><div className="booking-v2-complete-actions"><a className="button" href="/account?view=appointments">Return to appointments</a><a className="button button-secondary" href="tel:+15704215887">Call 570-421-5887</a></div></div></div></section>;
}

export function WalkInEntryV7() {
  const account = getPlatformSessionAccount();
  const [serviceId, setServiceId] = useState(barberServiceOptions[0]?.id ?? '');
  const [customer, setCustomer] = useState<WalkInCustomer>({ name: '', email: '', phone: '', note: '' });
  const [error, setError] = useState('');
  const [created, setCreated] = useState<PlatformAppointment | null>(null);
  const service = barberServiceOptions.find((item) => item.id === serviceId) ?? null;

  if (!account || account.role === 'customer') return <section className="section platform-pattern platform-pattern-staff"><div className="container narrow-container"><div className="staff-empty-state"><p className="eyebrow">Staff access required</p><h1>Sign in before adding a walk-in.</h1><a className="button" href="/account">Account / Login</a></div></div></section>;

  const submit = () => {
    if (!service) return;
    if (customer.name.trim().length < 2) return setError('Enter the customer name.');
    if (!isValidEmail(customer.email)) return setError('Enter a valid email address.');
    if (!isValidPhone(customer.phone)) return setError('Enter a valid 10-digit phone number.');
    setCreated(createAppointmentRequest({
      serviceId: service.id,
      serviceName: service.name,
      price: service.price,
      priceCents: service.priceCents,
      durationMinutes: service.durationMinutes,
      requestedBarberId: 'any',
      assignedBarberId: null,
      barberName: 'Any available barber',
      date: todayInShopTime(),
      time: 'Waiting list',
      startMinutes: 0,
      endMinutes: service.durationMinutes,
      proposedDate: null,
      proposedTime: null,
      proposedStartMinutes: null,
      customerName: customer.name.trim(),
      customerEmail: customer.email.trim().toLowerCase(),
      customerPhone: normalizePhone(customer.phone),
      phoneVerified: false,
      accountPreference: 'guest',
      source: 'walk-in',
      customerNote: customer.note.trim(),
      staffNote: `Added by ${account.name}`,
    }));
    setError('');
  };

  if (created) return <section className="section platform-pattern platform-pattern-staff"><div className="container narrow-container"><div className="booking-v2-confirmation"><p className="eyebrow">Walk-in added</p><h1>{created.customerName} is on today’s waitlist.</h1><p>The crew can claim the request or propose a scheduled time.</p><div className="booking-v2-complete-actions"><a className="button" href="/staff/waitlist">Open waitlist</a><button className="button button-secondary" type="button" onClick={() => { setCreated(null); setCustomer({ name: '', email: '', phone: '', note: '' }); }}>Add another</button></div></div></div></section>;

  return <section className="section booking-v7-walkin platform-pattern platform-pattern-staff"><div className="container narrow-container"><form className="booking-v2-panel booking-v4-panel" onSubmit={(event) => { event.preventDefault(); submit(); }}><p className="eyebrow">Staff waitlist</p><h1>Add a walk-in customer.</h1><p>Create a same-day request without claiming a chair or time.</p><div className="booking-v2-fields booking-v4-fields"><label className="booking-v2-wide"><span>Service</span><select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>{barberServiceOptions.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.price}</option>)}</select></label><label><span>Name</span><input autoComplete="name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></label><label><span>Email</span><input type="email" autoComplete="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /></label><label><span>Mobile phone</span><input type="tel" autoComplete="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></label><label className="booking-v2-wide"><span>Note <small>Optional</small></span><textarea rows={3} value={customer.note} onChange={(event) => setCustomer({ ...customer, note: event.target.value })} /></label></div>{error ? <p className="form-error" role="alert">{error}</p> : null}<div className="booking-v2-submit-row"><button className="button" type="submit">Add to today’s waitlist</button><a className="button button-secondary" href="/staff/waitlist">Cancel</a></div></form></div></section>;
}
