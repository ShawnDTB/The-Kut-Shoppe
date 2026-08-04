import { useEffect, useState } from 'react';
import {
  authenticatePlatformAccount,
  createPlatformAccount,
  developmentMasterCredentials,
  ensureDevelopmentMasterAccount,
  getPlatformSessionAccount,
  isValidEmail,
  startPlatformSession,
  subscribeToPlatformAuth,
  validatePassword,
  type PlatformAccount,
} from '../data/auth-v2';
import { getCustomerProfileV5 } from '../data/account-profile-v5';
import { saveAccount as saveLegacyAccount, startSession as startLegacySession, type AccountRole as LegacyRole } from '../data/auth';
import { RoleDashboardV5 } from './RoleDashboardV5';

function bridgePrototypeSession(account: PlatformAccount) {
  const profile = getCustomerProfileV5(account);
  const legacyRole: LegacyRole = account.role === 'developer' ? 'owner' : account.role === 'barber' ? 'staff' : account.role;
  const legacy = saveLegacyAccount({
    id: account.id,
    name: account.name,
    email: account.email,
    phone: profile?.phone ?? '',
    phoneVerified: profile?.phoneVerified ?? false,
    role: legacyRole,
    staffProfileId: account.staffProfileId,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  });
  startLegacySession(legacy);
}

function RequiredLabel({ children }: { children: string }) {
  return <span className="v4-field-label">{children}<span aria-hidden="true">*</span></span>;
}

function openAccount(account: PlatformAccount) {
  startPlatformSession(account);
  bridgePrototypeSession(account);
  window.location.assign(account.role === 'customer' ? '/account' : '/dashboard');
}

export function AccountAccessV5() {
  const [sessionAccount, setSessionAccount] = useState(() => getPlatformSessionAccount());
  const [mode, setMode] = useState<'sign-in' | 'create'>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void ensureDevelopmentMasterAccount();
    return subscribeToPlatformAuth(() => setSessionAccount(getPlatformSessionAccount()));
  }, []);

  if (sessionAccount) return <RoleDashboardV5 />;

  const resetFeedback = () => setError('');

  const signIn = async () => {
    if (working) return;
    setWorking(true);
    setError('');
    try {
      if (!isValidEmail(email)) throw new Error('Enter the email address attached to the account.');
      if (!password) throw new Error('Enter the account password.');
      const account = await authenticatePlatformAccount(email, password);
      if (!account) throw new Error('The email or password is incorrect.');
      openAccount(account);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Unable to sign in.');
      setWorking(false);
    }
  };

  const create = async () => {
    if (working) return;
    setWorking(true);
    setError('');
    try {
      if (honeypot) throw new Error('Unable to create the account.');
      if (name.trim().length < 2) throw new Error('Enter your full name.');
      if (!isValidEmail(email)) throw new Error('Enter a valid email address.');
      const passwordProblem = validatePassword(password);
      if (passwordProblem) throw new Error(passwordProblem);
      if (password !== confirmation) throw new Error('The password confirmation does not match.');
      const account = await createPlatformAccount({
        name,
        email,
        password,
        role: 'customer',
        emailVerified: false,
      });
      openAccount(account);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create the account.');
      setWorking(false);
    }
  };

  const passwordError = password ? validatePassword(password) : '';

  return (
    <section className="section v2-auth-page v4-auth-page v5-auth-page platform-pattern platform-pattern-account">
      <div className="container v4-auth-container">
        <div className="v2-auth-card v4-auth-card">
          <h1 className="sr-only">The Kut Shoppe account</h1>
          <div className="v2-auth-tabs" role="tablist" aria-label="Account access">
            <button role="tab" aria-selected={mode === 'sign-in'} className={mode === 'sign-in' ? 'is-active' : ''} type="button" onClick={() => { setMode('sign-in'); resetFeedback(); }}>Sign in</button>
            <button role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? 'is-active' : ''} type="button" onClick={() => { setMode('create'); resetFeedback(); }}>Create account</button>
          </div>
          <form className="v2-auth-form v4-auth-form" onSubmit={(event) => { event.preventDefault(); void (mode === 'sign-in' ? signIn() : create()); }}>
            <div className="v2-auth-fields v4-auth-fields">
              {mode === 'create' ? <label><RequiredLabel>Full name</RequiredLabel><input required autoComplete="name" value={name} onChange={(event) => { setName(event.target.value); resetFeedback(); }} /></label> : null}
              <label><RequiredLabel>Email</RequiredLabel><input required type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); resetFeedback(); }} /></label>
              <label><RequiredLabel>Password</RequiredLabel><span className="v2-password-field"><input required type={showPassword ? 'text' : 'password'} autoComplete={mode === 'create' ? 'new-password' : 'current-password'} value={password} onKeyDown={(event) => { if (event.key === 'Enter' && mode === 'sign-in') { event.preventDefault(); void signIn(); } }} onChange={(event) => { setPassword(event.target.value); resetFeedback(); }} /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Hide' : 'Show'}</button></span>{mode === 'create' ? <small>Use at least 10 characters.</small> : null}</label>
              {mode === 'create' ? <label><RequiredLabel>Confirm password</RequiredLabel><input required type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); resetFeedback(); }} /></label> : null}
              <label className="v5-honeypot" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} /></label>
            </div>
            {passwordError && mode === 'create' ? <p className="field-error">{passwordError}</p> : null}
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <button className="button v2-auth-submit" type="submit" disabled={working}>{working ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}</button>
            {mode === 'sign-in'
              ? <button className="text-button" type="button" disabled>Password recovery will use verified email in production</button>
              : <p className="v2-auth-note">Phone is collected only when a booking or order requires it. Email verification will be enabled with protected production delivery.</p>}
          </form>
          {import.meta.env.DEV ? <details className="v2-dev-account"><summary>Local Owner preview</summary><div><strong>{developmentMasterCredentials.email}</strong><code>{developmentMasterCredentials.password}</code><small>This disposable account is available only in local development.</small></div></details> : null}
        </div>
      </div>
    </section>
  );
}
