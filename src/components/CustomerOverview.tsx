import { useEffect, useState } from 'react';
import { accountApi } from '../data/customer-api';
import type { CustomerAccount } from '../shared/customer';
import type { CustomerDashboard } from '../shared/dashboard';

const when = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' }).format(new Date(value)) : 'Time to be arranged';
const status = (value: string) => value.replaceAll('_', ' ');
export function CustomerOverview({ account, bookingEnabled }: { account: CustomerAccount; bookingEnabled: boolean }) {
  const [data, setData] = useState<CustomerDashboard | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void accountApi<CustomerDashboard>('/me/dashboard').then((value) => { if (active) { setData(value); setError(''); } }).catch((failure) => { if (active) setError(failure instanceof Error ? failure.message : 'Please try again.'); });
    return () => { active = false; };
  }, [attempt]);
  return <section className="customer-overview"><div className="customer-section-heading"><h2>Your overview</h2><a className="button" href="/book">{bookingEnabled ? 'Book your next visit' : 'View booking options'}</a></div>
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    {!data && !error ? <p role="status">Loading your dashboard…</p> : null}
    {data ? <><dl className="customer-overview-stats">{([['upcoming', 'Upcoming & active'], ['pending', 'Awaiting a decision'], ['completed', 'Completed visits'], ['orders', 'Orders']] as const).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{data.counts[key]}</dd></div>)}</dl>
      <div className="customer-overview-grid"><section className="customer-overview-panel"><h3>Your next visit</h3>{data.nextVisit ? <><p className="customer-status">{status(data.nextVisit.status)}</p><h4>{data.nextVisit.serviceName}</h4><p>{when(data.nextVisit.startsAt)} (Eastern time)</p><p>With {data.nextVisit.barberName ?? 'Your professional'}</p><a className="button button-secondary" href={`/account?view=appointments&record=${encodeURIComponent(data.nextVisit.id)}`}>View appointment</a></> : <><p>No confirmed upcoming visit yet.</p><p>{data.counts.pending ? 'You have requests awaiting a decision. Check appointments for their current status.' : 'Choose a service and professional to plan your next visit.'}</p><a href="/account?view=appointments">View your appointments</a></>}</section>
      <section className="customer-overview-panel"><h3>Your profile</h3><p><strong>{account.profile.name}</strong><br />{account.email}<br />{account.profile.phone || 'No contact phone saved'}</p><div className="customer-form-actions"><a href="/account?view=profile">Edit profile</a><a href="/account?view=security">Account security</a></div>{account.role !== 'customer' ? <p><a href="/account?view=professional">Professional requests</a> · <a href="/account?view=professional-visits">Your assigned visits</a></p> : null}</section>
      <section className="customer-overview-panel"><div className="customer-section-heading"><h3>Recent appointment activity</h3><a href="/account?view=appointments">View all</a></div>{data.recentAppointments.length ? <ul className="customer-records">{data.recentAppointments.map((item) => <li key={item.id}><div><strong>{item.serviceName}</strong><p>{status(item.status)} · {item.barberName ?? 'Professional to be assigned'}</p></div><a href={`/account?view=appointments&record=${encodeURIComponent(item.id)}`}>Details</a></li>)}</ul> : <p>Your website appointment requests will appear here. Existing provider bookings do not sync automatically.</p>}</section>
      <section className="customer-overview-panel"><div className="customer-section-heading"><h3>Recent orders</h3><a href="/account?view=orders">View all</a></div>{data.recentOrders.length ? <ul className="customer-records">{data.recentOrders.map((item) => <li key={item.id}><div><strong>Order {item.id.slice(-8)}</strong><p>{status(item.status)} · {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.totalCents / 100)}</p></div><a href={`/account?view=orders&record=${encodeURIComponent(item.id)}`}>Details</a></li>)}</ul> : <p>No orders linked to your account yet. Browse the shop to start a pickup or shipping request.</p>}</section></div></> : null}
    <button className="text-button" onClick={() => { setData(null); setError(''); setAttempt((value) => value + 1); }}>Refresh dashboard</button>
  </section>;
}
