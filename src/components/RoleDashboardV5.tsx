import { useEffect, useState } from 'react';
import {
  endPlatformSession,
  getPlatformSessionAccount,
  readPlatformAccounts,
  startPlatformSession,
  subscribeToPlatformAuth,
  type PlatformAccount,
} from '../data/auth-v2';
import { endSession as endLegacySession } from '../data/auth';
import { changeCustomerPassword } from '../data/account-profile-v4';
import {
  getActiveIdentityChallengeV5,
  getCustomerProfileV5,
  requestIdentityChallengeV5,
  saveCustomerProfileV5,
  updateAccountName,
  verifyIdentityChallengeV5,
  type CustomerAddressV5,
  type IdentityChallengeV5,
} from '../data/account-profile-v5';
import {
  readAppointments,
  readStaffProfiles,
  respondToAppointmentProposal,
  subscribeToAppointmentChanges,
  updateAppointment,
  type PlatformAppointment,
} from '../data/platform';
import { formatNoticeWindow, getStaffPolicy } from '../data/staff-policy-v5';
import { formatMoney, readOrders, subscribeToStorefrontChanges, type StoreOrder } from '../data/storefront';
import { business } from '../data/site';
import { RoleDashboardV4 } from './RoleDashboardV4';

function appointmentDate(appointment: PlatformAppointment) {
  return new Date(`${appointment.date}T${String(Math.floor(appointment.startMinutes / 60)).padStart(2, '0')}:${String(appointment.startMinutes % 60).padStart(2, '0')}:00`);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function IdentityChange({ account, channel, currentValue, onVerified }: { account: PlatformAccount; channel: 'email' | 'phone'; currentValue: string; onVerified: () => void }) {
  const [value, setValue] = useState(currentValue);
  const [challenge, setChallenge] = useState<IdentityChallengeV5 | null>(() => getActiveIdentityChallengeV5(account.id, channel));
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const request = () => {
    try {
      const next = requestIdentityChallengeV5(account.id, channel, value);
      setChallenge(next); setCode(''); setMessage(`${channel === 'email' ? 'Email' : 'Phone'} change is pending verification.`); setError('');
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to request verification.'); }
  };

  const verify = () => {
    try {
      verifyIdentityChallengeV5(challenge?.id ?? '', code);
      setMessage(`${channel === 'email' ? 'Email' : 'Phone'} verified and updated.`); setError(''); setChallenge(null); setCode(''); onVerified();
    } catch (verificationError) { setError(verificationError instanceof Error ? verificationError.message : 'Unable to verify the change.'); }
  };

  return <section className="v5-identity-change"><label>{channel === 'email' ? 'Email address' : 'Mobile phone'}<input type={channel === 'email' ? 'email' : 'tel'} autoComplete={channel === 'email' ? 'email' : 'tel'} value={value} onChange={(event) => { setValue(event.target.value); setMessage(''); setError(''); }} /></label><div className="v5-inline-actions"><button className="button button-secondary" type="button" disabled={!value.trim() || value === currentValue} onClick={request}>Verify new {channel}</button>{challenge ? <><input className="v5-code-input" aria-label={`${channel} verification code`} inputMode="numeric" maxLength={6} placeholder="6-digit code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /><button className="button" type="button" disabled={code.length !== 6} onClick={verify}>Confirm</button></> : null}</div>{import.meta.env.DEV && challenge ? <small>Local verification code: {challenge.code}</small> : null}{message ? <p className="success-message" role="status">{message}</p> : null}{error ? <p className="form-error" role="alert">{error}</p> : null}</section>;
}

function CustomerDashboard({ initialAccount }: { initialAccount: PlatformAccount }) {
  const [account, setAccount] = useState(initialAccount);
  const [profile, setProfile] = useState(() => getCustomerProfileV5(initialAccount));
  const [appointments, setAppointments] = useState(() => readAppointments());
  const [orders, setOrders] = useState(() => readOrders());
  const [name, setName] = useState(initialAccount.name);
  const [address, setAddress] = useState<CustomerAddressV5>(() => profile?.address ?? { line1: '', line2: '', city: '', state: 'PA', postalCode: '' });
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    const refresh = () => { const next = getPlatformSessionAccount(); if (next) { setAccount(next); setProfile(getCustomerProfileV5(next)); } setAppointments(readAppointments()); setOrders(readOrders()); };
    const unsubscribeAuth = subscribeToPlatformAuth(refresh);
    const unsubscribeAppointments = subscribeToAppointmentChanges(refresh);
    const unsubscribeStore = subscribeToStorefrontChanges(refresh);
    return () => { unsubscribeAuth(); unsubscribeAppointments(); unsubscribeStore(); };
  }, []);

  const customerAppointments = appointments.filter((item) => item.customerEmail === account.email && (!profile?.phone || item.customerPhone === profile.phone));
  const activeAppointments = customerAppointments.filter((item) => !['completed', 'cancelled', 'declined', 'no-show'].includes(item.status));
  const customerOrders = orders.filter((order) => order.customer.email === account.email && (!profile?.phone || order.customer.phone === profile.phone));

  const refreshIdentity = () => {
    const updated = readPlatformAccounts().find((item) => item.id === account.id) ?? account;
    startPlatformSession(updated); setAccount(updated); setProfile(getCustomerProfileV5(updated));
  };

  const noticeHours = (appointment: PlatformAppointment) => {
    const staff = readStaffProfiles().find((item) => item.id === appointment.assignedBarberId);
    return getStaffPolicy(staff)?.cancellationNoticeHours ?? staff?.bookingRules.minimumNoticeHours ?? 24;
  };

  const canChange = (appointment: PlatformAppointment) => {
    const remaining = appointmentDate(appointment).getTime() - Date.now();
    return remaining > noticeHours(appointment) * 60 * 60 * 1000;
  };

  const saveProfile = () => {
    try {
      const updated = updateAccountName(account, name);
      if (profile) saveCustomerProfileV5({ ...profile, address });
      startPlatformSession(updated); setAccount(updated); setProfile(getCustomerProfileV5(updated)); setProfileMessage('Profile and address saved.'); setProfileError('');
    } catch (error) { setProfileError(error instanceof Error ? error.message : 'Unable to save the profile.'); }
  };

  const changePassword = async () => {
    setPasswordMessage(''); setPasswordError('');
    try {
      if (newPassword !== confirmPassword) throw new Error('The new password confirmation does not match.');
      const updated = await changeCustomerPassword(account, currentPassword, newPassword);
      startPlatformSession(updated); setAccount(updated); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordMessage('Password changed.');
    } catch (error) { setPasswordError(error instanceof Error ? error.message : 'Unable to change the password.'); }
  };

  const logout = () => { endPlatformSession(); endLegacySession(); window.location.assign('/'); };

  return <section className="section v5-customer-account platform-pattern platform-pattern-account"><div className="container route-wide"><header className="v5-account-header"><div><p className="eyebrow">The Kut Shoppe account</p><h1>Welcome, {account.name.split(/\s+/)[0]}.</h1></div><button className="button button-secondary" type="button" onClick={logout}>Log out</button></header>
    <section className="v5-account-section v5-appointments"><div className="v5-section-heading"><div><p className="eyebrow">Appointments</p><h2>Your appointments</h2></div><a className="button" href="/book">Book now</a></div>{activeAppointments.length ? <div className="v5-appointment-list">{activeAppointments.map((appointment) => { const policyHours = noticeHours(appointment); const online = canChange(appointment); return <article key={appointment.id}><div><span className={`staff-status staff-status-${appointment.status}`}>{appointment.status.replaceAll('-', ' ')}</span><h3>{appointment.serviceName}</h3><dl><div><dt>Date</dt><dd>{formatDate(appointment.date)}</dd></div><div><dt>Time</dt><dd>{appointment.time}</dd></div><div><dt>Barber</dt><dd>{appointment.barberName.replace(/\.$/, '')}</dd></div></dl></div><div className="v5-appointment-policy"><p>Online changes close {formatNoticeWindow(policyHours)}.</p>{appointment.status === 'reschedule-proposed' && appointment.proposedDate ? <><strong>Proposed: {formatDate(appointment.proposedDate)} at {appointment.proposedTime}</strong><div className="v5-inline-actions"><button className="button" type="button" onClick={() => { respondToAppointmentProposal(appointment.id, true); setAppointments(readAppointments()); }}>Accept</button><button className="button button-secondary" type="button" onClick={() => { respondToAppointmentProposal(appointment.id, false); setAppointments(readAppointments()); }}>Decline</button></div></> : online ? <div className="v5-inline-actions"><a className="button button-secondary" href={`/book?appointment=${appointment.id}`}>Change appointment</a><button className="text-button danger" type="button" onClick={() => { updateAppointment(appointment.id, { status: 'cancelled' }); setAppointments(readAppointments()); }}>Cancel appointment</button></div> : <a className="text-link" href={business.phoneHref}>Call {business.phone}</a>}</div></article>; })}</div> : <p>No upcoming appointment requests.</p>}</section>
    <div className="v5-account-grid"><section className="v5-account-section"><div className="v5-section-heading"><div><p className="eyebrow">Orders</p><h2>Your orders</h2></div><a className="text-link" href="/shop">Shop</a></div>{customerOrders.length ? <div className="v5-order-list">{customerOrders.map((order: StoreOrder) => <article key={order.id}><div><strong>{order.items.map((item) => `${item.quantity} × ${item.name}`).join(', ')}</strong><small>{order.status.replaceAll('-', ' ')} · {order.fulfillment}</small></div><strong>{formatMoney(order.totalCents)}</strong></article>)}</div> : <div className="v5-account-recommendations"><strong>Nothing ordered yet.</strong><a href="/shop">Browse the Shop →</a><a href="/gallery">View recent work →</a><a href="/services">See services →</a></div>}</section>
      <section className="v5-account-section v5-profile-section"><p className="eyebrow">Profile</p><h2>Contact and delivery details</h2><div className="v5-profile-fields"><label>Full name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label><IdentityChange account={account} channel="email" currentValue={account.email} onVerified={refreshIdentity} /><IdentityChange account={account} channel="phone" currentValue={profile?.phone ?? ''} onVerified={refreshIdentity} /><label className="v5-profile-wide">Street address<input autoComplete="street-address" value={address.line1} onChange={(event) => setAddress({ ...address, line1: event.target.value })} /></label><label className="v5-profile-wide"><span className="sr-only">Apartment, suite, unit, or P.O. box</span><input autoComplete="address-line2" placeholder="Apt., suite, unit, or P.O. box (optional)" value={address.line2} onChange={(event) => setAddress({ ...address, line2: event.target.value })} /></label><label>City<input autoComplete="address-level2" value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} /></label><label>State<input autoComplete="address-level1" value={address.state} onChange={(event) => setAddress({ ...address, state: event.target.value })} /></label><label>ZIP code<input autoComplete="postal-code" value={address.postalCode} onChange={(event) => setAddress({ ...address, postalCode: event.target.value })} /></label></div>{profileMessage ? <p className="success-message">{profileMessage}</p> : null}{profileError ? <p className="form-error">{profileError}</p> : null}<button className="button" type="button" onClick={saveProfile}>Save profile</button></section></div>
    <details className="v5-security-panel"><summary><span><small>Security</small><strong>Change password</strong></span><span aria-hidden="true">+</span></summary><div className="v5-password-fields"><label>Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label>New password<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><label>Confirm new password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label><button className="button" type="button" onClick={() => void changePassword()}>Change password</button></div>{passwordMessage ? <p className="success-message">{passwordMessage}</p> : null}{passwordError ? <p className="form-error">{passwordError}</p> : null}</details>
  </div></section>;
}

export function RoleDashboardV5() {
  const account = getPlatformSessionAccount();
  if (!account) return <section className="section"><div className="container narrow-container"><a className="button" href="/account">Account / Login</a></div></section>;
  if (account.role === 'barber' && account.staffProfileId) {
    if (typeof window !== 'undefined') window.location.replace('/staff');
    return <section className="section"><div className="container narrow-container"><p>Opening your chair dashboard…</p></div></section>;
  }
  if (account.role !== 'customer') return <RoleDashboardV4 />;
  return <CustomerDashboard initialAccount={account} />;
}
