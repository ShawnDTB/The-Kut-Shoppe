import { useEffect, useRef, useState, type FormEvent } from 'react';
import { accountApi } from '../data/customer-api';
import type { AccountDirectory, AccountSession, ManagedAccount } from '../shared/account-management';
import type { CustomerAccount, AccountRole } from '../shared/customer';
import { StaffAuthenticator } from './StaffAuthenticator';

const labels: Record<AccountRole, string> = { customer: 'Client', barber: 'Barber', manager: 'Manager', owner: 'Owner', developer: 'Administrator' };
const messageOf = (failure: unknown) => failure instanceof Error ? failure.message : 'Please try again.';

export function AccountManagement({ account }: { account: CustomerAccount }) {
  return <StaffAuthenticator><Directory key={account.id} account={account} /></StaffAuthenticator>;
}
function Directory({ account }: { account: CustomerAccount }) {
  const [data, setData] = useState<AccountDirectory | null>(null);
  const [query, setQuery] = useState(''); const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ManagedAccount | null>(null);
  const [role, setRole] = useState<AccountRole>('barber'); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [attempt, setAttempt] = useState(0);
  const elevated = account.role === 'owner' || account.role === 'developer';
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (selected) reviewHeading.current?.focus(); }, [selected]);
  useEffect(() => {
    let active = true;
    void accountApi<AccountDirectory>(`/me/accounts?q=${encodeURIComponent(search)}`).then(value => { if (active) { setData(value); setError(''); } })
      .catch(failure => { if (active) { setData(null); setError(messageOf(failure)); } });
    return () => { active = false; };
  }, [search, attempt]);
  const change = async (event: FormEvent) => {
    event.preventDefault(); if (!selected || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await accountApi<{ message: string }>(`/me/accounts/${encodeURIComponent(selected.id)}/role`, { role, previousRole: selected.role, updatedAt: selected.updatedAt, currentPassword: password });
      setSelected(null); setData(null); setMessage(result.message); setAttempt(value => value + 1);
    } catch (failure) { setError(messageOf(failure)); }
    finally { setBusy(false); setPassword(''); }
  };
  return <section className="account-directory"><h2>Accounts and staff access</h2><p>Find an existing, verified account and assign the access that person needs. Barber access starts professional setup; it does not publish a booking profile.</p>
    <form className="customer-form" onSubmit={event => { event.preventDefault(); setData(null); setSelected(null); setPassword(''); setSearch(query.trim()); setAttempt(value => value + 1); }}>
      <label>Find a person<input type="search" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} placeholder="Name or email address" /></label><button className="button button-secondary" disabled={busy}>Search accounts</button>
    </form>
    {message ? <p role="status" className="customer-notice">{message}</p> : null}{error ? <p role="alert" className="form-error">{error}</p> : null}
    {!data && !error ? <p role="status">Loading accounts…</p> : null}
    {selected ? <form className="customer-form account-role-review" onSubmit={event => void change(event)} aria-busy={busy}>
      <h3 ref={reviewHeading} tabIndex={-1}>Change access for {selected.name}</h3><p>{selected.email} · Current role: {labels[selected.role]}</p>
      <fieldset disabled={busy}><label htmlFor="account-role">New role</label><select id="account-role" value={role} onChange={event => setRole(event.target.value as AccountRole)}>{Object.entries(labels).filter(([value]) => elevated || !['owner', 'developer'].includes(value)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <p>This signs the person out of all devices. They will need to sign in again. You cannot remove the last owner or remove professional access while visits need attention.</p>
      <label>Your current password<input required type="password" autoComplete="current-password" maxLength={128} value={password} onChange={event => setPassword(event.target.value)} /></label>
      <div className="customer-form-actions"><button className="button" disabled={role === selected.role}>Confirm access change</button><button className="text-button" type="button" onClick={() => { setSelected(null); setPassword(''); }}>Cancel</button></div></fieldset>
    </form> : data ? <><p role="status">{data.items.length ? `${data.items.length} matching accounts${data.more ? ' shown. Narrow your search to find more.' : '.'}` : 'No matching accounts. Ask the person to create an account and verify their email first.'}</p>
      <ul className="customer-records">{data.items.map(person => <li key={person.id}><div><strong>{person.name}</strong><p>{person.email}</p><p>{labels[person.role]} · {person.verified ? 'Email verified' : 'Email verification needed'}{person.professionalStatus ? ` · Profile ${person.professionalStatus.replaceAll('_', ' ')}` : ''}</p></div>
        <button type="button" className="button button-secondary" disabled={person.id === account.id || !person.verified || (!elevated && ['owner', 'developer'].includes(person.role))} onClick={() => { setSelected(person); setRole(person.role === 'customer' ? 'barber' : person.role); setMessage(''); setError(''); }}>Change access<span className="sr-only"> for {person.name}</span></button></li>)}</ul></> : <button className="button" onClick={() => setAttempt(value => value + 1)}>Retry accounts</button>}
  </section>;
}

export function AccountSessions() {
  const [data, setData] = useState<{ items: AccountSession[]; more: boolean } | null>(null);
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void accountApi<{ items: AccountSession[]; more: boolean }>('/me/sessions').then(value => { if (active) { setData(value); setError(''); } }).catch(failure => { if (active) { setData(null); setError(messageOf(failure)); } });
    return () => { active = false; };
  }, [attempt]);
  const revoke = async (id: string) => {
    if (busy) return; setBusy(true); setError(''); setMessage('');
    try { const result = await accountApi<{ message: string }>(`/me/sessions/${encodeURIComponent(id)}/revoke`, {}); setMessage(result.message); setAttempt(value => value + 1); }
    catch (failure) { setError(messageOf(failure)); } finally { setBusy(false); }
  };
  return <div><p>Review active sign-ins by their start and most recent activity. Device names and locations are not collected.</p>
    {error ? <p role="alert" className="form-error">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
    {!data && !error ? <p role="status">Loading active sessions…</p> : null}
    <ul className="customer-records">{data?.items.map(session => <li key={session.id}><div><strong>{session.current ? 'This session' : 'Other session'}</strong><p>Started {new Date(session.createdAt).toLocaleString()}</p><p>Last active {new Date(session.lastSeenAt).toLocaleString()}</p></div>{!session.current ? <button className="button button-secondary" type="button" disabled={busy} onClick={() => void revoke(session.id)}>Sign out session<span className="sr-only"> started {new Date(session.createdAt).toLocaleString()}</span></button> : null}</li>)}</ul>
    {data?.more ? <p>Showing 50 sessions. Use “Sign out on every device” to end all active sessions.</p> : null}<button className="text-button" type="button" disabled={busy} onClick={() => setAttempt(value => value + 1)}>Refresh sessions</button>
  </div>;
}
