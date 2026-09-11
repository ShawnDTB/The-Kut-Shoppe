import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { accountApi } from '../data/customer-api';
import type { StaffMfaEnrollment, StaffMfaStatus } from '../shared/mfa';

export function StaffAuthenticator({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<StaffMfaStatus | null>(null);
  const [setup, setSetup] = useState<StaffMfaEnrollment | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [password, setPassword] = useState(''); const [code, setCode] = useState('');
  const [error, setError] = useState(''); const [working, setWorking] = useState(false);
  const [manage, setManage] = useState(false); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void accountApi<StaffMfaStatus>('/me/mfa').then((data) => { if (active) { setStatus(data); setError(''); } })
      .catch((failure: unknown) => { if (active) setError(failure instanceof Error ? failure.message : 'Please try again.'); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => {
    if (!status?.unlockedUntil) return;
    const expire = () => { setStatus((current) => current ? { ...current, unlockedUntil: null } : null); setPassword(''); setCode(''); setManage(false); };
    const timer = window.setTimeout(expire, Math.max(0, Date.parse(status.unlockedUntil) - Date.now()));
    // Check server state on return to a tab, including changes on another device.
    const refresh = () => { if (document.visibilityState === 'visible') { setStatus(null); setAttempt((value) => value + 1); } };
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [status?.unlockedUntil]);
  const run = async (operation: 'start' | 'confirm' | 'unlock' | 'lock', event?: FormEvent) => {
    event?.preventDefault(); if (working) return;
    setWorking(true); setError('');
    try {
      if (operation === 'start') {
        setSetup(await accountApi<StaffMfaEnrollment>('/me/mfa/enroll/start', { currentPassword: password }));
      } else if (operation === 'confirm') {
        const result = await accountApi<{ recoveryCodes: string[]; unlockedUntil: string }>('/me/mfa/enroll/confirm', { enrollmentId: setup?.enrollmentId, code });
        setCodes(result.recoveryCodes); setSetup(null); setManage(false);
        setStatus({ configured: true, enrolled: true, unlockedUntil: result.unlockedUntil });
      } else if (operation === 'unlock') {
        const result = await accountApi<{ unlockedUntil: string }>('/me/mfa/unlock', { currentPassword: password, code });
        setStatus({ configured: true, enrolled: true, unlockedUntil: result.unlockedUntil }); setManage(false);
      } else {
        await accountApi('/me/mfa/lock', {}); setStatus((current) => current ? { ...current, unlockedUntil: null } : null);
        setSetup(null); setManage(false); setCodes([]);
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Please try again.'); }
    finally { setWorking(false); setPassword(''); setCode(''); }
  };
  const unlocked = Boolean(status?.unlockedUntil);
  return <section aria-busy={working}>
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    {!status ? <><p role="status">Checking staff verification…</p>{error ? <button className="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button> : null}</>
      : !status.configured ? <><h2>Staff verification is unavailable</h2><p>Contact the shop to finish configuring secure professional access.</p></>
      : codes.length ? <><h2>Save your recovery codes</h2><p>Store these in a password manager or another safe place. Each code works once if you lose access to your authenticator. These codes will not be shown again.</p>
        <ul>{codes.map((value) => <li key={value}><code>{value}</code></li>)}</ul><button className="button" onClick={() => setCodes([])}>I’ve saved my recovery codes</button></>
      : setup ? <form className="customer-form" onSubmit={(event) => void run('confirm', event)}>
        <h2>Add The Kut Shoppe to your authenticator</h2><p>Choose manual setup in your authenticator app. Enter this key, choose time-based codes, six digits, and a 30-second period. Use your account email as its label.</p>
        <label>Setup key<input readOnly value={setup.setupKey} autoComplete="off" spellCheck={false} /></label>
        <p>This setup expires at {new Date(setup.expiresAt).toLocaleTimeString()}. Keep the key private. {status.enrolled ? 'Your existing authenticator and recovery codes keep working until you confirm this replacement.' : ''}</p>
        <label>Six-digit authenticator code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} /></label>
        <div className="customer-form-actions"><button className="button" disabled={working}>Confirm authenticator</button><button type="button" className="text-button" disabled={working} onClick={() => { setSetup(null); setCode(''); }}>Back</button></div>
      </form>
      : !status.enrolled || manage ? <form className="customer-form" onSubmit={(event) => void run('start', event)}>
        <h2>{status.enrolled ? 'Replace your authenticator' : 'Set up staff verification'}</h2>
        <p>Professional access requires your password and an authenticator code. Verification unlocks this device for 15 minutes.</p>
        {status.enrolled ? <p>Confirming a replacement invalidates the old authenticator, all old recovery codes, and staff access on other devices.</p> : null}
        <label>Current password<input type="password" required autoComplete="current-password" maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <div className="customer-form-actions"><button className="button" disabled={working}>Start authenticator setup</button>{manage ? <button type="button" className="text-button" disabled={working} onClick={() => { setManage(false); setPassword(''); }}>Back</button> : null}</div>
      </form>
      : !unlocked ? <form className="customer-form" onSubmit={(event) => void run('unlock', event)}>
        <h2>Unlock professional access</h2><p>Enter your current password and a fresh authenticator code. An unused recovery code also works. If you’ve lost both, contact the shop; an email password reset cannot remove staff verification.</p>
        <label>Current password<input type="password" required autoComplete="current-password" maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label>Authenticator or recovery code<input required autoComplete="one-time-code" maxLength={23} spellCheck={false} autoCapitalize="none" value={code} onChange={(event) => setCode(event.target.value)} /></label>
        <button className="button" disabled={working}>Verify and unlock</button>
      </form>
      : <><div className="customer-form-actions"><p>Staff access verified until {new Date(status.unlockedUntil!).toLocaleTimeString()}.</p><button className="text-button" disabled={working} onClick={() => void run('lock')}>Lock staff access</button><button className="text-button" onClick={() => setManage(true)}>Replace authenticator</button></div>{children}</>}
  </section>;
}
