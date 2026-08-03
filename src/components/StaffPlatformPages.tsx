import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createOrUpdateStaffAccount,
  endSession,
  findAccount,
  formatPhone,
  getSessionAccount,
  isValidEmail,
  isValidPhone,
  requestPhoneVerification,
  startSession,
  verifyPhoneChallenge,
} from '../data/auth';
import { readNotifications, type NotificationRecord } from '../data/notifications';
import {
  barberServiceOptions,
  claimWalkIn,
  confirmAppointment,
  createStaffProfileDraft,
  declineAppointment,
  getBarberDirectory,
  minutesToTimeLabel,
  primaryLocation,
  proposeAppointmentTime,
  readAppointments,
  readStaffProfiles,
  saveStaffProfile,
  subscribeToAppointmentChanges,
  timeLabelToMinutes,
  updateAppointment,
  validateStaffProfile,
  type AppointmentStatus,
  type PlatformAppointment,
  type StaffProfile,
  type WeeklyWindow,
} from '../data/platform';

const staffLinks = [
  ['Overview', '/staff'],
  ['Calendar', '/staff/calendar'],
  ['Requests', '/staff/requests'],
  ['Waitlist', '/staff/waitlist'],
  ['Earnings', '/staff/earnings'],
  ['Payouts', '/staff/payouts'],
  ['Notifications', '/staff/notifications'],
  ['Settings', '/staff/settings'],
] as const;

type CalendarView = 'day' | 'week' | 'month';

type VerificationState = {
  challengeId: string;
  code: string;
  developmentCode: string;
  verified: boolean;
  error: string;
};

const emptyVerification: VerificationState = {
  challengeId: '',
  code: '',
  developmentCode: '',
  verified: false,
  error: '',
};

function todayKey() {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function formatDate(dateKey: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', options ?? {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${dateKey}T12:00:00`));
}

function addDays(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function startOfWeek(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  const mondayOffset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  date.setDate(date.getDate() + mondayOffset);
  return date.toISOString().slice(0, 10);
}

function monthKeys(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  const year = date.getFullYear();
  const month = date.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: days }, (_, index) => {
    const value = new Date(year, month, index + 1, 12, 0, 0, 0);
    return value.toISOString().slice(0, 10);
  });
}

function appointmentDateTime(appointment: PlatformAppointment) {
  return `${appointment.date}-${String(appointment.startMinutes).padStart(4, '0')}`;
}

function getProfileForSession() {
  const account = getSessionAccount();
  if (!account?.staffProfileId) return null;
  return readStaffProfiles().find((profile) => profile.id === account.staffProfileId) ?? null;
}

function StaffNav({ currentPath }: { currentPath: string }) {
  return (
    <nav className="staff-platform-nav" aria-label="Staff account">
      {staffLinks.map(([label, href]) => (
        <a href={href} aria-current={currentPath === href ? 'page' : undefined} key={href}>{label}</a>
      ))}
    </nav>
  );
}

function StaffShell({
  currentPath,
  children,
  profile,
}: {
  currentPath: string;
  children: ReactNode;
  profile: StaffProfile;
}) {
  const logout = () => {
    endSession();
    window.location.assign('/staff/login');
  };

  return (
    <section className="section staff-platform-page platform-pattern platform-pattern-tools">
      <div className="container route-wide">
        <header className="staff-platform-header">
          <div>
            <p className="eyebrow">The Kut Shoppe staff platform</p>
            <h1>Manage your chair.</h1>
            <p>{profile.professionalName} · {profile.locationName}</p>
          </div>
          <div className="staff-session-actions">
            <a className="button button-secondary" href="/account">Customer account</a>
            <button className="text-button" type="button" onClick={logout}>Log out</button>
          </div>
        </header>
        <StaffNav currentPath={currentPath} />
        {children}
      </div>
    </section>
  );
}

function PhoneVerificationFields({
  phone,
  verification,
  onChange,
}: {
  phone: string;
  verification: VerificationState;
  onChange: (next: VerificationState) => void;
}) {
  const requestCode = () => {
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
      onChange({ ...verification, error: error instanceof Error ? error.message : 'Unable to start verification.' });
    }
  };

  const verify = () => {
    const result = verifyPhoneChallenge(verification.challengeId, verification.code);
    onChange(result.valid
      ? { ...verification, verified: true, error: '' }
      : { ...verification, error: result.reason });
  };

  return (
    <div className="staff-verification-box">
      <p><strong>Verify {formatPhone(phone)}</strong></p>
      {!verification.challengeId ? <button className="button" type="button" disabled={!isValidPhone(phone)} onClick={requestCode}>Send code</button> : null}
      {verification.challengeId && !verification.verified ? (
        <div className="staff-verification-entry">
          <label>Verification code<input inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={verification.code} onChange={(event) => onChange({ ...verification, code: event.target.value.replace(/\D/g, '').slice(0, 6), error: '' })} /></label>
          <button className="button" type="button" disabled={verification.code.length !== 6} onClick={verify}>Verify</button>
          <button className="text-button" type="button" onClick={requestCode}>Send another</button>
        </div>
      ) : null}
      {verification.verified ? <p className="success-message">Phone verified.</p> : null}
      {verification.developmentCode && !verification.verified ? <p className="development-code"><strong>Development code:</strong> {verification.developmentCode}<span>Queued for SMS delivery when the production transport is connected.</span></p> : null}
      {verification.error ? <p className="form-error" role="alert">{verification.error}</p> : null}
    </div>
  );
}

function StaffLoginPage() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [verification, setVerification] = useState<VerificationState>(emptyVerification);
  const [error, setError] = useState('');
  const matching = findAccount(email, phone);
  const validStaff = matching && matching.role !== 'customer' && matching.staffProfileId;

  const finishLogin = () => {
    if (!matching || !validStaff || !verification.verified) {
      setError('Complete phone verification with the contact details attached to the staff account.');
      return;
    }
    startSession(matching);
    window.location.assign('/staff');
  };

  return (
    <section className="section staff-login-page platform-pattern platform-pattern-poles">
      <div className="container narrow-container">
        <div className="staff-login-card">
          <p className="eyebrow">Staff portal</p>
          <h1>Sign in to your chair.</h1>
          <p>Use the email and mobile number saved during staff setup.</p>
          <div className="staff-form-grid">
            <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setVerification(emptyVerification); setError(''); }} /></label>
            <label>Mobile phone<input type="tel" autoComplete="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setVerification(emptyVerification); setError(''); }} /></label>
          </div>
          {email && phone && !validStaff ? <p className="form-error">No completed staff account matches those details.</p> : null}
          {validStaff ? <PhoneVerificationFields phone={phone} verification={verification} onChange={setVerification} /> : null}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="button" type="button" disabled={!validStaff || !verification.verified} onClick={finishLogin}>Open staff portal</button>
          <div className="staff-login-links"><a href="/staff/setup">Set up a staff account</a><a href="/account">Customer sign in</a></div>
        </div>
      </div>
    </section>
  );
}

function SetupProgress({ step }: { step: number }) {
  const labels = ['Profile', 'Location', 'Services', 'Work hours', 'Booking rules', 'Payouts', 'Verify'];
  return (
    <aside className="staff-setup-progress">
      <p className="eyebrow">Account setup</p>
      <ol>
        {labels.map((label, index) => (
          <li className={step === index + 1 ? 'is-current' : step > index + 1 ? 'is-complete' : ''} key={label}><span>{index + 1}</span>{label}</li>
        ))}
      </ol>
    </aside>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <small className="field-error" role="alert">{message}</small> : null;
}

function StaffSetupPage() {
  const existing = readStaffProfiles().find((profile) => profile.setupComplete);
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<StaffProfile>(() => existing ?? createStaffProfileDraft());
  const [verification, setVerification] = useState<VerificationState>(emptyVerification);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (existing) window.location.replace('/staff/settings');
  }, [existing]);

  const updateSchedule = (day: WeeklyWindow['day'], patch: Partial<WeeklyWindow>) => {
    setProfile((current) => ({
      ...current,
      schedule: current.schedule.map((window) => window.day === day ? { ...window, ...patch } : window),
    }));
  };

  const toggleService = (serviceId: string) => {
    setProfile((current) => ({
      ...current,
      serviceIds: current.serviceIds.includes(serviceId)
        ? current.serviceIds.filter((id) => id !== serviceId)
        : [...current.serviceIds, serviceId],
    }));
  };

  const nextStep = (next: number) => {
    const validation = validateStaffProfile(profile);
    const currentErrors: Record<string, string> = {};
    if (step === 1) {
      if (validation.professionalName) currentErrors.professionalName = validation.professionalName;
      if (validation.email) currentErrors.email = validation.email;
      if (validation.phone) currentErrors.phone = validation.phone;
    }
    if (step === 2) {
      if (validation.locationName) currentErrors.locationName = validation.locationName;
      if (validation.locationAddress) currentErrors.locationAddress = validation.locationAddress;
    }
    if (step === 3 && validation.serviceIds) currentErrors.serviceIds = validation.serviceIds;
    if (step === 4) {
      Object.entries(validation).forEach(([key, value]) => {
        if (key === 'schedule' || key.startsWith('schedule-')) currentErrors[key] = value;
      });
    }
    setErrors(currentErrors);
    if (!Object.keys(currentErrors).length) setStep(next);
  };

  const completeSetup = () => {
    const validation = validateStaffProfile(profile);
    if (Object.keys(validation).length || !verification.verified) {
      setErrors(validation);
      return;
    }
    const completed: StaffProfile = {
      ...profile,
      email: profile.email.trim().toLowerCase(),
      phone: profile.phone.replace(/\D/g, '').slice(-10),
      setupComplete: true,
      updatedAt: new Date().toISOString(),
    };
    saveStaffProfile(completed);
    const account = createOrUpdateStaffAccount({
      name: completed.professionalName,
      email: completed.email,
      phone: completed.phone,
      role: completed.role,
      staffProfileId: completed.id,
      phoneVerified: true,
    });
    startSession(account);
    window.location.assign('/staff');
  };

  if (existing) return <section className="section staff-platform-page"><div className="container narrow-container"><div className="staff-empty-state"><h1>Opening staff settings.</h1><p>Completed setup is managed from the protected Settings page.</p><a className="button" href="/staff/settings">Continue</a></div></div></section>;

  return (
    <section className="section staff-platform-page platform-pattern platform-pattern-tools">
      <div className="container route-wide">
        <header className="staff-platform-header">
          <div><p className="eyebrow">Staff account setup</p><h1>Build the schedule customers can trust.</h1></div>
          <a className="text-link" href="/staff/login">Already set up? Sign in</a>
        </header>
        <div className="staff-setup-layout">
          <SetupProgress step={step} />
          <main className="staff-setup-card">
            {step === 1 ? (
              <section>
                <p className="eyebrow">Step 1 of 7</p><h2>Professional profile</h2><p>Required fields are marked and must be valid before continuing.</p>
                <div className="staff-form-grid">
                  <label>Professional name <span aria-hidden="true">*</span><input required value={profile.professionalName} onChange={(event) => setProfile({ ...profile, professionalName: event.target.value })} /><FieldError message={errors.professionalName} /></label>
                  <label>Email <span aria-hidden="true">*</span><input required type="email" autoComplete="email" value={profile.email} onChange={(event) => { setProfile({ ...profile, email: event.target.value }); setVerification(emptyVerification); }} /><FieldError message={errors.email} /></label>
                  <label>Mobile phone <span aria-hidden="true">*</span><input required type="tel" autoComplete="tel" value={profile.phone} onChange={(event) => { setProfile({ ...profile, phone: event.target.value }); setVerification(emptyVerification); }} /><FieldError message={errors.phone} /></label>
                  <label>Portal role<input value="Barber" readOnly /><small>Managers and owners assign elevated permissions after setup.</small></label>
                  <label className="staff-form-wide">Public introduction<textarea rows={4} value={profile.publicBio} onChange={(event) => setProfile({ ...profile, publicBio: event.target.value })} placeholder="Optional short introduction shown to customers" /></label>
                </div>
                <div className="staff-form-actions"><span /><button className="button" type="button" onClick={() => nextStep(2)}>Continue</button></div>
              </section>
            ) : null}

            {step === 2 ? (
              <section>
                <p className="eyebrow">Step 2 of 7</p><h2>Work location</h2><p>The Main Street shop is selected by default. Future approved locations can be added by management.</p>
                <label className="staff-location-card is-selected"><input type="radio" checked readOnly /><span><strong>{primaryLocation.name}</strong><small>{primaryLocation.address}</small></span></label>
                <div className="staff-form-grid">
                  <label>Location display name <span aria-hidden="true">*</span><input required value={profile.locationName} onChange={(event) => setProfile({ ...profile, locationName: event.target.value })} /><FieldError message={errors.locationName} /></label>
                  <label>Address <span aria-hidden="true">*</span><input required value={profile.locationAddress} onChange={(event) => setProfile({ ...profile, locationAddress: event.target.value })} /><FieldError message={errors.locationAddress} /></label>
                </div>
                <div className="staff-form-actions"><button className="button button-secondary" type="button" onClick={() => setStep(1)}>Back</button><button className="button" type="button" onClick={() => nextStep(3)}>Choose services</button></div>
              </section>
            ) : null}

            {step === 3 ? (
              <section>
                <p className="eyebrow">Step 3 of 7</p><h2>Services you accept</h2><p>Select every service customers can request from your chair.</p>
                <FieldError message={errors.serviceIds} />
                <div className="staff-service-selector">
                  {barberServiceOptions.map((service) => (
                    <label className={profile.serviceIds.includes(service.id) ? 'is-selected' : ''} key={service.id}><input type="checkbox" checked={profile.serviceIds.includes(service.id)} onChange={() => toggleService(service.id)} /><span><small>{service.category}</small><strong>{service.name}</strong></span><span><strong>{service.price}</strong><small>{service.durationMinutes} min</small></span></label>
                  ))}
                </div>
                <div className="staff-form-actions"><button className="button button-secondary" type="button" onClick={() => setStep(2)}>Back</button><button className="button" type="button" onClick={() => nextStep(4)}>Set work hours</button></div>
              </section>
            ) : null}

            {step === 4 ? (
              <section>
                <p className="eyebrow">Step 4 of 7</p><h2>Weekly work hours</h2><p>These hours drive the customer-facing availability engine.</p>
                <FieldError message={errors.schedule} />
                <div className="staff-hours-editor">
                  {profile.schedule.map((window) => (
                    <div className={window.enabled ? 'is-enabled' : ''} key={window.day}>
                      <label><input type="checkbox" checked={window.enabled} onChange={(event) => updateSchedule(window.day, { enabled: event.target.checked })} />{window.label}</label>
                      <input type="time" value={window.start} disabled={!window.enabled} aria-label={`${window.label} start time`} onChange={(event) => updateSchedule(window.day, { start: event.target.value })} />
                      <span>to</span>
                      <input type="time" value={window.end} disabled={!window.enabled} aria-label={`${window.label} end time`} onChange={(event) => updateSchedule(window.day, { end: event.target.value })} />
                      <FieldError message={errors[`schedule-${window.day}`]} />
                    </div>
                  ))}
                </div>
                <div className="staff-form-actions"><button className="button button-secondary" type="button" onClick={() => setStep(3)}>Back</button><button className="button" type="button" onClick={() => nextStep(5)}>Booking rules</button></div>
              </section>
            ) : null}

            {step === 5 ? (
              <section>
                <p className="eyebrow">Step 5 of 7</p><h2>Booking and waitlist rules</h2>
                <div className="staff-form-grid">
                  <label>Buffer after appointments<select value={profile.bookingRules.bufferMinutes} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, bufferMinutes: Number(event.target.value) } })}><option value="0">No buffer</option><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option></select></label>
                  <label>Minimum notice<select value={profile.bookingRules.minimumNoticeHours} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, minimumNoticeHours: Number(event.target.value) } })}><option value="0">Same time if open</option><option value="1">1 hour</option><option value="2">2 hours</option><option value="4">4 hours</option><option value="24">24 hours</option></select></label>
                  <label>Booking window<select value={profile.bookingRules.bookingWindowDays} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, bookingWindowDays: Number(event.target.value) } })}><option value="14">14 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select></label>
                </div>
                <div className="staff-toggle-list">
                  <label><input type="checkbox" checked={profile.bookingRules.acceptsNewClients} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, acceptsNewClients: event.target.checked } })} /><span><strong>Accept new clients</strong><small>Allow first-time customers to request your chair.</small></span></label>
                  <label><input type="checkbox" checked={profile.bookingRules.allowAnyAvailable} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, allowAnyAvailable: event.target.checked } })} /><span><strong>Join Any Available Barber</strong><small>Allow open times to be matched to your chair.</small></span></label>
                  <label><input type="checkbox" checked={profile.bookingRules.acceptsWalkIns} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, acceptsWalkIns: event.target.checked } })} /><span><strong>See walk-in requests</strong><small>Claim last-minute clients or propose another time.</small></span></label>
                </div>
                <div className="staff-form-actions"><button className="button button-secondary" type="button" onClick={() => setStep(4)}>Back</button><button className="button" type="button" onClick={() => setStep(6)}>Payout setup</button></div>
              </section>
            ) : null}

            {step === 6 ? (
              <section>
                <p className="eyebrow">Step 6 of 7</p><h2>Payout profile</h2>
                <div className="staff-payout-notice"><strong>No banking information is collected here.</strong><p>The platform records approved earnings and manual payouts until a regulated transfer provider is connected.</p></div>
                <div className="staff-form-grid">
                  <label>Payout tracking<input value="Manual payout ledger" readOnly /></label>
                  <label>Preferred frequency<select value={profile.payoutProfile.frequency} onChange={(event) => setProfile({ ...profile, payoutProfile: { ...profile.payoutProfile, frequency: event.target.value as StaffProfile['payoutProfile']['frequency'] } })}><option value="weekly">Weekly</option><option value="biweekly">Every two weeks</option><option value="monthly">Monthly</option></select></label>
                </div>
                <div className="staff-form-actions"><button className="button button-secondary" type="button" onClick={() => setStep(5)}>Back</button><button className="button" type="button" onClick={() => setStep(7)}>Verify account</button></div>
              </section>
            ) : null}

            {step === 7 ? (
              <section>
                <p className="eyebrow">Step 7 of 7</p><h2>Verify and activate the staff account</h2>
                <div className="staff-review-panel"><p><strong>Professional:</strong> {profile.professionalName}</p><p><strong>Email:</strong> {profile.email}</p><p><strong>Phone:</strong> {formatPhone(profile.phone)}</p><p><strong>Services:</strong> {profile.serviceIds.length}</p><p><strong>Working days:</strong> {profile.schedule.filter((window) => window.enabled).length}</p></div>
                <PhoneVerificationFields phone={profile.phone} verification={verification} onChange={setVerification} />
                <div className="staff-form-actions"><button className="button button-secondary" type="button" onClick={() => setStep(6)}>Back</button><button className="button" type="button" disabled={!verification.verified} onClick={completeSetup}>Activate staff portal</button></div>
              </section>
            ) : null}
          </main>
        </div>
      </div>
    </section>
  );
}

function StaffSettingsPage({ profile }: { profile: StaffProfile }) {
  const [draft, setDraft] = useState(profile);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateSchedule = (day: WeeklyWindow['day'], patch: Partial<WeeklyWindow>) => {
    setDraft((current) => ({ ...current, schedule: current.schedule.map((window) => window.day === day ? { ...window, ...patch } : window) }));
  };

  const save = () => {
    const validation = validateStaffProfile(draft);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    saveStaffProfile({ ...draft, updatedAt: new Date().toISOString() });
    setMessage('Staff settings saved. Updated availability is now used by the booking prototype.');
  };

  return (
    <StaffShell currentPath="/staff/settings" profile={profile}>
      <div className="staff-settings-layout">
        <section className="staff-dashboard-panel">
          <p className="eyebrow">Profile and contact</p><h2>Public staff details</h2>
          <div className="staff-form-grid">
            <label>Professional name<input value={draft.professionalName} onChange={(event) => setDraft({ ...draft, professionalName: event.target.value })} /><FieldError message={errors.professionalName} /></label>
            <label>Email<input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /><FieldError message={errors.email} /></label>
            <label>Phone<input type="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /><FieldError message={errors.phone} /></label>
            <label className="staff-form-wide">Public introduction<textarea rows={4} value={draft.publicBio} onChange={(event) => setDraft({ ...draft, publicBio: event.target.value })} /></label>
          </div>
        </section>
        <section className="staff-dashboard-panel">
          <p className="eyebrow">Services and rules</p><h2>Booking controls</h2>
          <div className="staff-service-selector compact">
            {barberServiceOptions.map((service) => <label className={draft.serviceIds.includes(service.id) ? 'is-selected' : ''} key={service.id}><input type="checkbox" checked={draft.serviceIds.includes(service.id)} onChange={() => setDraft({ ...draft, serviceIds: draft.serviceIds.includes(service.id) ? draft.serviceIds.filter((id) => id !== service.id) : [...draft.serviceIds, service.id] })} /><span><small>{service.category}</small><strong>{service.name}</strong></span></label>)}
          </div>
          <div className="staff-toggle-list">
            <label><input type="checkbox" checked={draft.bookingRules.acceptsNewClients} onChange={(event) => setDraft({ ...draft, bookingRules: { ...draft.bookingRules, acceptsNewClients: event.target.checked } })} /><span><strong>Accept new clients</strong></span></label>
            <label><input type="checkbox" checked={draft.bookingRules.allowAnyAvailable} onChange={(event) => setDraft({ ...draft, bookingRules: { ...draft.bookingRules, allowAnyAvailable: event.target.checked } })} /><span><strong>Any Available Barber</strong></span></label>
            <label><input type="checkbox" checked={draft.bookingRules.acceptsWalkIns} onChange={(event) => setDraft({ ...draft, bookingRules: { ...draft.bookingRules, acceptsWalkIns: event.target.checked } })} /><span><strong>Walk-in requests</strong></span></label>
          </div>
        </section>
        <section className="staff-dashboard-panel staff-form-wide">
          <p className="eyebrow">Work hours</p><h2>Weekly availability</h2>
          <div className="staff-hours-editor">{draft.schedule.map((window) => <div className={window.enabled ? 'is-enabled' : ''} key={window.day}><label><input type="checkbox" checked={window.enabled} onChange={(event) => updateSchedule(window.day, { enabled: event.target.checked })} />{window.label}</label><input type="time" value={window.start} disabled={!window.enabled} onChange={(event) => updateSchedule(window.day, { start: event.target.value })} /><span>to</span><input type="time" value={window.end} disabled={!window.enabled} onChange={(event) => updateSchedule(window.day, { end: event.target.value })} /></div>)}</div>
        </section>
        {message ? <p className="success-message staff-form-wide" role="status">{message}</p> : null}
        <button className="button staff-form-wide" type="button" onClick={save}>Save staff settings</button>
      </div>
    </StaffShell>
  );
}

function AppointmentActionPanel({
  appointment,
  profiles,
  onClose,
  onSaved,
}: {
  appointment: PlatformAppointment;
  profiles: StaffProfile[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const directory = getBarberDirectory(profiles);
  const [date, setDate] = useState(appointment.proposedDate ?? appointment.date);
  const [time, setTime] = useState(appointment.proposedTime ?? appointment.time.replace('Waiting list', '10:00 AM'));
  const [barberId, setBarberId] = useState(appointment.assignedBarberId ?? profiles[0]?.id ?? '');
  const [staffNote, setStaffNote] = useState(appointment.staffNote);
  const [message, setMessage] = useState('');
  const selectedBarber = directory.find((barber) => (barber.profile?.id ?? barber.id) === barberId);
  const startMinutes = timeLabelToMinutes(time);

  const saveDetails = () => {
    updateAppointment(appointment.id, {
      date,
      time,
      startMinutes,
      endMinutes: startMinutes + appointment.durationMinutes,
      assignedBarberId: barberId || null,
      barberName: selectedBarber?.name ?? appointment.barberName,
      staffNote,
    });
    setMessage('Appointment details updated.');
    onSaved();
  };

  const confirm = () => {
    saveDetails();
    confirmAppointment(appointment.id, barberId);
    onSaved();
    onClose();
  };

  const decline = () => {
    declineAppointment(appointment.id, staffNote);
    onSaved();
    onClose();
  };

  const propose = () => {
    if (!selectedBarber || !date || !time) return;
    proposeAppointmentTime(appointment.id, {
      date,
      time,
      startMinutes,
      assignedBarberId: barberId,
      barberName: selectedBarber.name,
      staffNote,
    });
    onSaved();
    onClose();
  };

  const claim = () => {
    if (!selectedBarber || !date || !time) return;
    claimWalkIn(appointment.id, {
      staffId: barberId,
      barberName: selectedBarber.name,
      date,
      time,
      startMinutes,
    });
    onSaved();
    onClose();
  };

  return (
    <div className="appointment-editor" role="dialog" aria-modal="true" aria-labelledby="appointment-editor-heading">
      <button className="appointment-editor-backdrop" type="button" aria-label="Close appointment editor" onClick={onClose} />
      <section>
        <div className="appointment-editor-heading"><div><p className="eyebrow">Manage request</p><h2 id="appointment-editor-heading">{appointment.customerName}</h2></div><button className="text-button" type="button" onClick={onClose}>Close</button></div>
        <dl className="appointment-editor-summary"><div><dt>Service</dt><dd>{appointment.serviceName}</dd></div><div><dt>Current status</dt><dd>{appointment.status.replaceAll('-', ' ')}</dd></div><div><dt>Phone</dt><dd>{formatPhone(appointment.customerPhone)}</dd></div><div><dt>Email</dt><dd>{appointment.customerEmail}</dd></div></dl>
        <div className="staff-form-grid">
          <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label>Time<input type="time" value={startMinutes ? `${String(Math.floor(startMinutes / 60)).padStart(2, '0')}:${String(startMinutes % 60).padStart(2, '0')}` : ''} onChange={(event) => setTime(minutesToTimeLabel(Number(event.target.value.split(':')[0] ?? 0) * 60 + Number(event.target.value.split(':')[1] ?? 0)))} /></label>
          <label>Assigned barber<select value={barberId} onChange={(event) => setBarberId(event.target.value)}><option value="">Unassigned</option>{directory.map((barber) => { const id = barber.profile?.id ?? barber.id; return <option value={id} key={id}>{barber.name}</option>; })}</select></label>
          <label className="staff-form-wide">Internal note<textarea rows={4} value={staffNote} onChange={(event) => setStaffNote(event.target.value)} /></label>
        </div>
        {appointment.customerNote ? <p className="appointment-customer-note"><strong>Customer note:</strong> {appointment.customerNote}</p> : null}
        {message ? <p className="success-message" role="status">{message}</p> : null}
        <div className="appointment-editor-actions">
          <button className="button button-secondary" type="button" onClick={saveDetails}>Save details</button>
          {appointment.status === 'waitlisted' ? <button className="button" type="button" disabled={!barberId} onClick={claim}>Claim and confirm</button> : <button className="button" type="button" disabled={!barberId} onClick={confirm}>Confirm appointment</button>}
          <button className="button button-secondary" type="button" disabled={!barberId} onClick={propose}>Propose this time</button>
          <button className="text-button danger" type="button" onClick={decline}>Decline request</button>
        </div>
      </section>
    </div>
  );
}

function AppointmentList({
  appointments,
  profiles,
  onSaved,
}: {
  appointments: PlatformAppointment[];
  profiles: StaffProfile[];
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState<PlatformAppointment | null>(null);

  return (
    <>
      <div className="staff-appointment-list">
        {appointments.map((appointment) => (
          <article key={appointment.id}>
            <time><span>{appointment.date}</span><strong>{appointment.time}</strong></time>
            <div><p className="eyebrow">{appointment.source.replace('-', ' ')}</p><h3>{appointment.customerName}</h3><p>{appointment.serviceName} · {appointment.barberName}</p></div>
            <span className={`staff-status staff-status-${appointment.status}`}>{appointment.status.replaceAll('-', ' ')}</span>
            <button className="button button-secondary" type="button" onClick={() => setEditing(appointment)}>Manage</button>
          </article>
        ))}
      </div>
      {editing ? <AppointmentActionPanel appointment={editing} profiles={profiles} onClose={() => setEditing(null)} onSaved={onSaved} /> : null}
    </>
  );
}

function StaffDashboardPage({ profile }: { profile: StaffProfile }) {
  const [appointments, setAppointments] = useState(() => readAppointments());
  const [notifications, setNotifications] = useState(() => readNotifications());
  const profiles = readStaffProfiles();

  useEffect(() => subscribeToAppointmentChanges(() => {
    setAppointments(readAppointments());
    setNotifications(readNotifications());
  }), []);

  const pending = appointments.filter((appointment) => appointment.status === 'requested' || appointment.status === 'reschedule-proposed');
  const waitlist = appointments.filter((appointment) => appointment.status === 'waitlisted');
  const upcoming = appointments.filter((appointment) => appointment.status === 'confirmed').slice(0, 5);

  return (
    <StaffShell currentPath="/staff" profile={profile}>
      <div className="staff-dashboard-grid">
        <section className="staff-dashboard-welcome"><p className="eyebrow">Welcome back</p><h2>{profile.professionalName}</h2><p>{profile.locationAddress}</p><div className="staff-dashboard-actions"><a className="button" href="/staff/calendar">Open calendar</a><a className="button button-secondary" href="/staff/settings">Edit availability</a></div></section>
        <section className="staff-stat-grid" aria-label="Staff summary">
          <article><small>Needs review</small><strong>{pending.length}</strong><span>appointment requests</span></article>
          <article><small>Waiting list</small><strong>{waitlist.length}</strong><span>last-minute clients</span></article>
          <article><small>Confirmed</small><strong>{upcoming.length}</strong><span>upcoming appointments</span></article>
          <article><small>Queued updates</small><strong>{notifications.filter((notification) => notification.status === 'queued').length}</strong><span>email or SMS events</span></article>
        </section>
        <section className="staff-dashboard-panel staff-dashboard-wide"><div className="staff-panel-heading"><div><p className="eyebrow">Needs attention</p><h2>Appointment requests</h2></div><a href="/staff/requests">View all</a></div>{pending.length ? <AppointmentList appointments={pending.slice(0, 4)} profiles={profiles} onSaved={() => setAppointments(readAppointments())} /> : <p>No appointment requests are waiting for review.</p>}</section>
        <section className="staff-dashboard-panel"><div className="staff-panel-heading"><div><p className="eyebrow">Waiting list</p><h2>Open walk-ins</h2></div><a href="/staff/waitlist">Open queue</a></div>{waitlist.length ? <p>{waitlist.length} client{waitlist.length === 1 ? '' : 's'} waiting for a barber to claim or reschedule.</p> : <p>No walk-in requests are waiting.</p>}</section>
        <section className="staff-dashboard-panel"><div className="staff-panel-heading"><div><p className="eyebrow">Published hours</p><h2>This week</h2></div></div><dl className="staff-schedule-summary">{profile.schedule.map((window) => <div key={window.day}><dt>{window.label}</dt><dd>{window.enabled ? `${window.start} to ${window.end}` : 'Not available'}</dd></div>)}</dl></section>
      </div>
    </StaffShell>
  );
}

function StaffRequestsPage({ profile }: { profile: StaffProfile }) {
  const [appointments, setAppointments] = useState(() => readAppointments());
  const profiles = readStaffProfiles();
  useEffect(() => subscribeToAppointmentChanges(() => setAppointments(readAppointments())), []);
  const requests = appointments.filter((appointment) => ['requested', 'reschedule-proposed'].includes(appointment.status));
  return <StaffShell currentPath="/staff/requests" profile={profile}><div className="staff-section-heading"><div><p className="eyebrow">Approval queue</p><h2>Appointment requests</h2></div></div>{requests.length ? <AppointmentList appointments={requests} profiles={profiles} onSaved={() => setAppointments(readAppointments())} /> : <div className="staff-empty-state"><h2>No requests need review.</h2></div>}</StaffShell>;
}

function StaffWaitlistPage({ profile }: { profile: StaffProfile }) {
  const [appointments, setAppointments] = useState(() => readAppointments());
  const profiles = readStaffProfiles();
  useEffect(() => subscribeToAppointmentChanges(() => setAppointments(readAppointments())), []);
  const waitlist = appointments.filter((appointment) => appointment.status === 'waitlisted');
  return <StaffShell currentPath="/staff/waitlist" profile={profile}><div className="staff-section-heading"><div><p className="eyebrow">Walk-ins and last-minute clients</p><h2>Waiting list</h2></div><a className="button" href="/book/walk-in">Add a customer</a></div>{waitlist.length ? <AppointmentList appointments={waitlist} profiles={profiles} onSaved={() => setAppointments(readAppointments())} /> : <div className="staff-empty-state"><h2>The waiting list is clear.</h2><p>New walk-in requests appear here for the crew to claim or reschedule.</p></div>}</StaffShell>;
}

function CalendarToolbar({
  view,
  dateKey,
  onView,
  onDate,
}: {
  view: CalendarView;
  dateKey: string;
  onView: (view: CalendarView) => void;
  onDate: (dateKey: string) => void;
}) {
  const move = (direction: -1 | 1) => {
    if (view === 'day') onDate(addDays(dateKey, direction));
    if (view === 'week') onDate(addDays(dateKey, direction * 7));
    if (view === 'month') {
      const date = new Date(`${dateKey}T12:00:00`);
      date.setMonth(date.getMonth() + direction);
      onDate(date.toISOString().slice(0, 10));
    }
  };

  return (
    <div className="staff-calendar-toolbar">
      <div className="calendar-navigation"><button type="button" onClick={() => move(-1)} aria-label="Previous period">←</button><button type="button" onClick={() => onDate(todayKey())}>Today</button><button type="button" onClick={() => move(1)} aria-label="Next period">→</button></div>
      <strong>{view === 'month' ? formatDate(dateKey, { month: 'long', year: 'numeric' }) : view === 'week' ? `Week of ${formatDate(startOfWeek(dateKey))}` : formatDate(dateKey, { weekday: 'long', month: 'long', day: 'numeric' })}</strong>
      <div className="calendar-view-switch" role="group" aria-label="Calendar view"><button className={view === 'day' ? 'is-active' : ''} type="button" onClick={() => onView('day')}>Day</button><button className={view === 'week' ? 'is-active' : ''} type="button" onClick={() => onView('week')}>Week</button><button className={view === 'month' ? 'is-active' : ''} type="button" onClick={() => onView('month')}>Month</button></div>
    </div>
  );
}

function StaffCalendarPage({ profile }: { profile: StaffProfile }) {
  const [appointments, setAppointments] = useState(() => readAppointments());
  const [view, setView] = useState<CalendarView>('day');
  const [dateKey, setDateKey] = useState(todayKey);
  const [statusFilter, setStatusFilter] = useState<'all' | AppointmentStatus>('all');
  const [barberFilter, setBarberFilter] = useState('all');
  const profiles = readStaffProfiles();
  useEffect(() => subscribeToAppointmentChanges(() => setAppointments(readAppointments())), []);

  const filtered = appointments.filter((appointment) => (
    (statusFilter === 'all' || appointment.status === statusFilter)
    && (barberFilter === 'all' || appointment.assignedBarberId === barberFilter)
  ));
  const visibleDates = view === 'day'
    ? [dateKey]
    : view === 'week'
      ? Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(dateKey), index))
      : monthKeys(dateKey);
  const visible = filtered.filter((appointment) => visibleDates.includes(appointment.date)).sort((a, b) => appointmentDateTime(a).localeCompare(appointmentDateTime(b)));

  return (
    <StaffShell currentPath="/staff/calendar" profile={profile}>
      <div className="staff-section-heading"><div><p className="eyebrow">Appointments</p><h2>Calendar</h2></div><div className="staff-dashboard-actions"><a className="button" href="/book">Create request</a><a className="button button-secondary" href="/book/walk-in">Add walk-in</a></div></div>
      <CalendarToolbar view={view} dateKey={dateKey} onView={setView} onDate={setDateKey} />
      <div className="calendar-filters"><label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | AppointmentStatus)}><option value="all">All statuses</option><option value="requested">Requested</option><option value="confirmed">Confirmed</option><option value="reschedule-proposed">Reschedule proposed</option><option value="waitlisted">Waitlisted</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="declined">Declined</option><option value="no-show">No-show</option></select></label><label>Barber<select value={barberFilter} onChange={(event) => setBarberFilter(event.target.value)}><option value="all">All barbers</option>{profiles.map((staff) => <option value={staff.id} key={staff.id}>{staff.professionalName}</option>)}</select></label></div>
      {view === 'month' ? (
        <div className="staff-month-grid">{visibleDates.map((day) => { const dayAppointments = visible.filter((appointment) => appointment.date === day); return <button className={day === todayKey() ? 'is-today' : ''} type="button" key={day} onClick={() => { setDateKey(day); setView('day'); }}><span>{new Date(`${day}T12:00:00`).getDate()}</span><strong>{dayAppointments.length}</strong><small>{dayAppointments.length === 1 ? 'appointment' : 'appointments'}</small></button>; })}</div>
      ) : (
        <div className={view === 'week' ? 'staff-week-grid' : 'staff-day-view'}>
          {visibleDates.map((day) => {
            const dayAppointments = visible.filter((appointment) => appointment.date === day);
            return <section className="staff-calendar-day" key={day}><header><span>{formatDate(day, { weekday: 'short' })}</span><strong>{formatDate(day, { month: 'short', day: 'numeric' })}</strong><small>{dayAppointments.length} scheduled</small></header>{dayAppointments.length ? <AppointmentList appointments={dayAppointments} profiles={profiles} onSaved={() => setAppointments(readAppointments())} /> : <p className="calendar-empty">No matching appointments.</p>}</section>;
          })}
        </div>
      )}
    </StaffShell>
  );
}

function StaffEarningsPage({ profile }: { profile: StaffProfile }) {
  const completed = readAppointments().filter((appointment) => appointment.status === 'completed' && appointment.assignedBarberId === profile.id);
  const gross = completed.reduce((total, appointment) => total + appointment.priceCents, 0);
  return <StaffShell currentPath="/staff/earnings" profile={profile}><div className="staff-section-heading"><div><p className="eyebrow">Earnings ledger</p><h2>Completed services and shop sales</h2></div></div><div className="staff-stat-grid"><article><small>Gross service sales</small><strong>${(gross / 100).toFixed(2)}</strong><span>{completed.length} completed services</span></article><article><small>Tips recorded</small><strong>$0.00</strong><span>not enabled yet</span></article><article><small>Adjustments</small><strong>$0.00</strong><span>none recorded</span></article><article><small>Approved payout</small><strong>$0.00</strong><span>awaiting compensation rules</span></article></div><div className="staff-dashboard-panel"><p className="eyebrow">Ledger status</p><h2>Service totals are separated from payout rules.</h2><p>Completed appointments can feed the ledger now. Shop share, tips, taxes, booth rent, payroll, and staff share remain administrator-controlled business rules.</p></div></StaffShell>;
}

function StaffPayoutsPage({ profile }: { profile: StaffProfile }) {
  return <StaffShell currentPath="/staff/payouts" profile={profile}><div className="staff-section-heading"><div><p className="eyebrow">Payouts</p><h2>Track what the shop owes and pays.</h2></div></div><div className="staff-payout-layout"><section className="staff-dashboard-panel"><p className="eyebrow">Current mode</p><h2>Manual payout ledger</h2><p>The platform can record approved earnings and external payouts without storing bank account numbers.</p><dl className="staff-payout-summary"><div><dt>Available</dt><dd>$0.00</dd></div><div><dt>Pending review</dt><dd>$0.00</dd></div><div><dt>Last payout</dt><dd>None</dd></div></dl></section><section className="staff-dashboard-panel"><p className="eyebrow">Automated payouts</p><h2>Regulated transfer connection required</h2><p>Identity checks, tokenized bank setup, settlement, tax reporting, and disputes must be handled by a licensed provider before direct transfers are enabled.</p><button className="button" type="button" disabled>Connect payout destination later</button></section></div></StaffShell>;
}

function StaffNotificationsPage({ profile }: { profile: StaffProfile }) {
  const [notifications, setNotifications] = useState<NotificationRecord[]>(() => readNotifications());
  useEffect(() => subscribeToAppointmentChanges(() => setNotifications(readNotifications())), []);
  return <StaffShell currentPath="/staff/notifications" profile={profile}><div className="staff-section-heading"><div><p className="eyebrow">Transactional messages</p><h2>Email and SMS outbox</h2></div></div><p className="staff-preview-notice">These records prove when the application would send a verification, confirmation, receipt, or status update. Production delivery still requires configured email and SMS transports.</p>{notifications.length ? <div className="notification-outbox">{notifications.slice().reverse().map((notification) => <article key={notification.id}><div><span>{notification.channel}</span><strong>{notification.subject}</strong><small>{notification.recipient}</small></div><p>{notification.message}</p><span className={`staff-status staff-status-${notification.status}`}>{notification.status}</span></article>)}</div> : <div className="staff-empty-state"><h2>No messages queued yet.</h2></div>}</StaffShell>;
}

function StaffProtectedRoutes({ path }: { path: string }) {
  const account = getSessionAccount();
  const profile = getProfileForSession();
  if (!account || account.role === 'customer' || !profile) {
    return <section className="section staff-login-required platform-pattern platform-pattern-poles"><div className="container narrow-container"><div className="staff-empty-state"><p className="eyebrow">Staff sign-in required</p><h1>Open the protected staff portal.</h1><p>Appointment details, customer contact information, schedules, earnings, and payouts are available only after staff verification.</p><a className="button" href="/staff/login">Staff sign in</a></div></div></section>;
  }

  if (path === '/staff/settings' || path === '/staff/setup') return <StaffSettingsPage profile={profile} />;
  if (path === '/staff/calendar') return <StaffCalendarPage profile={profile} />;
  if (path === '/staff/requests') return <StaffRequestsPage profile={profile} />;
  if (path === '/staff/waitlist') return <StaffWaitlistPage profile={profile} />;
  if (path === '/staff/earnings') return <StaffEarningsPage profile={profile} />;
  if (path === '/staff/payouts') return <StaffPayoutsPage profile={profile} />;
  if (path === '/staff/notifications') return <StaffNotificationsPage profile={profile} />;
  return <StaffDashboardPage profile={profile} />;
}

export function StaffPlatformPage({ path }: { path: string }) {
  if (path === '/staff/login') return <StaffLoginPage />;
  if (path === '/staff/setup' && !readStaffProfiles().some((profile) => profile.setupComplete)) return <StaffSetupPage />;
  return <StaffProtectedRoutes path={path} />;
}
