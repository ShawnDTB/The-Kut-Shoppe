import { useEffect, useRef, useState } from 'react';
import { AccountGate, ProfileForm, SecurityPanel } from './AccountBasics';
import { accountApi } from '../data/customer-api';
import { bookingPaths } from '../data/site';
import type { CustomerAccount } from '../shared/customer';

const sections = [['overview', 'Overview'], ['profile', 'Profile'], ['security', 'Security']] as const;
type View = typeof sections[number][0];
function currentView(): View {
  const value = new URLSearchParams(window.location.search).get('view');
  return value === 'profile' || value === 'security' ? value : 'overview';
}
function AccountHome({ account, onSignedOut }: { account: CustomerAccount; onSignedOut: (message: string) => void }) {
  const [view, setView] = useState(currentView); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { const sync = () => setView(currentView()); window.addEventListener('popstate', sync); return () => window.removeEventListener('popstate', sync); }, []);
  const select = (next: View) => { setView(next); window.history.pushState({}, '', `/account?view=${next}`); window.requestAnimationFrame(() => heading.current?.focus()); };
  const logout = async () => {
    setBusy(true); setError('');
    try { await accountApi('/auth/logout', {}); onSignedOut('You have been signed out.'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to sign out. Please try again.'); }
    finally { setBusy(false); }
  };
  return <div className="customer-home"><header className="customer-home-header"><div><p className="customer-kicker">Your Kut Shoppe account</p><h1 ref={heading} tabIndex={-1}>Welcome, {account.profile.name.split(/\s+/)[0]}.</h1></div><button className="button button-secondary" disabled={busy} onClick={() => void logout()}>Sign out</button></header>
    <nav className="customer-form-actions" aria-label="Account sections">{sections.map(([key, label]) => <a key={key} href={`/account?view=${key}`} aria-current={view === key ? 'page' : undefined} onClick={event => { if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); select(key); } }}>{label}</a>)}</nav>
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    <div className="customer-content">{view === 'profile' ? <ProfileForm account={account} /> : view === 'security' ? <SecurityPanel account={account} onSignedOut={onSignedOut} operationsEnabled={false} /> : <section className="customer-overview"><h2>Your account is ready</h2><p>You can update your profile, change your sign-in details, and manage your active sessions.</p><div className="customer-form-actions"><a href="/account?view=profile">Edit profile</a><a href="/account?view=security">Account security</a></div><section className="customer-security-section"><h3>Book your next visit</h3><p>Appointments are still booked with your professional through Booksy or GlossGenius. Those bookings do not appear in this account yet.</p><div className="customer-form-actions">{bookingPaths.map(path => <a key={path.id} className="button button-secondary" href={path.href} rel="noopener noreferrer">{path.provider}</a>)}</div></section><section className="customer-security-section"><h3>More on the way</h3><p>Website booking, online shopping, and staff workspaces are being introduced in stages. We’ll make each available when it is ready.</p></section></section>}</div>
  </div>;
}
export function LiveAccounts() {
  return <AccountGate>{(account, _config, signOut) => <AccountHome key={account.id} account={account} onSignedOut={signOut} />}</AccountGate>;
}
