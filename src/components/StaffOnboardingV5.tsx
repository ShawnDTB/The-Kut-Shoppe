import { useEffect, useState } from 'react';
import {
  getPlatformSessionAccount,
  linkPlatformStaffProfile,
  startPlatformSession,
  type PlatformAccount,
} from '../data/auth-v2';
import { saveAccount as saveLegacyAccount, startSession as startLegacySession, type AccountRole as LegacyRole } from '../data/auth';
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
import { defaultStaffPolicy, saveStaffPolicy, type LateCancellationAction, type RefundPolicy } from '../data/staff-policy-v5';

function roleLabel(account: PlatformAccount) {
  return account.role.charAt(0).toUpperCase() + account.role.slice(1);
}
function profileRole(account: PlatformAccount): StaffProfile['role'] {
  return account.role === 'barber' ? 'barber' : account.role === 'manager' ? 'manager' : 'owner';
}
function legacyRole(account: PlatformAccount): LegacyRole {
  return account.role === 'barber' ? 'staff' : account.role === 'manager' ? 'manager' : 'owner';
}
function Required({ children }: { children: string }) {
  return <span className="v5-required-label">{children}<span aria-hidden="true">*</span></span>;
}
function FieldError({ message }: { message?: string }) {
  return message ? <small className="field-error" role="alert">{message}</small> : null;
}

export function StaffOnboardingV5() {
  const account = getPlatformSessionAccount();
  const linkedProfile = account?.staffProfileId ? readStaffProfiles().find((profile) => profile.id === account.staffProfileId) ?? null : null;
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<StaffProfile>(() => {
    const draft = createStaffProfileDraft();
    if (!account) return draft;
    const role = profileRole(account);
    return { ...draft, professionalName: account.name, email: account.email, role, serviceIds: role === 'barber' ? [] : barberServiceOptions.map((service) => service.id) };
  });
  const [policy, setPolicy] = useState(() => defaultStaffPolicy(profile));

  useEffect(() => { if (linkedProfile) window.location.replace('/staff/settings'); }, [linkedProfile]);
  if (!account) return <section className="section staff-v5-onboarding"><div className="container narrow-container"><div className="staff-v2-state"><h1>Sign in before professional setup.</h1><a className="button" href="/account">Account / Login</a></div></div></section>;
  if (account.role === 'customer') return <section className="section staff-v5-onboarding"><div className="container narrow-container"><div className="staff-v2-state"><h1>Staff approval is required.</h1><p>An Owner, Developer, or Manager must assign professional access before setup.</p><a className="button" href="/account">Return to Account</a></div></div></section>;
  if (linkedProfile) return <section className="section staff-v5-onboarding"><div className="container narrow-container"><a className="button" href="/staff/settings">Open Staff Settings</a></div></section>;

  const isBarber = account.role === 'barber';
  const steps = ['Profile', 'Services', 'Hours', 'Rules', 'Review'];
  const updateSchedule = (day: WeeklyWindow['day'], patch: Partial<WeeklyWindow>) => setProfile((current) => ({ ...current, schedule: current.schedule.map((window) => window.day === day ? { ...window, ...patch } : window) }));
  const toggleService = (serviceId: string) => setProfile((current) => ({ ...current, serviceIds: current.serviceIds.includes(serviceId) ? current.serviceIds.filter((id) => id !== serviceId) : [...current.serviceIds, serviceId] }));

  const validateCurrent = () => {
    const validation = validateStaffProfile(profile);
    const next: Record<string, string> = {};
    if (step === 1) { if (validation.professionalName) next.professionalName = validation.professionalName; if (validation.phone) next.phone = validation.phone; }
    if (step === 2 && isBarber && validation.serviceIds) next.serviceIds = validation.serviceIds;
    if (step === 3 && isBarber) Object.entries(validation).forEach(([key, value]) => { if (key === 'schedule' || key.startsWith('schedule-')) next[key] = value; });
    setErrors(next);
    if (Object.keys(next).length) {
      const first = Object.keys(next)[0];
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-field="${first}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return false;
    }
    return true;
  };

  const next = () => { if (validateCurrent()) { setStep((current) => Math.min(5, current + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
  const complete = () => {
    const validation = validateStaffProfile(profile);
    const finalErrors = isBarber ? validation : Object.fromEntries(Object.entries(validation).filter(([key]) => !['serviceIds', 'schedule'].includes(key) && !key.startsWith('schedule-')));
    if (Object.keys(finalErrors).length) { setErrors(finalErrors); return; }
    const completed = { ...profile, email: account.email, role: profileRole(account), setupComplete: true, updatedAt: new Date().toISOString() };
    saveStaffProfile(completed);
    saveStaffPolicy({ ...policy, profileId: completed.id });
    const updated = linkPlatformStaffProfile(account.id, completed.id, completed.professionalName);
    startPlatformSession(updated);
    const legacy = saveLegacyAccount({ id: updated.id, name: updated.name, email: updated.email, phone: completed.phone, phoneVerified: false, role: legacyRole(updated), staffProfileId: completed.id, createdAt: updated.createdAt, updatedAt: updated.updatedAt });
    startLegacySession(legacy);
    window.location.assign('/staff');
  };

  return <section className="section staff-v5-onboarding platform-pattern platform-pattern-staff"><div className="container route-wide"><header className="staff-v5-onboarding-header"><div><p className="eyebrow">{roleLabel(account)} onboarding</p><h1>Set up your chair.</h1><p>Everything entered here can be updated later from Staff Settings.</p></div><a className="button button-secondary" href="/dashboard">Back to dashboard</a></header><ol className="staff-v2-progress" aria-label="Professional setup progress">{steps.map((label, index) => <li className={step === index + 1 ? 'is-current' : step > index + 1 ? 'is-complete' : ''} key={label}><span>{index + 1}</span><small>{label}</small></li>)}</ol><div className="staff-v5-onboarding-panel">
    {step === 1 ? <section><p className="eyebrow">Profile</p><h2>Profile and contact</h2><div className="staff-v5-fields"><label data-field="professionalName"><Required>Professional display name</Required><input value={profile.professionalName} onChange={(event) => setProfile({ ...profile, professionalName: event.target.value })} /><FieldError message={errors.professionalName} /></label><label>Account email<input value={account.email} readOnly /></label><label data-field="phone"><Required>Business phone</Required><input type="tel" autoComplete="tel" placeholder="570-421-5887" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /><FieldError message={errors.phone} /></label><label>Access role<input value={roleLabel(account)} readOnly /></label><label className="staff-v5-wide">Public introduction<textarea rows={3} value={profile.publicBio} onChange={(event) => setProfile({ ...profile, publicBio: event.target.value })} /></label></div><div className="staff-v2-location"><p className="eyebrow">Primary location</p><strong>{primaryLocation.name}</strong><span>{primaryLocation.address}</span></div></section> : null}
    {step === 2 ? <section><p className="eyebrow">Services</p><h2>{isBarber ? 'Services customers can book' : 'Operational access'}</h2>{isBarber ? <><FieldError message={errors.serviceIds} /><div className="staff-v5-service-grid">{barberServiceOptions.map((service) => <label className={profile.serviceIds.includes(service.id) ? 'is-selected' : ''} key={service.id}><input type="checkbox" checked={profile.serviceIds.includes(service.id)} onChange={() => toggleService(service.id)} /><span><small>{service.category}</small><strong>{service.name}</strong></span><span>{service.price}<small>{service.durationMinutes} min</small></span></label>)}</div></> : <p>Management access does not publish this account as an available barber.</p>}</section> : null}
    {step === 3 ? <section><p className="eyebrow">Hours</p><h2>{isBarber ? 'Weekly work hours' : 'Shop-wide access'}</h2>{isBarber ? <div className="staff-v5-hours">{profile.schedule.map((window) => <div className={window.enabled ? 'is-enabled' : ''} data-field={`schedule-${window.day}`} key={window.day}><label><input type="checkbox" checked={window.enabled} onChange={(event) => updateSchedule(window.day, { enabled: event.target.checked })} />{window.label}</label><input type="time" disabled={!window.enabled} value={window.start} onChange={(event) => updateSchedule(window.day, { start: event.target.value })} /><span>to</span><input type="time" disabled={!window.enabled} value={window.end} onChange={(event) => updateSchedule(window.day, { end: event.target.value })} /><FieldError message={errors[`schedule-${window.day}`]} /></div>)}</div> : <p>Management accounts can review all published schedules without creating personal availability.</p>}</section> : null}
    {step === 4 ? <section><p className="eyebrow">Rules</p><h2>Booking, cancellation, and refund rules</h2>{isBarber ? <><div className="staff-v5-fields"><label>Buffer after appointments<select value={profile.bookingRules.bufferMinutes} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, bufferMinutes: Number(event.target.value) } })}><option value="0">No buffer</option><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option></select></label><label>Minimum booking notice<select value={profile.bookingRules.minimumNoticeHours} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, minimumNoticeHours: Number(event.target.value) } })}><option value="0">Same time if open</option><option value="1">1 hour</option><option value="2">2 hours</option><option value="4">4 hours</option><option value="12">12 hours</option><option value="24">24 hours</option><option value="48">48 hours</option></select></label><label>Booking window<select value={profile.bookingRules.bookingWindowDays} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, bookingWindowDays: Number(event.target.value) } })}><option value="14">14 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select></label><label>Online cancellation window<select value={policy.cancellationNoticeHours} onChange={(event) => setPolicy({ ...policy, cancellationNoticeHours: Number(event.target.value) })}><option value="0">Until appointment time</option><option value="1">1 hour</option><option value="2">2 hours</option><option value="4">4 hours</option><option value="12">12 hours</option><option value="24">24 hours</option><option value="48">48 hours</option></select></label><label>After window closes<select value={policy.lateCancellationAction} onChange={(event) => setPolicy({ ...policy, lateCancellationAction: event.target.value as LateCancellationAction })}><option value="call-shop">Customer must call</option><option value="manager-review">Manager review</option><option value="deposit-forfeited">Deposit may be forfeited</option></select></label><label>Refund policy<select value={policy.refundPolicy} onChange={(event) => setPolicy({ ...policy, refundPolicy: event.target.value as RefundPolicy })}><option value="manager-review">Manager review</option><option value="original-payment">Original payment method</option><option value="store-credit">Store credit</option><option value="nonrefundable">Nonrefundable after approval</option></select></label></div><div className="staff-v5-toggles"><label><input type="checkbox" checked={profile.bookingRules.acceptsNewClients} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, acceptsNewClients: event.target.checked } })} />Accept new clients</label><label><input type="checkbox" checked={profile.bookingRules.allowAnyAvailable} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, allowAnyAvailable: event.target.checked } })} />Join Any Available Barber</label><label><input type="checkbox" checked={profile.bookingRules.acceptsWalkIns} onChange={(event) => setProfile({ ...profile, bookingRules: { ...profile.bookingRules, acceptsWalkIns: event.target.checked } })} />Same-day waitlist</label></div></> : <p>Management accounts use shop-wide permissions. Barber-specific policies remain attached to each chair.</p>}</section> : null}
    {step === 5 ? <section><p className="eyebrow">Review</p><h2>Review and activate</h2><dl className="staff-v2-review"><div><dt>Account</dt><dd>{account.email}</dd></div><div><dt>Role</dt><dd>{roleLabel(account)}</dd></div><div><dt>Display name</dt><dd>{profile.professionalName}</dd></div><div><dt>Location</dt><dd>{primaryLocation.address}</dd></div><div><dt>Services</dt><dd>{isBarber ? profile.serviceIds.length : 'Operational access'}</dd></div><div><dt>Cancellation window</dt><dd>{isBarber ? `${policy.cancellationNoticeHours} hours` : 'Not applicable'}</dd></div></dl></section> : null}
    <div className="staff-v2-actions"><button className="button button-secondary" type="button" disabled={step === 1} onClick={() => { setErrors({}); setStep((current) => Math.max(1, current - 1)); }}>Back</button>{step < 5 ? <button className="button" type="button" onClick={next}>Continue</button> : <button className="button" type="button" onClick={complete}>Activate professional profile</button>}</div>
  </div></div></section>;
}
