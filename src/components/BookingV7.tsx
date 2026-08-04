import { useEffect, useMemo, useState } from 'react';
import { getPlatformSessionAccount, isValidEmail } from '../data/auth-v2';
import { isValidPhone, normalizePhone } from '../data/auth';
import { getCustomerProfileV5 } from '../data/account-profile-v5';
import {
  barberServiceOptions,
  createAppointmentRequest,
  getAvailableTimeSlots,
  getEligibleBarbers,
  getScheduleForBarber,
  getWindowForDate,
  hasAppointmentConflict,
  readAppointments,
  readStaffProfiles,
  subscribeToAppointmentChanges,
  timeValueToMinutes,
  updateAppointment,
  type BarberDirectoryEntry,
  type BarberServiceOption,
  type PlatformAppointment,
  type StaffProfile,
  type TimeSlot,
} from '../data/platform';
import { getBookingPath } from '../data/site';

type BookingStep = 'service' | 'barber' | 'schedule' | 'details' | 'complete';
type CustomerDetails = { name: string; email: string; phone: string; note: string };
type CalendarDay = { key: string; weekday: string; month: string; day: string; isToday: boolean };

const shopTimeZone = 'America/New_York';
const fallbackBookingWindowDays = 30;

function shopParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: shopTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function todayKey() {
  const parts = shopParts();
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function shopMinutesNow() {
  const parts = shopParts();
  return Number(parts.hour ?? 0) * 60 + Number(parts.minute ?? 0);
}

function dateFromKey(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

function dateOffsetFromToday(value: string) {
  return Math.round((dateFromKey(value).getTime() - dateFromKey(todayKey()).getTime()) / 86_400_000);
}

function buildCalendarDays(days: number): CalendarDay[] {
  const safeDays = Math.max(1, Math.min(90, days));
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: shopTimeZone, weekday: 'short' });
  const month = new Intl.DateTimeFormat('en-US', { timeZone: shopTimeZone, month: 'short' });
  const start = dateFromKey(todayKey());
  return Array.from({ length: safeDays }, (_, offset) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + offset);
    const key = date.toISOString().slice(0, 10);
    return { key, weekday: weekday.format(date), month: month.format(date), day: String(date.getUTCDate()), isToday: key === todayKey() };
  });
}

function barberId(barber: BarberDirectoryEntry) {
  return barber.profile?.id ?? barber.id;
}

function cleanBarberName(value: string) {
  return value.replace(/\.$/, '');
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: shopTimeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(dateFromKey(value));
}

function formatWeekRange(days: CalendarDay[]) {
  const first = days[0];
  const last = days.at(-1);
  if (!first || !last) return 'Upcoming dates';
  return first.month === last.month ? `${first.month} ${first.day}–${last.day}` : `${first.month} ${first.day} – ${last.month} ${last.day}`;
}

function matchingBarbers(serviceId: string, requestedBarberId: string, profiles: StaffProfile[]) {
  return getEligibleBarbers(serviceId, profiles).filter((barber) => {
    const id = barberId(barber);
    if (requestedBarberId !== 'any') return id === requestedBarberId || barber.id === requestedBarberId;
    return barber.profile?.bookingRules.allowAnyAvailable ?? true;
  });
}

function bookingWindowForSelection(serviceId: string, requestedBarberId: string, profiles: StaffProfile[]) {
  if (!serviceId) return fallbackBookingWindowDays;
  const windows = matchingBarbers(serviceId, requestedBarberId, profiles)
    .map((barber) => barber.profile?.bookingRules.bookingWindowDays ?? fallbackBookingWindowDays);
  return windows.length ? Math.max(...windows) : fallbackBookingWindowDays;
}

function barberAcceptsSlot(barber: BarberDirectoryEntry, date: string, slot: TimeSlot) {
  const offset = dateOffsetFromToday(date);
  const bookingWindow = barber.profile?.bookingRules.bookingWindowDays ?? fallbackBookingWindowDays;
  if (offset < 0 || offset >= bookingWindow) return false;
  if (date !== todayKey()) return true;
  return slot.startMinutes >= shopMinutesNow() + (barber.profile?.bookingRules.minimumNoticeHours ?? 0) * 60;
}

function availableBarbersForSlot(input: {
  service: BarberServiceOption;
  requestedBarberId: string;
  date: string;
  slot: TimeSlot;
  profiles: StaffProfile[];
  appointments: PlatformAppointment[];
}) {
  return matchingBarbers(input.service.id, input.requestedBarberId, input.profiles).filter((barber) => {
    if (!barberAcceptsSlot(barber, input.date, input.slot)) return false;
    const window = getWindowForDate(input.date, getScheduleForBarber(barber));
    if (!window?.enabled) return false;
    const start = timeValueToMinutes(window.start);
    const end = timeValueToMinutes(window.end);
    if (input.slot.startMinutes < start || input.slot.endMinutes > end) return false;
    return !hasAppointmentConflict(barberId(barber), input.date, input.slot.startMinutes, input.slot.endMinutes, input.appointments);
  });
}

function dayAcceptsAppointments(serviceId: string, requestedBarberId: string, date: string, profiles: StaffProfile[]) {
  return matchingBarbers(serviceId, requestedBarberId, profiles)
    .some((barber) => getWindowForDate(date, getScheduleForBarber(barber))?.enabled);
}

function Progress({ step }: { step: BookingStep }) {
  const steps: Array<[BookingStep, string]> = [['service', 'Service'], ['barber', 'Barber'], ['schedule', 'Appointment'], ['details', 'Details']];
  const current = steps.findIndex(([value]) => value === step);
  return <ol className="booking-v2-progress booking-v4-progress" aria-label="Booking progress">{steps.map(([value, label], index) => <li className={index === current ? 'is-current' : index < current || step === 'complete' ? 'is-complete' : ''} key={value}><span>{index + 1}</span><small>{label}</small></li>)}</ol>;
}

function PanelToolbar({ onBack, showLoctician = true }: { onBack: () => void; showLoctician?: boolean }) {
  const loctician = getBookingPath('styling');
  return <div className="booking-v5-panel-toolbar"><button className="text-button" type="button" onClick={onBack}><span aria-hidden="true">←</span> Back</button>{showLoctician ? <a className="text-link" href={loctician.href} target="_blank" rel="noopener noreferrer">Book with the Loctician <span aria-hidden="true">↗</span></a> : null}</div>;
}

function BookingGateway() {
  const loctician = getBookingPath('styling');
  return <section className="section booking-gateway-v3 booking-gateway-v4 booking-gateway-v6 platform-pattern platform-pattern-booking"><div className="container booking-gateway-v3-inner"><div className="booking-gateway-v3-heading booking-gateway-v4-heading"><h1>Who do you need?</h1></div><div className="booking-gateway-v3-grid"><a className="booking-gateway-v3-card booking-gateway-v3-barber" href="/book?barber=any"><span className="booking-gateway-v3-icon" aria-hidden="true">✂</span><div><p className="eyebrow">Haircuts and grooming</p><h2>Barber</h2><p>Choose a service, Barber, date, and available time.</p></div><strong>Book with a Barber <span aria-hidden="true">→</span></strong></a><a className="booking-gateway-v3-card booking-gateway-v3-loctician" href={loctician.href} target="_blank" rel="noopener noreferrer"><span className="booking-gateway-v3-icon" aria-hidden="true">CS</span><div><p className="eyebrow">Crowned by Steph</p><h2>Loctician</h2><p>Continue to Steph’s loc, braid, twist, and retwist availability.</p></div><strong>Book with the Loctician <span aria-hidden="true">↗</span></strong></a></div></div></section>;
}

function AppointmentChangeHold() {
  return <section className="section booking-v7-safety platform-pattern platform-pattern-booking"><div className="container narrow-container"><div className="booking-v2-confirmation"><p className="eyebrow">Appointment protection</p><h1>Online appointment changes are temporarily paused.</h1><p>Your current appointment has not been changed. The previous prototype could replace an approved time before the shop reviewed the request, so this route is disabled until protected change requests are stored separately.</p><div className="booking-v2-complete-actions"><a className="button" href="/account?view=appointments">Return to appointments</a><a className="button button-secondary" href="tel:+15704215887">Call 570-421-5887</a></div></div></div></section>;
}

export function BookingV7() {
  const account = getPlatformSessionAccount();
  const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const requestedType = params.get('type') ?? '';
  const requestedBarber = params.get('barber') ?? '';
  const profile = account ? getCustomerProfileV5(account) : null;

  const [step, setStep] = useState<BookingStep>('service');
  const [serviceId, setServiceId] = useState('');
  const [selectedBarberId, setSelectedBarberId] = useState(requestedBarber || 'any');
  const [dateKey, setDateKey] = useState('');
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const [candidateBarbers, setCandidateBarbers] = useState<BarberDirectoryEntry[]>([]);
  const [waitlist, setWaitlist] = useState(false);
  const [weekStart, setWeekStart] = useState(0);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>(() => readStaffProfiles());
  const [appointments, setAppointments] = useState<PlatformAppointment[]>(() => readAppointments());
  const [customer, setCustomer] = useState<CustomerDetails>({ name: account?.name ?? '', email: account?.email ?? '', phone: profile?.phone ?? '', note: '' });
  const [confirmation, setConfirmation] = useState<PlatformAppointment | null>(null);
  const [error, setError] = useState('');

  const service = barberServiceOptions.find((item) => item.id === serviceId) ?? null;
  const barbers = service ? getEligibleBarbers(service.id, staffProfiles) : [];
  const selectedBarber = barbers.find((barber) => barberId(barber) === selectedBarberId || barber.id === selectedBarberId) ?? null;
  const calendarWindowDays = useMemo(() => bookingWindowForSelection(serviceId, selectedBarberId, staffProfiles), [selectedBarberId, serviceId, staffProfiles]);
  const calendarDays = useMemo(() => buildCalendarDays(calendarWindowDays), [calendarWindowDays]);
  const effectiveWeekStart = Math.min(weekStart, Math.max(0, calendarDays.length - 7));
  const visibleDays = calendarDays.slice(effectiveWeekStart, effectiveWeekStart + 7);

  const slotsForDate = (value: string) => {
    if (!service) return [];
    return getAvailableTimeSlots({ service, requestedBarberId: selectedBarberId, date: value, profiles: staffProfiles, appointments })
      .filter((candidate) => availableBarbersForSlot({ service, requestedBarberId: selectedBarberId, date: value, slot: candidate, profiles: staffProfiles, appointments }).length > 0);
  };

  const availableSlots = service && dateKey ? slotsForDate(dateKey) : [];
  const sameDayFull = Boolean(service && dateKey === todayKey() && availableSlots.length === 0);
  const canJoinWaitlist = Boolean(service && sameDayFull && matchingBarbers(service.id, selectedBarberId, staffProfiles).some((barber) => barber.profile?.bookingRules.acceptsWalkIns ?? true));

  useEffect(() => subscribeToAppointmentChanges(() => {
    setStaffProfiles(readStaffProfiles());
    setAppointments(readAppointments());
  }), []);

  if (params.has('appointment')) return <AppointmentChangeHold />;
  if (!params.toString()) return <BookingGateway />;

  if (requestedType === 'loctician') {
    const loctician = getBookingPath('styling');
    return <section className="section booking-v2-entry platform-pattern platform-pattern-booking"><div className="container narrow-container"><div className="booking-v2-confirmation"><PanelToolbar onBack={() => window.location.assign('/book')} showLoctician={false} /><p className="eyebrow">Loctician booking</p><h1>Continue with Crowned by Steph.</h1><p>Loc and styling availability remains managed through Steph’s booking system.</p><a className="button" href={loctician.href} target="_blank" rel="noopener noreferrer">Open Steph’s booking site <span aria-hidden="true">↗</span></a></div></div></section>;
  }

  const chooseService = (value: BarberServiceOption) => {
    setServiceId(value.id); setSelectedBarberId(requestedBarber || 'any'); setDateKey(''); setSlot(null); setCandidateBarbers([]); setWaitlist(false); setWeekStart(0); setError(''); setStep('barber');
  };
  const chooseBarber = (value: string) => {
    setSelectedBarberId(value); setDateKey(''); setSlot(null); setCandidateBarbers([]); setWaitlist(false); setWeekStart(0); setError(''); setStep('schedule');
  };
  const chooseDate = (value: string) => {
    setDateKey(value); setSlot(null); setCandidateBarbers([]); setWaitlist(false); setError('');
  };
  const back = () => {
    setError('');
    if (step === 'service') window.location.assign('/book');
    else if (step === 'barber') setStep('service');
    else if (step === 'schedule') setStep('barber');
    else if (step === 'details') setStep('schedule');
    else window.location.assign('/account?view=appointments');
  };
  const continueWithSlot = (value: TimeSlot) => {
    if (!service || !dateKey) return;
    const candidates = availableBarbersForSlot({ service, requestedBarberId: selectedBarberId, date: dateKey, slot: value, profiles: staffProfiles, appointments });
    if (!candidates.length) {
      setError('That opening was just taken or no longer meets the selected Barber’s booking rules. Choose another time.');
      setAppointments(readAppointments());
      return;
    }
    setSlot(value); setWaitlist(false); setError('');
    if (selectedBarberId !== 'any' || candidates.length === 1) {
      setSelectedBarberId(barberId(candidates[0]!)); setCandidateBarbers([]); setStep('details');
    } else setCandidateBarbers(candidates);
  };
  const continueWithWaitlist = () => {
    setSlot(null); setCandidateBarbers([]); setWaitlist(true); setError(''); setStep('details');
  };
  const submit = () => {
    if (!service || !dateKey) return;
    if (customer.name.trim().length < 2) return setError('Enter the customer name.');
    if (!isValidEmail(customer.email)) return setError('Enter a valid email address.');
    if (!isValidPhone(customer.phone)) return setError('Enter a valid 10-digit phone number.');
    if (!waitlist && !slot) return setError('Choose an available appointment time.');

    const resolvedBarber = waitlist ? null : availableBarbersForSlot({ service, requestedBarberId: selectedBarberId, date: dateKey, slot: slot!, profiles: staffProfiles, appointments })[0] ?? null;
    if (!waitlist && !resolvedBarber) {
      setError('That opening is no longer available. Choose another time.'); setStep('schedule'); setAppointments(readAppointments()); return;
    }
    const startMinutes = waitlist ? 0 : slot!.startMinutes;
    const appointment = createAppointmentRequest({
      serviceId: service.id,
      serviceName: service.name,
      price: service.price,
      priceCents: service.priceCents,
      durationMinutes: service.durationMinutes,
      requestedBarberId: selectedBarberId,
      assignedBarberId: resolvedBarber ? barberId(resolvedBarber) : null,
      barberName: resolvedBarber?.name ?? selectedBarber?.name ?? 'Any available barber',
      date: dateKey,
      time: waitlist ? 'Waiting list' : slot!.label,
      startMinutes,
      endMinutes: startMinutes + service.durationMinutes,
      proposedDate: null,
      proposedTime: null,
      proposedStartMinutes: null,
      customerName: customer.name.trim(),
      customerEmail: customer.email.trim().toLowerCase(),
      customerPhone: normalizePhone(customer.phone),
      phoneVerified: Boolean(profile?.phoneVerified),
      accountPreference: account ? 'account' : 'guest',
      source: waitlist ? 'walk-in' : 'website',
      customerNote: customer.note.trim(),
      staffNote: '',
    });
    setConfirmation(appointment); setStep('complete'); setError('');
  };
  const cancelConfirmation = () => {
    if (!confirmation) return;
    updateAppointment(confirmation.id, { status: 'cancelled' });
    window.location.assign('/account?view=appointments');
  };

  return <section className="section booking-v2-page booking-v4-page booking-v5-page booking-v6-page booking-v7-page platform-pattern platform-pattern-booking"><div className="container route-wide"><h1 className="sr-only">Book a Barber appointment</h1><Progress step={step} />
    {step === 'service' ? <section className="booking-v2-panel booking-v4-panel"><PanelToolbar onBack={back} /><div className="booking-v2-panel-heading"><h2>Choose a service</h2></div><div className="booking-v2-service-list">{barberServiceOptions.map((item) => <button type="button" key={item.id} onClick={() => chooseService(item)}><span><small>{item.category}</small><strong>{item.name}</strong></span><span><strong>{item.price}</strong><small>{item.durationMinutes} min</small></span></button>)}</div></section> : null}
    {step === 'barber' && service ? <section className="booking-v2-panel booking-v4-panel"><PanelToolbar onBack={back} /><div className="booking-v2-panel-heading"><h2>Choose your Barber</h2><p>{service.name} · {service.price} · {service.durationMinutes} minutes</p></div><div className="booking-v2-barber-grid"><button type="button" onClick={() => chooseBarber('any')}><strong>Any available Barber</strong><span>Compare every eligible chair for the selected opening.</span></button>{barbers.map((barber) => <button type="button" key={barberId(barber)} onClick={() => chooseBarber(barberId(barber))}><strong>{cleanBarberName(barber.name)}</strong><span>{barber.profile ? 'Uses published availability' : 'Uses current shop hours'}</span></button>)}</div></section> : null}
    {step === 'schedule' && service ? <section className="booking-v2-panel booking-v4-panel booking-v4-schedule"><PanelToolbar onBack={back} /><div className="booking-v2-panel-heading"><h2>Choose a date and time</h2><p>{service.name} with {selectedBarber ? cleanBarberName(selectedBarber.name) : 'any available Barber'}.</p><small className="booking-v6-timezone">Times are shown in Eastern Time. Each Barber’s booking window and minimum notice are applied automatically.</small></div><div className="booking-v4-calendar"><div className="booking-v4-calendar-toolbar"><button type="button" disabled={effectiveWeekStart === 0} onClick={() => setWeekStart(Math.max(0, effectiveWeekStart - 7))} aria-label="Previous week">←</button><strong>{formatWeekRange(visibleDays)}</strong><button type="button" disabled={effectiveWeekStart + 7 >= calendarDays.length} onClick={() => setWeekStart(Math.min(Math.max(0, calendarDays.length - 7), effectiveWeekStart + 7))} aria-label="Next week">→</button></div><div className="booking-v4-week" role="group" aria-label={formatWeekRange(visibleDays)}>{visibleDays.map((day) => { const openDay = dayAcceptsAppointments(service.id, selectedBarberId, day.key, staffProfiles); const openings = openDay ? slotsForDate(day.key) : []; const status = !openDay ? 'Closed' : openings.length ? 'Open' : 'Full'; return <button className={dateKey === day.key ? 'is-selected' : ''} type="button" key={day.key} disabled={!openDay} aria-pressed={dateKey === day.key} aria-label={`${formatLongDate(day.key)}. ${status}.`} onClick={() => chooseDate(day.key)}><small>{day.isToday ? 'Today' : day.weekday}</small><strong>{day.day}</strong><span>{day.month}</span><em>{status}</em></button>; })}</div></div>{dateKey ? <div className="booking-v2-times booking-v4-times"><h3>{formatLongDate(dateKey)}</h3>{availableSlots.length ? <div>{availableSlots.map((value) => <button type="button" key={value.startMinutes} onClick={() => continueWithSlot(value)}>{value.label}</button>)}</div> : <div className="booking-v2-no-times"><strong>No openings match this selection.</strong><p>{sameDayFull ? 'Today has no remaining online openings for the selected service and Barber rules.' : 'Choose another day or Barber to continue.'}</p>{canJoinWaitlist ? <button className="button" type="button" onClick={continueWithWaitlist}>Join today’s waitlist</button> : null}</div>}</div> : <p className="booking-v2-prompt">Choose a day to view available appointment times.</p>}{candidateBarbers.length && slot ? <div className="booking-v5-candidate-picker"><p className="eyebrow">Multiple chairs are open at {slot.label}</p><h3>Choose the Barber for this opening</h3><div>{candidateBarbers.map((barber) => <button type="button" key={barberId(barber)} onClick={() => { setSelectedBarberId(barberId(barber)); setCandidateBarbers([]); setStep('details'); }}><strong>{cleanBarberName(barber.name)}</strong><span>{slot.label}</span></button>)}</div></div> : null}{error ? <p className="form-error" role="alert">{error}</p> : null}</section> : null}
    {step === 'details' && service && dateKey ? <section className="booking-v2-panel booking-v4-panel"><PanelToolbar onBack={back} /><div className="booking-v2-panel-heading"><h2>{waitlist ? 'Join today’s waitlist' : 'Review your appointment'}</h2><p>{account ? 'Your account information was filled in automatically.' : 'An account is not required.'}</p></div><div className="booking-v2-review"><div><small>Service</small><strong>{service.name}</strong></div><div><small>Barber</small><strong>{selectedBarber ? cleanBarberName(selectedBarber.name) : 'Any available Barber'}</strong></div><div><small>Date</small><strong>{formatLongDate(dateKey)}</strong></div><div><small>{waitlist ? 'Status' : 'Time'}</small><strong>{waitlist ? 'Waiting for an opening' : slot?.label}</strong></div><div><small>Price</small><strong>{service.price}</strong></div></div><div className="booking-v2-fields booking-v4-fields"><label><span>Name</span><input autoComplete="name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></label><label><span>Email</span><input type="email" autoComplete="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /></label><label><span>Mobile phone</span><input type="tel" autoComplete="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></label><label className="booking-v2-wide"><span>Note for the Barber <small>Optional</small></span><textarea rows={4} value={customer.note} onChange={(event) => setCustomer({ ...customer, note: event.target.value })} /></label></div>{error ? <p className="form-error" role="alert">{error}</p> : null}<p className="booking-v2-disclaimer">Submitting sends a request to the shop. It is not confirmed until the assigned Barber or shop approves it.</p><div className="booking-v2-submit-row"><button className="button" type="button" onClick={submit}>{waitlist ? 'Join today’s waitlist' : 'Request appointment'}</button></div></section> : null}
    {step === 'complete' && confirmation ? <section className="booking-v2-confirmation booking-v5-confirmation"><p className="eyebrow">Request received</p><h2>{confirmation.status === 'waitlisted' ? 'You joined today’s waitlist.' : 'Your appointment request was sent.'}</h2><p>{confirmation.status === 'waitlisted' ? 'A Barber can claim the request when an opening becomes available.' : 'The appointment is pending until the assigned Barber or shop confirms it.'}</p><dl><div><dt>Service</dt><dd>{confirmation.serviceName}</dd></div><div><dt>Barber</dt><dd>{cleanBarberName(confirmation.barberName)}</dd></div><div><dt>Date</dt><dd>{formatLongDate(confirmation.date)}</dd></div><div><dt>Time</dt><dd>{confirmation.time}</dd></div></dl><div className="booking-v2-complete-actions"><a className="button" href="/account?view=appointments">Manage appointment</a><button className="text-button danger" type="button" onClick={cancelConfirmation}>Cancel request</button></div></section> : null}
  </div></section>;
}

export function WalkInEntryV7() {
  const account = getPlatformSessionAccount();
  const allowed = Boolean(account && account.role !== 'customer');
  const [serviceId, setServiceId] = useState(barberServiceOptions[0]?.id ?? '');
  const [customer, setCustomer] = useState<CustomerDetails>({ name: '', email: '', phone: '', note: '' });
  const [error, setError] = useState('');
  const [created, setCreated] = useState<PlatformAppointment | null>(null);
  const service = barberServiceOptions.find((item) => item.id === serviceId) ?? barberServiceOptions[0] ?? null;

  if (!allowed || !account) return <section className="section booking-v7-walkin platform-pattern platform-pattern-staff"><div className="container narrow-container"><div className="staff-empty-state"><p className="eyebrow">Staff access required</p><h1>Sign in before adding a walk-in.</h1><p>Customer contact information and the staff waitlist are protected operational tools.</p><a className="button" href="/account">Account / Login</a></div></div></section>;

  const submit = () => {
    if (!service) return;
    if (customer.name.trim().length < 2) return setError('Enter the customer name.');
    if (!isValidEmail(customer.email)) return setError('Enter a valid email address.');
    if (!isValidPhone(customer.phone)) return setError('Enter a valid 10-digit phone number.');
    const appointment = createAppointmentRequest({
      serviceId: service.id,
      serviceName: service.name,
      price: service.price,
      priceCents: service.priceCents,
      durationMinutes: service.durationMinutes,
      requestedBarberId: 'any',
      assignedBarberId: null,
      barberName: 'Any available barber',
      date: todayKey(),
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
    });
    setCreated(appointment); setError('');
  };

  if (created) return <section className="section booking-v7-walkin platform-pattern platform-pattern-staff"><div className="container narrow-container"><div className="booking-v2-confirmation"><p className="eyebrow">Walk-in added</p><h1>{created.customerName} is on today’s waitlist.</h1><p>The crew can claim the request or propose a scheduled time from the staff portal.</p><div className="booking-v2-complete-actions"><a className="button" href="/staff/waitlist">Open waitlist</a><button className="button button-secondary" type="button" onClick={() => { setCreated(null); setCustomer({ name: '', email: '', phone: '', note: '' }); }}>Add another</button></div></div></div></section>;

  return <section className="section booking-v7-walkin platform-pattern platform-pattern-staff"><div className="container narrow-container"><div className="booking-v7-walkin-card"><p className="eyebrow">Staff waitlist</p><h1>Add a walk-in customer.</h1><p>Create a same-day request without pretending a chair or time is already confirmed.</p><div className="booking-v2-fields booking-v4-fields"><label className="booking-v2-wide"><span>Service</span><select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>{barberServiceOptions.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.price}</option>)}</select></label><label><span>Name</span><input autoComplete="name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></label><label><span>Email</span><input type="email" autoComplete="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /></label><label><span>Mobile phone</span><input type="tel" autoComplete="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></label><label className="booking-v2-wide"><span>Staff or customer note <small>Optional</small></span><textarea rows={4} value={customer.note} onChange={(event) => setCustomer({ ...customer, note: event.target.value })} /></label></div>{error ? <p className="form-error" role="alert">{error}</p> : null}<div className="booking-v2-submit-row"><button className="button" type="button" onClick={submit}>Add to today’s waitlist</button><a className="button button-secondary" href="/staff/waitlist">Cancel</a></div></div></div></section>;
}
