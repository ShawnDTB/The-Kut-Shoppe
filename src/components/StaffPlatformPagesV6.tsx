import { useEffect, useRef } from 'react';
import { getPlatformSessionAccount } from '../data/auth-v2';
import { StaffPlatformPage } from './StaffPlatformPages';
import { RoleDashboardV6 } from './RoleDashboardV6';

function managementHeading(role: string) {
  if (role === 'manager') return 'Manage shop operations.';
  if (role === 'developer') return 'Configure the platform.';
  return 'Manage The Kut Shoppe.';
}

function FinancialFeatureHold({ path }: { path: string }) {
  const isPayouts = path === '/staff/payouts';
  return (
    <section className="section staff-finance-hold-v6 platform-pattern platform-pattern-tools">
      <div className="container narrow-container">
        <div className="staff-finance-hold-v6-card">
          <p className="eyebrow">Production connection required</p>
          <h1>{isPayouts ? 'Payouts are not active yet.' : 'Earnings reporting is not active yet.'}</h1>
          <p>
            {isPayouts
              ? 'Payout destinations, tax handling, compensation rules, and transfer history must be connected to protected production services before this area is used.'
              : 'Service totals can be reviewed after production appointments and payments become authoritative. Preview zeroes are hidden so they are not mistaken for business records.'}
          </p>
          <div className="staff-finance-hold-v6-actions">
            <a className="button" href="/dashboard">Return to dashboard</a>
            <a className="button button-secondary" href="/admin/orders">Review orders</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function StaffPlatformPageV6({ path }: { path: string }) {
  const account = getPlatformSessionAccount();
  const management = Boolean(account && ['manager', 'owner', 'developer'].includes(account.role));
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!management || !wrapperRef.current || !account) return undefined;
    const applyRoleLanguage = () => {
      const root = wrapperRef.current;
      const heading = root?.querySelector<HTMLElement>('.staff-platform-header h1');
      const eyebrow = root?.querySelector<HTMLElement>('.staff-platform-header .eyebrow');
      const customerAccount = root?.querySelector<HTMLAnchorElement>('.staff-session-actions a[href="/account"]');
      const expected = managementHeading(account.role);
      if (heading && heading.textContent !== expected) heading.textContent = expected;
      if (eyebrow && eyebrow.textContent !== 'The Kut Shoppe operations platform') eyebrow.textContent = 'The Kut Shoppe operations platform';
      if (customerAccount) customerAccount.hidden = true;
    };

    applyRoleLanguage();
    const observer = new MutationObserver(applyRoleLanguage);
    observer.observe(wrapperRef.current, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [account, management, path]);

  if (management && path === '/staff') return <RoleDashboardV6 />;
  if (management && (path === '/staff/earnings' || path === '/staff/payouts')) return <FinancialFeatureHold path={path} />;

  return (
    <div ref={wrapperRef} className={management ? 'staff-role-management-v6' : 'staff-role-barber-v6'}>
      <StaffPlatformPage path={path} />
    </div>
  );
}
