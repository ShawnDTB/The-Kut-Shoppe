import { getPlatformSessionAccount } from '../data/auth-v2';
import { StaffSettingsV5 } from './StaffSettingsV5';

export function StaffSettingsV7() {
  const account = getPlatformSessionAccount();
  if (!account || account.role === 'customer' || account.role === 'barber') return <StaffSettingsV5 />;
  return <section className="section staff-v5-settings platform-pattern platform-pattern-staff"><div className="container narrow-container"><div className="staff-v2-state"><p className="eyebrow">Management account</p><h1>Chair settings do not apply to this role.</h1><p>Use the operational dashboard for shop appointments, orders, products, staff, and access.</p><div className="staff-v2-actions"><a className="button" href="/dashboard">Open dashboard</a><a className="button button-secondary" href="/account">Account security</a></div></div></div></section>;
}
