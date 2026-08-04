import { useEffect, useMemo, useState } from 'react';
import { getPlatformSessionAccount, isValidEmail } from '../data/auth-v2';
import { isValidPhone, normalizePhone } from '../data/auth';
import {
  barberServiceOptions,
  chooseAvailableBarber,
  createAppointmentRequest,
  getAvailableTimeSlots,
  getEligibleBarbers,
  readAppointments,
  readStaffProfiles,
  subscribeToAppointmentChanges,
  type BarberDirectoryEntry,
  type BarberServiceOption,
  type PlatformAppointment,
  type StaffProfile,
  type TimeSlot,
} from '../data/platform';
import { getBookingPath } from '../data/site';

type BookingMode = 'barber' | 'loctician' | null;
type BookingStep = 'service' | 'barber' | 'schedule' | 'details' | 'complete';

type CustomerDetails = {
  name: string;
  email: string;
  phone: string;
  note: string;
};

type DateOption = {
  key: string;
  weekday: string;
  label: string;
};

function todayKey() {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function buildDateOptions(days = 45): DateOption[] {
  const options: DateOption[] = [];
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
  const label = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    if (date.getDay() === 0) continue;
    options.push({ key: date.toISOString().slice(0, 10), weekday: weekday.format(date), label: label.format(date) });
  }
  return options;
}

function barberId(barber: BarberDirectoryEntry) {
  return barber.profile?.id ?? barber.id;
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function visibleTodaySlots(slots: TimeSlot[], dateKey: string) {
  if (dateKey !== todayKey()) return slots;
  const now = new Date();
  const minimum = now.getHours() * 60 + now.getMinutes() + 30;
  return slots.filter((slot) => slot.startMinutes >= minimum);
}

function Progress({ step }: { step: BookingStep }) {
  const steps: Array<[BookingStep, string]> = [
    ['service', 'Service'],
    ['barber', 'Barber'],
    ['schedule', 'Date and time'],
    ['details', 'Details'],
  ];
  const current = steps.findIndex(([value]) => value === step);
  return (
    <ol className="booking-v2-progress" aria-label="Booking progress">
      {steps.map(([value, label], index) => <li className={index === current ? 'is-current' : index < current || step === 'complete' ? 'is-complete' : ''} key={value}><span>{index + 1}</span><small>{label}</small></li>)}
    </ol>
  );
}

function ChoiceScreen({ onBarber }: { onBarber: () => void }) {
  const loctician = getBookingPath('styling');
  return (
    <section className="section booking-v2-entry platform-pattern platform-pattern-tools">
      <div className="container route-wide">
        <header className="booking-v2-entry-header">
          <p className="eyebrow">Book now</p>
          <h1>Choose the service side you need.</h1>
          <p>One clear choice gets you to the right appointment process.</p>
        </header>
        <div className="booking-v2-choice-grid">
          <article>
            <div><p className="eyebrow">Haircuts and grooming</p><h2>Book with a Barber</h2><p>Haircuts, fades, line-ups, beard work, kids cuts and senior services.</p></div>
            <button className="button" type="button" onClick={onBarber}>Book with a Barber</button>
          </article>
          <article>
            <div><p className="eyebrow">Crowned by Steph</p><h2>Book with the Loctician</h2><p>Locs, braids, twists, retwists, consultations and related hair care.</p></div>
            <a className="button button-secondary" href={loctician.href} target="_blank" rel="noopener noreferrer">Book with the Loctician <span aria-hidden="true">↗</span></a>
          </article>
        </div>
      </div>
    </section>
  );
}

export function BookingV2() {
  const account = getPlatformSessionAccount();
  const requestedType = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('type') ?? '';
  const requestedBarber = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('barber') ?? '';
  const [mode, setMode] = useState<BookingMode>(requestedType === 'loctician' ? 'loctician' : requestedBarber ? 'barber' : null);
  const [step, setStep] = useState<BookingStep>('service');
  const [serviceId, setServiceId] = useState('');
  const [selectedBarberId, setSelectedBarberId] = useState(requestedBarber || 'any');
  const [dateKey, setDateKey] = useState('');
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const [waitlist, setWaitlist] = useState(false);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>(() => readStaffProfiles());
  const [appointments, setAppointments] = useState<PlatformAppointment[]>(() => readAppointments());
  const [customer, setCustomer] = useState<CustomerDetails>({ name: account?.name ?? '', email: account?.email ?? '', phone: '', note: '' });
  const [confirmation, setConfirmation] = useState<PlatformAppointment | null>(null);
  const [error, setError] = useState('');
  const dates = useMemo(() => buildDateOptions(), []);
  const service = barberServiceOptions.find((item) => item.id === serviceId) ?? null;
  const barbers = service ? getEligibleBarbers(service.id, staffProfiles) : [];
  const selectedBarber = barbers.find((barber) => barberId(barber) === selectedBarberId) ?? null;
  const availableSlots = service && dateKey
    ? visibleTodaySlots(getAvailableTimeSlots({ service, requestedBarberId: selectedBarberId, date: dateKey, profiles: staffProfiles, appointments }), dateKey)
    : [];
  const sameDayFull = Boolean(service && dateKey === todayKey() && availableSlots.length === 0);

  useEffect(() => subscribeToAppointmentChanges(() => {
    setStaffProfiles(readStaffProfiles());
    setAppointments(readAppointments());
  }), []);

  if (mode === null) return <ChoiceScreen onBarber={() => setMode('barber')} />;
  if (mode === 'loctician') {
    const loctician = getBookingPath('styling');
    return <section className="section booking-v2-entry platform-pattern platform-pattern-tools"><div className="container narrow-container"><div className="booking-v2-confirmation"><p className="eyebrow">Loctician booking</p><h1>Continue with Crowned by Steph.</h1><p>Loc and styling availability remains managed through Steph’s booking system.</p><a className="button" href={loctician.href} target="_blank" rel="noopener noreferrer">Open Steph’s booking site <span aria-hidden="true">↗</span></a><button className="text-button" type="button" onClick={() => setMode(null)}>Back to booking choice</button></div></div></section>;
  }

  const chooseService = (value: BarberServiceOption) => {
    setServiceId(value.id);
    setSelectedBarberId(requestedBarber || 'any');
    setDateKey('');
    setSlot(null);
    setWaitlist(false);
    setStep('barber');
  };

  const chooseBarber = (value: string) => {
    setSelectedBarberId(value);
    setDateKey('');
    setSlot(null);
    setWaitlist(false);
    setStep('schedule');
  };

  const chooseDate = (value: string) => {
    setDateKey(value);
    setSlot(null);
    setWaitlist(false);
    setError('');
  };

  const continueWithSlot = (value: TimeSlot) => {
    setSlot(value);
    setWaitlist(false);
    setStep('details');
  };

  const continueWithWaitlist = () => {
    setSlot(null);
    setWaitlist(true);
    setStep('details');
  };

  const submit = () => {
    if (!service || !dateKey) return;
    if (customer.name.trim().length < 2) return setError('Enter the customer name.');
    if (!isValidEmail(customer.email)) return setError('Enter a valid email address.');
    if (!isValidPhone(customer.phone)) return setError('Enter a valid 10-digit phone number.');
    if (!waitlist && !slot) return setError('Choose an available appointment time.');

    const resolvedBarber = waitlist
      ? selectedBarber
      : chooseAvailableBarber({
          serviceId: service.id,
          requestedBarberId: selectedBarberId,
          date: dateKey,
          startMinutes: slot?.startMinutes ?? 0,
          durationMinutes: service.durationMinutes,
          profiles: staffProfiles,
          appointments,
        });

    if (!waitlist && !resolvedBarber) {
      setAppointments(readAppointments());
      setError('That time was just taken. Choose another available time.');
      setStep('schedule');
      return;
    }

    const resolvedId = resolvedBarber ? barberId(resolvedBarber) : null;
    const time = waitlist ? 'Waiting list' : slot?.label ?? '';
    const startMinutes = waitlist ? 0 : slot?.startMinutes ?? 0;
    const appointment = createAppointmentRequest({
      serviceId: service.id,
      serviceName: service.name,
      price: service.price,
      priceCents: service.priceCents,
      durationMinutes: service.durationMinutes,
      requestedBarberId: selectedBarberId,
      assignedBarberId: resolvedId,
      barberName: resolvedBarber?.name ?? selectedBarber?.name ?? 'Any available barber',
      date: dateKey,
      time,
      startMinutes,
      endMinutes: startMinutes + service.durationMinutes,
      proposedDate: null,
      proposedTime: null,
      proposedStartMinutes: null,
      customerName: customer.name.trim(),
      customerEmail: customer.email.trim().toLowerCase(),
      customerPhone: normalizePhone(customer.phone),
      phoneVerified: false,
      accountPreference: account ? 'account' : 'guest',
      source: waitlist ? 'walk-in' : 'website',
      customerNote: customer.note.trim(),
      staffNote: '',
    });
    setConfirmation(appointment);
    setStep('complete');
    setError('');
  };

  return (
    <section className="section booking-v2-page platform-pattern platform-pattern-tools">
      <div className="container route-wide">
        <header className="booking-v2-header"><div><p className="eyebrow">Barber booking</p><h1>Request your chair.</h1></div><button className="text-button" type="button" onClick={() => setMode(null)}>Change to Loctician</button></header>
        <Progress step={step} />

        {step === 'service' ? <section className="booking-v2-panel"><div className="booking-v2-panel-heading"><p className="eyebrow">Step 1</p><h2>Choose a service</h2></div><div className="booking-v2-service-list">{barberServiceOptions.map((item) => <button type="button" key={item.id} onClick={() => chooseService(item)}><span><small>{item.category}</small><strong>{item.name}</strong></span><span><strong>{item.price}</strong><small>{item.durationMinutes} min</small></span></button>)}</div></section> : null}

        {step === 'barber' && service ? <section className="booking-v2-panel"><div className="booking-v2-panel-heading"><p className="eyebrow">Step 2</p><h2>Choose a barber</h2><p>{service.name} · {service.price} · {service.durationMinutes} minutes</p></div><div className="booking-v2-barber-grid"><button type="button" onClick={() => chooseBarber('any')}><strong>Any available barber</strong><span>Show the earliest open chair.</span></button>{barbers.map((barber) => <button type="button" key={barberId(barber)} onClick={() => chooseBarber(barberId(barber))}><strong>{barber.name}</strong><span>{barber.profile ? 'Uses published staff availability' : 'Uses current shop hours'}</span></button>)}</div><button className="text-button" type="button" onClick={() => setStep('service')}>Back to services</button></section> : null}

        {step === 'schedule' && service ? <section className="booking-v2-panel"><div className="booking-v2-panel-heading"><p className="eyebrow">Step 3</p><h2>Choose a date and time</h2><p>{service.name} with {selectedBarber?.name ?? 'any available barber'}.</p></div><div className="booking-v2-date-strip">{dates.map((date) => <button className={dateKey === date.key ? 'is-selected' : ''} type="button" key={date.key} onClick={() => chooseDate(date.key)}><small>{date.weekday}</small><strong>{date.label}</strong></button>)}</div>{dateKey ? <div className="booking-v2-times"><h3>{formatLongDate(dateKey)}</h3>{availableSlots.length ? <div>{availableSlots.map((value) => <button type="button" key={value.startMinutes} onClick={() => continueWithSlot(value)}>{value.label}</button>)}</div> : <div className="booking-v2-no-times"><strong>No openings match this selection.</strong><p>{sameDayFull ? 'Today is full for the service and barber you selected.' : 'Choose another date or barber to continue.'}</p>{sameDayFull ? <button className="button" type="button" onClick={continueWithWaitlist}>Join today’s waitlist</button> : null}</div>}</div> : <p className="booking-v2-prompt">Select a date to see available times.</p>}<div className="booking-v2-back-row"><button className="text-button" type="button" onClick={() => setStep('barber')}>Back to barbers</button></div></section> : null}

        {step === 'details' && service && dateKey ? <section className="booking-v2-panel"><div className="booking-v2-panel-heading"><p className="eyebrow">Step 4</p><h2>{waitlist ? 'Join today’s waitlist' : 'Review and enter contact details'}</h2><p>{account ? 'Your account name and email were filled in automatically.' : 'You can submit as a guest. An account is not required.'}</p></div><div className="booking-v2-review"><div><small>Service</small><strong>{service.name}</strong></div><div><small>Barber</small><strong>{selectedBarber?.name ?? 'Any available barber'}</strong></div><div><small>Date</small><strong>{formatLongDate(dateKey)}</strong></div><div><small>{waitlist ? 'Status' : 'Time'}</small><strong>{waitlist ? 'Waiting for an opening' : slot?.label}</strong></div><div><small>Price</small><strong>{service.price}</strong></div></div><div className="booking-v2-fields"><label>Name<input autoComplete="name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></label><label>Email<input type="email" autoComplete="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /></label><label>Mobile phone<input type="tel" autoComplete="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></label><label className="booking-v2-wide">Note for the barber <span>Optional</span><textarea rows={4} value={customer.note} onChange={(event) => setCustomer({ ...customer, note: event.target.value })} /></label></div>{error ? <p className="form-error" role="alert">{error}</p> : null}<p className="booking-v2-disclaimer">Submitting sends a request to the shop. It is not confirmed until the barber or shop approves it.</p><div className="booking-v2-submit-row"><button className="text-button" type="button" onClick={() => setStep('schedule')}>Back to date and time</button><button className="button" type="button" onClick={submit}>{waitlist ? 'Join today’s waitlist' : 'Request appointment'}</button></div></section> : null}

        {step === 'complete' && confirmation ? <section className="booking-v2-confirmation"><p className="eyebrow">Request received</p><h2>{confirmation.status === 'waitlisted' ? 'You joined today’s waitlist.' : 'Your appointment request was sent.'}</h2><p>{confirmation.status === 'waitlisted' ? 'A barber can claim the request when an opening becomes available. The shop may also propose another time.' : 'The appointment remains pending until the shop confirms it.'}</p><dl><div><dt>Service</dt><dd>{confirmation.serviceName}</dd></div><div><dt>Barber</dt><dd>{confirmation.barberName}</dd></div><div><dt>Date</dt><dd>{formatLongDate(confirmation.date)}</dd></div><div><dt>Time</dt><dd>{confirmation.time}</dd></div></dl><div className="booking-v2-complete-actions"><a className="button" href="/account">Open Account / Login</a><button className="button button-secondary" type="button" onClick={() => { setStep('service'); setServiceId(''); setDateKey(''); setSlot(null); setWaitlist(false); setConfirmation(null); }}>Book another service</button></div></section> : null}
      </div>
    </section>
  );
}
