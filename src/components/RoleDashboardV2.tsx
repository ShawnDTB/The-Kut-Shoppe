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
import { readAppointments, subscribeToAppointmentChanges } from '../data/platform';
import { formatMoney, readOrders, subscribeToStorefrontChanges } from '../data/storefront';

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

function CustomerSummary({ account }: { account: PlatformAccount }) {
  const [appointments, setAppointments] = useState(() => readAppointments().filter((appointment) => appointment.customerEmail === account.email));
  const [orders, setOrders] = useState(() => readOrders().filter((order) => order.customer.email === account.email));

  useEffect(() => {
    const refreshAppointments = () => setAppointments(readAppointments().filter((appointment) => appointment.customerEmail === account.email));
    const refreshOrders = () => setOrders(readOrders().filter((order) => order.customer.email === account.email));
    const unsubscribeAppointments = subscribeToAppointmentChanges(refreshAppointments);
    const unsubscribeOrders = subscribeToStorefrontChanges(refreshOrders);
    refreshAppointments();
    refreshOrders();
    return () => {
      unsubscribeAppointments();
      unsubscribeOrders();
    };
  }, [account.email]);

  const active = appointments.filter((appointment) => ['requested', 'confirmed', 'reschedule-proposed', 'waitlisted'].includes(appointment.status));

  return (
    <div className="v2-dashboard-grid">
      <section className="v2-panel v2-panel-priority">
        <div className="v2-panel-heading"><div><p className="eyebrow">Appointments</p><h2>Upcoming and pending</h2></div><a className="button" href="/book">Book now</a></div>
        {active.length ? <div className="v2-list">{active.map((appointment) => <article key={appointment.id}><div><strong>{appointment.serviceName}</strong><span>{appointment.date} at {appointment.time}</span><small>{appointment.barberName}</small></div><span className="v2-status">{appointment.status.replaceAll('-', ' ')}</span></article>)}</div> : <div className="v2-empty"><h3>No active barber appointments.</h3><p>Guest and account bookings using this email will appear here.</p></div>}
      </section>
      <section className="v2-panel">
        <div className="v2-panel-heading"><div><p className="eyebrow">Orders</p><h2>Shop activity</h2></div><a className="button button-secondary" href="/shop">Visit shop</a></div>
        {orders.length ? <div className="v2-list">{orders.slice().reverse().map((order) => <article key={order.id}><div><strong>Order {order.id.split('-').at(-1)}</strong><span>{order.status.replaceAll('-', ' ')}</span><small>{order.fulfillment}</small></div><strong>{formatMoney(order.totalCents)}</strong></article>)}</div> : <div className="v2-empty"><h3>No orders yet.</h3><p>Submitted pickup and shipping orders will appear here.</p></div>}
      </section>
    </div>
  );
}

function StaffSummary({ account }: { account: PlatformAccount }) {
  const isBarber = account.role === 'barber';
  const canManageShop = hasPlatformCapability(account, 'manage-shop-appointments');
  const canManageStore = hasPlatformCapability(account, 'manage-products');
  const setupComplete = Boolean(account.staffProfileId);

  return (
    <div className="v2-dashboard-grid">
      {!setupComplete ? (
        <section className="v2-panel v2-panel-priority v2-setup-callout">
          <p className="eyebrow">Professional setup required</p>
          <h2>Finish connecting this account to the shop.</h2>
          <p>The role is approved. Add the professional display name, business phone, location, services, hours, and booking rules before opening staff operations.</p>
          <a className="button" href="/staff/setup">Complete professional setup</a>
        </section>
      ) : isBarber ? (
        <section className="v2-panel v2-panel-priority v2-chair-panel">
          <p className="eyebrow">My chair</p>
          <h2>Calendar, services, and availability</h2>
          <p>These controls affect only this Barber profile. Update working hours, accepted services, booking rules, requests, and same-day waitlist participation without changing another chair.</p>
          <div className="v2-action-grid v2-action-grid-chair">
            <a href="/staff/calendar">My calendar</a>
            <a href="/staff/requests">My requests</a>
            <a href="/staff/waitlist">Same-day waitlist</a>
            <a href="/staff/settings">Services and pricing</a>
            <a href="/staff/settings">Working hours</a>
            <a href="/staff/settings">Booking rules</a>
          </div>
        </section>
      ) : (
        <section className="v2-panel v2-panel-priority">
          <p className="eyebrow">Shop operations</p>
          <h2>Appointments, staff, and daily activity</h2>
          <p>Review shop-wide schedules and appointment activity. Individual Barber hours and services remain attached to each professional profile.</p>
          <div className="v2-action-grid">
            <a href="/staff">Operations overview</a>
            <a href="/staff/calendar">Shop calendar</a>
            <a href="/staff/requests">Appointment requests</a>
            <a href="/staff/waitlist">Waitlist</a>
            <a href="#access">Staff access</a>
            <a href="/staff/earnings">Earnings</a>
          </div>
        </section>
      )}

      {canManageStore ? (
        <section className="v2-panel v2-management-card">
          <div><p className="eyebrow">Products and orders</p><h2>Store management</h2><p>Add products, edit inventory and variants, publish the catalog, and process submitted orders.</p></div>
          <div className="v2-management-actions">
            <a className="button" href="/admin/products">Manage products</a>
            <a className="button button-secondary" href="/admin/orders">Manage orders</a>
            <a className="text-link" href="/shop">Preview customer Shop →</a>
          </div>
        </section>
      ) : null}

      {canManageShop ? (
        <section className="v2-panel">
          <p className="eyebrow">Team permissions</p>
          <h2>Accounts and roles</h2>
          <p>Approve professional accounts and keep elevated access limited to the people who need it.</p>
          <a className="button button-secondary" href="#access">Manage account roles</a>
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
      setMessage('Account access updated. The user can complete professional setup after signing in.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update access.');
    }
  };

  return (
    <section className="v2-panel v2-panel-wide" id="access">
      <div className="v2-panel-heading"><div><p className="eyebrow">Role-based access</p><h2>Accounts and permissions</h2></div></div>
      <p>Customers register normally. Owner, Developer, and Manager accounts can approve professional access. Barbers receive the tools needed to operate their own chair.</p>
      {message ? <p className="success-message" role="status">{message}</p> : null}
      <div className="v2-account-table">
        {accounts.map((account) => (
          <article key={account.id}>
            <div><strong>{account.name}</strong><span>{account.email}</span><small>{account.emailVerified ? 'Email verified' : 'Email verification pending'} · {account.staffProfileId ? 'Professional setup linked' : account.role === 'customer' ? 'Customer account' : 'Professional setup pending'}</small></div>
            <label>Role<select value={account.role} disabled={account.id === actor.id && actor.role === 'owner'} onChange={(event) => changeRole(account.id, event.target.value as PlatformRole)}><option value="customer">Customer</option><option value="barber">Barber</option><option value="manager">Manager</option>{canAssignElevated ? <option value="owner">Owner</option> : null}{canAssignElevated ? <option value="developer">Developer</option> : null}</select></label>
          </article>
        ))}
      </div>
    </section>
  );
}

export function RoleDashboardV2() {
  const [account, setAccount] = useState(() => getPlatformSessionAccount());
  useEffect(() => subscribeToPlatformAuth(() => setAccount(getPlatformSessionAccount())), []);

  if (!account) {
    return <section className="section v2-auth-page platform-pattern platform-pattern-account"><div className="container narrow-container"><div className="v2-auth-card"><p className="eyebrow">Account required</p><h1>Sign in to continue.</h1><a className="button" href="/account">Account / Login</a></div></div></section>;
  }

  const elevated = account.role !== 'customer';
  return (
    <section className="section v2-dashboard-page platform-pattern platform-pattern-staff">
      <div className="container route-wide">
        <header className="v2-dashboard-header"><div><p className="eyebrow">{roleLabels[account.role]} account</p><h1>Welcome, {account.name}.</h1><p>{elevated ? 'Open the tools assigned to this role.' : 'Manage appointments first, then review purchases and account details.'}</p></div><div className="v2-profile-summary"><strong>{roleLabels[account.role]}</strong><span>{account.email}</span><small>{elevated ? account.staffProfileId ? 'Professional profile connected' : 'Professional setup pending' : 'Customer account'}</small><button className="text-button" type="button" onClick={logout}>Log out</button></div></header>
        {elevated ? <StaffSummary account={account} /> : <CustomerSummary account={account} />}
        {hasPlatformCapability(account, 'manage-staff') ? <AccessManager actor={account} /> : null}
      </div>
    </section>
  );
}
