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
import {
  readAppointments,
  readStaffProfiles,
  respondToAppointmentProposal,
  subscribeToAppointmentChanges,
  updateAppointment,
  type PlatformAppointment,
} from '../data/platform';
import { business } from '../data/site';
import { formatMoney, readOrders, subscribeToStorefrontChanges } from '../data/storefront';
import {
  changeCustomerPassword,
  getCustomerPhone,
  updateCustomerProfile,
} from '../data/account-profile-v4';

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

function formatAppointmentDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

function appointmentPolicy(appointment: PlatformAppointment) {
  if (appointment.status === 'waitlisted') return { canManageOnline: true, noticeHours: 0 };
  const profiles = readStaffProfiles();
  const profile = profiles.find((candidate) => (
    candidate.id === appointment.assignedBarberId
    || candidate.id === appointment.requestedBarberId
  ));
  const noticeHours = profile?.bookingRules.minimumNoticeHours ?? 24;
  const startsAt = new Date(`${appointment.date}T00:00:00`);
  startsAt.setMinutes(appointment.startMinutes);
  const hoursUntil = (startsAt.getTime() - Date.now()) / 3_600_000;
  return {
    noticeHours,
    canManageOnline: hoursUntil > noticeHours,
  };
}

function AppointmentCard({
  appointment,
  pendingCancel,
  onCancelStart,
  onCancelConfirm,
  onCancelDismiss,
  onProposal,
}: {
  appointment: PlatformAppointment;
  pendingCancel: boolean;
  onCancelStart: () => void;
  onCancelConfirm: () => void;
  onCancelDismiss: () => void;
  onProposal: (accepted: boolean) => void;
}) {
  const policy = appointmentPolicy(appointment);
  const proposed = appointment.status === 'reschedule-proposed' && appointment.proposedDate && appointment.proposedTime;
  const changeHref = `/book?appointment=${encodeURIComponent(appointment.id)}`;
  return (
    <article className="v4-appointment-card">
      <div className="v4-appointment-main">
        <p className="eyebrow">{appointment.status.replaceAll('-', ' ')}</p>
        <h3>{appointment.serviceName}</h3>
        <dl>
          <div><dt>Date</dt><dd>{formatAppointmentDate(appointment.date)}</dd></div>
          <div><dt>Time</dt><dd>{appointment.time}</dd></div>
          <div><dt>Barber</dt><dd>{appointment.barberName.replace(/\.$/, '')}</dd></div>
        </dl>
      </div>

      {proposed ? (
        <div className="v4-proposal">
          <strong>New time proposed</strong>
          <span>{formatAppointmentDate(appointment.proposedDate ?? appointment.date)} at {appointment.proposedTime}</span>
          <div><button className="button" type="button" onClick={() => onProposal(true)}>Accept</button><button className="button button-secondary" type="button" onClick={() => onProposal(false)}>Decline</button></div>
        </div>
      ) : null}

      <div className="v4-appointment-actions">
        {policy.canManageOnline ? <a className="button button-secondary" href={changeHref}>Change appointment</a> : null}
        {policy.canManageOnline && !pendingCancel ? <button className="text-button" type="button" onClick={onCancelStart}>{appointment.status === 'waitlisted' ? 'Leave waitlist' : 'Cancel appointment'}</button> : null}
        {pendingCancel ? <div className="v4-cancel-confirm"><span>Cancel this {appointment.status === 'waitlisted' ? 'waitlist request' : 'appointment'}?</span><button type="button" onClick={onCancelConfirm}>Yes, cancel</button><button type="button" onClick={onCancelDismiss}>Keep it</button></div> : null}
        {!policy.canManageOnline ? <p>Online changes close {policy.noticeHours} hours before the appointment. <a href={business.phoneHref}>Call {business.phone}</a>.</p> : null}
      </div>
    </article>
  );
}

function CustomerSummary({ account }: { account: PlatformAccount }) {
  const [appointments, setAppointments] = useState(() => readAppointments().filter((appointment) => appointment.customerEmail === account.email));
  const [orders, setOrders] = useState(() => readOrders().filter((order) => order.customer.email === account.email));
  const [pendingCancelId, setPendingCancelId] = useState('');
  const [profile, setProfile] = useState({ name: account.name, email: account.email, phone: getCustomerPhone(account) });
  const [profileMessage, setProfileMessage] = useState('');
  const [security, setSecurity] = useState({ current: '', next: '', confirmation: '' });
  const [securityMessage, setSecurityMessage] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const refreshAppointments = () => setAppointments(readAppointments().filter((appointment) => appointment.customerEmail === account.email));
    const refreshOrders = () => setOrders(readOrders().filter((order) => order.customer.email === account.email));
    const unsubscribeAppointments = subscribeToAppointmentChanges(refreshAppointments);
    const unsubscribeOrders = subscribeToStorefrontChanges(refreshOrders);
    refreshAppointments();
    refreshOrders();
    setProfile({ name: account.name, email: account.email, phone: getCustomerPhone(account) });
    return () => {
      unsubscribeAppointments();
      unsubscribeOrders();
    };
  }, [account]);

  const active = appointments.filter((appointment) => ['requested', 'confirmed', 'reschedule-proposed', 'waitlisted'].includes(appointment.status));

  const cancel = (appointment: PlatformAppointment) => {
    updateAppointment(appointment.id, { status: 'cancelled' });
    setAppointments(readAppointments().filter((item) => item.customerEmail === account.email));
    setPendingCancelId('');
  };

  const respond = (appointmentId: string, accepted: boolean) => {
    respondToAppointmentProposal(appointmentId, accepted);
    setAppointments(readAppointments().filter((item) => item.customerEmail === account.email));
  };

  const saveProfile = () => {
    try {
      setProfileMessage('');
      updateCustomerProfile(account, profile);
      setProfileMessage('Profile updated. Existing appointments and orders now use these details.');
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'Unable to update the profile.');
    }
  };

  const changePassword = async () => {
    setWorking(true);
    setSecurityMessage('');
    try {
      if (security.next !== security.confirmation) throw new Error('The new password confirmation does not match.');
      await changeCustomerPassword(account, security.current, security.next);
      setSecurity({ current: '', next: '', confirmation: '' });
      setSecurityMessage('Password updated.');
    } catch (error) {
      setSecurityMessage(error instanceof Error ? error.message : 'Unable to change the password.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="v4-customer-dashboard">
      <section className="v2-panel v2-panel-priority v4-appointments-panel">
        <div className="v2-panel-heading v4-panel-heading"><div><p className="eyebrow">Appointments</p><h2>Your appointments</h2></div><a className="button" href="/book">Book now</a></div>
        {active.length ? <div className="v4-appointment-list">{active.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} pendingCancel={pendingCancelId === appointment.id} onCancelStart={() => setPendingCancelId(appointment.id)} onCancelConfirm={() => cancel(appointment)} onCancelDismiss={() => setPendingCancelId('')} onProposal={(accepted) => respond(appointment.id, accepted)} />)}</div> : <div className="v2-empty v4-empty"><h3>No active appointments.</h3><p>Book a service when you are ready for your next visit.</p><a className="button button-secondary" href="/book">Find an opening</a></div>}
      </section>

      <div className="v4-customer-secondary-grid">
        <section className="v2-panel">
          <div className="v2-panel-heading v4-panel-heading"><div><p className="eyebrow">Orders</p><h2>Your orders</h2></div><a className="text-link" href="/shop">Shop</a></div>
          {orders.length ? <div className="v2-list">{orders.slice().reverse().map((order) => <article key={order.id}><div><strong>Order {order.id.split('-').at(-1)}</strong><span>{order.status.replaceAll('-', ' ')}</span><small>{order.fulfillment}</small></div><strong>{formatMoney(order.totalCents)}</strong></article>)}</div> : <div className="v4-account-recommendations"><h3>Nothing ordered yet.</h3><p>Explore products, recent work, or another appointment without leaving your account.</p><div><a href="/shop">Browse the Shop <span>→</span></a><a href="/gallery">View recent work <span>→</span></a><a href="/services">See services <span>→</span></a></div></div>}
        </section>

        <section className="v2-panel v4-profile-panel">
          <p className="eyebrow">Profile</p><h2>Contact details</h2>
          <div className="v4-profile-fields"><label><span>Full name</span><input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label><label><span>Email</span><input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label><label><span>Mobile phone</span><input type="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label></div>
          {profileMessage ? <p className="v4-form-message" role="status">{profileMessage}</p> : null}
          <button className="button button-secondary" type="button" onClick={saveProfile}>Save profile</button>
        </section>
      </div>

      <section className="v2-panel v2-panel-wide v4-security-panel">
        <div><p className="eyebrow">Security</p><h2>Change password</h2><p>Use your current password before choosing a new one.</p></div>
        <div className="v4-security-fields"><label><span>Current password</span><input type="password" autoComplete="current-password" value={security.current} onChange={(event) => setSecurity({ ...security, current: event.target.value })} /></label><label><span>New password</span><input type="password" autoComplete="new-password" value={security.next} onChange={(event) => setSecurity({ ...security, next: event.target.value })} /></label><label><span>Confirm new password</span><input type="password" autoComplete="new-password" value={security.confirmation} onChange={(event) => setSecurity({ ...security, confirmation: event.target.value })} /></label><button className="button" type="button" disabled={working || !security.current || !security.next || !security.confirmation} onClick={() => void changePassword()}>{working ? 'Updating…' : 'Update password'}</button></div>
        {securityMessage ? <p className="v4-form-message" role="status">{securityMessage}</p> : null}
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

export function RoleDashboardV4() {
  const [account, setAccount] = useState(() => getPlatformSessionAccount());
  useEffect(() => subscribeToPlatformAuth(() => setAccount(getPlatformSessionAccount())), []);

  if (!account) {
    return <section className="section v2-auth-page platform-pattern platform-pattern-account"><div className="container narrow-container"><div className="v2-auth-card"><p className="eyebrow">Account required</p><h1>Sign in to continue.</h1><a className="button" href="/account">Account / Login</a></div></div></section>;
  }

  const elevated = account.role !== 'customer';
  return (
    <section className="section v2-dashboard-page v4-dashboard-page platform-pattern platform-pattern-staff">
      <div className="container route-wide">
        <header className="v2-dashboard-header v4-dashboard-header"><div><p className="eyebrow">{roleLabels[account.role]} account</p><h1>Welcome, {account.name}.</h1>{elevated ? <p>Open the tools assigned to this role.</p> : <p>Appointments, orders, profile details, and account security in one place.</p>}</div><button className="button button-secondary v4-logout" type="button" onClick={logout}>Log out</button></header>
        {elevated ? <StaffSummary account={account} /> : <CustomerSummary account={account} />}
        {hasPlatformCapability(account, 'manage-staff') ? <AccessManager actor={account} /> : null}
      </div>
    </section>
  );
}
