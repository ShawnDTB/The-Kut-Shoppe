import { useEffect, useMemo, useState } from 'react';
import {
  getPlatformSessionAccount,
  hasPlatformCapability,
  linkPlatformStaffProfile,
  startPlatformSession,
  type PlatformAccount,
  type PlatformCapability,
} from '../data/auth-v2';
import {
  saveAccount as saveLegacyAccount,
  startSession as startLegacySession,
  type AccountRole as LegacyRole,
} from '../data/auth';
import {
  barberServiceOptions,
  createStaffProfileDraft,
  primaryLocation,
  readStaffProfiles,
  saveStaffProfile,
  validateStaffProfile,
  type StaffProfile,
} from '../data/platform';
import { defaultStaffPolicy, saveStaffPolicy } from '../data/staff-policy-v5';
import { StaffOnboardingV5 } from './StaffOnboardingV5';

function roleLabel(account: PlatformAccount) {
  return account.role.charAt(0).toUpperCase() + account.role.slice(1);
}

function profileRole(account: PlatformAccount): StaffProfile['role'] {
  if (account.role === 'manager') return 'manager';
  if (account.role === 'barber') return 'barber';
  return 'owner';
}

function legacyRole(account: PlatformAccount): LegacyRole {
  return account.role === 'manager' ? 'manager' : account.role === 'barber' ? 'staff' : 'owner';
}

function managementHeading(account: PlatformAccount) {
  if (account.role === 'manager') return 'Manage shop operations.';
  if (account.role === 'developer') return 'Configure the platform.';
  return 'Manage The Kut Shoppe.';
}

const capabilityDetails: Array<[PlatformCapability, string, string]> = [
  ['manage-shop-appointments', 'Appointments', 'Review requests, calendars, changes, and daily service activity.'],
  ['manage-products', 'Products', 'Maintain the catalog, variants, availability, and publishing state.'],
  ['manage-orders', 'Orders', 'Process pickup, shipping, and in-person order activity.'],
  ['manage-staff', 'Staff', 'Review professional setup, schedules, and shop access.'],
  ['manage-roles', 'Roles', 'Approve account access and elevated responsibilities.'],
  ['manage-platform', 'Platform', 'Review platform-level configuration and production boundaries.'],
];

function Required({ children }: { children: string }) {
  return <span className="v5-required-label">{children}<span aria-hidden="true">*</span></span>;
}

export function StaffOnboardingV6() {
  const account = getPlatformSessionAccount();
  const linkedProfile = account?.staffProfileId
    ? readStaffProfiles().find((profile) => profile.id === account.staffProfileId) ?? null
    : null;

  useEffect(() => {
    if (linkedProfile && account?.role !== 'barber') window.location.replace('/dashboard');
  }, [account?.role, linkedProfile]);

  if (!account || account.role === 'customer' || account.role === 'barber') return <StaffOnboardingV5 />;
  if (linkedProfile) return <section className="section management-onboarding-v6"><div className="container narrow-container"><a className="button" href="/dashboard">Open dashboard</a></div></section>;

  return <ManagementOnboarding account={account} />;
}

function ManagementOnboarding({ account }: { account: PlatformAccount }) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<StaffProfile>(() => {
    const draft = createStaffProfileDraft();
    return {
      ...draft,
      professionalName: account.name,
      email: account.email,
      role: profileRole(account),
      serviceIds: barberServiceOptions.map((service) => service.id),
    };
  });

  const access = useMemo(
    () => capabilityDetails.filter(([capability]) => hasPlatformCapability(account, capability)),
    [account],
  );

  const validateAccount = () => {
    const validation = validateStaffProfile(profile);
    const message = validation.professionalName || validation.phone || '';
    setError(message);
    if (message) {
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-management-error]')?.focus());
      return false;
    }
    return true;
  };

  const continueSetup = () => {
    if (step === 1 && !validateAccount()) return;
    setError('');
    setStep((current) => Math.min(3, current + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const complete = () => {
    if (!validateAccount()) {
      setStep(1);
      return;
    }

    const now = new Date().toISOString();
    const completed: StaffProfile = {
      ...profile,
      email: account.email,
      role: profileRole(account),
      publicBio: '',
      setupComplete: true,
      updatedAt: now,
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

  const steps = ['Account', 'Access', 'Review'];

  return (
    <section className="section management-onboarding-v6 platform-pattern platform-pattern-staff">
      <div className="container route-wide">
        <header className="management-onboarding-v6-header">
          <div>
            <p className="eyebrow">{roleLabel(account)} onboarding</p>
            <h1>{managementHeading(account)}</h1>
            <p>Connect this approved account to the shop without creating customer-facing chair availability.</p>
          </div>
          <a className="button button-secondary" href="/dashboard">Back to dashboard</a>
        </header>

        <ol className="staff-v2-progress management-onboarding-v6-progress" aria-label="Management setup progress">
          {steps.map((label, index) => (
            <li className={step === index + 1 ? 'is-current' : step > index + 1 ? 'is-complete' : ''} key={label}>
              <span>{index + 1}</span><small>{label}</small>
            </li>
          ))}
        </ol>

        <div className="management-onboarding-v6-panel">
          {step === 1 ? (
            <section>
              <p className="eyebrow">Account and contact</p>
              <h2>Connect your management profile</h2>
              <p>This information is used for shop operations. Management accounts are not published as available Barbers.</p>
              {error ? <p className="form-error" role="alert" tabIndex={-1} data-management-error>{error}</p> : null}
              <div className="management-onboarding-v6-fields">
                <label><Required>Display name</Required><input autoComplete="name" value={profile.professionalName} onChange={(event) => setProfile({ ...profile, professionalName: event.target.value })} /></label>
                <label>Account email<input type="email" value={account.email} readOnly /></label>
                <label><Required>Business phone</Required><input type="tel" autoComplete="tel" placeholder="570-421-5887" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label>
                <label>Access role<input value={roleLabel(account)} readOnly /></label>
              </div>
              <div className="management-onboarding-v6-location">
                <p className="eyebrow">Primary location</p>
                <strong>{primaryLocation.name}</strong>
                <span>{primaryLocation.address}</span>
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section>
              <p className="eyebrow">Approved access</p>
              <h2>Tools assigned to this role</h2>
              <p>These permissions follow the approved account role. They can be changed later by an authorized Owner or Developer.</p>
              <div className="management-onboarding-v6-access">
                {access.map(([capability, title, description]) => (
                  <article key={capability}><strong>{title}</strong><p>{description}</p></article>
                ))}
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section>
              <p className="eyebrow">Review</p>
              <h2>Finish connecting the account</h2>
              <dl className="management-onboarding-v6-review">
                <div><dt>Name</dt><dd>{profile.professionalName}</dd></div>
                <div><dt>Role</dt><dd>{roleLabel(account)}</dd></div>
                <div><dt>Email</dt><dd>{account.email}</dd></div>
                <div><dt>Phone</dt><dd>{profile.phone}</dd></div>
                <div><dt>Location</dt><dd>{primaryLocation.address}</dd></div>
                <div><dt>Customer booking</dt><dd>Not published as a chair</dd></div>
              </dl>
            </section>
          ) : null}

          <div className="staff-v2-actions management-onboarding-v6-actions">
            <button className="button button-secondary" type="button" disabled={step === 1} onClick={() => { setError(''); setStep((current) => Math.max(1, current - 1)); }}>Back</button>
            {step < 3
              ? <button className="button" type="button" onClick={continueSetup}>Continue</button>
              : <button className="button" type="button" onClick={complete}>Finish account setup</button>}
          </div>
        </div>
      </div>
    </section>
  );
}
