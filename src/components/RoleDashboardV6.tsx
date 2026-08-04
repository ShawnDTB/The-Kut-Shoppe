import { getPlatformSessionAccount } from '../data/auth-v2';
import { RoleDashboardV5 } from './RoleDashboardV5';

type AccountView = 'appointments' | 'orders' | 'profile' | 'security';
const accountViews: Array<[AccountView, string]> = [['appointments', 'Appointments'], ['orders', 'Orders'], ['profile', 'Profile'], ['security', 'Security']];

export function RoleDashboardV6() {
  const account = getPlatformSessionAccount();
  if (account?.role !== 'customer') return <RoleDashboardV5 />;
  const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const requested = params.has('order') ? 'orders' : params.get('view');
  const view = accountViews.some(([value]) => value === requested) ? requested as AccountView : 'appointments';
  return <div className={`account-v6-shell account-v6-view-${view}`}><nav className="account-v6-tabs" aria-label="Customer account sections">{accountViews.map(([value, label]) => <button className={view === value ? 'is-active' : ''} type="button" aria-pressed={view === value} onClick={() => window.location.assign(`/account?view=${value}`)} key={value}>{label}</button>)}</nav><RoleDashboardV5 /></div>;
}
