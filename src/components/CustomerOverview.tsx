import { useEffect, useState } from 'react';
import { accountApi, AccountApiError } from '../data/customer-api';
import type { CustomerAccount } from '../shared/customer';
import type { CustomerDashboard, DashboardAppointment } from '../shared/dashboard';

const appointmentHref = (id: string) => `/account?view=appointments&record=${encodeURIComponent(id)}`;
const orderHref = (id: string) => `/account?view=orders&record=${encodeURIComponent(id)}`;
const status = (value: string) => value.replaceAll('_', ' ');
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
function when(visit: DashboardAppointment) {
  if (!visit.startsAt || !Number.isFinite(Date.parse(visit.startsAt))) return 'Time to be arranged';
  return new Intl.DateTimeFormat('en-US', { timeZone: visit.timeZone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(visit.startsAt));
}
function pendingLabel(visit: DashboardAppointment) {
  if (visit.changeKind === 'professional_proposal') return 'Your professional proposed a new time. Open your appointment to accept or decline.';
  if (visit.changeKind === 'customer_request') return 'Rescheduling requested. Your original visit stays confirmed until approved.';
  if (visit.status === 'confirmed' && visit.cancellationState === 'pending') return 'Cancellation requested. Your visit remains confirmed until approved.';
  if (visit.status === 'reschedule_proposed') return 'A different time has been proposed. Open your appointment for details.';
  if (visit.status === 'waitlisted') return 'On the waitlist. A visit has not been confirmed.';
  return 'Booking requested. Awaiting your professional’s decision.';
}

export function CustomerOverview(props: { account: CustomerAccount; bookingEnabled: boolean }) {
  // Reset private records on identity change, before rendering another account.
  return <OverviewContent key={props.account.id} {...props} />;
}

function OverviewContent({ account, bookingEnabled }: { account: CustomerAccount; bookingEnabled: boolean }) {
  const [data, setData] = useState<CustomerDashboard | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void accountApi<CustomerDashboard>('/me/dashboard').then((value) => {
      if (active) { setData(value); setError(''); }
    }).catch((failure) => {
      if (active) {
        if (failure instanceof AccountApiError && [401, 403].includes(failure.status)) setData(null);
        setError(failure instanceof Error ? failure.message : 'Please try again.');
      }
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [attempt]);

  return <section className="customer-overview">
    <div className="customer-section-heading"><div><h2>Your overview</h2><p>Keep track of your next visit, requests, and orders.</p></div><a className="button" href="/book">{bookingEnabled ? 'Book your next visit' : 'View booking options'}</a></div>
    {error ? <p role="alert" className="form-error">{data ? 'Your dashboard could not be refreshed. The information below may be out of date. ' : ''}{error}</p> : null}
    <p role="status" className="customer-dashboard-refresh-status">{busy ? data ? 'Refreshing your dashboard…' : 'Loading your dashboard…' : ''}</p>
    {data ? <>
      <div className="customer-dashboard-priority">
        <section className="customer-overview-panel customer-next-visit" aria-labelledby="next-visit-heading">
          <h3 id="next-visit-heading">Your next visit</h3>
          {data.nextVisit ? <><p className="customer-status">{status(data.nextVisit.status)}</p><h4>{data.nextVisit.serviceName}</h4><p className="customer-visit-date">{when(data.nextVisit)}</p><p>With {data.nextVisit.barberName ?? 'Your professional'}</p>
            {data.nextVisit.status === 'confirmed' && data.nextVisit.cancellationState === 'pending' ? <p className="customer-notice">Cancellation requested. This visit remains confirmed until your professional approves.</p> : null}
            <a className="button button-secondary" href={appointmentHref(data.nextVisit.id)}>View appointment</a>
          </> : <><h4>Plan your next visit</h4><p>No confirmed upcoming visit yet.</p><p>{data.counts.pending ? 'You have requests awaiting a decision. A request is confirmed only after your professional accepts it.' : 'Choose a service and professional to find a time that works for you.'}</p><a href="/account?view=appointments">View your appointments</a></>}
        </section>
        <section className="customer-overview-panel customer-pending" aria-labelledby="pending-heading">
          <h3 id="pending-heading">Requests and pickups</h3>
          {data.counts.pending || data.readyOrderCount ? <>
            {data.counts.pending ? <><p>{data.counts.pending} appointment {data.counts.pending === 1 ? 'request or decision' : 'requests or decisions'} pending</p><ul className="customer-records">{data.pendingAppointments.map((item) => <li key={item.id}><div><strong>{item.serviceName}</strong><p>{pendingLabel(item)}</p><a href={appointmentHref(item.id)}>View request<span className="sr-only"> for {item.serviceName}</span></a></div></li>)}</ul>{data.counts.pending > data.pendingAppointments.length ? <p><a href="/account?view=appointments">View all appointments and requests</a></p> : null}</> : null}
            {data.readyOrderCount ? <><p>{data.readyOrderCount} {data.readyOrderCount === 1 ? 'order ready' : 'orders ready'} for pickup</p><ul className="customer-records">{data.readyOrders.map((item) => <li key={item.id}><div><strong>Order {item.id.slice(-8)}</strong><p>Ready for pickup</p><a href={orderHref(item.id)}>View pickup details<span className="sr-only"> for order {item.id.slice(-8)}</span></a></div></li>)}</ul>{data.readyOrderCount > data.readyOrders.length ? <a href="/account?view=orders">View all orders</a> : null}</> : null}
          </> : <><p>No pending appointment decisions or orders ready for pickup.</p><p>Updates will appear here as your professional reviews requests and the shop prepares orders.</p></>}
        </section>
      </div>
      <dl className="customer-overview-stats">{([['upcoming', 'Upcoming & active'], ['pending', 'Pending decisions'], ['completed', 'Completed visits'], ['orders', 'Orders']] as const).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{data.counts[key]}</dd></div>)}</dl>
      <div className="customer-overview-grid">
        <section className="customer-overview-panel"><div className="customer-section-heading"><h3>Recently updated appointments</h3><a href="/account?view=appointments">View all appointments</a></div>{data.recentAppointments.length ? <ul className="customer-records">{data.recentAppointments.map((item) => <li key={item.id}><div><strong>{item.serviceName}</strong><p>{status(item.status)} · {item.barberName ?? 'Professional to be assigned'}</p><p>{when(item)}</p></div><a href={appointmentHref(item.id)}>Details<span className="sr-only"> for {item.serviceName}</span></a></li>)}</ul> : <p>Your website appointment requests will appear here. Existing provider bookings do not sync automatically.</p>}</section>
        <section className="customer-overview-panel"><div className="customer-section-heading"><h3>Recently updated orders</h3><a href="/account?view=orders">View all orders</a></div>{data.recentOrders.length ? <ul className="customer-records">{data.recentOrders.map((item) => <li key={item.id}><div><strong>Order {item.id.slice(-8)}</strong><p>{status(item.status)} · {status(item.fulfillment)}</p><p>Order total: {money(item.totalCents)}</p></div><a href={orderHref(item.id)}>Details<span className="sr-only"> for order {item.id.slice(-8)}</span></a></li>)}</ul> : <><p>No orders linked to your account yet.</p><a href="/shop">Browse the shop</a></>}</section>
      </div>
      <section className="customer-overview-panel customer-dashboard-profile"><div><h3>Your profile</h3><p><strong>{account.profile.name}</strong><br />{account.email}<br />{account.profile.phone || 'No contact phone saved'}</p></div><div className="customer-form-actions"><a href="/account?view=profile">Edit profile</a><a href="/account?view=security">Account security</a>{account.role !== 'customer' ? <><a href="/account?view=professional">Professional requests</a><a href="/account?view=professional-visits">Your assigned visits</a></> : null}</div></section>
    </> : null}
    <button className="text-button" disabled={busy} onClick={() => { setBusy(true); setError(''); setAttempt((value) => value + 1); }}>Refresh dashboard</button>
  </section>;
}
