import { useEffect, useState } from 'react';
import {
  endPlatformSession,
  getPlatformSessionAccount,
  hasPlatformCapability,
  readPlatformAccounts,
  subscribeToPlatformAuth,
  updatePlatformRole,
  type PlatformAccount,
  type PlatformRole,
} from '../data/auth-v2';
import { endSession as endLegacySession } from '../data/auth';

const roleLabels: Record<PlatformRole, string> = {
  customer: 'Customer',
  barber: 'Barber',
  manager: 'Manager',
  owner: 'Owner',
  developer: 'Developer',
};

function logout() {
  endPlatformSession();
  endLegacySession();
  window.location.assign('/account');
}

function StaffSummary({ account }: { account: PlatformAccount }) {
  const isBarber = account.role === 'barber';
  const canManageShop = hasPlatformCapability(account, 'manage-shop-appointments');
  const canManageStore = hasPlatformCapability(account, 'manage-products');
  const setupComplete = Boolean(account.staffProfileId);

  return (
    <div className="v4-staff-dashboard">
      {!setupComplete ? (
        <section className="v2-panel v2-panel-wide v4-setup-callout">
          <div><p className="eyebrow">Professional setup required</p><h2>Complete professional setup.</h2><p>Add the shop profile, services, hours, and booking rules connected to this account.</p></div>
          <a className="button" href="/staff/setup">Complete setup</a>
        </section>
      ) : null}

      {setupComplete && isBarber ? (
        <section className="v2-panel v2-panel-wide v2-chair-panel">
          <p className="eyebrow">My chair</p><h2>Calendar, services, and availability</h2><p>Manage the schedule and booking rules attached to this chair.</p>
          <div className="v2-action-grid v2-action-grid-chair"><a href="/staff/calendar">My calendar</a><a href="/staff/requests">My requests</a><a href="/staff/waitlist">Same-day waitlist</a><a href="/staff/settings">Services and pricing</a><a href="/staff/settings">Working hours</a><a href="/staff/settings">Booking rules</a></div>
        </section>
      ) : null}

      {canManageShop ? (
        <section className="v2-panel v2-panel-wide v4-operations-card">
          <div><p className="eyebrow">Shop operations</p><h2>Appointments and daily activity</h2><p>Review the shop calendar, requests, waitlist, staff access, and earnings.</p></div>
          <div className="v2-action-grid"><a href="/staff">Operations overview</a><a href="/staff/calendar">Shop calendar</a><a href="/staff/requests">Appointment requests</a><a href="/staff/waitlist">Waitlist</a><a href="#access">Staff access</a><a href="/staff/earnings">Earnings</a></div>
        </section>
      ) : null}

      {canManageStore ? (
        <section className="v2-panel v2-panel-wide v2-management-card v4-store-management">
          <div><p className="eyebrow">Products and orders</p><h2>Store management</h2><p>Add products, publish inventory, and process customer orders.</p></div>
          <div className="v2-management-actions"><a className="button" href="/admin/products">Manage products</a><a className="button button-secondary" href="/admin/orders">Manage orders</a><a className="text-link" href="/shop">Preview customer Shop →</a></div>
        </section>
      ) : null}
    </div>
  );
}

function AccessManager({ actor }: { actor: PlatformAccount }) {
  const [accounts, setAccounts] = useState(() => readPlatformAccounts());
  const [message, setMessage] = useState('');
  const canAssignElevated = actor.role === 'owner' || actor.role === 'developer';

  useEffect(() => subscribeToPlatformAuth(() => setAccounts(readPlatformAccounts())), []);

  const changeRole = (accountId: string, role: PlatformRole) => {
    try {
      updatePlatformRole(actor, accountId, role);
      setAccounts(readPlatformAccounts());
      setMessage('Account access updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update access.');
    }
  };

  return (
    <section className="v2-panel v2-panel-wide v4-access-manager" id="access">
      <div className="v2-panel-heading v4-panel-heading"><div><p className="eyebrow">Role-based access</p><h2>Accounts and permissions</h2></div></div>
      <p>Approve professional access and keep elevated permissions limited to the people who need them.</p>
      {message ? <p className="success-message" role="status">{message}</p> : null}
      <div className="v2-account-table">
        {accounts.map((target) => (
          <article key={target.id}>
            <div><strong>{target.name}</strong><span>{target.email}</span><small>{target.emailVerified ? 'Email verified' : 'Email verification pending'} · {target.staffProfileId ? 'Professional setup linked' : target.role === 'customer' ? 'Customer account' : 'Professional setup pending'}</small></div>
            <label>Role<select value={target.role} disabled={target.id === actor.id && actor.role === 'owner'} onChange={(event) => changeRole(target.id, event.target.value as PlatformRole)}><option value="customer">Customer</option><option value="barber">Barber</option><option value="manager">Manager</option>{canAssignElevated ? <option value="owner">Owner</option> : null}{canAssignElevated ? <option value="developer">Developer</option> : null}</select></label>
          </article>
        ))}
      </div>
    </section>
  );
}

// Renders the staff/manager/owner/developer dashboard. Only ever reached via
// CustomerAccountDashboard's delegation for non-customer roles, which already
// guarantees account.role !== 'customer' before this renders -- so unlike
// its predecessor (formerly RoleDashboardV4), this no longer needs its own
// customer-facing branch. The "no account" guard stays for defensive
// robustness if this component is ever reached directly.
export function StaffAccountDashboard() {
  const [account, setAccount] = useState(() => getPlatformSessionAccount());
  useEffect(() => subscribeToPlatformAuth(() => setAccount(getPlatformSessionAccount())), []);

  if (!account) {
    return <section className="section v2-auth-page platform-pattern platform-pattern-account"><div className="container narrow-container"><div className="v2-auth-card"><p className="eyebrow">Account required</p><h1>Sign in to continue.</h1><a className="button" href="/account">Account / Login</a></div></div></section>;
  }

  return (
    <section className="section v2-dashboard-page v4-dashboard-page platform-pattern platform-pattern-staff">
      <div className="container route-wide">
        <header className="v2-dashboard-header v4-dashboard-header"><div><p className="eyebrow">{roleLabels[account.role]} account</p><h1>Welcome, {account.name}.</h1><p>Open the tools assigned to this role.</p></div><button className="button button-secondary v4-logout" type="button" onClick={logout}>Log out</button></header>
        <StaffSummary account={account} />
        {hasPlatformCapability(account, 'manage-staff') ? <AccessManager actor={account} /> : null}
      </div>
    </section>
  );
}
