import { useEffect, useMemo, useState } from 'react';
import {
  createOrUpdateCustomerAccount,
  endSession,
  findAccount,
  formatPhone,
  getSessionAccount,
  isValidEmail,
  isValidPhone,
  requestPhoneVerification,
  startSession,
  subscribeToAuthChanges,
  verifyPhoneChallenge,
  type CustomerAccount,
} from '../data/auth';
import { readNotifications } from '../data/notifications';
import {
  readAppointments,
  respondToAppointmentProposal,
  subscribeToAppointmentChanges,
  updateAppointment,
  type PlatformAppointment,
} from '../data/platform';
import { business, getBookingPath } from '../data/site';
import { formatMoney, readOrders, subscribeToStorefrontChanges, type StoreOrder } from '../data/storefront';
import { originalAssets } from '../data/visuals';

type AuthMode = 'sign-in' | 'create';

type VerificationState = {
  challengeId: string;
  code: string;
  developmentCode: string;
  verified: boolean;
  error: string;
};

const emptyVerification: VerificationState = {
  challengeId: '',
  code: '',
  developmentCode: '',
  verified: false,
  error: '',
};

function formatDate(dateKey: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${dateKey}T12:00:00`));
}

function CustomerAuthPanel({ onAuthenticated }: { onAuthenticated: (account: CustomerAccount) => void }) {
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [verification, setVerification] = useState<VerificationState>(emptyVerification);
  const [error, setError] = useState('');
  const existing = findAccount(email, phone);
  const contactValid = isValidEmail(email) && isValidPhone(phone);
  const canVerify = mode === 'create' ? contactValid && name.trim().length >= 2 : contactValid && Boolean(existing);

  const requestCode = () => {
    try {
      const challenge = requestPhoneVerification(phone);
      setVerification({ challengeId: challenge.challengeId, code: '', developmentCode: challenge.developmentCode, verified: false, error: '' });
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to start verification.');
    }
  };

  const verify = () => {
    const result = verifyPhoneChallenge(verification.challengeId, verification.code);
    setVerification(result.valid ? { ...verification, verified: true, error: '' } : { ...verification, error: result.reason });
  };

  const finish = () => {
    if (!verification.verified) return;
    const account = mode === 'create'
      ? createOrUpdateCustomerAccount({ name, email, phone, phoneVerified: true })
      : findAccount(email, phone);
    if (!account) {
      setError('No account matches that verified email and phone number.');
      return;
    }
    startSession(account);
    onAuthenticated(account);
  };

  const changeMode = (next: AuthMode) => {
    setMode(next);
    setVerification(emptyVerification);
    setError('');
  };

  return (
    <section className="account-auth-shell platform-pattern platform-pattern-poles">
      <div className="account-auth-card">
        <img src={originalAssets.logo} alt="The Kut Shoppe" width="96" height="96" />
        <p className="eyebrow">Customer account</p>
        <h1>{mode === 'create' ? 'Create your Kut Shoppe account.' : 'Welcome back.'}</h1>
        <p>Appointments come first. Product orders, pickup, shipping, and receipts use the same account.</p>
        <div className="account-auth-tabs" role="tablist" aria-label="Account access"><button role="tab" aria-selected={mode === 'sign-in'} className={mode === 'sign-in' ? 'is-active' : ''} type="button" onClick={() => changeMode('sign-in')}>Sign in</button><button role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? 'is-active' : ''} type="button" onClick={() => changeMode('create')}>Create account</button></div>
        <div className="account-auth-fields">
          {mode === 'create' ? <label>Full name <span aria-hidden="true">*</span><input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label> : null}
          <label>Email <span aria-hidden="true">*</span><input required type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setVerification(emptyVerification); setError(''); }} /></label>
          <label>Mobile phone <span aria-hidden="true">*</span><input required type="tel" autoComplete="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setVerification(emptyVerification); setError(''); }} /></label>
        </div>
        {mode === 'sign-in' && contactValid && !existing ? <p className="form-error">No customer or staff account matches both entries.</p> : null}
        {!verification.challengeId ? <button className="button" type="button" disabled={!canVerify} onClick={requestCode}>Send verification code</button> : null}
        {verification.challengeId && !verification.verified ? <div className="account-code-entry"><label>Verification code<input inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={verification.code} onChange={(event) => setVerification({ ...verification, code: event.target.value.replace(/\D/g, '').slice(0, 6), error: '' })} /></label><button className="button" type="button" disabled={verification.code.length !== 6} onClick={verify}>Verify</button><button className="text-button" type="button" onClick={requestCode}>Send another code</button></div> : null}
        {verification.developmentCode && !verification.verified ? <p className="development-code"><strong>Development code:</strong> {verification.developmentCode}<span>The SMS outbox is active; live delivery requires production messaging credentials.</span></p> : null}
        {verification.error ? <p className="form-error" role="alert">{verification.error}</p> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {verification.verified ? <button className="button" type="button" onClick={finish}>{mode === 'create' ? 'Create account' : 'Open account'}</button> : null}
        <div className="account-auth-links"><a href="/book">Continue booking as a guest</a><a href="/staff/login">Staff portal</a></div>
      </div>
    </section>
  );
}

function AppointmentStatusCopy({ appointment }: { appointment: PlatformAppointment }) {
  const copy: Record<PlatformAppointment['status'], string> = {
    requested: 'Waiting for barber approval',
    confirmed: 'Confirmed by the barber',
    'reschedule-proposed': 'A different time needs your response',
    waitlisted: 'Waiting for an available barber',
    declined: 'The request was declined',
    cancelled: 'Cancelled',
    completed: 'Completed',
    'no-show': 'Marked as no-show',
  };
  return <span className={`account-status account-status-${appointment.status}`}>{copy[appointment.status]}</span>;
}

function AccountAppointmentCard({ appointment, onUpdated }: { appointment: PlatformAppointment; onUpdated: () => void }) {
  const cancelAllowed = ['requested', 'confirmed', 'reschedule-proposed', 'waitlisted'].includes(appointment.status);
  const acceptProposal = () => { respondToAppointmentProposal(appointment.id, true); onUpdated(); };
  const rejectProposal = () => { respondToAppointmentProposal(appointment.id, false); onUpdated(); };
  const cancel = () => { updateAppointment(appointment.id, { status: 'cancelled' }); onUpdated(); };

  return (
    <article className="account-appointment-card">
      <time><strong>{formatDate(appointment.date)}</strong><span>{appointment.time}</span></time>
      <div className="account-appointment-copy"><p className="eyebrow">{appointment.barberName}</p><h3>{appointment.serviceName}</h3><p>{appointment.durationMinutes} minutes · {appointment.price}</p>{appointment.customerNote ? <small>{appointment.customerNote}</small> : null}</div>
      <AppointmentStatusCopy appointment={appointment} />
      {appointment.status === 'reschedule-proposed' && appointment.proposedDate && appointment.proposedTime ? <div className="account-proposal"><p><strong>Proposed:</strong> {formatDate(appointment.proposedDate)} at {appointment.proposedTime}</p><div><button className="button" type="button" onClick={acceptProposal}>Accept new time</button><button className="button button-secondary" type="button" onClick={rejectProposal}>Reject</button></div></div> : null}
      {cancelAllowed ? <button className="text-button danger account-cancel" type="button" onClick={cancel}>Cancel request</button> : null}
    </article>
  );
}

function AccountOrderCard({ order }: { order: StoreOrder }) {
  return (
    <article className="account-order-card">
      <header><div><p className="eyebrow">{order.fulfillment}</p><h3>Order {order.id.split('-').slice(-1)[0]}</h3><p>{new Date(order.createdAt).toLocaleDateString()}</p></div><span className={`account-status account-status-${order.status}`}>{order.status.replaceAll('-', ' ')}</span></header>
      <div className="account-order-items">{order.items.map((item) => <div key={`${item.productId}-${item.variantId}`}><span>{item.quantity} × {item.name}<small>{item.variantName}</small></span><strong>{formatMoney(item.unitPriceCents * item.quantity)}</strong></div>)}</div>
      <footer><strong>{formatMoney(order.totalCents)}</strong>{order.trackingNumber ? <a href={`https://www.google.com/search?q=${encodeURIComponent(order.trackingNumber)}`} target="_blank" rel="noopener noreferrer">Tracking {order.trackingNumber} ↗</a> : <span>{order.ownerActionRequired ? 'Waiting for owner review' : 'Status updated by the shop'}</span>}</footer>
    </article>
  );
}

function SignedInAccount({ account, onLogout }: { account: CustomerAccount; onLogout: () => void }) {
  const [appointments, setAppointments] = useState(() => readAppointments());
  const [orders, setOrders] = useState(() => readOrders());
  const [notifications, setNotifications] = useState(() => readNotifications());
  const loctician = getBookingPath('styling');

  useEffect(() => {
    const refresh = () => {
      setAppointments(readAppointments());
      setOrders(readOrders());
      setNotifications(readNotifications());
    };
    const unsubscribeAppointments = subscribeToAppointmentChanges(refresh);
    const unsubscribeOrders = subscribeToStorefrontChanges(refresh);
    return () => { unsubscribeAppointments(); unsubscribeOrders(); };
  }, []);

  const accountAppointments = useMemo(() => appointments.filter((appointment) => (
    appointment.customerEmail === account.email
    || appointment.customerPhone === account.phone
  )), [account, appointments]);
  const activeAppointments = accountAppointments.filter((appointment) => ['requested', 'confirmed', 'reschedule-proposed', 'waitlisted'].includes(appointment.status));
  const appointmentHistory = accountAppointments.filter((appointment) => !['requested', 'confirmed', 'reschedule-proposed', 'waitlisted'].includes(appointment.status));
  const accountOrders = orders.filter((order) => order.customer.email === account.email || order.customer.phone === account.phone);
  const accountMessages = notifications.filter((notification) => notification.recipient === account.email || notification.recipient === account.phone).slice().reverse().slice(0, 8);

  return (
    <section className="section account-app-page platform-pattern platform-pattern-poles">
      <div className="container route-wide">
        <header className="account-app-header">
          <div><p className="eyebrow">Customer account</p><h1>Your chair comes first.</h1><p className="lede">Appointments, waitlist requests, shop orders, receipts, and fulfillment updates stay connected to one verified customer profile.</p></div>
          <div className="account-app-profile-card"><img src={originalAssets.logo} alt="" width="72" height="72" /><div><small>Signed in as</small><strong>{account.name}</strong></div><span>{account.email}<br />{formatPhone(account.phone)}</span><button className="text-button" type="button" onClick={onLogout}>Log out</button></div>
        </header>
        <nav className="account-app-nav" aria-label="Customer account sections"><a href="#appointments">Appointments</a><a href="#orders">Orders</a><a href="#messages">Messages</a><a href="#details">Profile</a></nav>

        <div className="account-app-grid">
          <main>
            <section className="account-app-panel account-priority-panel" id="appointments">
              <div className="account-panel-heading"><div><p className="eyebrow">Appointments</p><h2>Upcoming and pending</h2></div><div><a className="button" href="/book">Book appointment</a><a className="button button-secondary" href="/book/walk-in">Join walk-in list</a></div></div>
              {activeAppointments.length ? <div className="account-appointment-list">{activeAppointments.map((appointment) => <AccountAppointmentCard appointment={appointment} onUpdated={() => setAppointments(readAppointments())} key={appointment.id} />)}</div> : <div className="account-empty-state"><h3>No active barber requests.</h3><p>New appointment and waitlist requests appear here immediately.</p></div>}
              <div className="account-external-appointments"><div><p className="eyebrow">Loctician appointments</p><h3>Managed by Crowned by Steph</h3><p>Loc, braid, twist, and retwist appointments remain in Steph’s external system.</p></div><a className="button button-secondary" href={loctician.href} target="_blank" rel="noopener noreferrer">Manage with Steph <span aria-hidden="true">↗</span></a></div>
              {appointmentHistory.length ? <details className="account-history"><summary>Appointment history ({appointmentHistory.length})</summary><div className="account-appointment-list">{appointmentHistory.map((appointment) => <AccountAppointmentCard appointment={appointment} onUpdated={() => setAppointments(readAppointments())} key={appointment.id} />)}</div></details> : null}
            </section>

            <section className="account-app-panel" id="orders"><div className="account-panel-heading"><div><p className="eyebrow">Shop orders</p><h2>Orders, pickup, and shipping</h2></div><a className="button button-secondary" href="/shop">Browse the shop</a></div>{accountOrders.length ? <div className="account-order-list">{accountOrders.map((order) => <AccountOrderCard order={order} key={order.id} />)}</div> : <div className="account-empty-state"><h3>No product orders yet.</h3><p>Submitted pickup and shipping orders appear here while the owner reviews them.</p></div>}</section>

            <section className="account-app-panel" id="messages"><div className="account-panel-heading"><div><p className="eyebrow">Receipts and updates</p><h2>Message activity</h2></div></div>{accountMessages.length ? <div className="account-message-list">{accountMessages.map((notification) => <article key={notification.id}><div><span>{notification.channel}</span><strong>{notification.subject}</strong><small>{new Date(notification.createdAt).toLocaleString()}</small></div><p>{notification.message}</p><span className={`account-status account-status-${notification.status}`}>{notification.status}</span></article>)}</div> : <div className="account-empty-state"><h3>No messages yet.</h3><p>Verification, appointment, order, receipt, pickup, and shipping messages are recorded here.</p></div>}</section>

            <section className="account-app-panel" id="details"><div className="account-panel-heading"><div><p className="eyebrow">Account profile</p><h2>Contact and fulfillment details</h2></div></div><div className="account-detail-grid"><article><small>Contact</small><strong>{account.name}</strong><p>{account.email}<br />{formatPhone(account.phone)}</p></article><article><small>Verification</small><strong>{account.phoneVerified ? 'Phone verified' : 'Verification required'}</strong><p>Verification protects booking and account access.</p></article><article><small>Pickup</small><strong>{business.address}</strong><p>Ready-for-pickup updates appear with eligible orders.</p></article></div></section>
          </main>

          <aside className="account-app-sidebar"><section><p className="eyebrow">Current status</p><h2>{activeAppointments.length} active appointment{activeAppointments.length === 1 ? '' : 's'}</h2><p>{accountOrders.filter((order) => !['completed', 'declined', 'cancelled'].includes(order.status)).length} open shop order{accountOrders.length === 1 ? '' : 's'}.</p></section><section><p className="eyebrow">Need help?</p><p>Call the shop for appointment guidance, accessibility needs, or order questions.</p><a href={business.phoneHref}>Call {business.phone}</a></section>{account.role !== 'customer' ? <section><p className="eyebrow">Staff access</p><a className="button" href="/staff">Open staff portal</a></section> : null}</aside>
        </div>
      </div>
    </section>
  );
}

export function CustomerAccountPrototype() {
  const [account, setAccount] = useState<CustomerAccount | null>(() => getSessionAccount());

  useEffect(() => subscribeToAuthChanges(() => setAccount(getSessionAccount())), []);

  const logout = () => {
    endSession();
    setAccount(null);
  };

  return account
    ? <SignedInAccount account={account} onLogout={logout} />
    : <CustomerAuthPanel onAuthenticated={setAccount} />;
}
