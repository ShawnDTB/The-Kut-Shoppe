import { useEffect, useState } from 'react';
import { getPlatformSessionAccount } from '../data/auth-v2';
import { RoleDashboardV5 } from './RoleDashboardV5';

type AccountView = 'appointments' | 'orders' | 'profile' | 'security';
const accountViews: Array<[AccountView, string]> = [['appointments', 'Appointments'], ['orders', 'Orders'], ['profile', 'Profile'], ['security', 'Security']];

function locationView(): AccountView {
  if (typeof window === 'undefined') return 'appointments';
  const params = new URLSearchParams(window.location.search);
  const view = params.has('order') ? 'orders' : params.get('view');
  return accountViews.some(([value]) => value === view) ? view as AccountView : 'appointments';
}

export function RoleDashboardV6() {
  const account = getPlatformSessionAccount();
  const [view, setView] = useState<AccountView>(locationView);
  useEffect(() => {
    const sync = () => setView(locationView());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  if (account?.role !== 'customer') return <RoleDashboardV5 />;

  const select = (next: AccountView) => {
    const params = new URLSearchParams(window.location.search);
    params.set('view', next);
    if (next !== 'orders') params.delete('order');
    window.history.pushState({}, '', `/account?${params.toString()}`);
    setView(next);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  };

  return <div className={`account-v6-shell account-v6-view-${view}`}><nav className="account-v6-tabs" aria-label="Customer account sections">{accountViews.map(([value, label]) => <button className={view === value ? 'is-active' : ''} type="button" aria-pressed={view === value} onClick={() => select(value)} key={value}>{label}</button>)}</nav><RoleDashboardV5 /></div>;
}
