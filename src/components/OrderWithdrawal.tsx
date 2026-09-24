import { useState } from 'react';
import { accountApi } from '../data/customer-api';

export function OrderWithdrawal({ id, updatedAt, onSaved }: { id: string; updatedAt: string; onSaved: (message: string) => void }) {
  const [review, setReview] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const withdraw = async () => {
    if (busy) return; setBusy(true); setError('');
    try {
      const result = await accountApi<{ message: string }>(`/me/orders/${encodeURIComponent(id)}/withdraw`, { updatedAt });
      onSaved(result.message);
    } catch (failure) { setError(`${failure instanceof Error ? failure.message : 'Unable to withdraw.'} Retry or refresh the order to check its status.`); }
    finally { setBusy(false); }
  };
  return <section className="customer-security-section"><h3>Need to cancel this request?</h3><p>You can withdraw an unpaid request before the shop accepts it. This releases its reserved items; it does not process a refund.</p>
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    {review ? <><p>Withdraw this order request? To order again, you’ll need to submit a new request.</p><div className="customer-form-actions"><button className="button button-secondary" disabled={busy} onClick={() => setReview(false)}>Keep order request</button><button className="button" disabled={busy} onClick={() => void withdraw()}>{busy ? 'Withdrawing…' : 'Confirm withdrawal'}</button></div></> : <button className="button button-secondary" onClick={() => setReview(true)}>Withdraw order request</button>}
  </section>;
}
