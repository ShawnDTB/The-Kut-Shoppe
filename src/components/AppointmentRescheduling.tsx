import { useEffect, useRef, useState, type FormEvent } from 'react';
import { accountApi } from '../data/customer-api';
import type { BookingAvailability } from '../shared/booking';
import type { ReschedulePage } from '../shared/rescheduling';

const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Please try again.';
const when = (value: string | null, timeZone: string) => value ? new Intl.DateTimeFormat('en-US', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Time not set';
export function AppointmentRescheduling({ id, professional = false, onSaved }: { id: string; professional?: boolean; onSaved: () => void }) {
  const path = professional ? `/me/professional/requests/${encodeURIComponent(id)}/reschedule` : `/me/appointments/${encodeURIComponent(id)}/reschedule`;
  const [page, setPage] = useState<ReschedulePage | null>(null);
  const [attempt, setAttempt] = useState(0); const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [date, setDate] = useState(''); const [available, setAvailable] = useState<BookingAvailability | null>(null);
  const [startsAt, setStartsAt] = useState(''); const [action, setAction] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const pending = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    let active = true;
    void accountApi<ReschedulePage>(path).then(value => { if (active) { setPage(value); setError(''); } })
      .catch(failure => { if (active) setError(messageOf(failure)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, attempt]);
  const refresh = () => { pending.current = null; setLoading(true); setPage(null); setAction(null); setAvailable(null); setStartsAt(''); setPassword(''); setError(''); setAttempt(value => value + 1); };
  const findTimes = async (event: FormEvent) => {
    event.preventDefault(); if (busy || loading) return;
    setBusy(true); setError(''); setAvailable(null); setStartsAt('');
    try { setAvailable(await accountApi<BookingAvailability>(`${path}?date=${encodeURIComponent(date)}`)); }
    catch (failure) { setError(messageOf(failure)); }
    finally { setBusy(false); }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!page || !action || busy || loading) return;
    setBusy(true); setError(''); setNotice('');
    pending.current ??= { action, updatedAt: page.updatedAt, version: page.version, requestKey: crypto.randomUUID(),
      ...(page.change ? { changeId: page.change.id } : {}),
      ...(['request', 'propose'].includes(action) ? { startsAt, date: available!.date, quote: available!.quote } : {}) };
    try {
      const result = await accountApi<ReschedulePage & { message: string }>(path, { ...pending.current, ...(professional ? { currentPassword: password } : {}) });
      setPage(result); setNotice(result.message); setAction(null); setAvailable(null); setStartsAt(''); pending.current = null; onSaved();
    } catch (failure) { setError(`${messageOf(failure)} Retry the same change or refresh its status before choosing a different action.`); }
    finally { setBusy(false); setPassword(''); }
  };
  const own = page?.change?.kind === (professional ? 'professional_proposal' : 'customer_request');
  const change = page?.change;
  return <section className="customer-security-section" aria-busy={busy || loading}>
    <h3>Reschedule this visit</h3>
    <p>Your confirmed time stays reserved until the replacement is approved. Suggested times are not held and are checked again when accepted. The recorded service price stays the same.</p>
    {error ? <p className="form-error" role="alert">{error}</p> : null}{notice ? <p className="customer-notice" role="status">{notice}</p> : null}
    {loading ? <p role="status">Loading appointment changes…</p> : null}
    {page ? <>
      <p><strong>Confirmed time:</strong> {when(page.startsAt, page.timeZone)} ({page.timeZone})</p>
      {change ? <div className="customer-notice"><p><strong>{change.kind === 'professional_proposal' ? 'Professional’s proposal' : 'Customer’s request'}: {change.status}</strong></p><p>{when(change.startsAt, page.timeZone)} to {when(change.endsAt, page.timeZone)}</p>
        {change.status === 'pending' ? <p>Respond before {when(change.expiresAt, page.timeZone)}. {own ? 'Waiting for the other party to respond.' : 'Review the replacement time before accepting.'}</p> : change.status === 'approved' ? <p>The appointment has moved. Download a new calendar copy.</p> : <p>This change did not move the confirmed appointment.</p>}
      </div> : null}
      {!action ? <>
        {change && page.canResolve ? <div className="customer-form-actions">
          {!own && change.status === 'pending' ? <button className="button" disabled={busy || loading} onClick={() => setAction(professional ? 'approve' : 'accept')}>Review replacement time</button> : null}
          <button className="button button-secondary" disabled={busy || loading} onClick={() => setAction(own ? 'withdraw' : 'decline')}>{own ? 'Withdraw change request' : 'Decline change request'}</button>
        </div> : null}
        {page.canRequest ? <form className="customer-form customer-detail-action" onSubmit={event => void findTimes(event)}>
          <label>Replacement date<input type="date" required value={date} disabled={busy} onChange={event => { setDate(event.target.value); setAvailable(null); setStartsAt(''); }} /></label>
          <button className="button button-secondary" disabled={busy}>{busy ? 'Checking times…' : 'Find replacement times'}</button>
        </form> : !change || !['pending', 'expired'].includes(change.status) ? <p>This visit cannot accept a new online change right now. Contact the shop for help.</p> : null}
        {available ? <div><p>Available times for {available.option.professionalName} on {available.date} ({available.option.timeZone})</p>
          {available.slots.length ? <><fieldset className="customer-time-options"><legend>Choose a replacement time</legend>{available.slots.map(slot => <label key={slot.startsAt}><input type="radio" name={`reschedule-${id}`} checked={startsAt === slot.startsAt} disabled={busy} onChange={() => setStartsAt(slot.startsAt)} />{when(slot.startsAt, available.option.timeZone)}</label>)}</fieldset><button className="button" disabled={!startsAt || busy} onClick={() => setAction(professional ? 'propose' : 'request')}>Review change request</button></> : <p>No replacement times are available on this date. Try another date.</p>}
        </div> : null}
      </> : <form className="customer-form customer-detail-action" onSubmit={event => void save(event)}>
        <h4>{['approve', 'accept'].includes(action) ? 'Accept the replacement time?' : action === 'withdraw' ? 'Withdraw this change?' : action === 'decline' ? 'Decline this change?' : 'Send this replacement time?'}</h4>
        <p>{when(['request', 'propose'].includes(action) ? startsAt : change?.startsAt ?? null, page.timeZone)} ({page.timeZone})</p>
        <p>{['approve', 'accept'].includes(action) ? 'Accepting moves the appointment and releases the original time, if the replacement is still available.' : ['request', 'propose'].includes(action) ? 'The original appointment remains confirmed while the other party reviews this time.' : 'The original appointment will remain unchanged.'}</p>
        {professional ? <label>Your current password<input type="password" autoComplete="current-password" required maxLength={128} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></label> : null}
        <div className="customer-form-actions"><button className="button" disabled={busy || loading}>{busy ? 'Saving change…' : 'Confirm appointment change'}</button><button className="button button-secondary" type="button" disabled={busy} onClick={refresh}>Refresh before changing decision</button></div>
      </form>}
    </> : null}
    <button className="text-button" disabled={busy || loading} onClick={refresh}>Refresh appointment changes</button>
  </section>;
}
