import { useEffect, useState } from 'react';
import {
  getPlatformSessionAccount,
  linkPlatformStaffProfile,
  startPlatformSession,
  type PlatformAccount,
} from '../data/auth-v2';
import {
  isValidPhone,
  saveAccount as saveLegacyAccount,
  startSession as startLegacySession,
  type AccountRole as LegacyRole,
} from '../data/auth';
import {
  createStaffProfileDraft,
  primaryLocation,
  readStaffProfiles,
  saveStaffProfile,
  type StaffProfile,
} from '../data/platform';
import { defaultStaffPolicy, saveStaffPolicy } from '../data/staff-policy-v5';
import { StaffOnboardingV5 } from './StaffOnboardingV5';

function roleLabel(account: PlatformAccount) {
  return account.role.charAt(0).toUpperCase() + account.role.slice(1);
}

function profileRole(account: PlatformAccount): StaffProfile['role'] {
  return account.role === 'manager' ? 'manager' : 'owner';
}

function legacyRole(account: PlatformAccount): LegacyRole {
  return account.role === 'manager' ? 'manager' : 'owner';
}

function heading(account: PlatformAccount) {
  if (account.role === 'manager') return 'Manage shop operations.';
  if (account.role === 'developer') return 'Configure the platform.';
  return 'Manage The Kut Shoppe.';
}

export function StaffOnboardingV6() {
  const account = getPlatformSessionAccount();
  const linked = account?.staffProfileId
    ? readStaffProfiles().find((profile) => profile.id === account.staffProfileId) ?? null
    : null;

  useEffect(() => {
    if (linked && account?.role !== 'barber') window.location.replace('/dashboard');
  }, [account?.role, linked]);

  if (!account || account.role === 'customer' || account.role === 'barber') return <StaffOnboardingV5 />;
  if (linked) return <section className="section"><div className="container narrow-container"><a className="button" href="/dashboard">Open dashboard</a></div></section>;
  return <ManagementSetup account={account} />;
}

function ManagementSetup({ account }: { account: PlatformAccount }) {
  const [name, setName] = useState(account.name);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const complete = () => {
    if (name.trim().length < 2) return setError('Enter a display name.');
    if (!isValidPhone(phone)) return setError('Enter a valid 10-digit phone number.');

    const draft = createStaffProfileDraft();
    const completed: StaffProfile = {
      ...draft,
      professionalName: name.trim(),
      email: account.email,
      phone,
      publicBio: '',
      role: profileRole(account),
      serviceIds: [],
      setupComplete: true,
      updatedAt: new Date().toISOString(),
    };
    saveStaffProfile(completed);
    saveStaffPolicy({ ...defaultStaffPolicy(completed), profileId: completed.id });

    const updated = linkPlatformStaffProfile(account.id, completed.id, completed.professionalName);
    startPlatformSession(updated);
    const legacy = saveLegacyAccount({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: completed.phone,
      phoneVerified: false,
      role: legacyRole(updated),
      staffProfileId: completed.id,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
    startLegacySession(legacy);
    window.location.assign('/dashboard');
  };

  return (
    <section className="section management-onboarding-v6 platform-pattern platform-pattern-staff">
      <div className="container route-wide">
        <header className="management-onboarding-v6-header">
          <div><p className="eyebrow">{roleLabel(account)} onboarding</p><h1>{heading(account)}</h1><p>Connect this account to shop operations.</p></div>
          <a className="button button-secondary" href="/dashboard">Back to dashboard</a>
        </header>

        <div className="management-onboarding-v6-panel">
          <p className="eyebrow">Account and access</p>
          <h2>Finish account setup</h2>
          <p>The approved role controls the available shop tools.</p>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="management-onboarding-v6-fields">
            <label><span className="v5-required-label">Display name <span aria-hidden="true">*</span></span><input autoComplete="name" value={name} onChange={(event) => { setName(event.target.value); setError(''); }} /></label>
            <label>Account email<input type="email" value={account.email} readOnly /></label>
            <label><span className="v5-required-label">Business phone <span aria-hidden="true">*</span></span><input type="tel" autoComplete="tel" placeholder="570-421-5887" value={phone} onChange={(event) => { setPhone(event.target.value); setError(''); }} /></label>
            <label>Access role<input value={roleLabel(account)} readOnly /></label>
          </div>
          <div className="management-onboarding-v6-location"><p className="eyebrow">Primary location</p><strong>{primaryLocation.name}</strong><span>{primaryLocation.address}</span></div>
          <div className="management-onboarding-v6-actions"><button className="button" type="button" onClick={complete}>Finish account setup</button></div>
        </div>
      </div>
    </section>
  );
}
