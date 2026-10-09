import { useRef, useState, type FormEvent } from 'react';
import { accountApi } from '../data/customer-api';
import type { FinalizedSale } from '../shared/counter';

export function SandboxCardPayment({ sale, onChanged, onAttempt }: { sale: FinalizedSale; onChanged: () => Promise<void>; onAttempt: () => void }) {
  const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const lock = useRef(false);
  const payment = sale.cardPayment;
  if (!sale.sandboxCheckoutEnabled && !payment) return null;
  const run = async (event: FormEvent, reconcile: boolean) => {
    event.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try {
      if (reconcile && payment) await accountApi(`/me/payments/${payment.id}/reconcile`, {});
      else { onAttempt(); await accountApi('/me/payments/checkout', { saleId: sale.id, currentPassword: password }); }
      await onChanged();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to check payment. Retry the same sale.'); }
    finally { lock.current = false; setBusy(false); setPassword(''); }
  };
  const canCreate = sale.sandboxCheckoutEnabled && sale.state === 'unpaid' && (!payment || payment.state === 'pending');
  return <section className="customer-security-section sandbox-card-payment" aria-busy={busy}><h3>Card payment testing</h3>
    <p>Test mode only. No real money moves. Use Stripe test cards; do not enter a customer’s card.</p>
    {payment ? <p role="status">{payment.state === 'paid' ? 'Stripe confirmed the test payment.' : payment.state === 'expired' ? 'Stripe confirmed that checkout expired without payment. Cash recording is available again.' : payment.state === 'review' ? 'This payment needs review in Stripe before any further collection.' : 'Payment is not confirmed. Retry this sale or check its status; do not collect again.'}</p> : null}
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    {payment?.checkoutUrl && payment.state === 'pending' ? <p><a className="button" href={payment.checkoutUrl} target="_blank" rel="noopener noreferrer">Open Stripe test checkout (new tab)</a></p> : null}
    {canCreate ? <form className="customer-form" onSubmit={event => void run(event, false)}>
      <label>Your current password<input type="password" autoComplete="current-password" required maxLength={128} disabled={busy} value={password} onChange={event => setPassword(event.target.value)} /></label>
      <button className="button button-secondary" disabled={busy}>{busy ? 'Checking…' : payment ? 'Recover the same test checkout' : 'Create test card checkout'}</button>
    </form> : null}
    {payment ? <form onSubmit={event => void run(event, true)}><button className="button button-secondary" disabled={busy}>Check Stripe payment status</button></form> : null}
    <p>Returning from Stripe does not confirm payment. Booking, stock, cash receipts and payroll stay separate from this test.</p>
  </section>;
}
