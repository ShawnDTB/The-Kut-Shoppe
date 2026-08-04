import { useEffect } from 'react';
import { getPlatformSessionAccount } from '../data/auth-v2';
import { StaffPlatformPage } from './StaffPlatformPages';
import { RoleDashboardV6 } from './RoleDashboardV6';

function heading(role: string) {
  if (role === 'manager') return 'Manage shop operations.';
  if (role === 'developer') return 'Configure the platform.';
  return 'Manage The Kut Shoppe.';
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

  if (management && (path === '/staff' || path === '/staff/earnings' || path === '/staff/payouts')) return <RoleDashboardV6 />;
  return <div className={management ? 'staff-role-management-v6' : 'staff-role-barber-v6'}><StaffPlatformPage path={path} /></div>;
}
