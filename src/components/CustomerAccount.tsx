import { useEffect, useRef, useState } from 'react';
import { AccountManagement } from './AccountManagement';
import { WorkspaceOverview } from './WorkspaceOverview';
import { accountSections, canOpenAccountView, readAccountRoute, type AccountView as View } from '../data/account-sections';
import { accountApi } from '../data/customer-api';
import type { CustomerAccount as Account } from '../shared/customer';
import { CustomerHistory } from './CustomerHistory';
import { CustomerAppointmentDetails, CustomerOrderDetails } from './CustomerRecordDetails';
import { StaffRequests } from './StaffRequests';
import { ProfessionalSetup } from './ProfessionalSetup';
import { ProfessionalSchedule } from './ProfessionalSchedule';
import { StaffVisits } from './StaffVisits';
import { FrontDesk } from './FrontDesk';
import { SalesPreparation, CustomerEstimates } from './SaleEstimates';
import { CashCounter, CustomerReceipts } from './CashCounter';
import { CashRegister } from './CashRegister';
import { CustomerOverview } from './CustomerOverview';
import { RestoredBooking as CustomerBooking } from './RestoredBooking';

import { AccountGate, ProfileForm, SecurityPanel } from './AccountBasics';

const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Please try again.';

function AccountHome({ account, onSignedOut, bookingEnabled }: { account: Account; onSignedOut: (message: string) => void; bookingEnabled: boolean }) {
  const [{ view, record }, setRoute] = useState(readAccountRoute);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sync = () => setRoute(readAccountRoute());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  const select = (next: View, id: string | null = null) => { setRoute({ view: next, record: id }); window.history.pushState({}, '', `/account?view=${next}${id ? `&record=${encodeURIComponent(id)}` : ''}`); window.requestAnimationFrame(() => content.current?.focus({ preventScroll: true })); };
  const logout = async () => {
    setWorking(true); setError('');
    try { await accountApi('/auth/logout', {}); onSignedOut('You have been signed out.'); }
    catch (failure) { setError(messageOf(failure)); } finally { setWorking(false); }
  };
  return <div className="customer-home"><header className="customer-home-header"><div><p className="customer-kicker">{account.role === 'customer' ? 'Client account' : account.role === 'barber' ? 'Barber workspace' : 'Shop management'}</p><h1>Welcome, {account.profile.name.split(/\s+/)[0]}.</h1></div><button className="button button-secondary" type="button" disabled={working} onClick={() => void logout()}>Sign out</button></header>
    <div className="customer-form account-mobile-nav"><label htmlFor="account-section">Account section</label><select id="account-section" value={canOpenAccountView(account.role, view) ? view : 'overview'} onChange={event => { if (event.target.value.startsWith('/')) window.location.assign(event.target.value); else select(event.target.value as View); }}>{accountSections.filter(([key]) => canOpenAccountView(account.role, key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}{['owner', 'manager', 'developer'].includes(account.role) ? <optgroup label="Store management"><option value="/admin/products">Products &amp; inventory</option><option value="/admin/orders">Customer orders</option></optgroup> : null}</select></div>
    <div className="account-workspace"><nav className="account-sidebar" aria-label="Account sections">{([['work', account.role === 'customer' ? 'Start here' : 'Workspace'], ['chair', 'My chair'], ['personal', 'My visits & orders'], ['account', 'My account']] as const).map(([group, title]) => {
      const links = accountSections.filter(([key, , section]) => section === group && canOpenAccountView(account.role, key));
      return links.length ? <div className="account-nav-group" key={group}><p>{title}</p>{links.map(([key, label]) => <a key={key} href={`/account?view=${key}`} aria-current={view === key ? 'page' : undefined} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) { event.preventDefault(); select(key); } }}>{label}</a>)}</div> : null;
    })}{['owner','manager','developer'].includes(account.role) ? <div className="account-nav-group"><p>Store management</p><a href="/admin/products">Products & inventory</a><a href="/admin/orders">Customer orders</a></div> : null}</nav>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <div className="customer-content" ref={content} tabIndex={-1} role="region" aria-label={accountSections.find(([key]) => key === view)?.[1] ?? 'Account content'}>{!canOpenAccountView(account.role, view) ? <section><h2>This section needs staff access</h2><p>Your appointments, orders and account settings are available from your dashboard.</p><button className="button" onClick={() => select('overview')}>Back to my dashboard</button></section> : view === 'register' ? <CashRegister /> : view === 'counter' ? <CashCounter /> : view === 'receipts' ? <CustomerReceipts /> : view === 'accounts' ? <AccountManagement account={account} /> : view === 'sales' ? <SalesPreparation /> : view === 'estimates' ? <CustomerEstimates /> : view === 'front-desk' ? <FrontDesk /> : view === 'overview' ? account.role === 'customer' ? <CustomerOverview account={account} bookingEnabled={bookingEnabled} /> : <WorkspaceOverview account={account} /> : view === 'booking' ? bookingEnabled ? <CustomerBooking onBack={() => select('overview')} onOpen={(id) => select('appointments', id)} /> : <p>Website booking is not open. <a href="/book">View booking providers</a>.</p> : view === 'professional-visits' ? <StaffVisits /> : view === 'professional-schedule' ? <ProfessionalSchedule /> : view === 'professional-setup' || view === 'setup-reviews' ? <ProfessionalSetup key={view} review={view === 'setup-reviews'} /> : view === 'professional' ? <StaffRequests /> : view === 'profile' ? <ProfileForm account={account} /> : view === 'security' ? <SecurityPanel account={account} onSignedOut={onSignedOut} />
      : record ? view === 'appointments' ? <CustomerAppointmentDetails key={record} id={record} onBack={() => select('appointments')} /> : <CustomerOrderDetails key={record} id={record} onBack={() => select('orders')} />
        : <CustomerHistory key={view} kind={view} bookingEnabled={bookingEnabled} onOpen={(id) => select(view, id)} />}</div></div>
  </div>;
}

export function CustomerAccount() { return <AccountGate>{(account, config, signOut) => <AccountHome key={account.id} account={account} bookingEnabled={Boolean(config.bookingEnabled)} onSignedOut={signOut} />}</AccountGate>; }
