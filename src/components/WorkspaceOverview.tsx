import { useEffect, useState } from 'react';
import { accountApi } from '../data/customer-api';
import type { WorkspaceDashboard } from '../shared/workspace';
import type { CustomerAccount } from '../shared/customer';
import { StaffAuthenticator } from './StaffAuthenticator';

export function WorkspaceOverview({ account }: { account: CustomerAccount }) {
  return <section><div className="customer-section-heading"><div><h2>{account.role === 'barber' ? 'Your chair' : 'Shop overview'}</h2><p>{account.role === 'barber' ? 'Your requests, upcoming clients and working hours.' : 'Visits, orders and staff access in one workspace.'}</p></div></div>
    <StaffAuthenticator><WorkspaceContent key={`${account.id}:${account.role}`} /></StaffAuthenticator>
  </section>;
}
function WorkspaceContent() {
  const [data, setData] = useState<WorkspaceDashboard | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(true); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void accountApi<WorkspaceDashboard>('/me/workspace').then(value => { if (active) { setData(value); setError(''); } }).catch(failure => { if (active) { setData(null); setError(failure instanceof Error ? failure.message : 'Please try again.'); } }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [attempt]);
  const shop = data?.scope === 'shop';
  return <div className="workspace-overview" aria-busy={busy}>
    {error ? <p role="alert" className="form-error">{error}</p> : null}{busy ? <p role="status">Refreshing your workspace…</p> : null}
    {data ? <>
      {!shop && data.access.state !== 'approved' ? <section className="customer-overview-panel"><h3>{data.access.state === 'pending_review' ? 'Your profile is being reviewed' : data.access.state === 'disabled' ? 'Your professional profile is paused' : 'Get your chair ready'}</h3><p>{data.access.state === 'pending_review' ? 'The owner will review your services and profile. You can check your submission for updates.' : data.access.state === 'disabled' ? 'Contact the shop about restoring your professional profile.' : 'Add your professional details and services for owner approval, then set your availability.'}</p>{data.access.setupEnabled && data.access.state !== 'disabled' ? <a className="button" href="/account?view=professional-setup">Open professional setup</a> : null}</section> : null}
      <div className="workspace-metrics">
        <a href={shop ? '/account?view=front-desk' : '/account?view=professional-visits'}><span>Upcoming visits</span><strong>{data.counts.upcoming}</strong><small>Confirmed or proposed changes</small></a>
        <a href={shop ? '/account?view=front-desk' : '/account?view=professional-visits'}><span>In the shop</span><strong>{data.counts.active}</strong><small>Checked in or in service</small></a>
        <div><span>Pending decisions</span><strong>{data.counts.pending}</strong><small>{shop ? 'Assigned professionals review requests' : 'Requests and appointment changes'}</small>{!shop ? <a href="/account?view=professional">Review requests →</a> : null}</div>
        {data.counts.orders !== null ? <a href="/admin/orders"><span>Open orders</span><strong>{data.counts.orders}</strong><small>Requests through pickup</small></a> : null}
      </div>
      <section className="customer-overview-panel"><div className="customer-section-heading"><h3>{shop ? 'Next at the shop' : 'Your next clients'}</h3><a href={shop ? '/account?view=front-desk' : '/account?view=professional-visits'}>{shop ? 'Open front desk' : 'View assigned visits'}</a></div>
        {data.visits.length ? <ul className="customer-records">{data.visits.map(visit => <li key={visit.id}><div><strong>{visit.customerName}</strong><p>{visit.serviceName}{shop ? ` · ${visit.professionalName}` : ''}</p><p>{new Intl.DateTimeFormat('en-US', { timeZone: visit.timeZone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(visit.startsAt))}</p></div><span className="customer-status">{visit.status.replaceAll('_', ' ')}</span></li>)}</ul> : <p>No confirmed upcoming visits. New requests appear after a client submits them; visits appear here after confirmation.</p>}
      </section>
      <section className="customer-overview-panel"><h3>{shop ? 'Keep the shop moving' : 'Manage your chair'}</h3><div className="workspace-actions">
        {shop ? <><a href="/account?view=sales"><strong>Sales preparation</strong><span>Prepare estimates for visits and order requests</span></a><a href="/account?view=register"><strong>Cash register</strong><span>Open your register before recording cash</span></a><a href="/account?view=counter"><strong>Sales &amp; cash</strong><span>Review sales, record payments and find receipts</span></a><a href="/account?view=front-desk"><strong>Front desk</strong><span>Walk-ins, check-in and visit progress</span></a><a href="/account?view=accounts"><strong>Staff access</strong><span>Find accounts and assign permissions</span></a>{data.counts.orders !== null ? <a href="/admin/orders"><strong>Customer orders</strong><span>Review requests and prepare fulfillment</span></a> : null}{data.counts.reviews !== null ? <a href="/account?view=setup-reviews"><strong>Professional reviews</strong><span>{data.counts.reviews} submissions awaiting review</span></a> : null}</> : <><a href="/account?view=professional"><strong>Appointment requests</strong><span>Review bookings, changes and cancellations</span></a><a href="/account?view=professional-schedule"><strong>Availability</strong><span>Weekly hours and time off</span></a><a href="/account?view=professional-setup"><strong>Professional profile</strong><span>Services and setup status</span></a></>}
      </div></section>
      {shop && data.access.state === 'approved' ? <p>You also have an approved chair. <a href="/account?view=professional">Open your assigned requests</a> or <a href="/account?view=professional-schedule">edit your availability</a>.</p> : null}
    </> : null}
    <button className="text-button" disabled={busy} onClick={() => { setBusy(true); setAttempt(value => value + 1); }}>Refresh workspace</button>
  </div>;
}
