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
import {
  saveAccount as saveLegacyAccount,
  startSession as startLegacySession,
  type AccountRole as LegacyRole,
} from '../data/auth';
import { RoleDashboardV2 } from './RoleDashboardV2';

function bridgePrototypeSession(account: PlatformAccount) {
  const legacyRole: LegacyRole = account.role === 'developer'
    ? 'owner'
    : account.role === 'barber'
      ? 'staff'
      : account.role;
  const legacy = saveLegacyAccount({
    id: account.id,
    name: account.name,
    email: account.email,
    phone: '',
    phoneVerified: false,
    role: legacyRole,
    staffProfileId: account.staffProfileId,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  });
  startLegacySession(legacy);
}

export function AccountAccessV2() {
  const [sessionAccount, setSessionAccount] = useState(() => getPlatformSessionAccount());
  const [mode, setMode] = useState<'sign-in' | 'create'>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void ensureDevelopmentMasterAccount();
    return subscribeToPlatformAuth(() => setSessionAccount(getPlatformSessionAccount()));
  }, []);

  if (sessionAccount) return <RoleDashboardV2 />;

  const resetFeedback = () => setError('');

  const signIn = async () => {
    setWorking(true);
    setError('');
    try {
      if (!isValidEmail(email)) throw new Error('Enter the email address attached to the account.');
      if (!password) throw new Error('Enter the account password.');
      const account = await authenticatePlatformAccount(email, password);
      if (!account) throw new Error('The email or password is incorrect.');
      startPlatformSession(account);
      bridgePrototypeSession(account);
      window.location.assign(account.role === 'customer' ? '/account' : '/dashboard');
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Unable to sign in.');
      setWorking(false);
    }
  };

  const create = async () => {
    setWorking(true);
    setError('');
    try {
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
        emailVerified: import.meta.env.DEV,
      });
      startPlatformSession(account);
      bridgePrototypeSession(account);
      window.location.assign('/account');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create the account.');
      setWorking(false);
    }
  };

  const passwordError = password ? validatePassword(password) : '';

  return (
    <section className="section v2-auth-page platform-pattern platform-pattern-account">
      <div className="container v2-auth-layout v2-auth-layout-compact">
        <header className="v2-auth-intro">
          <p className="eyebrow">The Kut Shoppe Account</p>
          <h1>Account access.</h1>
          <p>Book as a guest or sign in to keep appointments and orders together. Approved professionals use this same entry for their chair and shop tools.</p>
          <div className="v2-auth-role-note"><strong>One login</strong><span>Customer, Barber, Manager, Owner, and Developer access opens from the assigned role.</span></div>
        </header>

        <div className="v2-auth-card">
          <div className="v2-auth-tabs" role="tablist" aria-label="Account access">
            <button role="tab" aria-selected={mode === 'sign-in'} className={mode === 'sign-in' ? 'is-active' : ''} type="button" onClick={() => { setMode('sign-in'); resetFeedback(); }}>Sign in</button>
            <button role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? 'is-active' : ''} type="button" onClick={() => { setMode('create'); resetFeedback(); }}>Create account</button>
          </div>

          <form className="v2-auth-form" onSubmit={(event) => { event.preventDefault(); void (mode === 'sign-in' ? signIn() : create()); }}>
            <p className="v2-auth-mode-note">{mode === 'sign-in' ? 'Use the email and password attached to your account.' : 'Create a customer account with only the essentials.'}</p>
            <div className="v2-auth-fields">
              {mode === 'create' ? <label>Full name <span aria-hidden="true">*</span><input required autoComplete="name" value={name} onChange={(event) => { setName(event.target.value); resetFeedback(); }} /></label> : null}
              <label>Email <span aria-hidden="true">*</span><input required type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); resetFeedback(); }} /></label>
              <label>Password <span aria-hidden="true">*</span><span className="v2-password-field"><input required type={showPassword ? 'text' : 'password'} autoComplete={mode === 'create' ? 'new-password' : 'current-password'} value={password} onChange={(event) => { setPassword(event.target.value); resetFeedback(); }} /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Hide' : 'Show'}</button></span>{mode === 'create' ? <small>Use at least 10 characters for the local preview.</small> : null}</label>
              {mode === 'create' ? <label>Confirm password <span aria-hidden="true">*</span><input required type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); resetFeedback(); }} /></label> : null}
            </div>

            {passwordError && mode === 'create' ? <p className="field-error">{passwordError}</p> : null}
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <button className="button v2-auth-submit" type="submit" disabled={working}>{working ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create customer account'}</button>
            {mode === 'sign-in' ? <button className="text-button" type="button" disabled>Forgot password will use verified email in production</button> : <p className="v2-auth-note">Phone and shipping details are requested only when a booking or order needs them.</p>}
          </form>

          {import.meta.env.DEV ? <details className="v2-dev-account"><summary>Local Owner preview</summary><div><strong>{developmentMasterCredentials.email}</strong><code>{developmentMasterCredentials.password}</code><small>This disposable account has Owner access and Developer capability only in local development.</small></div></details> : null}
        </div>
      </div>
    </section>
  );
}
