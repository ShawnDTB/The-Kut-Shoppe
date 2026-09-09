import { useEffect, useState, useSyncExternalStore, type FormEvent } from 'react';
import { accountApi, getCustomerSession, loadCustomerSession, setCustomerSession, subscribeToCustomerSession } from '../data/customer-api';
import { business } from '../data/site';
import type { AccountConfig, CustomerAccount as Account, CustomerOverview, CustomerProfile } from '../shared/customer';
import { AccountSecurityCheck } from './AccountSecurityCheck';

const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Please try again.';
type View = 'appointments' | 'orders' | 'profile' | 'security';
const views: Array<[View, string]> = [['appointments', 'Appointments'], ['orders', 'Orders'], ['profile', 'Profile'], ['security', 'Security']];
const time = (value: string | null) => value ? new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value)) : 'Time to be arranged';
const statusLabel = (value: string) => value.replaceAll('_', ' ');

function AccountAccess({ config, initialMessage }: { config: AccountConfig; initialMessage: string }) {
  const [mode, setMode] = useState<'login' | 'register' | 'recover'>('login');
  const [challenge, setChallenge] = useState<{ id: string; reset: boolean } | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [website, setWebsite] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(initialMessage);
  const needsPassword = challenge ? challenge.reset : mode !== 'recover';
  const newPassword = challenge ? challenge.reset : mode === 'register';
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (working) return;
    setWorking(true); setError(''); setMessage('');
    try {
      if (newPassword && password !== confirmPassword) throw new Error('The passwords do not match.');
      let path: string;
      let payload: unknown;
      if (challenge) {
        path = challenge.reset ? '/auth/reset' : '/auth/verify';
        payload = { challengeId: challenge.id, code, ...(challenge.reset ? { password } : {}) };
      } else {
        path = `/auth/${mode}`;
        payload = { email, turnstileToken: token, ...(mode !== 'recover' ? { password } : {}), ...(mode === 'register' ? { name, website } : {}) };
      }
      const result = await accountApi<{ account?: Account; challengeId?: string; message?: string }>(path, payload);
      if (result.account) { setCustomerSession(result.account); return; }
      if (result.challengeId) { setChallenge({ id: result.challengeId, reset: mode === 'recover' }); setPassword(''); setConfirmPassword(''); }
      else { setChallenge(null); setMode('login'); setPassword(''); setConfirmPassword(''); setCode(''); }
      setMessage(result.message ?? 'Check your email.');
    } catch (failure) { setError(messageOf(failure)); }
    finally { setWorking(false); setToken(''); setAttempt((value) => value + 1); }
  };
  const switchMode = (next: typeof mode) => { setMode(next); setChallenge(null); setPassword(''); setConfirmPassword(''); setCode(''); setError(''); setMessage(''); setToken(''); setAttempt((value) => value + 1); };
  return <div className="customer-access"><header><h1>{challenge ? challenge.reset ? 'Reset your password' : 'Check your email' : mode === 'register' ? 'Make yourself at home' : mode === 'recover' ? 'Forgot your password?' : 'Welcome back'}</h1><p>{challenge ? 'Enter the eight-digit code from your email. Codes expire after 10 minutes.' : 'Your appointments, orders, and details, together in one account.'}</p></header>
    {!challenge ? <nav className="customer-access-nav" aria-label="Account access"><button type="button" aria-current={mode === 'login' ? 'page' : undefined} onClick={() => switchMode('login')}>Sign in</button><button type="button" aria-current={mode === 'register' ? 'page' : undefined} onClick={() => switchMode('register')}>Create account</button></nav> : null}
    <form onSubmit={(event) => void submit(event)} className="customer-form" aria-busy={working}>
      <fieldset disabled={working}>
        {!challenge && mode === 'register' ? <label>Full name<input required autoComplete="name" maxLength={100} minLength={2} value={name} onChange={(event) => setName(event.target.value)} /></label> : null}
        {!challenge ? <label>Email address<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label> : <label>Email code<input required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} /></label>}
        {needsPassword ? <label>{newPassword ? 'New password' : 'Password'}<input required type="password" autoComplete={newPassword ? 'new-password' : 'current-password'} minLength={newPassword ? 15 : 1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} />{newPassword ? <small>Use 15 to 128 characters. Spaces and password managers are welcome.</small> : null}</label> : null}
        {newPassword ? <label>Confirm password<input required type="password" autoComplete="new-password" maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label> : null}
        {!challenge && mode === 'register' ? <label className="v5-honeypot" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label> : null}
        {!challenge ? <AccountSecurityCheck key={attempt} siteKey={config.turnstileSiteKey} onToken={setToken} /> : null}
        <button className="button" disabled={working || (!challenge && !token)}>{working ? 'Please wait…' : challenge ? challenge.reset ? 'Reset password' : 'Verify email' : mode === 'register' ? 'Create account' : mode === 'recover' ? 'Send reset code' : 'Sign in'}</button>
      </fieldset>
      {error ? <p className="form-error" role="alert">{error}</p> : null}{message ? <p className="customer-notice" role="status">{message}</p> : null}
    </form>
    {challenge ? <p><button type="button" className="text-button" disabled={working} onClick={() => switchMode(challenge.reset ? 'recover' : 'login')}>Need a new code? Start again</button></p> : mode === 'login' ? <p><button type="button" className="text-button" onClick={() => switchMode('recover')}>Forgot password?</button></p> : null}
    <p className="customer-fine-print">Review our <a href="/privacy">privacy policy</a> and <a href="/terms">terms</a>. You can <a href="/book">book an appointment</a> without making an account.</p>
  </div>;
}

function ProfileForm({ account }: { account: Account }) {
  const [profile, setProfile] = useState<CustomerProfile>(account.profile);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (working) return;
    setWorking(true); setError(''); setMessage('');
    try { const result = await accountApi<{ account: Account }>('/me/profile', profile, 'PATCH'); setCustomerSession(result.account); setProfile(result.account.profile); setMessage('Your profile is saved.'); }
    catch (failure) { setError(messageOf(failure)); }
    finally { setWorking(false); }
  };
  const addressFields = [['line1', 'Street address', 'address-line1', 150], ['line2', 'Apartment or unit (optional)', 'address-line2', 100], ['city', 'City', 'address-level2', 100], ['state', 'State', 'address-level1', 2], ['postalCode', 'ZIP code', 'postal-code', 10]] as const;
  return <form className="customer-form customer-profile" onSubmit={(event) => void save(event)} aria-busy={working}><h2>Your profile</h2><p>Keep your contact details current. Your history stays linked to your account when these details change.</p><fieldset disabled={working}>
    <legend>Contact details</legend><label>Full name<input required minLength={2} maxLength={100} autoComplete="name" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label>
    <label>Email address<input type="email" value={account.email} readOnly autoComplete="email" /><small>Verified sign-in address. Contact the shop if you need help changing it.</small></label>
    <label>Phone (optional)<input type="tel" maxLength={30} autoComplete="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /><small>For contact only. This number is not a verified recovery method.</small></label>
  </fieldset><fieldset disabled={working}><legend>Delivery address (optional)</legend><p>Save an address for future orders, or leave every address field blank.</p><div className="customer-address-grid">{addressFields.map(([key, label, autoComplete, maxLength]) => <label key={key}>{label}<input autoComplete={autoComplete} maxLength={maxLength} value={profile.address[key]} onChange={(event) => setProfile({ ...profile, address: { ...profile.address, [key]: event.target.value } })} /></label>)}</div></fieldset>
    {error ? <p className="form-error" role="alert">{error}</p> : null}{message ? <p className="customer-notice" role="status">{message}</p> : null}<button className="button" disabled={working}>{working ? 'Saving…' : 'Save profile'}</button>
  </form>;
}

function SecurityPanel({ onSignedOut }: { onSignedOut: (message: string) => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const perform = async (all: boolean) => {
    if (working) return;
    setWorking(true); setError('');
    try {
      if (!all && password !== confirmation) throw new Error('The passwords do not match.');
      const result = await accountApi<{ message: string }>(all ? '/me/sessions/revoke' : '/me/password', all ? {} : { currentPassword, password });
      onSignedOut(result.message);
    } catch (failure) { setError(messageOf(failure)); } finally { setWorking(false); }
  };
  return <div className="customer-security"><h2>Account security</h2><form className="customer-form" onSubmit={(event) => { event.preventDefault(); void perform(false); }}><fieldset disabled={working}><legend>Change password</legend><label>Current password<input required type="password" autoComplete="current-password" maxLength={128} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label>New password<input required type="password" autoComplete="new-password" minLength={15} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /><small>Use 15 to 128 characters.</small></label><label>Confirm new password<input required type="password" autoComplete="new-password" maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><button className="button" disabled={working}>{working ? 'Please wait…' : 'Change password'}</button></fieldset><p>Changing your password signs you out on every device.</p></form>
    <section className="customer-security-section"><h3>Signed-in devices</h3><p>Using a shared device, or concerned about access? End every active session, including this one.</p><button className="button button-secondary" disabled={working} type="button" onClick={() => void perform(true)}>Sign out on every device</button></section>
    <section className="customer-security-section"><h3>Your information</h3><p>For a copy of your information, a correction, or an account deletion request, <a href={business.phoneHref}>call {business.phone}</a>. See the <a href="/privacy">privacy policy</a> for details.</p></section>{error ? <p role="alert" className="form-error">{error}</p> : null}
  </div>;
}

function AccountHome({ account, onSignedOut }: { account: Account; onSignedOut: (message: string) => void }) {
  const [view, setView] = useState<View>(() => {
    const requested = new URLSearchParams(window.location.search).get('view');
    return views.some(([key]) => key === requested) ? requested as View : 'appointments';
  });
  const [overview, setOverview] = useState<CustomerOverview | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [working, setWorking] = useState(false);
  useEffect(() => {
    let active = true;
    void accountApi<CustomerOverview>('/me/overview').then((data) => { if (active) { setOverview(data); setError(''); } }).catch((failure) => { if (active) setError(messageOf(failure)); });
    return () => { active = false; };
  }, [account.id, attempt]);
  useEffect(() => {
    const sync = () => { const query = new URLSearchParams(window.location.search).get('view'); setView(views.some(([key]) => key === query) ? query as View : 'appointments'); };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  const select = (next: View) => { setView(next); window.history.pushState({}, '', `/account?view=${next}`); };
  const logout = async () => {
    setWorking(true); setError('');
    try { await accountApi('/auth/logout', {}); onSignedOut('You have been signed out.'); }
    catch (failure) { setError(messageOf(failure)); } finally { setWorking(false); }
  };
  return <div className="customer-home"><header className="customer-home-header"><div><p className="customer-kicker">Your Kut Shoppe account</p><h1>Welcome, {account.profile.name.split(/\s+/)[0]}.</h1></div><button className="button button-secondary" type="button" disabled={working} onClick={() => void logout()}>Sign out</button></header>
    <nav className="customer-nav" aria-label="Account sections">{views.map(([key, label]) => <a key={key} href={`/account?view=${key}`} aria-current={view === key ? 'page' : undefined} onClick={(event) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) { event.preventDefault(); select(key); } }}>{label}</a>)}</nav>
    <div className="customer-content">{view === 'profile' ? <ProfileForm account={account} /> : view === 'security' ? <SecurityPanel onSignedOut={onSignedOut} /> : <>
      <div className="customer-section-heading"><h2>{view === 'appointments' ? 'Your appointments' : 'Your orders'}</h2>{view === 'appointments' ? <a className="button" href="/book">Book an appointment</a> : null}</div>
      {error ? <div role="alert"><p className="form-error">{error}</p><button className="button button-secondary" type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button></div> : !overview ? <p role="status">Loading your {view}…</p> : view === 'appointments' ? <>
        {overview.appointments.length ? <ul className="customer-records">{overview.appointments.map((item) => <li key={item.id}><div><span className="customer-status">{statusLabel(item.status)}</span><h3>{item.serviceName}</h3><p>{time(item.startsAt)} · {item.barberName ?? 'Professional to be assigned'}</p></div><a href={business.phoneHref}>Call about this appointment</a></li>)}</ul> : <div className="customer-empty"><h3>No appointments linked yet.</h3><p>Appointments booked through Booksy or Crowned by Steph are managed with that provider. They do not appear here automatically.</p></div>}
        <p className="customer-fine-print">Times are shown in the shop’s time zone (Eastern). An appointment request is only confirmed when the shop accepts it. Contact your booking provider or <a href={business.phoneHref}>call the shop</a> for changes.</p>
      </> : overview.orders.length ? <ul className="customer-records">{overview.orders.map((item) => <li key={item.id}><div><h3>Order {item.id.slice(-8)}</h3><p>{statusLabel(item.status)} · {statusLabel(item.fulfillment)} · {time(item.createdAt)}</p></div><strong>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.totalCents / 100)}</strong></li>)}</ul> : <div className="customer-empty"><h3>No orders linked yet.</h3><p>Your orders will appear here when online ordering opens. For product availability today, <a href={business.phoneHref}>call the shop</a>.</p></div>}
    </>}</div>
  </div>;
}

export function CustomerAccount() {
  const account = useSyncExternalStore(subscribeToCustomerSession, getCustomerSession, () => null);
  const [config, setConfig] = useState<AccountConfig | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void accountApi<AccountConfig>('/config').then(async (data) => {
      if (!active) return;
      setConfig(data);
      if (data.enabled) await loadCustomerSession();
      if (active) { setReady(true); setError(''); }
    }).catch((failure) => { if (active) { setError(messageOf(failure)); setReady(true); } });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible' && config?.enabled) void loadCustomerSession().catch(() => undefined); };
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('pageshow', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [config]);
  const signOut = (notice: string) => { setMessage(notice); setCustomerSession(null); };
  return <section className="section customer-account"><div className="container route-wide">{!ready ? <p role="status">Opening your account…</p> : error ? <div className="customer-access"><h1>We couldn’t open your account</h1><p role="alert">{error}</p><button type="button" className="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button></div> : !config?.enabled ? <div className="customer-access"><h1>Account access is coming soon</h1><p>You can still book with your professional or contact the shop.</p><a className="button" href="/book">Book an appointment</a><p><a href={business.phoneHref}>Call {business.phone}</a></p></div> : account ? <AccountHome key={account.id} account={account} onSignedOut={signOut} /> : <AccountAccess config={config} initialMessage={message} />}</div></section>;
}
