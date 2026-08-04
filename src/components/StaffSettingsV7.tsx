import { getPlatformSessionAccount, hasPlatformCapability } from '../data/auth-v2';
import { formatPhone } from '../data/auth';
import { primaryLocation, readStaffProfiles } from '../data/platform';
import { StaffSettingsV5 } from './StaffSettingsV5';

function roleLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function StaffSettingsV7() {
  const account = getPlatformSessionAccount();
  if (!account || account.role === 'customer') return <StaffSettingsV5 />;
  if (account.role === 'barber') return <StaffSettingsV5 />;

  const profile = account.staffProfileId
    ? readStaffProfiles().find((item) => item.id === account.staffProfileId) ?? null
    : null;

  if (!profile) {
    return <section className="section management-settings-v7 platform-pattern platform-pattern-staff"><div className="container narrow-container"><div className="staff-empty-state"><p className="eyebrow">Management setup required</p><h1>Finish connecting this account.</h1><p>Management settings become available after the approved account is linked to the shop.</p><a className="button" href="/staff/setup">Complete account setup</a></div></div></section>;
  }

  const tools = [
    ['Dashboard', '/dashboard', true],
    ['Calendar', '/staff/calendar', hasPlatformCapability(account, 'manage-shop-appointments')],
    ['Requests', '/staff/requests', hasPlatformCapability(account, 'manage-shop-appointments')],
    ['Waitlist', '/staff/waitlist', hasPlatformCapability(account, 'manage-shop-appointments')],
    ['Notifications', '/staff/notifications', hasPlatformCapability(account, 'manage-shop-appointments')],
    ['Products', '/admin/products', hasPlatformCapability(account, 'manage-products')],
    ['Orders', '/admin/orders', hasPlatformCapability(account, 'manage-orders')],
    ['Settings', '/staff/settings', true],
  ].filter((item) => item[2]) as Array<[string, string, boolean]>;

  return <section className="section management-settings-v7 platform-pattern platform-pattern-staff"><div className="container route-wide"><header className="management-settings-v7-header"><div><p className="eyebrow">Management settings</p><h1>Account and operational access.</h1><p>This account manages the shop. It is not published as a customer-bookable chair.</p></div><a className="button button-secondary" href="/dashboard">Back to dashboard</a></header><nav className="staff-platform-nav management-settings-v7-nav" aria-label="Management account">{tools.map(([label, href]) => <a href={href} aria-current={href === '/staff/settings' ? 'page' : undefined} key={href}>{label}</a>)}</nav><div className="management-settings-v7-grid"><section className="management-settings-v7-card"><p className="eyebrow">Account</p><h2>{profile.professionalName}</h2><dl><div><dt>Role</dt><dd>{roleLabel(account.role)}</dd></div><div><dt>Email</dt><dd>{account.email}</dd></div><div><dt>Business phone</dt><dd>{formatPhone(profile.phone)}</dd></div><div><dt>Customer booking</dt><dd>Not published as a chair</dd></div></dl><a className="button button-secondary" href="/account?view=security">Open account security</a></section><section className="management-settings-v7-card"><p className="eyebrow">Primary location</p><h2>{primaryLocation.name}</h2><p>{primaryLocation.address}</p><p>Location, staff access, compensation rules, and production integrations remain controlled operational settings rather than public profile fields.</p></section><section className="management-settings-v7-card management-settings-v7-wide"><p className="eyebrow">Approved tools</p><h2>Access follows the assigned role.</h2><div className="management-settings-v7-tools">{tools.filter(([label]) => label !== 'Settings').map(([label, href]) => <a href={href} key={href}><strong>{label}</strong><span>Open tool <span aria-hidden="true">→</span></span></a>)}</div></section></div></div></section>;
}
