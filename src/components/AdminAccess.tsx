import { useEffect, useState, type ReactNode } from 'react';
import {
  findAccount,
  getSessionAccount,
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
  requestPhoneVerification,
  saveAccount,
  startSession,
  subscribeToAuthChanges,
  verifyPhoneChallenge,
  type CustomerAccount,
} from '../data/auth';

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isAdministrator(account: CustomerAccount | null) {
  return account?.role === 'owner' || account?.role === 'manager';
}

export function AdminGuard({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<CustomerAccount | null>(null);

  useEffect(() => {
    const refresh = () => {
      setAccount(getSessionAccount());
      setReady(true);
    };
    refresh();
    return subscribeToAuthChanges(refresh);
  }, []);

  if (!ready) {
    return (
      <section className="section staff-login-required platform-pattern platform-pattern-products">
        <div className="container narrow-container"><div className="staff-empty-state"><p className="eyebrow">Checking access</p><h1>Opening shop administration.</h1></div></div>
      </section>
    );
  }

  if (!isAdministrator(account)) {
    return (
      <section className="section staff-login-required platform-pattern platform-pattern-products">
        <div className="container narrow-container">
          <div className="staff-empty-state">
            <p className="eyebrow">Owner or manager access required</p>
            <h1>Shop administration is protected.</h1>
            <p>Product inventory, customer orders, addresses, and fulfillment actions are not available through an ordinary customer or barber session.</p>
            <div className="commerce-inline-actions">
              <a className="button" href="/staff/login">Staff sign in</a>
              {import.meta.env.DEV ? <a className="button button-secondary" href="/admin/access">Development owner setup</a> : null}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return children;
}

export function AdminAccessPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [developmentCode, setDevelopmentCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');

  if (!import.meta.env.DEV) {
    return (
      <section className="section staff-login-required platform-pattern platform-pattern-products">
        <div className="container narrow-container"><div className="staff-empty-state"><p className="eyebrow">Unavailable in production</p><h1>Owner accounts must be provisioned securely.</h1><p>The development bootstrap is removed from production builds. A production owner or manager account must be created through the protected server administration process.</p><a className="button" href="/staff/login">Staff sign in</a></div></div>
      </section>
    );
  }

  const contactValid = name.trim().length >= 2 && isValidEmail(email) && isValidPhone(phone);

  const sendCode = () => {
    try {
      const challenge = requestPhoneVerification(phone);
      setChallengeId(challenge.challengeId);
      setDevelopmentCode(challenge.developmentCode);
      setCode('');
      setVerified(false);
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to start verification.');
    }
  };

  const verify = () => {
    const result = verifyPhoneChallenge(challengeId, code);
    if (!result.valid) {
      setError(result.reason);
      return;
    }
    setVerified(true);
    setError('');
  };

  const activate = () => {
    if (!verified || !contactValid) return;
    const now = new Date().toISOString();
    const existing = findAccount(email, phone);
    const account: CustomerAccount = existing
      ? {
          ...existing,
          name: name.trim(),
          email: normalizeEmail(email),
          phone: normalizePhone(phone),
          phoneVerified: true,
          role: 'owner',
          updatedAt: now,
        }
      : {
          id: createId('account'),
          name: name.trim(),
          email: normalizeEmail(email),
          phone: normalizePhone(phone),
          phoneVerified: true,
          role: 'owner',
          staffProfileId: null,
          createdAt: now,
          updatedAt: now,
        };
    saveAccount(account);
    startSession(account);
    window.location.assign('/admin/products');
  };

  return (
    <section className="section staff-login-page platform-pattern platform-pattern-products">
      <div className="container narrow-container">
        <div className="staff-login-card">
          <p className="eyebrow">Local development access</p>
          <h1>Create a temporary owner session.</h1>
          <p>This route exists only during `npm run dev`. Production builds disable it and require server-provisioned owner access.</p>
          <div className="staff-form-grid">
            <label>Full name<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label>Email<input required type="email" value={email} onChange={(event) => { setEmail(event.target.value); setVerified(false); }} /></label>
            <label>Mobile phone<input required type="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setVerified(false); setChallengeId(''); }} /></label>
          </div>
          {!challengeId ? <button className="button" type="button" disabled={!contactValid} onClick={sendCode}>Send verification code</button> : null}
          {challengeId && !verified ? <div className="staff-verification-entry"><label>Verification code<input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label><button className="button" type="button" disabled={code.length !== 6} onClick={verify}>Verify</button><button className="text-button" type="button" onClick={sendCode}>Send another</button></div> : null}
          {developmentCode && !verified ? <p className="development-code"><strong>Development code:</strong> {developmentCode}<span>Live SMS is not connected in the browser prototype.</span></p> : null}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {verified ? <button className="button" type="button" onClick={activate}>Open product administration</button> : null}
        </div>
      </div>
    </section>
  );
}
