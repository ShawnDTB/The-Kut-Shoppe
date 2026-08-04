import { useEffect, useState } from 'react';
import { getPlatformSessionAccount } from '../data/auth-v2';
import { RoleDashboardV5 } from './RoleDashboardV5';

type AccountView = 'appointments' | 'orders' | 'profile' | 'security';

const accountViews: Array<[AccountView, string]> = [
  ['appointments', 'Appointments'],
  ['orders', 'Orders'],
  ['profile', 'Profile'],
  ['security', 'Security'],
];

function viewFromLocation(): AccountView {
  if (typeof window === 'undefined') return 'appointments';
  const params = new URLSearchParams(window.location.search);
  if (params.has('order')) return 'orders';
  const requested = params.get('view');
  return accountViews.some(([value]) => value === requested) ? requested as AccountView : 'appointments';
}

function viewHref(view: AccountView) {
  if (typeof window === 'undefined') return `/account?view=${view}`;
  const params = new URLSearchParams(window.location.search);
  params.set('view', view);
  if (view !== 'orders') params.delete('order');
  return `/account?${params.toString()}`;
}

export function RoleDashboardV6() {
  const account = getPlatformSessionAccount();
  const [view, setView] = useState<AccountView>(viewFromLocation);

  useEffect(() => {
    const sync = () => setView(viewFromLocation());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  if (account?.role !== 'customer') return <RoleDashboardV5 />;

  const selectView = (next: AccountView, href: string) => {
    setView(next);
    window.history.pushState({}, '', href);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  };

  return (
    <div className={`account-v6-shell account-v6-view-${view}`} data-account-view={view}>
      <nav className="account-v6-tabs" aria-label="Customer account sections">
        {accountViews.map(([value, label]) => {
          const href = viewHref(value);
          return (
            <a
              className={view === value ? 'is-active' : ''}
              href={href}
              aria-current={view === value ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                selectView(value, href);
              }}
              key={value}
            >
              {label}
            </a>
          );
        })}
      </nav>
      <RoleDashboardV5 />
    </div>
  );
}
