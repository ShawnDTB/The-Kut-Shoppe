import type { FormEvent } from 'react';
import { getPlatformSessionAccount } from '../data/auth-v2';
import { barberServiceOptions, createAppointmentRequest } from '../data/platform';
import { BookingV6 } from './BookingV6';

export function BookingV7() {
  const editing = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('appointment');
  if (!editing) return <BookingV6 />;
  return <section className="section platform-pattern platform-pattern-booking"><div className="container narrow-container"><div className="booking-v2-confirmation"><p className="eyebrow">Appointment protection</p><h1>Online changes are paused.</h1><p>Your appointment was not changed. Call the shop for another opening.</p><div className="booking-v2-complete-actions"><a className="button" href="/account?view=appointments">Appointments</a><a className="button button-secondary" href="tel:+15704215887">Call 570-421-5887</a></div></div></div></section>;
}

export function WalkInEntryV7() {
  const account = getPlatformSessionAccount();
  if (!account || account.role === 'customer') return <section className="section platform-pattern platform-pattern-staff"><div className="container narrow-container"><div className="staff-empty-state"><p className="eyebrow">Staff access required</p><h1>Sign in to add a walk-in.</h1><a className="button" href="/account">Account / Login</a></div></div></section>;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const service = barberServiceOptions.find((item) => item.id === data.get('service'))!;
    const phone = String(data.get('phone')).replace(/\D/g, '').slice(-10);
    createAppointmentRequest({ serviceId: service.id, serviceName: service.name, price: service.price, priceCents: service.priceCents, durationMinutes: service.durationMinutes, requestedBarberId: 'any', assignedBarberId: null, barberName: 'Any available barber', date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()), time: 'Waiting list', startMinutes: 0, endMinutes: service.durationMinutes, proposedDate: null, proposedTime: null, proposedStartMinutes: null, customerName: String(data.get('name')).trim(), customerEmail: String(data.get('email')).trim().toLowerCase(), customerPhone: phone, phoneVerified: false, accountPreference: 'guest', source: 'walk-in', customerNote: '', staffNote: `Added by ${account.name}` });
    window.location.assign('/staff/waitlist');
  };

  return <section className="section platform-pattern platform-pattern-staff"><div className="container narrow-container"><form className="booking-v2-panel booking-v4-panel" onSubmit={submit}><p className="eyebrow">Staff waitlist</p><h1>Add a walk-in customer.</h1><div className="booking-v2-fields booking-v4-fields"><label className="booking-v2-wide"><span>Service</span><select name="service" defaultValue={barberServiceOptions[0]?.id}>{barberServiceOptions.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.price}</option>)}</select></label><label><span>Name</span><input name="name" autoComplete="name" minLength={2} required /></label><label><span>Email</span><input name="email" type="email" autoComplete="email" required /></label><label><span>Mobile phone</span><input name="phone" type="tel" autoComplete="tel" minLength={10} required /></label></div><div className="booking-v2-submit-row"><button className="button" type="submit">Add to waitlist</button><a className="button button-secondary" href="/staff/waitlist">Cancel</a></div></form></div></section>;
}
