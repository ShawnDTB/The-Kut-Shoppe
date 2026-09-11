import { useEffect, useState } from 'react';
import { accountApi } from '../data/customer-api';
import type { SetupPage, SetupProfile, SetupReviewQueue } from '../shared/professional-setup';
import type { ProfessionalAccess } from '../shared/staff';
import { StaffAuthenticator } from './StaffAuthenticator';

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Please try again.';
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const emptyProfile: SetupProfile = { professionalName: '', bio: '', locationIds: [], serviceIds: [] };
function ProfileSummary({ page }: { page: SetupPage }) {
  const profile = page.submission;
  if (!profile) return null;
  return <><h3>{profile.professionalName || 'Professional profile'}</h3><p className="customer-record-note">{profile.bio || 'No introduction provided.'}</p>
    <h4>Requested locations</h4><ul>{profile.locationIds.map((id) => { const item = page.locations.find((entry) => entry.id === id); return <li key={id}>{item ? `${item.name} (${item.timeZone})` : 'Unavailable location — return for changes'}</li>; })}</ul>
    <h4>Requested services</h4><ul>{profile.serviceIds.map((id) => { const item = page.services.find((entry) => entry.id === id); return <li key={id}>{item ? `${item.name} · ${item.durationMinutes} minutes · ${money(item.priceCents)}` : 'Unavailable service — return for changes'}</li>; })}</ul>
    <p>Approval uses the listed catalog prices and durations, a 10-minute cleanup allowance, two hours’ notice, and a 30-day booking window. Weekly availability must be set up separately.</p></>;
}
function SetupForm() {
  const [page, setPage] = useState<SetupPage | null>(null); const [profile, setProfile] = useState<SetupProfile>(emptyProfile);
  const [attempt, setAttempt] = useState(0); const [working, setWorking] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    void accountApi<SetupPage>('/me/professional/setup').then((data) => { if (active) { setPage(data); setProfile(data.submission ?? emptyProfile); setError(''); } })
      .catch((failure) => { if (active) setError(errorMessage(failure)); });
    return () => { active = false; };
  }, [attempt]);
  const save = async (submit: boolean) => {
    if (working || !page) return; setWorking(true); setError(''); setNotice('');
    try {
      const result = await accountApi<{ message: string }>('/me/professional/setup', { action: submit ? 'submit' : 'save', version: page.submission?.version ?? 0,
        professionalName: profile.professionalName, bio: profile.bio, locationIds: profile.locationIds, serviceIds: profile.serviceIds });
      setNotice(result.message); setPage(null); setAttempt((value) => value + 1);
    } catch (failure) { setError(`${errorMessage(failure)} Reload to check the saved status before retrying.`); }
    finally { setWorking(false); }
  };
  const toggle = (key: 'locationIds' | 'serviceIds', id: string) => setProfile((current) => ({ ...current, [key]: current[key].includes(id) ? current[key].filter((value) => value !== id) : [...current[key], id] }));
  return <section aria-busy={working}><h2>Professional setup</h2><p>Choose the services and locations you’re requesting. The shop will review your profile before professional access opens.</p>
    {error ? <p role="alert" className="form-error">{error}</p> : null}{notice ? <p role="status" className="customer-notice">{notice}</p> : null}
    {!page ? <p role="status">Loading your setup…</p> : <>
      {page.submission?.reviewNote ? <section className="customer-notice"><h3>Shop feedback</h3><p className="customer-record-note">{page.submission.reviewNote}</p></section> : null}
      {page.editable ? <form className="customer-form" onSubmit={(event) => { event.preventDefault(); void save(true); }}><fieldset disabled={working}>
        <legend>Your professional profile</legend>
        <label>Professional name<input required minLength={2} maxLength={100} value={profile.professionalName} onChange={(event) => setProfile({ ...profile, professionalName: event.target.value })} /></label>
        <label>Introduction (optional)<textarea maxLength={1500} rows={5} value={profile.bio} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} /><small>Write an introduction suitable for customers. Leave private contact and account information out.</small></label>
        <fieldset><legend>Requested locations</legend>{page.locations.map((item) => <label key={item.id}><input type="checkbox" checked={profile.locationIds.includes(item.id)} onChange={() => toggle('locationIds', item.id)} />{item.name} ({item.timeZone})</label>)}
          {profile.locationIds.filter((id) => !page.locations.some((item) => item.id === id)).map((id) => <label key={id}><input type="checkbox" checked onChange={() => toggle('locationIds', id)} />Unavailable location — uncheck to remove</label>)}</fieldset>
        <fieldset><legend>Requested services</legend>{page.services.map((item) => <label key={item.id}><input type="checkbox" checked={profile.serviceIds.includes(item.id)} onChange={() => toggle('serviceIds', item.id)} />{item.name} · {item.durationMinutes} minutes · {money(item.priceCents)}</label>)}
          {profile.serviceIds.filter((id) => !page.services.some((item) => item.id === id)).map((id) => <label key={id}><input type="checkbox" checked onChange={() => toggle('serviceIds', id)} />Unavailable service — uncheck to remove</label>)}</fieldset>
        {!page.locations.length || !page.services.length ? <p>The shop needs to make services and locations available before you can submit.</p> : null}
        <p>Submission locks this draft while the shop reviews it. Approval does not add working hours or publish a page on the public website.</p>
        <div className="customer-form-actions"><button type="button" className="button button-secondary" onClick={() => void save(false)}>Save draft</button><button className="button" disabled={!page.locations.length || !page.services.length}>Submit for review</button></div>
      </fieldset></form> : <><p className="customer-status">{page.submission?.status === 'submitted' ? 'Awaiting shop review' : page.submission?.status === 'approved' ? 'Professional setup approved' : 'Profile changes require shop assistance'}</p><ProfileSummary page={page} /></>}
    </>}
    <button className="text-button" disabled={working} onClick={() => { setPage(null); setAttempt((value) => value + 1); }}>Discard changes and reload status</button>
  </section>;
}
function ReviewDetail({ id, onBack }: { id: string; onBack: (message?: string) => void }) {
  const [page, setPage] = useState<SetupPage | null>(null); const [error, setError] = useState(''); const [working, setWorking] = useState(false);
  const [password, setPassword] = useState(''); const [note, setNote] = useState(''); const [decision, setDecision] = useState<'approve' | 'return'>('return');
  useEffect(() => {
    let active = true;
    void accountApi<SetupPage>(`/me/professional/reviews/${id}`).then((data) => { if (active) setPage(data); }).catch((failure) => { if (active) setError(errorMessage(failure)); });
    return () => { active = false; };
  }, [id]);
  const review = async () => {
    if (!page?.submission || working) return; setWorking(true); setError('');
    try {
      const result = await accountApi<{ message: string }>(`/me/professional/reviews/${id}`, { action: decision, version: page.submission.version, revision: page.revision, reviewNote: note, currentPassword: password });
      onBack(result.message);
    } catch (failure) { setError(`${errorMessage(failure)} Return to the queue and reopen this submission to check its status.`); }
    finally { setWorking(false); setPassword(''); }
  };
  return <section aria-busy={working}><button className="text-button" disabled={working} onClick={() => onBack()}>Back to setup reviews</button><h2>Review professional setup</h2>
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    {page ? <><ProfileSummary page={page} /><form className="customer-form" onSubmit={(event) => { event.preventDefault(); void review(); }}><fieldset disabled={working}>
      <legend>Shop decision</legend><p>Verify this person’s identity and their requested services and locations before approving. Existing accounts with schedules or appointments require a separate migration review. This action does not assign account roles or establish an employment relationship.</p>
      <label>Decision<select value={decision} onChange={(event) => setDecision(event.target.value as 'approve' | 'return')}><option value="return">Return for changes</option><option value="approve">Approve professional setup</option></select></label>
      <label>Feedback to the professional<textarea required={decision === 'return'} minLength={decision === 'return' ? 5 : undefined} maxLength={1000} rows={4} value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <label>Your current password<input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <button className="button">{decision === 'approve' ? 'Approve this setup' : 'Return with feedback'}</button>
    </fieldset></form></> : !error ? <p role="status">Loading submission…</p> : null}
  </section>;
}
function ReviewQueue() {
  const [items, setItems] = useState<SetupReviewQueue['items']>([]); const [cursor, setCursor] = useState<string | null>(null); const [next, setNext] = useState<string | null>(null);
  const [id, setId] = useState<string | null>(null); const [attempt, setAttempt] = useState(0); const [working, setWorking] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    void accountApi<SetupReviewQueue>(`/me/professional/reviews${cursor ? `?after=${encodeURIComponent(cursor)}` : ''}`).then((data) => {
      if (active) { setItems((previous) => [...(cursor ? previous : []), ...data.items.filter((item) => !cursor || !previous.some((entry) => entry.id === item.id))]); setNext(data.nextCursor); setError(''); }
    }).catch((failure) => { if (active) { setError(errorMessage(failure)); setItems([]); } }).finally(() => { if (active) setWorking(false); });
    return () => { active = false; };
  }, [cursor, attempt]);
  const refresh = (message?: string) => { setId(null); setCursor(null); setItems([]); setNext(null); setNotice(message ?? ''); setWorking(true); setAttempt((value) => value + 1); };
  if (id) return <ReviewDetail key={id} id={id} onBack={refresh} />;
  return <section aria-busy={working}><h2>Professional setup reviews</h2><p>Review submissions from eligible staff. Your own submission must be reviewed by another owner.</p>
    {error ? <p role="alert" className="form-error">{error}</p> : null}{notice ? <p role="status" className="customer-notice">{notice}</p> : null}
    <ul className="customer-records">{items.map((item) => <li key={item.id}><div><h3>{item.professionalName}</h3><p>Submitted {new Date(item.submittedAt).toLocaleDateString()}</p></div><button className="button button-secondary" onClick={() => setId(item.id)}>Review setup</button></li>)}</ul>
    <p role="status">{working ? 'Loading reviews…' : !items.length && !error ? 'No professional setups are awaiting your review.' : ''}</p>
    <div className="customer-form-actions">{next && !error ? <button className="button button-secondary" disabled={working} onClick={() => { setWorking(true); setCursor(next); }}>Load more</button> : null}<button className="text-button" disabled={working} onClick={() => refresh()}>Refresh reviews</button></div>
  </section>;
}
export function ProfessionalSetup({ review = false }: { review?: boolean }) {
  const [access, setAccess] = useState<ProfessionalAccess | null>(null); const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void accountApi<ProfessionalAccess>('/me/professional').then((value) => { if (active) { setAccess(value); setError(''); } }).catch((failure) => { if (active) setError(errorMessage(failure)); });
    return () => { active = false; };
  }, [attempt]);
  if (error) return <section><p role="alert">{error}</p><button className="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button></section>;
  if (!access) return <p role="status">Checking professional access…</p>;
  if (access.state === 'not_eligible' || (review && !access.canReview)) return <p>This account does not have access to this professional section.</p>;
  if (!access.setupEnabled) return <p>Professional setup and shop review are not open yet.</p>;
  return <StaffAuthenticator>{review ? <ReviewQueue /> : <SetupForm />}</StaffAuthenticator>;
}
