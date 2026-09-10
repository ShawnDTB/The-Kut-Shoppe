import { useState, type FormEvent } from 'react';
import { accountApi } from '../data/customer-api';
import { business } from '../data/site';

export function CustomerEmailChange({ currentEmail, onSignedOut }: { currentEmail: string; onSignedOut: (message: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [currentCode, setCurrentCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (working) return;
    setWorking(true); setError(''); setMessage('');
    try {
      if (challengeId) {
        const result = await accountApi<{ message: string }>('/me/email/confirm', { challengeId, currentCode, newCode });
        onSignedOut(result.message);
      } else {
        const result = await accountApi<{ challengeId: string; message: string }>('/me/email/start', { email, currentPassword: password });
        setChallengeId(result.challengeId); setMessage(result.message);
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Please try again.'); }
    finally { setWorking(false); setPassword(''); }
  };
  const cancel = async () => {
    if (working || !challengeId) return;
    setWorking(true); setError('');
    try {
      const result = await accountApi<{ message: string }>('/me/email/cancel', { challengeId });
      setChallengeId(null); setCurrentCode(''); setNewCode(''); setMessage(result.message);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Please try again.'); }
    finally { setWorking(false); }
  };
  return <section className="customer-security-section" aria-labelledby="change-email-heading">
    <h3 id="change-email-heading">Change sign-in email</h3>
    <p>Current address: <span className="customer-email-address">{currentEmail}</span></p>
    <p>Confirm your password, then enter a code from each inbox. Your current address stays active until both codes are accepted. Changing it signs you out on every device.</p>
    <form className="customer-form" onSubmit={(event) => void submit(event)} aria-busy={working}>
      <fieldset disabled={working}>
        {challengeId ? <>
          <p>Keep this page open while checking both emails. Codes expire after 10 minutes. Cancel below to start over or request new codes.</p>
          <label>Code sent to {currentEmail}<input required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} value={currentCode} onChange={(event) => setCurrentCode(event.target.value.replace(/\D/g, ''))} /></label>
          <label>Code sent to {email.trim().toLowerCase()}<input required autoComplete="off" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} value={newCode} onChange={(event) => setNewCode(event.target.value.replace(/\D/g, ''))} /></label>
        </> : <>
          <label>New email address<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Current password<input required type="password" autoComplete="current-password" maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        </>}
        <div className="customer-form-actions"><button className="button" disabled={working}>{working ? 'Please wait…' : challengeId ? 'Confirm email change' : 'Send confirmation codes'}</button>
          {challengeId ? <button className="button button-secondary" type="button" disabled={working} onClick={() => void cancel()}>Cancel email change</button> : null}</div>
      </fieldset>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {message ? <p className="customer-notice" role="status">{message}</p> : null}
    </form>
    <p className="customer-fine-print">Can’t access your current inbox? <a href={business.phoneHref}>Contact the shop</a> for help. A saved phone number cannot replace email verification.</p>
  </section>;
}
