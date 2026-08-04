import { useState } from 'react';
import { getPlatformSessionAccount } from '../data/auth-v2';
import {
  barberServiceOptions,
  readStaffProfiles,
  saveStaffProfile,
  validateStaffProfile,
  type StaffProfile,
  type WeeklyWindow,
} from '../data/platform';
import {
  defaultStaffPolicy,
  getStaffPolicy,
  saveStaffPolicy,
  type LateCancellationAction,
  type RefundPolicy,
  type StaffPolicyV5,
} from '../data/staff-policy-v5';

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

function Required({ children }: { children: string }) {
  return <span className="v5-required-label">{children}<span aria-hidden="true">*</span></span>;
}

export function StaffSettingsV5() {
  const account = getPlatformSessionAccount();
  const profile = account?.staffProfileId ? readStaffProfiles().find((item) => item.id === account.staffProfileId) ?? null : null;
  const [draft, setDraft] = useState<StaffProfile | null>(profile);
  const [policy, setPolicy] = useState<StaffPolicyV5>(() => profile ? getStaffPolicy(profile) ?? defaultStaffPolicy(profile) : { profileId: '', cancellationNoticeHours: 24, lateCancellationAction: 'call-shop', refundPolicy: 'manager-review', policyNote: '', updatedAt: '' });
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!account) return <section className="section staff-v5-settings"><div className="container narrow-container"><a className="button" href="/account">Account / Login</a></div></section>;
  if (!draft) return <section className="section staff-v5-settings"><div className="container narrow-container"><div className="staff-v2-state"><p className="eyebrow">Professional setup required</p><h1>Connect this account to a chair.</h1><a className="button" href="/staff/setup">Complete professional setup</a></div></div></section>;

  const updateSchedule = (day: WeeklyWindow['day'], patch: Partial<WeeklyWindow>) => setDraft((current) => current ? { ...current, schedule: current.schedule.map((window) => window.day === day ? { ...window, ...patch } : window) } : current);
  const toggleService = (serviceId: string) => setDraft((current) => current ? { ...current, serviceIds: current.serviceIds.includes(serviceId) ? current.serviceIds.filter((id) => id !== serviceId) : [...current.serviceIds, serviceId] } : current);

  const save = () => {
    const validation = validateStaffProfile(draft);
    setErrors(validation);
    if (Object.keys(validation).length) {
      const first = Object.keys(validation)[0];
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-field="${first}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return;
    }
    saveStaffProfile({ ...draft, updatedAt: new Date().toISOString() });
    saveStaffPolicy({ ...policy, profileId: draft.id });
    setMessage('Staff settings saved. Booking availability and policy notices now use these values.');
  };

  return <section className="section staff-v5-settings platform-pattern platform-pattern-staff"><div className="container route-wide"><header className="staff-v5-settings-header"><div><p className="eyebrow">Staff settings</p><h1>Manage your chair.</h1><p>Services, availability, booking limits, cancellations, and customer-facing details are managed here.</p></div><a className="button button-secondary" href="/staff">Back to dashboard</a></header><nav className="staff-platform-nav" aria-label="Staff account">{staffLinks.map(([label, href]) => <a href={href} aria-current={href === '/staff/settings' ? 'page' : undefined} key={href}>{label}</a>)}</nav>
    <div className="staff-v5-settings-grid"><section className="staff-v5-card"><p className="eyebrow">Profile</p><h2>Public staff details</h2><div className="staff-v5-fields"><label data-field="professionalName"><Required>Professional name</Required><input value={draft.professionalName} onChange={(event) => setDraft({ ...draft, professionalName: event.target.value })} />{errors.professionalName ? <small className="field-error">{errors.professionalName}</small> : null}</label><label>Account email<input value={draft.email} readOnly /><small>Use Account security to request a verified email change.</small></label><label data-field="phone"><Required>Business phone</Required><input type="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />{errors.phone ? <small className="field-error">{errors.phone}</small> : null}</label><label className="staff-v5-wide">Public introduction<textarea rows={3} value={draft.publicBio} onChange={(event) => setDraft({ ...draft, publicBio: event.target.value })} /></label></div></section>
      <section className="staff-v5-card staff-v5-wide"><p className="eyebrow">Services</p><h2>Services customers can request</h2>{errors.serviceIds ? <p className="field-error">{errors.serviceIds}</p> : null}<div className="staff-v5-service-grid">{barberServiceOptions.map((service) => <label className={draft.serviceIds.includes(service.id) ? 'is-selected' : ''} key={service.id}><input type="checkbox" checked={draft.serviceIds.includes(service.id)} onChange={() => toggleService(service.id)} /><span><small>{service.category}</small><strong>{service.name}</strong></span><span>{service.price}<small>{service.durationMinutes} min</small></span></label>)}</div></section>
      <section className="staff-v5-card staff-v5-wide"><p className="eyebrow">Availability</p><h2>Weekly work hours</h2><div className="staff-v5-hours">{draft.schedule.map((window) => <div className={window.enabled ? 'is-enabled' : ''} data-field={`schedule-${window.day}`} key={window.day}><label><input type="checkbox" checked={window.enabled} onChange={(event) => updateSchedule(window.day, { enabled: event.target.checked })} />{window.label}</label><input type="time" value={window.start} disabled={!window.enabled} onChange={(event) => updateSchedule(window.day, { start: event.target.value })} /><span>to</span><input type="time" value={window.end} disabled={!window.enabled} onChange={(event) => updateSchedule(window.day, { end: event.target.value })} />{errors[`schedule-${window.day}`] ? <small className="field-error">{errors[`schedule-${window.day}`]}</small> : null}</div>)}</div></section>
      <section className="staff-v5-card"><p className="eyebrow">Booking rules</p><h2>Scheduling controls</h2><div className="staff-v5-fields"><label>Buffer after appointments<select value={draft.bookingRules.bufferMinutes} onChange={(event) => setDraft({ ...draft, bookingRules: { ...draft.bookingRules, bufferMinutes: Number(event.target.value) } })}><option value="0">No buffer</option><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option></select></label><label>Minimum booking notice<select value={draft.bookingRules.minimumNoticeHours} onChange={(event) => setDraft({ ...draft, bookingRules: { ...draft.bookingRules, minimumNoticeHours: Number(event.target.value) } })}><option value="0">Same time if open</option><option value="1">1 hour</option><option value="2">2 hours</option><option value="4">4 hours</option><option value="12">12 hours</option><option value="24">24 hours</option><option value="48">48 hours</option></select></label><label>Booking window<select value={draft.bookingRules.bookingWindowDays} onChange={(event) => setDraft({ ...draft, bookingRules: { ...draft.bookingRules, bookingWindowDays: Number(event.target.value) } })}><option value="14">14 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select></label></div><div className="staff-v5-toggles"><label><input type="checkbox" checked={draft.bookingRules.acceptsNewClients} onChange={(event) => setDraft({ ...draft, bookingRules: { ...draft.bookingRules, acceptsNewClients: event.target.checked } })} />Accept new clients</label><label><input type="checkbox" checked={draft.bookingRules.allowAnyAvailable} onChange={(event) => setDraft({ ...draft, bookingRules: { ...draft.bookingRules, allowAnyAvailable: event.target.checked } })} />Join Any Available Barber</label><label><input type="checkbox" checked={draft.bookingRules.acceptsWalkIns} onChange={(event) => setDraft({ ...draft, bookingRules: { ...draft.bookingRules, acceptsWalkIns: event.target.checked } })} />Accept same-day waitlist requests</label></div></section>
      <section className="staff-v5-card"><p className="eyebrow">Cancellations and refunds</p><h2>Customer policy</h2><div className="staff-v5-fields"><label>Online change and cancellation window<select value={policy.cancellationNoticeHours} onChange={(event) => setPolicy({ ...policy, cancellationNoticeHours: Number(event.target.value) })}><option value="0">Until appointment time</option><option value="1">1 hour</option><option value="2">2 hours</option><option value="4">4 hours</option><option value="12">12 hours</option><option value="24">24 hours</option><option value="48">48 hours</option></select></label><label>After the window closes<select value={policy.lateCancellationAction} onChange={(event) => setPolicy({ ...policy, lateCancellationAction: event.target.value as LateCancellationAction })}><option value="call-shop">Customer must call the shop</option><option value="manager-review">Manager review required</option><option value="deposit-forfeited">Deposit may be forfeited</option></select></label><label>Refund handling<select value={policy.refundPolicy} onChange={(event) => setPolicy({ ...policy, refundPolicy: event.target.value as RefundPolicy })}><option value="manager-review">Manager review</option><option value="original-payment">Return to original payment method</option><option value="store-credit">Store credit</option><option value="nonrefundable">Nonrefundable after approval</option></select></label><label className="staff-v5-wide">Policy note<textarea rows={3} placeholder="Optional customer-facing clarification" value={policy.policyNote} onChange={(event) => setPolicy({ ...policy, policyNote: event.target.value })} /></label></div></section>
    </div>{message ? <p className="success-message" role="status">{message}</p> : null}<div className="staff-v5-savebar"><button className="button" type="button" onClick={save}>Save staff settings</button></div></div></section>;
}
