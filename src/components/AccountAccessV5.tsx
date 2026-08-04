import { useEffect, useState } from 'react';
import {
  authenticatePlatformAccount,
  createPlatformAccount,
  developmentMasterCredentials,
  ensureDevelopmentMasterAccount,
  getPlatformSessionAccount,
  isValidEmail,
  readPlatformAccounts,
  startPlatformSession,
  subscribeToPlatformAuth,
  validatePassword,
  type PlatformAccount,
} from '../data/auth-v2';
import { isValidPhone } from '../data/auth';
import {
  getActiveIdentityChallengeV5,
  getCustomerProfileV5,
  initializeSignupProfileV5,
  requestIdentityChallengeV5,
  verifyIdentityChallengeV5,
  type IdentityChallengeV5,
} from '../data/account-profile-v5';
import { saveAccount as saveLegacyAccount, startSession as startLegacySession, type AccountRole as LegacyRole } from '../data/auth';
import { RoleDashboardV5 } from './RoleDashboardV5';

function bridgePrototypeSession(account: PlatformAccount) {
  const profile = getCustomerProfileV5(account);
  const legacyRole: LegacyRole = account.role === 'developer' ? 'owner' : account.role === 'barber' ? 'staff' : account.role;
  const legacy = saveLegacyAccount({ id: account.id, name: account.name, email: account.email, phone: profile?.phone ?? '', phoneVerified: profile?.phoneVerified ?? false, role: legacyRole, staffProfileId: account.staffProfileId, createdAt: account.createdAt, updatedAt: account.updatedAt });
  startLegacySession(legacy);
}

function RequiredLabel({ children }: { children: string }) {
  return <span className="v4-field-label">{children}<span aria-hidden="true">*</span></span>;
}

function VerificationPanel({ account, phone, onComplete }: { account: PlatformAccount; phone: string; onComplete: (account: PlatformAccount) => void }) {
  const [emailChallenge, setEmailChallenge] = useState<IdentityChallengeV5 | null>(() => getActiveIdentityChallengeV5(account.id, 'email'));
  const [phoneChallenge, setPhoneChallenge] = useState<IdentityChallengeV5 | null>(() => getActiveIdentityChallengeV5(account.id, 'phone'));
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(account.emailVerified);
  const [phoneVerified, setPhoneVerified] = useState(Boolean(getCustomerProfileV5(account)?.phoneVerified));
  const [error, setError] = useState('');

  const ensureChallenge = (channel: 'email' | 'phone') => {
    const challenge = requestIdentityChallengeV5(account.id, channel, channel === 'email' ? account.email : phone);
    if (channel === 'email') setEmailChallenge(challenge); else setPhoneChallenge(challenge);
    setError('');
  };

  const verify = (channel: 'email' | 'phone') => {
    try {
      const challenge = channel === 'email' ? emailChallenge : phoneChallenge;
      if (!challenge) throw new Error(`Request a ${channel} verification code first.`);
      verifyIdentityChallengeV5(challenge.id, channel === 'email' ? emailCode : phoneCode);
      if (channel === 'email') setEmailVerified(true); else setPhoneVerified(true);
      setError('');
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : 'Unable to verify that contact method.');
    }
  };

  const finish = () => {
    const updated = readPlatformAccounts().find((item) => item.id === account.id);
    if (!updated || !emailVerified || !phoneVerified) return;
    startPlatformSession(updated);
    bridgePrototypeSession(updated);
    onComplete(updated);
  };

  return <div className="v5-verification-panel"><p className="eyebrow">Confirm your contact information</p><h1>Verify your account.</h1><p>Email verification protects account access. Phone verification protects appointment and order updates.</p><div className="v5-verification-grid"><section><div><strong>Email</strong><span>{account.email}</span></div>{emailVerified ? <p className="success-message">Email verified.</p> : <><button className="button button-secondary" type="button" onClick={() => ensureChallenge('email')}>{emailChallenge ? 'Send another code' : 'Send email code'}</button>{emailChallenge ? <label><RequiredLabel>Email code</RequiredLabel><input inputMode="numeric" maxLength={6} value={emailCode} onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /><button className="button" type="button" disabled={emailCode.length !== 6} onClick={() => verify('email')}>Verify email</button>{import.meta.env.DEV ? <small>Local code: {emailChallenge.code}</small> : null}</label> : null}</>}</section><section><div><strong>Mobile phone</strong><span>{phone}</span></div>{phoneVerified ? <p className="success-message">Phone verified.</p> : <><button className="button button-secondary" type="button" onClick={() => ensureChallenge('phone')}>{phoneChallenge ? 'Send another code' : 'Send text code'}</button>{phoneChallenge ? <label><RequiredLabel>Phone code</RequiredLabel><input inputMode="numeric" maxLength={6} value={phoneCode} onChange={(event) => setPhoneCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /><button className="button" type="button" disabled={phoneCode.length !== 6} onClick={() => verify('phone')}>Verify phone</button>{import.meta.env.DEV ? <small>Local code: {phoneChallenge.code}</small> : null}</label> : null}</>}</section></div>{error ? <p className="form-error" role="alert">{error}</p> : null}<button className="button v5-verification-finish" type="button" disabled={!emailVerified || !phoneVerified} onClick={finish}>Open your account</button><p className="fine-print">Production delivery requires protected email and SMS transports. Local development displays disposable verification codes for testing.</p></div>;
}

export function AccountAccessV5() {
  const [sessionAccount, setSessionAccount] = useState(() => getPlatformSessionAccount());
  const [pendingAccount, setPendingAccount] = useState<PlatformAccount | null>(null);
  const [mode, setMode] = useState<'sign-in' | 'create'>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { void ensureDevelopmentMasterAccount(); return subscribeToPlatformAuth(() => setSessionAccount(getPlatformSessionAccount())); }, []);
  if (sessionAccount) return <RoleDashboardV5 />;
  if (pendingAccount) return <section className="section v2-auth-page v5-auth-page platform-pattern platform-pattern-account"><div className="container v5-verification-container"><VerificationPanel account={pendingAccount} phone={phone || getCustomerProfileV5(pendingAccount)?.phone || ''} onComplete={(account) => window.location.assign(account.role === 'customer' ? '/account' : '/dashboard')} /></div></section>;

  const resetFeedback = () => setError('');
  const signIn = async () => {
    setWorking(true); setError('');
    try {
      if (!isValidEmail(email)) throw new Error('Enter the email address attached to the account.');
      if (!password) throw new Error('Enter the account password.');
      const account = await authenticatePlatformAccount(email, password);
      if (!account) throw new Error('The email or password is incorrect.');
      const profile = getCustomerProfileV5(account);
      if (!account.emailVerified || (profile?.phone && !profile.phoneVerified)) { setPhone(profile?.phone ?? ''); setPendingAccount(account); setWorking(false); return; }
      startPlatformSession(account); bridgePrototypeSession(account); window.location.assign(account.role === 'customer' ? '/account' : '/dashboard');
    } catch (signInError) { setError(signInError instanceof Error ? signInError.message : 'Unable to sign in.'); setWorking(false); }
  };

  const create = async () => {
    setWorking(true); setError('');
    try {
      if (honeypot) throw new Error('Unable to create the account.');
      if (name.trim().length < 2) throw new Error('Enter your full name.');
      if (!isValidEmail(email)) throw new Error('Enter a valid email address.');
      if (!isValidPhone(phone)) throw new Error('Enter a valid 10-digit mobile number.');
      const passwordProblem = validatePassword(password);
      if (passwordProblem) throw new Error(passwordProblem);
      if (password !== confirmation) throw new Error('The password confirmation does not match.');
      const account = await createPlatformAccount({ name, email, password, role: 'customer', emailVerified: false });
      const challenges = initializeSignupProfileV5(account, phone);
      setPendingAccount(account);
      if (import.meta.env.DEV) { setEmail(''); setPhone(challenges.profile.phone); }
      setWorking(false);
    } catch (createError) { setError(createError instanceof Error ? createError.message : 'Unable to create the account.'); setWorking(false); }
  };

  const passwordError = password ? validatePassword(password) : '';
  return <section className="section v2-auth-page v4-auth-page v5-auth-page platform-pattern platform-pattern-account"><div className="container v4-auth-container"><div className="v2-auth-card v4-auth-card"><h1 className="sr-only">The Kut Shoppe account</h1><div className="v2-auth-tabs" role="tablist" aria-label="Account access"><button role="tab" aria-selected={mode === 'sign-in'} className={mode === 'sign-in' ? 'is-active' : ''} type="button" onClick={() => { setMode('sign-in'); resetFeedback(); }}>Sign in</button><button role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? 'is-active' : ''} type="button" onClick={() => { setMode('create'); resetFeedback(); }}>Create account</button></div><form className="v2-auth-form v4-auth-form" onSubmit={(event) => { event.preventDefault(); void (mode === 'sign-in' ? signIn() : create()); }}><div className="v2-auth-fields v4-auth-fields">{mode === 'create' ? <label><RequiredLabel>Full name</RequiredLabel><input required autoComplete="name" value={name} onChange={(event) => { setName(event.target.value); resetFeedback(); }} /></label> : null}<label><RequiredLabel>Email</RequiredLabel><input required type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); resetFeedback(); }} /></label>{mode === 'create' ? <label><RequiredLabel>Mobile phone</RequiredLabel><input required type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(event) => { setPhone(event.target.value); resetFeedback(); }} /></label> : null}<label><RequiredLabel>Password</RequiredLabel><span className="v2-password-field"><input required type={showPassword ? 'text' : 'password'} autoComplete={mode === 'create' ? 'new-password' : 'current-password'} value={password} onChange={(event) => { setPassword(event.target.value); resetFeedback(); }} /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Hide' : 'Show'}</button></span>{mode === 'create' ? <small>Use at least 10 characters.</small> : null}</label>{mode === 'create' ? <label><RequiredLabel>Confirm password</RequiredLabel><input required type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); resetFeedback(); }} /></label> : null}<label className="v5-honeypot" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} /></label></div>{passwordError && mode === 'create' ? <p className="field-error">{passwordError}</p> : null}{error ? <p className="form-error" role="alert">{error}</p> : null}<button className="button v2-auth-submit" type="submit" disabled={working}>{working ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create and verify account'}</button>{mode === 'sign-in' ? <button className="text-button" type="button" disabled>Forgot password will use verified email in production</button> : <p className="v2-auth-note">A verified email and mobile number are required before the account opens.</p>}</form>{import.meta.env.DEV ? <details className="v2-dev-account"><summary>Local Owner preview</summary><div><strong>{developmentMasterCredentials.email}</strong><code>{developmentMasterCredentials.password}</code><small>This disposable account is available only in local development.</small></div></details> : null}</div></div></section>;
}
