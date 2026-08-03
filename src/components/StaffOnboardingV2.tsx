import { useEffect, useState } from 'react';
import {
  getPlatformSessionAccount,
  linkPlatformStaffProfile,
  startPlatformSession,
  type PlatformAccount,
} from '../data/auth-v2';
import {
  saveAccount as saveLegacyAccount,
  startSession as startLegacySession,
  type AccountRole as LegacyRole,
} from '../data/auth';
import {
  barberServiceOptions,
  createStaffProfileDraft,
  primaryLocation,
  readStaffProfiles,
  saveStaffProfile,
  validateStaffProfile,
  type StaffProfile,
  type WeeklyWindow,
} from '../data/platform';

function roleLabel(account: PlatformAccount) {
  if (account.role === 'barber') return 'Barber';
  if (account.role === 'manager') return 'Manager';
  if (account.role === 'owner') return 'Owner';
  if (account.role === 'developer') return 'Developer';
  return 'Customer';
}

function profileRole(account: PlatformAccount): StaffProfile['role'] {
  if (account.role === 'barber') return 'barber';
  if (account.role === 'manager') return 'manager';
  return 'owner';
}

function legacyRole(account: PlatformAccount): LegacyRole {
  if (account.role === 'barber') return 'staff';
  if (account.role === 'manager') return 'manager';
  return 'owner';
}

function FieldError({ message }: { message?: string }) {
  return message ? <small className="field-error" role="alert">{message}</small> : null;
}

function SetupProgress({ step }: { step: number }) {
  const steps = ['Profile', 'Services', 'Hours', 'Rules', 'Review'];
  return <ol className="staff-v2-progress" aria-label="Professional setup progress">{steps.map((label, index) => <li className={step === index + 1 ? 'is-current' : step > index + 1 ? 'is-complete' : ''} key={label}><span>{index + 1}</span><small>{label}</small></li>)}</ol>;
}

export function StaffOnboardingV2() {
  const account = getPlatformSessionAccount();
  const linkedProfile = account?.staffProfileId
    ? readStaffProfiles().find((profile) => profile.id === account.staffProfileId) ?? null
    : null;
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<StaffProfile>(() => {
    const draft = createStaffProfileDraft();
    if (!account) return draft;
    const operationalRole = profileRole(account);
    return {
      ...draft,
      professionalName: account.name,
      email: account.email,
      role: operationalRole,
      serviceIds: operationalRole === 'barber' ? [] : barberServiceOptions.map((service) => service.id),
    };
  });

  useEffect(() => {
    if (linkedProfile) window.location.replace('/staff/settings');
  }, [linkedProfile]);

  if (!account) {
    return <section className="section staff-v2-page platform-pattern platform-pattern-tools"><div className="container narrow-container"><div className="staff-v2-state"><p className="eyebrow">Account required</p><h1>Sign in before professional setup.</h1><a className="button" href="/account">Account / Login</a></div></div></section>;
  }

  if (account.role === 'customer') {
    return <section className="section staff-v2-page platform-pattern platform-pattern-tools"><div className="container narrow-container"><div className="staff-v2-state"><p className="eyebrow">Approval required</p><h1>This account does not have staff access yet.</h1><p>An Owner, Developer or Manager must approve the account as a Barber or Manager before professional information, hours and services can be published.</p><a className="button" href="/dashboard">Return to Account</a></div></div></section>;
  }

  if (linkedProfile) {
    return <section className="section staff-v2-page"><div className="container narrow-container"><div className="staff-v2-state"><h1>Opening professional settings.</h1><a className="button" href="/staff/settings">Continue</a></div></div></section>;
  }

  const isBarber = account.role === 'barber';

  const updateSchedule = (day: WeeklyWindow['day'], patch: Partial<WeeklyWindow>) => {
    setProfile((current) => ({ ...current, schedule: current.schedule.map((window) => window.day === day ? { ...window, ...patch } : window) }));
  };

  const toggleService = (serviceId: string) => {
    setProfile((current) => ({
      ...current,
      serviceIds: current.serviceIds.includes(serviceId)
        ? current.serviceIds.filter((id) => id !== serviceId)
        : [...current.serviceIds, serviceId],
    }));
  };

  const validateStep = () => {
    const validation = validateStaffProfile(profile);
    const nextErrors: Record<string, string> = {};
    if (step === 1) {
      if (validation.professionalName) nextErrors.professionalName = validation.professionalName;
      if (validation.phone) nextErrors.phone = validation.phone;
    }
    if (step === 2 && isBarber && validation.serviceIds) nextErrors.serviceIds = validation.serviceIds;
    if (step === 3 && isBarber) {
      Object.entries(validation).forEach(([key, value]) => {
        if (key === 'schedule' || key.startsWith('schedule-')) nextErrors[key] = value;
      });
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const next = () => {
    if (validateStep()) setStep((current) => Math.min(5, current + 1));
  };

  const complete = () => {
    const validation = validateStaffProfile(profile);
    const finalErrors = isBarber
      ? validation
      : Object.fromEntries(Object.entries(validation).filter(([key]) => !['serviceIds', 'schedule'].includes(key) && !key.startsWith('schedule-')));
    if (Object.keys(finalErrors).length) {
      setErrors(finalErrors);
      setStep(1);
      return;
    }

    const completed: StaffProfile = {
      ...profile,
      email: account.email,
      role: profileRole(account),
      setupComplete: true,
      updatedAt: new Date().toISOString(),
    };
    saveStaffProfile(completed);
    const updatedAccount = linkPlatformStaffProfile(account.id, completed.id, completed.professionalName);
    startPlatformSession(updatedAccount);
    const legacy = saveLegacyAccount({
      id: updatedAccount.id,
      name: updatedAccount.name,
      email: updatedAccount.email,
      phone: completed.phone,
      phoneVerified: false,
      role: legacyRole(updatedAccount),
      staffProfileId: completed.id,
      createdAt: updatedAccount.createdAt,
      updatedAt: updatedAccount.updatedAt,
    });
    startLegacySession(legacy);
    window.location.assign('/staff');
  };

  return (
    <section className="section staff-v2-page platform-pattern platform-pattern-tools">
      <div className="container route-wide">
        <header className="staff-v2-header"><div><p className="eyebrow">{roleLabel(account)} onboarding</p><h1>Connect this account to the shop.</h1><p>Email and password already secure account access. This setup only collects the professional information needed to operate the business.</p></div><a className="button button-secondary" href="/dashboard">Back to dashboard</a></header>
        <SetupProgress step={step} />
        <div className="staff-v2-panel">
          {step === 1 ? <section><p className="eyebrow">Professional profile</p><h2>How this account appears inside the shop.</h2><div className="staff-v2-fields"><label>Professional display name<input value={profile.professionalName} onChange={(event) => setProfile({ ...profile, professionalName: event.target.value })} /><FieldError message={errors.professionalName} /></label><label>Account email<input value={account.email} readOnly /><small>Change email through Account security after re-verification is available.</small></label><label>Business phone<input type="tel" autoComplete="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /><FieldError message={errors.phone} /></label><label>Access role<input value={roleLabel(account)} readOnly /><small>Only approved administrators can change access.</small></label><label className="staff-v2-wide">Public introduction <span>Optional</span><textarea rows={4} value={profile.publicBio} onChange={(event) => setProfile({ ...profile, publicBio: event.target.value })} /></label></div><div className="staff-v2-location"><p className="eyebrow">Primary location</p><strong>{primaryLocation.name}</strong><span>{primaryLocation.address}</span></div></section> : null}

          {step === 2 ? <section><p className="eyebrow">Services</p><h2>{isBarber ? 'Choose the services customers can request.' : 'Operational access does not publish this account as a barber.'}</h2>{isBarber ? <><FieldError message={errors.serviceIds} /><div className="staff-v2-services">{barberServiceOptions.map((service) => <label className={profile.serviceIds.includes(service.id) ? 'is-selected' : ''} key={service.id}><input type="checkbox" checked={profile.serviceIds.includes(service.id)} onChange={() => toggleService(service.id)} /><span><small>{service.category}</small><strong>{service.name}</strong></span><span>{service.price}<small>{service.durationMinutes} min</small></span></label>)}</div></> : <div className="staff-v2-state compact"><p>Owner, Developer and Manager profiles can manage shop operations without appearing as an available chair. A separate Barber role can be assigned when the account also needs public booking availability.</p></div>}</section> : null}

          {step === 3 ? <section><p className="eyebrow">Weekly availability</p><h2>{isBarber ? 'Publish the hours customers can request.' : 'Management accounts use the shop schedule.'}</h2>{isBarber ? <><FieldError message={errors.schedule} /><div className="staff-v2-hours">{profile.schedule.map((window) => <div className={window.enabled ? 'is-enabled' : ''} key={window.day}><label><input type="checkbox" checked={window.enabled} onChange={(event) => updateSchedule(window.day, { enabled: event.target.checked })} />{window.label}</label><input type="time" disabled={!window.enabled} value={window.start} onChange={(event) => updateSchedule(window.day, { start: event.target.value })} /><span>to</span><input type="time" disabled={!window.enabled} value={window.end} onChange={(event) => updateSchedule(window.day, { end: event.target.value })} /><FieldError message={errors[`schedule-${window.day}`]} /></div>)}</div></> : <div className="staff-v2-state compact"><p>This account can review shop-wide schedules. Personal appointment availability is only published for accounts assigned the Barber role.</p></div>}</section> : null}

          {step === 4 ? <section><p className="eyebrow">Booking controls</p><h2>Set how this professional participates.</h2>{isBarber ? <><div className="staff-v2-fields"><label>Buffer after appointments<select value={profile.bookingRules.bufferMinutes} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, bufferMinutes: Number(event.target.value) } })}><option value="0">No buffer</option><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option></select></label><label>Minimum booking notice<select value={profile.bookingRules.minimumNoticeHours} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, minimumNoticeHours: Number(event.target.value) } })}><option value="0">Same time if open</option><option value="1">1 hour</option><option value="2">2 hours</option><option value="4">4 hours</option><option value="24">24 hours</option></select></label><label>Booking window<select value={profile.bookingRules.bookingWindowDays} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, bookingWindowDays: Number(event.target.value) } })}><option value="14">14 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select></label></div><div className="staff-v2-toggles"><label><input type="checkbox" checked={profile.bookingRules.acceptsNewClients} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, acceptsNewClients: event.target.checked } })} /><span><strong>Accept new clients</strong><small>Show this chair to first-time customers.</small></span></label><label><input type="checkbox" checked={profile.bookingRules.allowAnyAvailable} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, allowAnyAvailable: event.target.checked } })} /><span><strong>Any Available Barber</strong><small>Include open times when a customer has no preference.</small></span></label><label><input type="checkbox" checked={profile.bookingRules.acceptsWalkIns} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, acceptsWalkIns: event.target.checked } })} /><span><strong>Same-day waitlist</strong><small>Allow this chair to claim contextual waitlist requests.</small></span></label></div></> : <div className="staff-v2-state compact"><p>Management accounts inherit shop-wide appointment oversight. Barber-specific booking controls do not apply until a Barber role and professional chair are assigned.</p></div>}<div className="staff-v2-payout-note"><strong>Payout destination is not collected here.</strong><p>The platform can record approved earnings and payout history. Bank details require a regulated, tokenized transfer connection before automated payouts are enabled.</p></div></section> : null}

          {step === 5 ? <section><p className="eyebrow">Review</p><h2>Activate professional access.</h2><dl className="staff-v2-review"><div><dt>Account</dt><dd>{account.email}</dd></div><div><dt>Role</dt><dd>{roleLabel(account)}</dd></div><div><dt>Display name</dt><dd>{profile.professionalName}</dd></div><div><dt>Location</dt><dd>{primaryLocation.address}</dd></div><div><dt>Services</dt><dd>{isBarber ? profile.serviceIds.length : 'Operational access'}</dd></div><div><dt>Working days</dt><dd>{isBarber ? profile.schedule.filter((window) => window.enabled).length : 'Shop-wide'}</dd></div></dl><p className="staff-v2-review-note">No SMS code is required. The signed-in account and its approved role establish identity for this local preview.</p></section> : null}

          <div className="staff-v2-actions"><button className="button button-secondary" type="button" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}>Back</button>{step < 5 ? <button className="button" type="button" onClick={next}>Continue</button> : <button className="button" type="button" onClick={complete}>Activate professional profile</button>}</div>
        </div>
      </div>
    </section>
  );
}
