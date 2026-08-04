import { getPlatformSessionAccount } from '../data/auth-v2';
import { formatPhone } from '../data/auth';
import { primaryLocation, readStaffProfiles } from '../data/platform';
import { StaffSettingsV5 } from './StaffSettingsV5';

export function StaffSettingsV7() {
  const account = getPlatformSessionAccount();
  if (!account || account.role === 'customer' || account.role === 'barber') return <StaffSettingsV5 />;
  const profile = account.staffProfileId ? readStaffProfiles().find((item) => item.id === account.staffProfileId) : null;
  if (!profile) return <section className="section staff-v5-settings"><div className="container narrow-container"><div className="staff-v2-state"><p className="eyebrow">Management setup required</p><h1>Finish connecting this account.</h1><a className="button" href="/staff/setup">Complete account setup</a></div></div></section>;

  return <section className="section staff-v5-settings platform-pattern platform-pattern-staff"><div className="container route-wide"><header className="staff-v5-settings-header"><div><p className="eyebrow">Management settings</p><h1>Account and operational access.</h1><p>This account manages the shop and is not a customer-bookable chair.</p></div><a className="button button-secondary" href="/dashboard">Back to dashboard</a></header><div className="staff-v5-settings-grid"><section className="staff-v5-card"><p className="eyebrow">Account</p><h2>{profile.professionalName}</h2><p>{account.role} · {account.email} · {formatPhone(profile.phone)}</p></section><section className="staff-v5-card"><p className="eyebrow">Primary location</p><h2>{primaryLocation.name}</h2><p>{primaryLocation.address}</p></section></div><nav className="staff-v5-savebar" aria-label="Management tools"><a className="button" href="/staff/calendar">Calendar</a><a className="button button-secondary" href="/staff/requests">Requests</a><a className="button button-secondary" href="/admin/orders">Orders</a><a className="text-link" href="/account">Account security</a></nav></div></section>;
}
