import { useRef, useState, type FormEvent } from 'react';
import { accountApi } from '../data/customer-api';
import { visitActionLabels, type VisitAction } from '../shared/visit-actions';
import type { StaffVisit } from '../shared/staff-visits';

export function VisitActions({ visit, onSaved }: { visit: StaffVisit; onSaved: (message: string) => void }) {
  const [action, setAction] = useState<VisitAction | null>(null);
  const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const pending = useRef<{ action: VisitAction; updatedAt: string; requestKey: string } | null>(null);
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!action || busy) return;
    setBusy(true); setError(''); setAttempted(true);
    pending.current ??= { action, updatedAt: visit.updatedAt, requestKey: crypto.randomUUID() };
    try {
      const result = await accountApi<{ message: string }>(`/me/professional/visits/${encodeURIComponent(visit.id)}`, { ...pending.current, currentPassword: password });
      pending.current = null; setAction(null); onSaved(result.message);
    } catch (failure) {
      setError(`${failure instanceof Error ? failure.message : 'Unable to save.'} Retry the same action, or refresh the appointment to check whether it saved.`);
    } finally { setBusy(false); setPassword(''); }
  };
  return <section className="customer-security-section"><h3>Manage this visit</h3>
    {visit.changePending ? <p className="customer-notice">Resolve the pending rescheduling request before updating this visit.</p> : null}
    {visit.cancellationPending ? <p className="customer-notice">The customer has requested cancellation. Cancel visit approves that request. To keep the appointment, review the cancellation in your request queue first.</p> : null}
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    {action ? <form className="customer-form" onSubmit={event => void save(event)}><h4>Confirm: {visitActionLabels[action]}</h4>
      <p>{visit.customerName} · {visit.serviceName}</p>
      <p>{action === 'cancelled' ? 'This cancels the visit and releases the reserved time. It does not process a refund.' : action === 'no_show' ? 'Only confirm if the customer did not attend. This does not charge a no-show fee.' : 'This records the visit status only. Completing service does not record payment.'}</p>
      <label>Your current password<input type="password" autoComplete="current-password" required maxLength={128} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></label>
      <div className="customer-form-actions"><button className="button" disabled={busy}>{busy ? 'Saving…' : 'Confirm visit update'}</button>
        {!attempted ? <button className="button button-secondary" type="button" disabled={busy} onClick={() => { setAction(null); setPassword(''); setError(''); }}>Go back</button> : null}</div>
    </form> : <div className="customer-form-actions">{visit.actions.map(value => <button className="button button-secondary" key={value} onClick={() => setAction(value)}>{visitActionLabels[value]}</button>)}</div>}
    {!visit.actions.length && !visit.changePending ? <p>No visit actions are available for the current status and scheduled time. Refresh when the scheduled start arrives. Completed visits remain in your visit history.</p> : null}
  </section>;
}
