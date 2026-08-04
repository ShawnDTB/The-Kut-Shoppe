import { getPlatformSessionAccount } from '../data/auth-v2';
import { formatPhone } from '../data/auth';
import { primaryLocation, readStaffProfiles } from '../data/platform';
import { StaffSettingsV5 } from './StaffSettingsV5';

export function StaffSettingsV7() {
  const account = getPlatformSessionAccount();
  if (!account || account.role === 'customer' || account.role === 'barber') return <StaffSettingsV5 />;
  const profile = account.staffProfileId ? readStaffProfiles().find((item) => item.id === account.staffProfileId) : null;

  if (!profile) return <section className="section management-settings-v7 platform-pattern platform-pattern-staff"><div className="container narrow-container"><div className="staff-empty-state"><p className="eyebrow">Management setup required</p><h1>Finish connecting this account.</h1><a className="button" href="/staff/setup">Complete account setup</a></div></div></section>;

  return <section className="section management-settings-v7 platform-pattern platform-pattern-staff"><div className="container route-wide"><header className="management-settings-v7-header"><div><p className="eyebrow">Management settings</p><h1>Account and operational access.</h1><p>This account manages the shop and is not published as a customer-bookable chair.</p></div><a className="button button-secondary" href="/dashboard">Back to dashboard</a></header><div className="management-settings-v7-grid"><section className="management-settings-v7-card"><p className="eyebrow">Account</p><h2>{profile.professionalName}</h2><dl><div><dt>Role</dt><dd>{account.role}</dd></div><div><dt>Email</dt><dd>{account.email}</dd></div><div><dt>Phone</dt><dd>{formatPhone(profile.phone)}</dd></div><div><dt>Booking</dt><dd>Not a chair</dd></div></dl></section><section className="management-settings-v7-card"><p className="eyebrow">Primary location</p><h2>{primaryLocation.name}</h2><p>{primaryLocation.address}</p></section></div><nav className="management-settings-v7-actions" aria-label="Management tools"><a className="button" href="/staff/calendar">Calendar</a><a className="button button-secondary" href="/staff/requests">Requests</a><a className="button button-secondary" href="/admin/orders">Orders</a><a className="text-link" href="/account">Account security</a></nav></div></section>;
}
