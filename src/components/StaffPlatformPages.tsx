import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  barberServiceOptions,
  createStaffProfileDraft,
  primaryLocation,
  readAppointments,
  readStaffProfiles,
  saveStaffProfile,
  type PlatformAppointment,
  type StaffProfile,
  type WeeklyWindow,
} from '../data/platform';

function StaffNav({ currentPath }: { currentPath: string }) {
  const links = [
    ['Overview', '/staff'],
    ['Calendar', '/staff/calendar'],
    ['Earnings', '/staff/earnings'],
    ['Payouts', '/staff/payouts'],
    ['Setup', '/staff/setup'],
  ] as const;

  return (
    <nav className="staff-platform-nav" aria-label="Staff account">
      {links.map(([label, href]) => (
        <a href={href} aria-current={currentPath === href ? 'page' : undefined} key={href}>{label}</a>
      ))}
    </nav>
  );
}

function StaffShell({ currentPath, children }: { currentPath: string; children: ReactNode }) {
  return (
    <section className="section staff-platform-page">
      <div className="container route-wide">
        <header className="staff-platform-header">
          <div>
            <p className="eyebrow">The Kut Shoppe staff platform</p>
            <h1>Manage your chair.</h1>
          </div>
          <span className="staff-preview-badge">Development branch</span>
        </header>
        <StaffNav currentPath={currentPath} />
        {children}
      </div>
    </section>
  );
}

function StaffSetupPage() {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<StaffProfile>(() => createStaffProfileDraft());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const existing = readStaffProfiles()[0];
    if (existing) setProfile(existing);
  }, []);

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

  const completeSetup = () => {
    const completed: StaffProfile = {
      ...profile,
      setupComplete: true,
      updatedAt: new Date().toISOString(),
    };
    saveStaffProfile(completed);
    setProfile(completed);
    setSaved(true);
  };

  return (
    <StaffShell currentPath="/staff/setup">
      <div className="staff-setup-layout">
        <aside className="staff-setup-progress">
          <p className="eyebrow">Account setup</p>
          <ol>
            {['Profile', 'Location', 'Services', 'Work hours', 'Booking rules', 'Payouts'].map((label, index) => (
              <li className={step === index + 1 ? 'is-current' : step > index + 1 ? 'is-complete' : ''} key={label}>
                <span>{index + 1}</span>{label}
              </li>
            ))}
          </ol>
        </aside>

        <main className="staff-setup-card">
          {saved ? (
            <div className="staff-setup-complete">
              <p className="eyebrow">Setup saved</p>
              <h2>Your staff profile is ready for testing.</h2>
              <p>Your schedule and services now feed the browser-based booking prototype on this device.</p>
              <div className="staff-form-actions">
                <a className="button" href="/staff">Open dashboard</a>
                <a className="button button-secondary" href="/book">Test booking</a>
              </div>
            </div>
          ) : null}

          {!saved && step === 1 ? (
            <section aria-labelledby="staff-profile-heading">
              <p className="eyebrow">Step 1 of 6</p>
              <h2 id="staff-profile-heading">Professional profile</h2>
              <p>This is the public name customers will see while choosing a barber.</p>
              <div className="staff-form-grid">
                <label>Professional name<input value={profile.professionalName} onChange={(event) => setProfile({ ...profile, professionalName: event.target.value })} /></label>
                <label>Email<input type="email" autoComplete="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label>
                <label>Phone<input type="tel" autoComplete="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label>
                <label>Platform role<select value={profile.role} onChange={(event) => setProfile({ ...profile, role: event.target.value as StaffProfile['role'] })}><option value="barber">Barber</option><option value="manager">Manager</option><option value="owner">Owner</option></select></label>
              </div>
              <div className="staff-form-actions"><span /><button className="button" type="button" disabled={!profile.professionalName || !profile.email || !profile.phone} onClick={() => setStep(2)}>Continue</button></div>
            </section>
          ) : null}

          {!saved && step === 2 ? (
            <section aria-labelledby="staff-location-heading">
              <p className="eyebrow">Step 2 of 6</p>
              <h2 id="staff-location-heading">Work location</h2>
              <p>The Main Street shop is selected by default. Additional approved locations can be added later.</p>
              <label className="staff-location-card is-selected">
                <input type="radio" checked readOnly />
                <span><strong>{primaryLocation.name}</strong><small>{primaryLocation.address}</small></span>
              </label>
              <div className="staff-form-grid">
                <label>Location display name<input value={profile.locationName} onChange={(event) => setProfile({ ...profile, locationName: event.target.value })} /></label>
                <label>Address<input value={profile.locationAddress} onChange={(event) => setProfile({ ...profile, locationAddress: event.target.value })} /></label>
              </div>
              <div className="staff-form-actions"><button className="button button-secondary" type="button" onClick={() => setStep(1)}>Back</button><button className="button" type="button" onClick={() => setStep(3)}>Choose services</button></div>
            </section>
          ) : null}

          {!saved && step === 3 ? (
            <section aria-labelledby="staff-services-heading">
              <p className="eyebrow">Step 3 of 6</p>
              <h2 id="staff-services-heading">Services you accept</h2>
              <p>These service names and prices are seeded from the current public barber menu. Shop administrators will control final publication.</p>
              <div className="staff-service-selector">
                {barberServiceOptions.map((service) => (
                  <label className={profile.serviceIds.includes(service.id) ? 'is-selected' : ''} key={service.id}>
                    <input type="checkbox" checked={profile.serviceIds.includes(service.id)} onChange={() => toggleService(service.id)} />
                    <span><small>{service.category}</small><strong>{service.name}</strong></span>
                    <span><strong>{service.price}</strong><small>{service.durationMinutes} min</small></span>
                  </label>
                ))}
              </div>
              <div className="staff-form-actions"><button className="button button-secondary" type="button" onClick={() => setStep(2)}>Back</button><button className="button" type="button" disabled={!profile.serviceIds.length} onClick={() => setStep(4)}>Set work hours</button></div>
            </section>
          ) : null}

          {!saved && step === 4 ? (
            <section aria-labelledby="staff-hours-heading">
              <p className="eyebrow">Step 4 of 6</p>
              <h2 id="staff-hours-heading">Weekly work hours</h2>
              <p>Your published availability will be calculated from these hours, approved time off, breaks, and existing appointments.</p>
              <div className="staff-hours-editor">
                {profile.schedule.map((window) => (
                  <div className={window.enabled ? 'is-enabled' : ''} key={window.day}>
                    <label><input type="checkbox" checked={window.enabled} onChange={(event) => updateSchedule(window.day, { enabled: event.target.checked })} />{window.label}</label>
                    <input type="time" value={window.start} disabled={!window.enabled} aria-label={`${window.label} start time`} onChange={(event) => updateSchedule(window.day, { start: event.target.value })} />
                    <span>to</span>
                    <input type="time" value={window.end} disabled={!window.enabled} aria-label={`${window.label} end time`} onChange={(event) => updateSchedule(window.day, { end: event.target.value })} />
                  </div>
                ))}
              </div>
              <div className="staff-form-actions"><button className="button button-secondary" type="button" onClick={() => setStep(3)}>Back</button><button className="button" type="button" onClick={() => setStep(5)}>Booking rules</button></div>
            </section>
          ) : null}

          {!saved && step === 5 ? (
            <section aria-labelledby="staff-rules-heading">
              <p className="eyebrow">Step 5 of 6</p>
              <h2 id="staff-rules-heading">Booking rules</h2>
              <div className="staff-form-grid">
                <label>Buffer after appointments<select value={profile.bookingRules.bufferMinutes} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, bufferMinutes: Number(event.target.value) } })}><option value="0">No buffer</option><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option></select></label>
                <label>Minimum notice<select value={profile.bookingRules.minimumNoticeHours} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, minimumNoticeHours: Number(event.target.value) } })}><option value="0">Same time if open</option><option value="1">1 hour</option><option value="2">2 hours</option><option value="4">4 hours</option><option value="24">24 hours</option></select></label>
                <label>Booking window<select value={profile.bookingRules.bookingWindowDays} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, bookingWindowDays: Number(event.target.value) } })}><option value="14">14 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select></label>
              </div>
              <div className="staff-toggle-list">
                <label><input type="checkbox" checked={profile.bookingRules.acceptsNewClients} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, acceptsNewClients: event.target.checked } })} /><span><strong>Accept new clients</strong><small>Allow customers without appointment history to book.</small></span></label>
                <label><input type="checkbox" checked={profile.bookingRules.allowAnyAvailable} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, allowAnyAvailable: event.target.checked } })} /><span><strong>Join “Any available barber”</strong><small>Allow the booking engine to match open time slots to your chair.</small></span></label>
              </div>
              <div className="staff-form-actions"><button className="button button-secondary" type="button" onClick={() => setStep(4)}>Back</button><button className="button" type="button" onClick={() => setStep(6)}>Payout setup</button></div>
            </section>
          ) : null}

          {!saved && step === 6 ? (
            <section aria-labelledby="staff-payout-heading">
              <p className="eyebrow">Step 6 of 6</p>
              <h2 id="staff-payout-heading">Payout profile</h2>
              <div className="staff-payout-notice">
                <strong>No banking information is collected here.</strong>
                <p>The first release will calculate earnings and record payouts made manually by the shop. Secure bank connection can be added through a regulated payment provider after the business chooses its payout and worker-classification model.</p>
              </div>
              <div className="staff-form-grid">
                <label>Payout tracking<select value={profile.payoutProfile.mode} disabled><option value="manual-ledger">Manual payout ledger</option></select></label>
                <label>Preferred payout frequency<select value={profile.payoutProfile.frequency} onChange={(event) => setProfile({ ...profile, payoutProfile: { ...profile.payoutProfile, frequency: event.target.value as StaffProfile['payoutProfile']['frequency'] } })}><option value="weekly">Weekly</option><option value="biweekly">Every two weeks</option><option value="monthly">Monthly</option></select></label>
              </div>
              <div className="staff-review-panel">
                <p><strong>Professional:</strong> {profile.professionalName}</p>
                <p><strong>Location:</strong> {profile.locationAddress}</p>
                <p><strong>Services selected:</strong> {profile.serviceIds.length}</p>
                <p><strong>Working days:</strong> {profile.schedule.filter((window) => window.enabled).length}</p>
                <p><strong>Relationship status:</strong> Pending administrator and business review</p>
              </div>
              <div className="staff-form-actions"><button className="button button-secondary" type="button" onClick={() => setStep(5)}>Back</button><button className="button" type="button" onClick={completeSetup}>Complete staff setup</button></div>
            </section>
          ) : null}
        </main>
      </div>
    </StaffShell>
  );
}

function EmptyStaffState() {
  return (
    <div className="staff-empty-state">
      <p className="eyebrow">Setup required</p>
      <h2>Create the first staff profile.</h2>
      <p>Staff onboarding connects professional details, services, work hours, booking rules, and payout tracking.</p>
      <a className="button" href="/staff/setup">Start staff setup</a>
    </div>
  );
}

function StaffDashboardPage() {
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [appointments, setAppointments] = useState<PlatformAppointment[]>([]);

  useEffect(() => {
    setProfile(readStaffProfiles()[0] ?? null);
    setAppointments(readAppointments());
  }, []);

  const upcoming = useMemo(() => appointments.filter((appointment) => appointment.status === 'confirmed').slice(0, 5), [appointments]);

  return (
    <StaffShell currentPath="/staff">
      {!profile ? <EmptyStaffState /> : (
        <div className="staff-dashboard-grid">
          <section className="staff-dashboard-welcome">
            <p className="eyebrow">Welcome back</p>
            <h2>{profile.professionalName}</h2>
            <p>{profile.locationAddress}</p>
            <div className="staff-dashboard-actions"><a className="button" href="/staff/calendar">Open calendar</a><a className="button button-secondary" href="/staff/setup">Edit setup</a></div>
          </section>

          <section className="staff-stat-grid" aria-label="Staff summary">
            <article><small>Upcoming</small><strong>{upcoming.length}</strong><span>test appointments</span></article>
            <article><small>Services</small><strong>{profile.serviceIds.length}</strong><span>available to book</span></article>
            <article><small>Work days</small><strong>{profile.schedule.filter((window) => window.enabled).length}</strong><span>each week</span></article>
            <article><small>Pending payout</small><strong>$0.00</strong><span>no completed sales</span></article>
          </section>

          <section className="staff-dashboard-panel">
            <div className="staff-panel-heading"><div><p className="eyebrow">Upcoming appointments</p><h2>Next in the chair</h2></div><a href="/staff/calendar">View calendar</a></div>
            {upcoming.length ? (
              <div className="staff-appointment-list">
                {upcoming.map((appointment) => (
                  <article key={appointment.id}><time>{appointment.date}<strong>{appointment.time}</strong></time><div><h3>{appointment.customerName}</h3><p>{appointment.serviceName}</p></div><span>{appointment.status}</span></article>
                ))}
              </div>
            ) : <p>No test appointments have been created yet. Use the booking flow to add one.</p>}
          </section>

          <section className="staff-dashboard-panel">
            <div className="staff-panel-heading"><div><p className="eyebrow">Published hours</p><h2>Weekly schedule</h2></div></div>
            <dl className="staff-schedule-summary">
              {profile.schedule.map((window) => <div key={window.day}><dt>{window.label}</dt><dd>{window.enabled ? `${window.start} to ${window.end}` : 'Not available'}</dd></div>)}
            </dl>
          </section>
        </div>
      )}
    </StaffShell>
  );
}

function StaffCalendarPage() {
  const [appointments, setAppointments] = useState<PlatformAppointment[]>([]);
  useEffect(() => setAppointments(readAppointments()), []);

  return (
    <StaffShell currentPath="/staff/calendar">
      <div className="staff-section-heading"><div><p className="eyebrow">Appointments</p><h2>Calendar and walk-ins</h2></div><a className="button" href="/book">Create test booking</a></div>
      <div className="staff-calendar-list">
        {appointments.length ? appointments.map((appointment) => (
          <article key={appointment.id}>
            <div><time>{appointment.date}</time><strong>{appointment.time}</strong></div>
            <div><h3>{appointment.customerName}</h3><p>{appointment.serviceName}</p><small>{appointment.customerPhone} · {appointment.customerEmail}</small></div>
            <span>{appointment.barberName}</span>
          </article>
        )) : <div className="staff-empty-state"><h2>No appointments yet.</h2><p>Confirmed test bookings will appear here.</p></div>}
      </div>
    </StaffShell>
  );
}

function StaffEarningsPage() {
  return (
    <StaffShell currentPath="/staff/earnings">
      <div className="staff-section-heading"><div><p className="eyebrow">Earnings ledger</p><h2>Completed services and shop sales</h2></div></div>
      <div className="staff-stat-grid">
        <article><small>Gross service sales</small><strong>$0.00</strong><span>no completed appointments</span></article>
        <article><small>Tips recorded</small><strong>$0.00</strong><span>not enabled yet</span></article>
        <article><small>Adjustments</small><strong>$0.00</strong><span>none recorded</span></article>
        <article><small>Net payout ledger</small><strong>$0.00</strong><span>awaiting business rules</span></article>
      </div>
      <div className="staff-dashboard-panel"><p className="eyebrow">Ledger status</p><h2>No earnings records yet.</h2><p>Completed appointments will create ledger entries after service completion, payment recording, tip handling, and the shop’s compensation rules are approved.</p></div>
    </StaffShell>
  );
}

function StaffPayoutsPage() {
  return (
    <StaffShell currentPath="/staff/payouts">
      <div className="staff-section-heading"><div><p className="eyebrow">Payouts</p><h2>Track what the shop owes and pays.</h2></div></div>
      <div className="staff-payout-layout">
        <section className="staff-dashboard-panel"><p className="eyebrow">Current mode</p><h2>Manual payout ledger</h2><p>The platform will calculate approved earnings while the shop records cash, check, payroll, or external bank payments. No bank account numbers are stored in this release.</p><dl className="staff-payout-summary"><div><dt>Available</dt><dd>$0.00</dd></div><div><dt>Pending review</dt><dd>$0.00</dd></div><div><dt>Last payout</dt><dd>None</dd></div></dl></section>
        <section className="staff-dashboard-panel"><p className="eyebrow">Before automated payouts</p><h2>Business approval required</h2><p>The shop must confirm whether each professional is paid through payroll, contractor payments, booth-rental accounting, or another approved arrangement. Automated transfers will use tokenized bank onboarding through a regulated provider.</p><button className="button" type="button" disabled>Connect payout destination later</button></section>
      </div>
    </StaffShell>
  );
}

export function StaffPlatformPage({ path }: { path: string }) {
  if (path === '/staff/setup') return <StaffSetupPage />;
  if (path === '/staff/calendar') return <StaffCalendarPage />;
  if (path === '/staff/earnings') return <StaffEarningsPage />;
  if (path === '/staff/payouts') return <StaffPayoutsPage />;
  return <StaffDashboardPage />;
}
