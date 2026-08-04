import { useLayoutEffect, useRef } from 'react';
import { getPlatformSessionAccount } from '../data/auth-v2';
import { StaffPlatformPage } from './StaffPlatformPages';
import { RoleDashboardV6 } from './RoleDashboardV6';

export function StaffPlatformPageV6({ path }: { path: string }) {
  const account = getPlatformSessionAccount();
  const management = Boolean(account && account.role !== 'customer' && account.role !== 'barber');
  const shell = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const title = management ? shell.current?.querySelector<HTMLElement>('.staff-platform-header h1') : null;
    if (title) title.textContent = 'Manage shop operations.';
  }, [management, path]);
  if (management && (path === '/staff' || path === '/staff/earnings' || path === '/staff/payouts')) return <RoleDashboardV6 />;
  return <div ref={shell} className={management ? 'staff-role-management-v6' : 'staff-role-barber-v6'}><StaffPlatformPage path={path} /></div>;
}
