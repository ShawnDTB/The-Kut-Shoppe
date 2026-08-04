import { useEffect, useMemo, useState } from 'react';
import { getPlatformSessionAccount, isValidEmail } from '../data/auth-v2';
import { isValidPhone, normalizePhone } from '../data/auth';
import { getCustomerPhone } from '../data/account-profile-v4';
import {
  barberServiceOptions,
  chooseAvailableBarber,
  createAppointmentRequest,
  getAvailableTimeSlots,
  getEligibleBarbers,
  readAppointments,
  readStaffProfiles,
  subscribeToAppointmentChanges,
  updateAppointment,
  type BarberDirectoryEntry,
  type BarberServiceOption,
  type PlatformAppointment,
  type StaffProfile,
  type TimeSlot,
} from '../data/platform';
import { getBookingPath } from '../data/site';

type BookingStep = 'service' | 'barber' | 'schedule' | 'details' | 'complete';

type CustomerDetails = {
  name: string;
  email: string;
  phone: string;
  note: string;
};

type CalendarDay = {
  key: string;
  weekday: string;
  month: string;
  day: string;
  isToday: boolean;
  isClosed: boolean;
};

function todayKey() {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function buildCalendarDays(days = 49): CalendarDay[] {
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' });
  return Array.from({ length: days }, (_, offset) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      weekday: weekday.format(date),
      month: month.format(date),
      day: String(date.getDate()),
      isToday: key === todayKey(),
      isClosed: date.getDay() === 0,
    };
  });
}

function barberId(barber: BarberDirectoryEntry) {
  return barber.profile?.id ?? barber.id;
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

function formatWeekRange(days: CalendarDay[]) {
  const first = days[0];
  const last = days.at(-1);
  if (!first || !last) return 'Upcoming week';
  return first.month === last.month
    ? `${first.month} ${first.day}–${last.day}`
    : `${first.month} ${first.day} – ${last.month} ${last.day}`;
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
    ['schedule', 'Appointment'],
    ['details', 'Details'],
  ];
  const current = steps.findIndex(([value]) => value === step);
  return (
    <ol className="booking-v2-progress booking-v4-progress" aria-label="Booking progress">
      {steps.map(([value, label], index) => (
        <li className={index === current ? 'is-current' : index < current || step === 'complete' ? 'is-complete' : ''} key={value}>
          <span>{index + 1}</span><small>{label}</small>
        </li>
      ))}
    </ol>
  );
}

function BookingGateway() {
  const loctician = getBookingPath('styling');
  return (
    <section className="section booking-gateway-v3 booking-gateway-v4 platform-pattern platform-pattern-booking">
      <div className="container booking-gateway-v3-inner">
        <div className="booking-gateway-v3-heading booking-gateway-v4-heading">
          <p className="eyebrow">Book now</p>
          <h1>Who do you need?</h1>
        </div>
        <div className="booking-gateway-v3-grid">
          <a className="booking-gateway-v3-card booking-gateway-v3-barber" href="/book?barber=any">
            <span className="booking-gateway-v3-icon" aria-hidden="true">✂</span>
            <div><p className="eyebrow">Haircuts and grooming</p><h2>Barber</h2><p>Choose a service, barber, date, and available time.</p></div>
            <strong>Book with a Barber <span aria-hidden="true">→</span></strong>
          </a>
          <a className="booking-gateway-v3-card booking-gateway-v3-loctician" href={loctician.href} target="_blank" rel="noopener noreferrer">
            <span className="booking-gateway-v3-icon" aria-hidden="true">CS</span>
            <div><p className="eyebrow">Crowned by Steph</p><h2>Loctician</h2><p>Continue to Steph’s loc, braid, twist, and retwist availability.</p></div>
            <strong>Book with the Loctician <span aria-hidden="true">↗</span></strong>
          </a>
        </div>
      </div>
    </section>
  );
}

export function BookingV4() {
  const account = getPlatformSessionAccount();
  const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const requestedType = params.get('type') ?? '';
  const requestedBarber = params.get('barber') ?? '';
  const appointmentId = params.get('appointment') ?? '';
  const initialAppointment = appointmentId
    ? readAppointments().find((appointment) => appointment.id === appointmentId) ?? null
    : null;
  const ownsAppointment = Boolean(initialAppointment && account && initialAppointment.customerEmail === account.email);
  const editingAppointment = ownsAppointment ? initialAppointment : null;
  const calendarDays = useMemo(() => buildCalendarDays(), []);
  const editingDayIndex = editingAppointment
    ? Math.max(0, calendarDays.findIndex((day) => day.key === editingAppointment.date))
    : 0;

  const [step, setStep] = useState<BookingStep>(editingAppointment ? 'schedule' : 'service');
  const [serviceId, setServiceId] = useState(editingAppointment?.serviceId ?? '');
  const [selectedBarberId, setSelectedBarberId] = useState((editingAppointment?.requestedBarberId ?? requestedBarber) || 'any');
  const [dateKey, setDateKey] = useState(editingAppointment?.date ?? '');
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const [waitlist, setWaitlist] = useState(false);
  const [weekStart, setWeekStart] = useState(Math.floor(editingDayIndex / 7) * 7);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>(() => readStaffProfiles());
  const [appointments, setAppointments] = useState<PlatformAppointment[]>(() => readAppointments());
  const [customer, setCustomer] = useState<CustomerDetails>({
    name: editingAppointment?.customerName ?? account?.name ?? '',
    email: editingAppointment?.customerEmail ?? account?.email ?? '',
    phone: editingAppointment?.customerPhone ?? (account ? getCustomerPhone(account) : ''),
    note: editingAppointment?.customerNote ?? '',
  });
  const [confirmation, setConfirmation] = useState<PlatformAppointment | null>(null);
  const [error, setError] = useState('');

  const service = barberServiceOptions.find((item) => item.id === serviceId) ?? null;
  const barbers = service ? getEligibleBarbers(service.id, staffProfiles) : [];
  const selectedBarber = barbers.find((barber) => barberId(barber) === selectedBarberId || barber.id === selectedBarberId) ?? null;
  const visibleDays = calendarDays.slice(weekStart, weekStart + 7);

  const slotsForDate = (value: string) => service
    ? visibleTodaySlots(getAvailableTimeSlots({
        service,
        requestedBarberId: selectedBarberId,
        date: value,
        profiles: staffProfiles,
        appointments,
      }), value)
    : [];

  const availableSlots = service && dateKey ? slotsForDate(dateKey) : [];
  const sameDayFull = Boolean(service && dateKey === todayKey() && availableSlots.length === 0);

  useEffect(() => subscribeToAppointmentChanges(() => {
    setStaffProfiles(readStaffProfiles());
    setAppointments(readAppointments());
  }), []);

  if (!params.toString()) return <BookingGateway />;

  if (requestedType === 'loctician') {
    const loctician = getBookingPath('styling');
    return (
      <section className="section booking-v2-entry platform-pattern platform-pattern-booking">
        <div className="container narrow-container">
          <a className="booking-v4-top-back" href="/book"><span aria-hidden="true">←</span> Back to booking</a>
          <div className="booking-v2-confirmation"><p className="eyebrow">Loctician booking</p><h1>Continue with Crowned by Steph.</h1><p>Loc and styling availability remains managed through Steph’s booking system.</p><a className="button" href={loctician.href} target="_blank" rel="noopener noreferrer">Open Steph’s booking site <span aria-hidden="true">↗</span></a></div>
        </div>
      </section>
    );
  }

  if (appointmentId && !ownsAppointment) {
    return (
      <section className="section booking-v2-entry platform-pattern platform-pattern-booking">
        <div className="container narrow-container"><div className="booking-v2-confirmation"><p className="eyebrow">Account required</p><h1>This appointment cannot be changed here.</h1><p>Sign in with the customer account attached to the appointment, or call the shop for help.</p><div className="booking-v2-complete-actions"><a className="button" href="/account">Account / Login</a><a className="button button-secondary" href="tel:+15704215887">Call the shop</a></div></div></div>
      </section>
    );
  }

  const chooseService = (value: BarberServiceOption) => {
    setServiceId(value.id);
    setSelectedBarberId(requestedBarber || 'any');
    setDateKey('');
    setSlot(null);
    setWaitlist(false);
    setWeekStart(0);
    setStep('barber');
  };

  const chooseBarber = (value: string) => {
    setSelectedBarberId(value);
    setDateKey('');
    setSlot(null);
    setWaitlist(false);
    setWeekStart(0);
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

  const back = () => {
    if (step === 'service') window.location.assign('/book');
    else if (step === 'barber') setStep('service');
    else if (step === 'schedule') editingAppointment ? window.location.assign('/account') : setStep('barber');
    else if (step === 'details') setStep('schedule');
    else window.location.assign('/account');
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
          appointments: editingAppointment
            ? appointments.filter((appointment) => appointment.id !== editingAppointment.id)
            : appointments,
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
    const shared = {
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
      customerNote: customer.note.trim(),
    };

    const appointment = editingAppointment
      ? updateAppointment(editingAppointment.id, {
          ...shared,
          status: waitlist ? 'waitlisted' : 'requested',
          clientResponse: null,
          source: waitlist ? 'walk-in' : 'website',
        })
      : createAppointmentRequest({
          serviceId: service.id,
          serviceName: service.name,
          price: service.price,
          priceCents: service.priceCents,
          durationMinutes: service.durationMinutes,
          ...shared,
          phoneVerified: false,
          accountPreference: account ? 'account' : 'guest',
          source: waitlist ? 'walk-in' : 'website',
          staffNote: '',
        });

    if (!appointment) return setError('The appointment could not be updated. Call the shop for help.');
    setConfirmation(appointment);
    setStep('complete');
    setError('');
  };

  return (
    <section className="section booking-v2-page booking-v4-page platform-pattern platform-pattern-booking">
      <div className="container route-wide">
        <div className="booking-v4-top-row">
          <button className="booking-v4-top-back" type="button" onClick={back}><span aria-hidden="true">←</span> Back</button>
          {!editingAppointment ? <a className="text-link" href="/book?type=loctician">Book with the Loctician <span aria-hidden="true">↗</span></a> : null}
        </div>
        <header className="booking-v2-header booking-v4-header"><div><p className="eyebrow">{editingAppointment ? 'Change appointment' : 'Barber booking'}</p><h1>{editingAppointment ? 'Choose a new opening.' : 'Request your chair.'}</h1></div></header>
        <Progress step={step} />

        {step === 'service' ? (
          <section className="booking-v2-panel booking-v4-panel">
            <div className="booking-v2-panel-heading"><h2>Choose a service</h2></div>
            <div className="booking-v2-service-list">{barberServiceOptions.map((item) => <button type="button" key={item.id} onClick={() => chooseService(item)}><span><small>{item.category}</small><strong>{item.name}</strong></span><span><strong>{item.price}</strong><small>{item.durationMinutes} min</small></span></button>)}</div>
          </section>
        ) : null}

        {step === 'barber' && service ? (
          <section className="booking-v2-panel booking-v4-panel">
            <div className="booking-v2-panel-heading"><h2>Choose your barber</h2><p>{service.name} · {service.price} · {service.durationMinutes} minutes</p></div>
            <div className="booking-v2-barber-grid"><button type="button" onClick={() => chooseBarber('any')}><strong>Any available barber</strong><span>Show the earliest open chair.</span></button>{barbers.map((barber) => <button type="button" key={barberId(barber)} onClick={() => chooseBarber(barberId(barber))}><strong>{barber.name.replace(/\.$/, '')}</strong><span>{barber.profile ? 'Uses published availability' : 'Uses current shop hours'}</span></button>)}</div>
          </section>
        ) : null}

        {step === 'schedule' && service ? (
          <section className="booking-v2-panel booking-v4-panel booking-v4-schedule">
            <div className="booking-v2-panel-heading"><h2>Appointment date and time</h2><p>{service.name} with {selectedBarber?.name.replace(/\.$/, '') ?? 'any available barber'}.</p></div>
            <div className="booking-v4-calendar">
              <div className="booking-v4-calendar-toolbar">
                <button type="button" disabled={weekStart === 0} onClick={() => setWeekStart((value) => Math.max(0, value - 7))} aria-label="Previous week">←</button>
                <strong>{formatWeekRange(visibleDays)}</strong>
                <button type="button" disabled={weekStart + 7 >= calendarDays.length} onClick={() => setWeekStart((value) => Math.min(calendarDays.length - 7, value + 7))} aria-label="Next week">→</button>
              </div>
              <div className="booking-v4-week" role="group" aria-label={formatWeekRange(visibleDays)}>
                {visibleDays.map((day) => {
                  const openings = day.isClosed ? [] : slotsForDate(day.key);
                  const status = day.isClosed ? 'Closed' : openings.length ? 'Open' : 'Full';
                  return (
                    <button
                      className={dateKey === day.key ? 'is-selected' : ''}
                      type="button"
                      key={day.key}
                      disabled={day.isClosed}
                      aria-pressed={dateKey === day.key}
                      onClick={() => chooseDate(day.key)}
                    >
                      <small>{day.isToday ? 'Today' : day.weekday}</small>
                      <strong>{day.day}</strong>
                      <span>{day.month}</span>
                      <em>{status}</em>
                    </button>
                  );
                })}
              </div>
            </div>

            {dateKey ? (
              <div className="booking-v2-times booking-v4-times">
                <h3>{formatLongDate(dateKey)}</h3>
                {availableSlots.length ? <div>{availableSlots.map((value) => <button type="button" key={value.startMinutes} onClick={() => continueWithSlot(value)}>{value.label}</button>)}</div> : <div className="booking-v2-no-times"><strong>No openings match this selection.</strong><p>{sameDayFull ? 'Today is full for the service and barber you selected.' : 'Choose another day or barber to continue.'}</p>{sameDayFull ? <button className="button" type="button" onClick={continueWithWaitlist}>Join today’s waitlist</button> : null}</div>}
              </div>
            ) : <p className="booking-v2-prompt">Choose a day to view available appointment times.</p>}
          </section>
        ) : null}

        {step === 'details' && service && dateKey ? (
          <section className="booking-v2-panel booking-v4-panel">
            <div className="booking-v2-panel-heading"><h2>{waitlist ? 'Join today’s waitlist' : 'Review your appointment'}</h2><p>{editingAppointment ? 'Submit the new opening for shop approval.' : account ? 'Your account information was filled in automatically.' : 'An account is not required.'}</p></div>
            <div className="booking-v2-review"><div><small>Service</small><strong>{service.name}</strong></div><div><small>Barber</small><strong>{selectedBarber?.name.replace(/\.$/, '') ?? 'Any available barber'}</strong></div><div><small>Date</small><strong>{formatLongDate(dateKey)}</strong></div><div><small>{waitlist ? 'Status' : 'Time'}</small><strong>{waitlist ? 'Waiting for an opening' : slot?.label}</strong></div><div><small>Price</small><strong>{service.price}</strong></div></div>
            <div className="booking-v2-fields booking-v4-fields"><label><span>Name</span><input autoComplete="name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></label><label><span>Email</span><input type="email" autoComplete="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /></label><label><span>Mobile phone</span><input type="tel" autoComplete="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></label><label className="booking-v2-wide"><span>Note for the barber <small>Optional</small></span><textarea rows={4} value={customer.note} onChange={(event) => setCustomer({ ...customer, note: event.target.value })} /></label></div>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <p className="booking-v2-disclaimer">Submitting sends a request to the shop. It is not confirmed until the barber or shop approves it.</p>
            <div className="booking-v2-submit-row"><button className="button" type="button" onClick={submit}>{editingAppointment ? 'Request appointment change' : waitlist ? 'Join today’s waitlist' : 'Request appointment'}</button></div>
          </section>
        ) : null}

        {step === 'complete' && confirmation ? (
          <section className="booking-v2-confirmation"><p className="eyebrow">Request received</p><h2>{editingAppointment ? 'Your change request was sent.' : confirmation.status === 'waitlisted' ? 'You joined today’s waitlist.' : 'Your appointment request was sent.'}</h2><p>{confirmation.status === 'waitlisted' ? 'A barber can claim the request when an opening becomes available.' : 'The appointment remains pending until the shop confirms it.'}</p><dl><div><dt>Service</dt><dd>{confirmation.serviceName}</dd></div><div><dt>Barber</dt><dd>{confirmation.barberName.replace(/\.$/, '')}</dd></div><div><dt>Date</dt><dd>{formatLongDate(confirmation.date)}</dd></div><div><dt>Time</dt><dd>{confirmation.time}</dd></div></dl><div className="booking-v2-complete-actions"><a className="button" href="/account">Open your account</a><a className="button button-secondary" href="/book">Book another service</a></div></section>
        ) : null}
      </div>
    </section>
  );
}
