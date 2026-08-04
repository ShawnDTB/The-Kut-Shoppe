import { useEffect, useMemo, useState } from 'react';
import {
  createOrUpdateCustomerAccount,
  formatPhone,
  isValidEmail,
  isValidPhone,
  requestPhoneVerification,
  startSession,
  verifyPhoneChallenge,
} from '../data/auth';
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
  type PlatformAppointment,
  type StaffProfile,
  type TimeSlot,
} from '../data/platform';
import { business, getBookingPath } from '../data/site';

interface DateOption {
  key: string;
  weekday: string;
  label: string;
}

type BookingChoice = 'barber' | 'walk-in' | 'loctician' | null;
type AccountPreference = 'guest' | 'account';

type CustomerDetails = {
  name: string;
  email: string;
  phone: string;
  note: string;
  accountPreference: AccountPreference;
};

type VerificationState = {
  challengeId: string;
  code: string;
  developmentCode: string;
  verified: boolean;
  error: string;
};

const emptyCustomer: CustomerDetails = {
  name: '',
  email: '',
  phone: '',
  note: '',
  accountPreference: 'guest',
};

const emptyVerification: VerificationState = {
  challengeId: '',
  code: '',
  developmentCode: '',
  verified: false,
  error: '',
};

function buildDateOptions(days = 45): DateOption[] {
  const options: DateOption[] = [];
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

  for (let offset = 0; offset < days; offset += 1) {
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
  const labels = ['Service', 'Barber', 'Time', 'Details', 'Verify', 'Review'];

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

function PhoneVerificationPanel({
  phone,
  verification,
  onChange,
}: {
  phone: string;
  verification: VerificationState;
  onChange: (next: VerificationState) => void;
}) {
  const sendCode = () => {
    try {
      const challenge = requestPhoneVerification(phone);
      onChange({
        challengeId: challenge.challengeId,
        code: '',
        developmentCode: challenge.developmentCode,
        verified: false,
        error: '',
      });
    } catch (error) {
      onChange({
        ...verification,
        error: error instanceof Error ? error.message : 'Unable to start verification.',
      });
    }
  };

  const verifyCode = () => {
    const result = verifyPhoneChallenge(verification.challengeId, verification.code);
    if (!result.valid) {
      onChange({ ...verification, error: result.reason });
      return;
    }

    onChange({ ...verification, verified: true, error: '' });
  };

  return (
    <div className="booking-verification-panel">
      <div>
        <p className="eyebrow">Phone verification</p>
        <h3>{verification.verified ? 'Phone verified.' : `Verify ${formatPhone(phone)}`}</h3>
        <p>
          A six-digit code is required before a booking or waitlist request can be submitted.
        </p>
      </div>

      {!verification.challengeId ? (
        <button className="button" type="button" onClick={sendCode} disabled={!isValidPhone(phone)}>
          Send verification code
        </button>
      ) : null}

      {verification.challengeId && !verification.verified ? (
        <div className="booking-verification-entry">
          <label>
            Verification code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={verification.code}
              onChange={(event) => onChange({ ...verification, code: event.target.value.replace(/\D/g, '').slice(0, 6), error: '' })}
            />
          </label>
          <button className="button" type="button" onClick={verifyCode} disabled={verification.code.length !== 6}>
            Verify phone
          </button>
          <button className="text-button" type="button" onClick={sendCode}>Send a new code</button>
        </div>
      ) : null}

      {verification.developmentCode && !verification.verified ? (
        <p className="booking-development-code" role="status">
          <strong>Development code:</strong> {verification.developmentCode}
          <span>SMS delivery is represented by the notification outbox until a production messaging transport is connected.</span>
        </p>
      ) : null}

      {verification.error ? <p className="form-error" role="alert">{verification.error}</p> : null}
    </div>
  );
}

function AppointmentTypeChoice({ onChoose }: { onChoose: (choice: BookingChoice) => void }) {
  const loctician = getBookingPath('styling');

  return (
    <section className="section booking-app-page platform-pattern platform-pattern-tools">
      <div className="container route-wide">
        <header className="booking-app-intro">
          <div>
            <p className="eyebrow">Appointments</p>
            <h1>What brings you to the shop?</h1>
          </div>
          <p className="lede">
            Barber requests stay inside The Kut Shoppe platform. Loc and styling appointments continue to Crowned by Steph.
          </p>
        </header>

        <div className="booking-choice-grid booking-choice-grid-three">
          <article>
            <span className="booking-choice-number" aria-hidden="true">01</span>
            <p className="eyebrow">Plan ahead</p>
            <h2>Barber appointment</h2>
            <p>Choose a service, barber, date, and time. The barber reviews the request before it becomes confirmed.</p>
            <button className="button" type="button" onClick={() => onChoose('barber')}>Start barber request</button>
          </article>

          <article>
            <span className="booking-choice-number" aria-hidden="true">02</span>
            <p className="eyebrow">Today or soon</p>
            <h2>Join the walk-in list</h2>
            <p>Let the crew know you are available. A barber can claim the request or propose a better time.</p>
            <button className="button button-secondary" type="button" onClick={() => onChoose('walk-in')}>Join the waiting list</button>
          </article>

          <article>
            <span className="booking-choice-number" aria-hidden="true">03</span>
            <p className="eyebrow">Crowned by Steph</p>
            <h2>Loctician services</h2>
            <p>Locs, braids, retwists, twists, consultations, and related hair care.</p>
            <a className="button button-secondary" href={loctician.href} target="_blank" rel="noopener noreferrer">
              Continue to Steph <span aria-hidden="true">↗</span>
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}

export function InternalBookingPage() {
  const [choice, setChoice] = useState<BookingChoice>(null);
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState('');
  const [barberId, setBarberId] = useState('any');
  const [dateKey, setDateKey] = useState('');
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const [customer, setCustomer] = useState<CustomerDetails>(emptyCustomer);
  const [verification, setVerification] = useState<VerificationState>(emptyVerification);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>(() => readStaffProfiles());
  const [appointments, setAppointments] = useState<PlatformAppointment[]>(() => readAppointments());
  const [confirmation, setConfirmation] = useState<PlatformAppointment | null>(null);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => subscribeToAppointmentChanges(() => {
    setStaffProfiles(readStaffProfiles());
    setAppointments(readAppointments());
  }), []);

  const selectedService = barberServiceOptions.find((service) => service.id === serviceId);
  const eligibleBarbers = useMemo(
    () => serviceId ? getEligibleBarbers(serviceId, staffProfiles) : [],
    [serviceId, staffProfiles],
  );
  const selectedBarber = eligibleBarbers.find((barber) => (
    barber.id === barberId || barber.profile?.id === barberId
  ));
  const bookingWindow = selectedBarber?.profile?.bookingRules.bookingWindowDays
    ?? Math.max(...staffProfiles.map((profile) => profile.bookingRules.bookingWindowDays), 30);
  const dates = useMemo(() => buildDateOptions(bookingWindow + 7), [bookingWindow]);
  const timeSlots = useMemo(() => {
    if (!dateKey || !selectedService) return [];
    return getAvailableTimeSlots({
      service: selectedService,
      requestedBarberId: barberId,
      date: dateKey,
      profiles: staffProfiles,
      appointments,
    });
  }, [appointments, barberId, dateKey, selectedService, staffProfiles]);

  const resetBooking = () => {
    setChoice(null);
    setStep(1);
    setServiceId('');
    setBarberId('any');
    setDateKey('');
    setSlot(null);
    setCustomer(emptyCustomer);
    setVerification(emptyVerification);
    setConfirmation(null);
    setSubmitError('');
  };

  const customerDetailsValid = Boolean(
    customer.name.trim().length >= 2
    && isValidEmail(customer.email)
    && isValidPhone(customer.phone)
  );

  const submitRequest = () => {
    if (!selectedService || !dateKey || !slot || !customerDetailsValid || !verification.verified) return;

    const assigned = chooseAvailableBarber({
      serviceId: selectedService.id,
      requestedBarberId: barberId,
      date: dateKey,
      startMinutes: slot.startMinutes,
      durationMinutes: selectedService.durationMinutes,
      profiles: staffProfiles,
      appointments,
    });

    if (!assigned) {
      setSubmitError('That opening was just taken. Choose another time and try again.');
      setStep(3);
      setSlot(null);
      return;
    }

    const assignedId = assigned.profile?.id ?? assigned.id;
    const request = createAppointmentRequest({
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      price: selectedService.price,
      priceCents: selectedService.priceCents,
      durationMinutes: selectedService.durationMinutes,
      requestedBarberId: barberId,
      assignedBarberId: assignedId,
      barberName: assigned.name,
      date: dateKey,
      time: slot.label,
      startMinutes: slot.startMinutes,
      endMinutes: slot.endMinutes,
      proposedDate: null,
      proposedTime: null,
      proposedStartMinutes: null,
      customerName: customer.name.trim(),
      customerEmail: customer.email,
      customerPhone: customer.phone,
      phoneVerified: true,
      accountPreference: customer.accountPreference,
      source: 'website',
      customerNote: customer.note.trim(),
      staffNote: '',
    });

    if (customer.accountPreference === 'account') {
      const account = createOrUpdateCustomerAccount({
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        phoneVerified: true,
      });
      startSession(account);
    }

    setAppointments(readAppointments());
    setConfirmation(request);
    setSubmitError('');
  };

  if (!choice) return <AppointmentTypeChoice onChoose={setChoice} />;
  if (choice === 'walk-in') return <WalkInRequestPage onBack={resetBooking} />;
  if (choice === 'loctician') return <AppointmentTypeChoice onChoose={setChoice} />;

  if (confirmation) {
    return (
      <section className="section booking-app-page platform-pattern platform-pattern-poles">
        <div className="container narrow-container">
          <div className="booking-confirmation-panel">
            <p className="eyebrow">Request received</p>
            <h1>Your barber will review the appointment.</h1>
            <p className="lede">
              The time is held in this prototype while the assigned barber reviews it. It becomes confirmed only after staff approval.
            </p>
            <dl>
              <div><dt>Status</dt><dd>Awaiting barber confirmation</dd></div>
              <div><dt>Service</dt><dd>{confirmation.serviceName}</dd></div>
              <div><dt>Professional</dt><dd>{confirmation.barberName}</dd></div>
              <div><dt>Date</dt><dd>{formatSelectedDate(confirmation.date)}</dd></div>
              <div><dt>Time</dt><dd>{confirmation.time}</dd></div>
              <div><dt>Reference</dt><dd>{confirmation.id}</dd></div>
            </dl>
            <div className="booking-app-actions">
              <a className="button" href="/account">View request in Account</a>
              <button className="button button-secondary" type="button" onClick={resetBooking}>Start another request</button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section booking-app-page platform-pattern platform-pattern-tools">
      <div className="container route-wide booking-app-shell">
        <header className="booking-app-header">
          <div>
            <p className="eyebrow">Internal barber booking</p>
            <h1>Request the chair that fits.</h1>
          </div>
          <button className="text-button" type="button" onClick={resetBooking}>Change appointment type</button>
        </header>

        <StepIndicator current={step} />

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
                        onChange={() => {
                          setServiceId(service.id);
                          setBarberId('any');
                          setDateKey('');
                          setSlot(null);
                        }}
                      />
                      <span><small>{service.category}</small><strong>{service.name}</strong></span>
                      <span className="booking-option-meta"><strong>{service.price}</strong><small>{service.durationMinutes} min</small></span>
                    </label>
                  ))}
                </div>
                <div className="booking-step-actions"><span /><button className="button" type="button" disabled={!serviceId} onClick={() => setStep(2)}>Choose barber</button></div>
              </section>
            ) : null}

            {step === 2 ? (
              <section aria-labelledby="barber-step-heading">
                <p className="eyebrow">Step 2</p>
                <h2 id="barber-step-heading">Choose a barber.</h2>
                <div className="barber-choice-grid">
                  <label className={barberId === 'any' ? 'is-selected' : ''}>
                    <input type="radio" name="barber" checked={barberId === 'any'} onChange={() => { setBarberId('any'); setDateKey(''); setSlot(null); }} />
                    <div className="barber-choice-placeholder" aria-hidden="true">ANY</div>
                    <span><strong>Any available barber</strong><small>Match the request to the first eligible open chair.</small></span>
                  </label>
                  {eligibleBarbers.map((barber) => {
                    const id = barber.profile?.id ?? barber.id;
                    return (
                      <label className={barberId === id ? 'is-selected' : ''} key={id}>
                        <input type="radio" name="barber" checked={barberId === id} onChange={() => { setBarberId(id); setDateKey(''); setSlot(null); }} />
                        {barber.photo ? <img src={barber.photo} alt="" width="180" height="180" loading="lazy" decoding="async" /> : <div className="barber-choice-placeholder" aria-hidden="true">{barber.shortName.slice(0, 3).toUpperCase()}</div>}
                        <span><strong>{barber.name}</strong><small>{barber.profile ? 'Schedule connected' : 'Preview shop schedule'}</small></span>
                      </label>
                    );
                  })}
                </div>
                <div className="booking-step-actions"><button className="button button-secondary" type="button" onClick={() => setStep(1)}>Back</button><button className="button" type="button" onClick={() => setStep(3)}>Choose time</button></div>
              </section>
            ) : null}

            {step === 3 ? (
              <section aria-labelledby="time-step-heading">
                <p className="eyebrow">Step 3</p>
                <h2 id="time-step-heading">Choose a date and time.</h2>
                <p className="booking-preview-warning">Requested times remain pending until the assigned barber confirms them.</p>
                {submitError ? <p className="form-error" role="alert">{submitError}</p> : null}
                <div className="booking-date-strip">
                  {dates.map((date) => (
                    <button className={dateKey === date.key ? 'is-selected' : ''} type="button" key={date.key} onClick={() => { setDateKey(date.key); setSlot(null); setSubmitError(''); }}>
                      <small>{date.weekday}</small><strong>{date.label}</strong>
                    </button>
                  ))}
                </div>
                {dateKey ? (
                  <div className="booking-time-grid" aria-label={`Available times for ${formatSelectedDate(dateKey)}`}>
                    {timeSlots.length ? timeSlots.map((timeSlot) => (
                      <button className={slot?.startMinutes === timeSlot.startMinutes ? 'is-selected' : ''} type="button" key={timeSlot.startMinutes} onClick={() => setSlot(timeSlot)}>{timeSlot.label}</button>
                    )) : <p>No open preview times are available for this date.</p>}
                  </div>
                ) : null}
                <div className="booking-step-actions"><button className="button button-secondary" type="button" onClick={() => setStep(2)}>Back</button><button className="button" type="button" disabled={!dateKey || !slot} onClick={() => setStep(4)}>Your details</button></div>
              </section>
            ) : null}

            {step === 4 ? (
              <section aria-labelledby="details-step-heading">
                <p className="eyebrow">Step 4</p>
                <h2 id="details-step-heading">Who is the request for?</h2>
                <div className="booking-account-choice">
                  <label><input type="radio" name="accountPreference" checked={customer.accountPreference === 'guest'} onChange={() => setCustomer({ ...customer, accountPreference: 'guest' })} /> Continue as guest</label>
                  <label><input type="radio" name="accountPreference" checked={customer.accountPreference === 'account'} onChange={() => setCustomer({ ...customer, accountPreference: 'account' })} /> Create or connect a Kut Shoppe account</label>
                </div>
                <div className="booking-customer-form">
                  <label>Full name<input required type="text" autoComplete="name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /><small>Required</small></label>
                  <label>Email<input required type="email" autoComplete="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /><small>{customer.email && !isValidEmail(customer.email) ? 'Enter a valid email.' : 'Required for appointment updates.'}</small></label>
                  <label>Mobile phone<input required type="tel" autoComplete="tel" value={customer.phone} onChange={(event) => { setCustomer({ ...customer, phone: event.target.value }); setVerification(emptyVerification); }} /><small>{customer.phone && !isValidPhone(customer.phone) ? 'Enter a valid 10-digit phone number.' : 'Required for two-step verification.'}</small></label>
                  <label className="booking-form-wide">Notes for the barber<textarea rows={4} value={customer.note} onChange={(event) => setCustomer({ ...customer, note: event.target.value })} placeholder="Optional haircut details, accessibility needs, or arrival notes" /></label>
                </div>
                <div className="booking-step-actions"><button className="button button-secondary" type="button" onClick={() => setStep(3)}>Back</button><button className="button" type="button" disabled={!customerDetailsValid} onClick={() => setStep(5)}>Verify phone</button></div>
              </section>
            ) : null}

            {step === 5 ? (
              <section aria-labelledby="verification-step-heading">
                <p className="eyebrow">Step 5</p>
                <h2 id="verification-step-heading">Protect the appointment request.</h2>
                <PhoneVerificationPanel phone={customer.phone} verification={verification} onChange={setVerification} />
                <div className="booking-step-actions"><button className="button button-secondary" type="button" onClick={() => setStep(4)}>Back</button><button className="button" type="button" disabled={!verification.verified} onClick={() => setStep(6)}>Review request</button></div>
              </section>
            ) : null}

            {step === 6 && selectedService && slot ? (
              <section aria-labelledby="confirm-step-heading">
                <p className="eyebrow">Step 6</p>
                <h2 id="confirm-step-heading">Review and send.</h2>
                <dl className="booking-review-list">
                  <div><dt>Service</dt><dd>{selectedService.name}</dd></div>
                  <div><dt>Price</dt><dd>{selectedService.price}</dd></div>
                  <div><dt>Duration</dt><dd>{selectedService.durationMinutes} minutes</dd></div>
                  <div><dt>Requested barber</dt><dd>{selectedBarber?.name ?? 'Any available barber'}</dd></div>
                  <div><dt>Date</dt><dd>{formatSelectedDate(dateKey)}</dd></div>
                  <div><dt>Time</dt><dd>{slot.label}</dd></div>
                  <div><dt>Customer</dt><dd>{customer.name}</dd></div>
                  <div><dt>Phone</dt><dd>{formatPhone(customer.phone)} · Verified</dd></div>
                </dl>
                <div className="booking-policy-box">
                  <strong>This is an appointment request.</strong>
                  <p>The selected time is not confirmed until the assigned barber approves it. The customer receives an update when the request is confirmed, declined, or moved.</p>
                </div>
                <div className="booking-step-actions"><button className="button button-secondary" type="button" onClick={() => setStep(5)}>Back</button><button className="button" type="button" onClick={submitRequest}>Send appointment request</button></div>
              </section>
            ) : null}
          </main>

          <aside className="booking-app-summary">
            <p className="eyebrow">Request summary</p>
            <dl>
              <div><dt>Service</dt><dd>{selectedService?.name ?? 'Not selected'}</dd></div>
              <div><dt>Barber</dt><dd>{selectedBarber?.name ?? (barberId === 'any' ? 'Any available' : 'Not selected')}</dd></div>
              <div><dt>Date</dt><dd>{dateKey ? formatSelectedDate(dateKey) : 'Not selected'}</dd></div>
              <div><dt>Time</dt><dd>{slot?.label ?? 'Not selected'}</dd></div>
              <div><dt>Status</dt><dd>Pending until staff approval</dd></div>
            </dl>
            <a href={business.phoneHref}>Need help? Call {business.phone}</a>
          </aside>
        </div>
      </div>
    </section>
  );
}

export function WalkInRequestPage({ onBack }: { onBack?: () => void }) {
  const [serviceId, setServiceId] = useState('');
  const [customer, setCustomer] = useState<CustomerDetails>(emptyCustomer);
  const [availability, setAvailability] = useState('As soon as possible');
  const [verification, setVerification] = useState<VerificationState>(emptyVerification);
  const [submitted, setSubmitted] = useState<PlatformAppointment | null>(null);
  const selectedService = barberServiceOptions.find((service) => service.id === serviceId);
  const detailsValid = Boolean(
    selectedService
    && customer.name.trim().length >= 2
    && isValidEmail(customer.email)
    && isValidPhone(customer.phone)
  );

  const submitWalkIn = () => {
    if (!selectedService || !verification.verified || !detailsValid) return;
    const now = new Date();
    const startMinutes = now.getHours() * 60 + now.getMinutes();
    const request = createAppointmentRequest({
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      price: selectedService.price,
      priceCents: selectedService.priceCents,
      durationMinutes: selectedService.durationMinutes,
      requestedBarberId: 'any',
      assignedBarberId: null,
      barberName: 'Waiting for a barber',
      date: now.toISOString().slice(0, 10),
      time: 'Waiting list',
      startMinutes,
      endMinutes: startMinutes + selectedService.durationMinutes,
      proposedDate: null,
      proposedTime: null,
      proposedStartMinutes: null,
      customerName: customer.name.trim(),
      customerEmail: customer.email,
      customerPhone: customer.phone,
      phoneVerified: true,
      accountPreference: customer.accountPreference,
      source: 'walk-in',
      customerNote: `${availability}${customer.note.trim() ? ` · ${customer.note.trim()}` : ''}`,
      staffNote: '',
    });

    if (customer.accountPreference === 'account') {
      const account = createOrUpdateCustomerAccount({
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        phoneVerified: true,
      });
      startSession(account);
    }

    setSubmitted(request);
  };

  if (submitted) {
    return (
      <section className="section booking-app-page platform-pattern platform-pattern-poles">
        <div className="container narrow-container">
          <div className="booking-confirmation-panel">
            <p className="eyebrow">Waiting-list request received</p>
            <h1>The crew can now see your request.</h1>
            <p>A barber may claim it for today or propose another date and time. Nothing is confirmed until the customer receives and accepts the update.</p>
            <dl>
              <div><dt>Service</dt><dd>{submitted.serviceName}</dd></div>
              <div><dt>Availability</dt><dd>{availability}</dd></div>
              <div><dt>Status</dt><dd>Waiting for a barber</dd></div>
              <div><dt>Reference</dt><dd>{submitted.id}</dd></div>
            </dl>
            <div className="booking-app-actions"><a className="button" href="/account">View in Account</a><a className="button button-secondary" href="/book">Back to booking</a></div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section booking-app-page platform-pattern platform-pattern-poles">
      <div className="container narrow-container">
        <header className="booking-app-header">
          <div><p className="eyebrow">Walk-in and last-minute list</p><h1>Let the next open chair find you.</h1></div>
          {onBack ? <button className="text-button" type="button" onClick={onBack}>Back to appointment types</button> : <a className="text-link" href="/book">Back to booking</a>}
        </header>

        <div className="walk-in-request-card">
          <section>
            <h2>1. Choose a service</h2>
            <div className="booking-option-list">
              {barberServiceOptions.map((service) => (
                <label className={serviceId === service.id ? 'is-selected' : ''} key={service.id}>
                  <input type="radio" name="walkInService" checked={serviceId === service.id} onChange={() => setServiceId(service.id)} />
                  <span><small>{service.category}</small><strong>{service.name}</strong></span>
                  <span className="booking-option-meta"><strong>{service.price}</strong><small>{service.durationMinutes} min</small></span>
                </label>
              ))}
            </div>
          </section>

          <section>
            <h2>2. Tell the crew when you are available</h2>
            <div className="booking-customer-form">
              <label>Availability<select value={availability} onChange={(event) => setAvailability(event.target.value)}><option>As soon as possible</option><option>Within the next hour</option><option>Later today</option><option>Another day is okay</option></select></label>
              <label>Full name<input required value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></label>
              <label>Email<input required type="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /></label>
              <label>Mobile phone<input required type="tel" value={customer.phone} onChange={(event) => { setCustomer({ ...customer, phone: event.target.value }); setVerification(emptyVerification); }} /></label>
              <label className="booking-form-wide">Notes<textarea rows={4} value={customer.note} onChange={(event) => setCustomer({ ...customer, note: event.target.value })} placeholder="Optional details for the crew" /></label>
            </div>
            <div className="booking-account-choice">
              <label><input type="radio" name="walkInAccount" checked={customer.accountPreference === 'guest'} onChange={() => setCustomer({ ...customer, accountPreference: 'guest' })} /> Continue as guest</label>
              <label><input type="radio" name="walkInAccount" checked={customer.accountPreference === 'account'} onChange={() => setCustomer({ ...customer, accountPreference: 'account' })} /> Save to a Kut Shoppe account</label>
            </div>
          </section>

          <section>
            <h2>3. Verify and join</h2>
            <PhoneVerificationPanel phone={customer.phone} verification={verification} onChange={setVerification} />
            <button className="button walk-in-submit" type="button" disabled={!detailsValid || !verification.verified} onClick={submitWalkIn}>Join the waiting list</button>
          </section>
        </div>
      </div>
    </section>
  );
}
