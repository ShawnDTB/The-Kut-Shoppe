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
  const canSignIn = isValidEmail(email) && password.length > 0 && !working;
  const canCreate = name.trim().length >= 2 && isValidEmail(email) && !passwordError && password === confirmation && !working;

  return (
    <section className="section v2-auth-page platform-pattern platform-pattern-poles">
      <div className="container v2-auth-layout">
        <div className="v2-auth-intro">
          <p className="eyebrow">One Kut Shoppe account</p>
          <h1>Appointments first. Orders when you need them.</h1>
          <p>Customers, barbers, managers and owners use the same secure entry. The account role determines which dashboard opens after sign-in.</p>
          <ul><li>Customers manage appointments and purchases.</li><li>Barbers manage their own chair and schedule.</li><li>Managers coordinate the shop and storefront.</li><li>Owner and Developer access remains fully controlled.</li></ul>
        </div>

        <div className="v2-auth-card">
          <div className="v2-auth-tabs" role="tablist" aria-label="Account access">
            <button role="tab" aria-selected={mode === 'sign-in'} className={mode === 'sign-in' ? 'is-active' : ''} type="button" onClick={() => { setMode('sign-in'); resetFeedback(); }}>Sign in</button>
            <button role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? 'is-active' : ''} type="button" onClick={() => { setMode('create'); resetFeedback(); }}>Create account</button>
          </div>

          <div>
            <p className="eyebrow">{mode === 'sign-in' ? 'Welcome back' : 'New customer account'}</p>
            <h2>{mode === 'sign-in' ? 'Sign in with email and password.' : 'Save the essentials for next time.'}</h2>
          </div>

          <div className="v2-auth-fields">
            {mode === 'create' ? <label>Full name<input autoComplete="name" value={name} onChange={(event) => { setName(event.target.value); resetFeedback(); }} /></label> : null}
            <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); resetFeedback(); }} /></label>
            <label>Password<span className="v2-password-field"><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'create' ? 'new-password' : 'current-password'} value={password} onChange={(event) => { setPassword(event.target.value); resetFeedback(); }} /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Hide' : 'Show'}</button></span>{mode === 'create' ? <small>Use at least 10 characters for the local preview.</small> : null}</label>
            {mode === 'create' ? <label>Confirm password<input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); resetFeedback(); }} /></label> : null}
          </div>

          {passwordError && mode === 'create' ? <p className="field-error">{passwordError}</p> : null}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="button" type="button" disabled={mode === 'sign-in' ? !canSignIn : !canCreate} onClick={() => void (mode === 'sign-in' ? signIn() : create())}>{working ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create customer account'}</button>
          {mode === 'sign-in' ? <button className="text-button" type="button" disabled>Forgot password will use verified email in production</button> : <p className="v2-auth-note">Only your name, email and password are required here. Phone and shipping details are collected only when a booking or order needs them.</p>}

          {import.meta.env.DEV ? <aside className="v2-dev-account"><p className="eyebrow">Local master preview</p><strong>{developmentMasterCredentials.email}</strong><code>{developmentMasterCredentials.password}</code><small>This disposable account has Owner access and Developer capability only in local development.</small></aside> : null}
        </div>
      </div>
    </section>
  );
}
