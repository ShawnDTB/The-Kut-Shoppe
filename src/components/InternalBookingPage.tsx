import { useEffect, useMemo, useState } from 'react';
import {
  barberDirectory,
  barberServiceOptions,
  defaultWeeklySchedule,
  generateTimeSlots,
  getScheduleForBarber,
  readAppointments,
  readStaffProfiles,
  saveAppointment,
  type PlatformAppointment,
  type StaffProfile,
} from '../data/platform';
import { business, getBookingPath } from '../data/site';

interface DateOption {
  key: string;
  weekday: string;
  label: string;
}

type BookingChoice = 'barber' | 'loctician' | null;

type CustomerDetails = {
  name: string;
  email: string;
  phone: string;
  accountPreference: 'guest' | 'account';
};

function buildDateOptions(): DateOption[] {
  const options: DateOption[] = [];
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

  for (let offset = 0; offset < 21 && options.length < 12; offset += 1) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    if (date.getDay() === 0) continue;

    options.push({
      key: date.toISOString().slice(0, 10),
      weekday: weekdayFormatter.format(date),
      label: formatter.format(date),
    });
  }

  return options;
}

function formatSelectedDate(dateKey: string) {
  if (!dateKey) return '';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${dateKey}T12:00:00`));
}

function StepIndicator({ current }: { current: number }) {
  const labels = ['Service', 'Barber', 'Time', 'Details', 'Confirm'];

  return (
    <ol className="booking-step-indicator" aria-label="Booking progress">
      {labels.map((label, index) => {
        const step = index + 1;
        return (
          <li className={step === current ? 'is-current' : step < current ? 'is-complete' : ''} key={label}>
            <span>{step}</span>
            <small>{label}</small>
          </li>
        );
      })}
    </ol>
  );
}

export function InternalBookingPage() {
  const loctician = getBookingPath('styling');
  const [choice, setChoice] = useState<BookingChoice>(null);
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState('');
  const [barberId, setBarberId] = useState('any');
  const [dateKey, setDateKey] = useState('');
  const [time, setTime] = useState('');
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [appointments, setAppointments] = useState<PlatformAppointment[]>([]);
  const [confirmation, setConfirmation] = useState<PlatformAppointment | null>(null);
  const [customer, setCustomer] = useState<CustomerDetails>({
    name: '',
    email: '',
    phone: '',
    accountPreference: 'guest',
  });

  const dates = useMemo(buildDateOptions, []);
  const selectedService = barberServiceOptions.find((service) => service.id === serviceId);
  const selectedBarber = barberDirectory.find((barber) => barber.id === barberId);

  useEffect(() => {
    setStaffProfiles(readStaffProfiles());
    setAppointments(readAppointments());
  }, []);

  const schedule = useMemo(() => {
    if (!selectedBarber) return defaultWeeklySchedule;
    return getScheduleForBarber(selectedBarber.name, staffProfiles);
  }, [selectedBarber, staffProfiles]);

  const timeSlots = useMemo(() => {
    if (!dateKey || !selectedService) return [];

    const generated = generateTimeSlots(dateKey, selectedService.durationMinutes, schedule);
    return generated.filter((slot) => !appointments.some((appointment) => {
      const sameDate = appointment.date === dateKey;
      const sameTime = appointment.time === slot;
      const sameBarber = barberId === 'any' || appointment.barberId === barberId;
      return sameDate && sameTime && sameBarber && appointment.status === 'confirmed';
    }));
  }, [appointments, barberId, dateKey, schedule, selectedService]);

  const resetBooking = () => {
    setChoice(null);
    setStep(1);
    setServiceId('');
    setBarberId('any');
    setDateKey('');
    setTime('');
    setConfirmation(null);
  };

  const confirmAppointment = () => {
    if (!selectedService || !dateKey || !time || !customer.name || !customer.email || !customer.phone) return;

    const appointment: PlatformAppointment = {
      id: `appointment-${Date.now()}`,
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      price: selectedService.price,
      durationMinutes: selectedService.durationMinutes,
      barberId,
      barberName: selectedBarber?.name ?? 'Any available barber',
      date: dateKey,
      time,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      accountPreference: customer.accountPreference,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };

    setAppointments(saveAppointment(appointment));
    setConfirmation(appointment);
    setStep(6);
  };

  if (confirmation) {
    return (
      <section className="section booking-app-page">
        <div className="container narrow-container">
          <div className="booking-confirmation-panel">
            <p className="eyebrow">Test appointment confirmed</p>
            <h1>Your chair is reserved in this browser.</h1>
            <p className="lede">
              This feature branch stores test appointments locally while the secure database and notification services are being built.
            </p>
            <dl>
              <div><dt>Service</dt><dd>{confirmation.serviceName}</dd></div>
              <div><dt>Professional</dt><dd>{confirmation.barberName}</dd></div>
              <div><dt>Date</dt><dd>{formatSelectedDate(confirmation.date)}</dd></div>
              <div><dt>Time</dt><dd>{confirmation.time}</dd></div>
              <div><dt>Reference</dt><dd>{confirmation.id}</dd></div>
            </dl>
            <div className="booking-app-actions">
              <a className="button" href="/staff">View staff dashboard</a>
              <button className="button button-secondary" type="button" onClick={resetBooking}>Book another</button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!choice) {
    return (
      <section className="section booking-app-page">
        <div className="container route-wide">
          <header className="booking-app-intro">
            <p className="eyebrow">Appointments</p>
            <h1>What are you booking?</h1>
            <p className="lede">
              Barber appointments stay inside The Kut Shoppe platform. Loc and styling appointments continue to Crowned by Steph.
            </p>
          </header>

          <div className="booking-choice-grid">
            <article>
              <span className="booking-choice-number" aria-hidden="true">01</span>
              <p className="eyebrow">Stay on this website</p>
              <h2>Barber services</h2>
              <p>Cuts, fades, line-ups, beard work, kids cuts, and senior services.</p>
              <button className="button" type="button" onClick={() => setChoice('barber')}>Start barber booking</button>
            </article>

            <article>
              <span className="booking-choice-number" aria-hidden="true">02</span>
              <p className="eyebrow">Crowned by Steph</p>
              <h2>Loctician services</h2>
              <p>Locs, braids, retwists, twists, consultations, and related hair care.</p>
              <a className="button button-secondary" href={loctician.href} target="_blank" rel="noopener noreferrer">
                Continue to Steph <span aria-hidden="true">↗</span>
              </a>
            </article>
          </div>

          <aside className="booking-development-note">
            <strong>Internal booking development preview</strong>
            <p>Test bookings are stored only in this browser until the D1 database, authentication, email, and conflict-safe reservation API are connected.</p>
          </aside>
        </div>
      </section>
    );
  }

  return (
    <section className="section booking-app-page">
      <div className="container route-wide booking-app-shell">
        <header className="booking-app-header">
          <div>
            <p className="eyebrow">Internal barber booking</p>
            <h1>Choose your service and chair.</h1>
          </div>
          <button className="text-button" type="button" onClick={resetBooking}>Change appointment type</button>
        </header>

        <StepIndicator current={Math.min(step, 5)} />

        <div className="booking-app-workspace">
          <main className="booking-app-main">
            {step === 1 ? (
              <section aria-labelledby="service-step-heading">
                <p className="eyebrow">Step 1</p>
                <h2 id="service-step-heading">Choose a service.</h2>
                <div className="booking-option-list">
                  {barberServiceOptions.map((service) => (
                    <label className={serviceId === service.id ? 'is-selected' : ''} key={service.id}>
                      <input
                        type="radio"
                        name="service"
                        value={service.id}
                        checked={serviceId === service.id}
                        onChange={() => setServiceId(service.id)}
                      />
                      <span>
                        <small>{service.category}</small>
                        <strong>{service.name}</strong>
                      </span>
                      <span className="booking-option-meta">
                        <strong>{service.price}</strong>
                        <small>{service.durationMinutes} min</small>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="booking-step-actions">
                  <span />
                  <button className="button" type="button" disabled={!serviceId} onClick={() => setStep(2)}>Choose barber</button>
                </div>
              </section>
            ) : null}

            {step === 2 ? (
              <section aria-labelledby="barber-step-heading">
                <p className="eyebrow">Step 2</p>
                <h2 id="barber-step-heading">Choose a barber.</h2>
                <div className="barber-choice-grid">
                  <label className={barberId === 'any' ? 'is-selected' : ''}>
                    <input type="radio" name="barber" checked={barberId === 'any'} onChange={() => setBarberId('any')} />
                    <div className="barber-choice-placeholder" aria-hidden="true">ANY</div>
                    <span><strong>Any available barber</strong><small>Match me with the first open chair.</small></span>
                  </label>
                  {barberDirectory.map((barber) => (
                    <label className={barberId === barber.id ? 'is-selected' : ''} key={barber.id}>
                      <input type="radio" name="barber" checked={barberId === barber.id} onChange={() => setBarberId(barber.id)} />
                      {barber.photo ? <img src={barber.photo} alt="" width="180" height="180" /> : null}
                      <span><strong>{barber.name}</strong><small>Barber</small></span>
                    </label>
                  ))}
                </div>
                <div className="booking-step-actions">
                  <button className="button button-secondary" type="button" onClick={() => setStep(1)}>Back</button>
                  <button className="button" type="button" onClick={() => setStep(3)}>Choose time</button>
                </div>
              </section>
            ) : null}

            {step === 3 ? (
              <section aria-labelledby="time-step-heading">
                <p className="eyebrow">Step 3</p>
                <h2 id="time-step-heading">Choose a date and time.</h2>
                <p className="booking-preview-warning">General shop hours are used as preview availability until each barber completes staff onboarding.</p>
                <div className="booking-date-strip">
                  {dates.map((date) => (
                    <button className={dateKey === date.key ? 'is-selected' : ''} type="button" key={date.key} onClick={() => { setDateKey(date.key); setTime(''); }}>
                      <small>{date.weekday}</small>
                      <strong>{date.label}</strong>
                    </button>
                  ))}
                </div>
                {dateKey ? (
                  <div className="booking-time-grid" aria-label={`Available times for ${formatSelectedDate(dateKey)}`}>
                    {timeSlots.length ? timeSlots.map((slot) => (
                      <button className={time === slot ? 'is-selected' : ''} type="button" key={slot} onClick={() => setTime(slot)}>{slot}</button>
                    )) : <p>No preview times are available for this date.</p>}
                  </div>
                ) : null}
                <div className="booking-step-actions">
                  <button className="button button-secondary" type="button" onClick={() => setStep(2)}>Back</button>
                  <button className="button" type="button" disabled={!dateKey || !time} onClick={() => setStep(4)}>Your details</button>
                </div>
              </section>
            ) : null}

            {step === 4 ? (
              <section aria-labelledby="details-step-heading">
                <p className="eyebrow">Step 4</p>
                <h2 id="details-step-heading">Who is the appointment for?</h2>
                <div className="booking-account-choice">
                  <label><input type="radio" name="accountPreference" checked={customer.accountPreference === 'guest'} onChange={() => setCustomer({ ...customer, accountPreference: 'guest' })} /> Continue as guest</label>
                  <label><input type="radio" name="accountPreference" checked={customer.accountPreference === 'account'} onChange={() => setCustomer({ ...customer, accountPreference: 'account' })} /> Save to a Kut Shoppe account</label>
                </div>
                <div className="booking-customer-form">
                  <label>Full name<input type="text" autoComplete="name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></label>
                  <label>Email<input type="email" autoComplete="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /></label>
                  <label>Phone<input type="tel" autoComplete="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></label>
                </div>
                <p className="fine-print">Confirmation email and account creation are represented in this prototype but are not sent yet.</p>
                <div className="booking-step-actions">
                  <button className="button button-secondary" type="button" onClick={() => setStep(3)}>Back</button>
                  <button className="button" type="button" disabled={!customer.name || !customer.email || !customer.phone} onClick={() => setStep(5)}>Review appointment</button>
                </div>
              </section>
            ) : null}

            {step === 5 && selectedService ? (
              <section aria-labelledby="confirm-step-heading">
                <p className="eyebrow">Step 5</p>
                <h2 id="confirm-step-heading">Review and confirm.</h2>
                <dl className="booking-review-list">
                  <div><dt>Service</dt><dd>{selectedService.name}</dd></div>
                  <div><dt>Price</dt><dd>{selectedService.price}</dd></div>
                  <div><dt>Duration</dt><dd>{selectedService.durationMinutes} minutes</dd></div>
                  <div><dt>Professional</dt><dd>{selectedBarber?.name ?? 'Any available barber'}</dd></div>
                  <div><dt>Date</dt><dd>{formatSelectedDate(dateKey)}</dd></div>
                  <div><dt>Time</dt><dd>{time}</dd></div>
                  <div><dt>Customer</dt><dd>{customer.name}</dd></div>
                </dl>
                <div className="booking-policy-box">
                  <strong>Appointment policies</strong>
                  <p>Cancellation, no-show, late-arrival, deposit, and rescheduling rules require shop approval before production launch.</p>
                </div>
                <div className="booking-step-actions">
                  <button className="button button-secondary" type="button" onClick={() => setStep(4)}>Back</button>
                  <button className="button" type="button" onClick={confirmAppointment}>Confirm test appointment</button>
                </div>
              </section>
            ) : null}
          </main>

          <aside className="booking-app-summary">
            <p className="eyebrow">Appointment summary</p>
            <dl>
              <div><dt>Service</dt><dd>{selectedService?.name ?? 'Not selected'}</dd></div>
              <div><dt>Barber</dt><dd>{selectedBarber?.name ?? (barberId === 'any' ? 'Any available' : 'Not selected')}</dd></div>
              <div><dt>Date</dt><dd>{dateKey ? formatSelectedDate(dateKey) : 'Not selected'}</dd></div>
              <div><dt>Time</dt><dd>{time || 'Not selected'}</dd></div>
            </dl>
            <a href={business.phoneHref}>Need help? Call {business.phone}</a>
          </aside>
        </div>
      </div>
    </section>
  );
}
