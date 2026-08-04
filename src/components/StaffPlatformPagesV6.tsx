import { useEffect } from 'react';
import { getPlatformSessionAccount } from '../data/auth-v2';
import { StaffPlatformPage } from './StaffPlatformPages';
import { RoleDashboardV6 } from './RoleDashboardV6';

function heading(role: string) {
  if (role === 'manager') return 'Manage shop operations.';
  if (role === 'developer') return 'Configure the platform.';
  return 'Manage The Kut Shoppe.';
}

function FinancialFeatureHold({ payouts }: { payouts: boolean }) {
  return (
    <section className="section staff-finance-hold-v6 platform-pattern platform-pattern-tools">
      <div className="container narrow-container"><div className="staff-finance-hold-v6-card">
        <p className="eyebrow">Production connection required</p>
        <h1>{payouts ? 'Payouts are not active yet.' : 'Earnings reporting is not active yet.'}</h1>
        <p>{payouts ? 'Payout destinations, tax handling, compensation rules, and transfer history require protected production services.' : 'Authoritative appointments and payments must be connected before service totals become business records.'}</p>
        <div className="staff-finance-hold-v6-actions"><a className="button" href="/dashboard">Return to dashboard</a><a className="button button-secondary" href="/admin/orders">Review orders</a></div>
      </div></div>
    </section>
  );
}

export function StaffPlatformPageV6({ path }: { path: string }) {
  const account = getPlatformSessionAccount();
  const management = Boolean(account && account.role !== 'customer' && account.role !== 'barber');

  useEffect(() => {
    if (!management || !account) return;
    const title = document.querySelector<HTMLElement>('.staff-role-management-v6 .staff-platform-header h1');
    const label = document.querySelector<HTMLElement>('.staff-role-management-v6 .staff-platform-header .eyebrow');
    if (title) title.textContent = heading(account.role);
    if (label) label.textContent = 'The Kut Shoppe operations platform';
  }, [account, management, path]);

  if (management && path === '/staff') return <RoleDashboardV6 />;
  if (management && path === '/staff/earnings') return <FinancialFeatureHold payouts={false} />;
  if (management && path === '/staff/payouts') return <FinancialFeatureHold payouts />;
  return <div className={management ? 'staff-role-management-v6' : 'staff-role-barber-v6'}><StaffPlatformPage path={path} /></div>;
}
