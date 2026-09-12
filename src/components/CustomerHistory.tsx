import { useEffect, useState } from 'react';
import { accountApi } from '../data/customer-api';
import { business } from '../data/site';
import type { CustomerAppointment, CustomerOrder, CustomerPage } from '../shared/customer';
import { followAccountLink } from '../data/customer-navigation';
import { RestoredBooking as CustomerBooking } from './RestoredBooking';

type Item = CustomerAppointment | CustomerOrder;
const statusLabel = (value: string) => value.replaceAll('_', ' ');
const time = (value: string | null) => value ? new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value)) : 'Time to be arranged';

export function CustomerHistory({ kind, onOpen, bookingEnabled = false }: { kind: 'appointments' | 'orders'; onOpen: (id: string) => void; bookingEnabled?: boolean }) {
  const [booking, setBooking] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [working, setWorking] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void accountApi<CustomerPage<Item>>(`/me/${kind}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`)
      .then((page) => {
        if (!active) return;
        setItems((previous) => {
          const existing = cursor ? previous ?? [] : [];
          const seen = new Set(existing.map((item) => item.id));
          return [...existing, ...page.items.filter((item) => !seen.has(item.id))];
        });
        setNextCursor(page.nextCursor); setError('');
      })
      .catch((failure) => { if (active) setError(failure instanceof Error ? failure.message : 'Please try again.'); })
      .finally(() => { if (active) setWorking(false); });
    return () => { active = false; };
  }, [kind, cursor, attempt]);
  const retry = () => { setWorking(true); setError(''); setAttempt((value) => value + 1); };
  const refresh = () => { setItems(null); setCursor(null); setNextCursor(null); retry(); };
  if (booking && kind === 'appointments' && bookingEnabled) return <CustomerBooking onOpen={onOpen} onBack={() => { setBooking(false); refresh(); }} />;
  return <section aria-busy={working}>
    <div className="customer-section-heading"><h2>Your {kind}</h2>{kind === 'appointments' ? bookingEnabled ? <button className="button" onClick={() => setBooking(true)}>Request an appointment</button> : <a className="button" href="/book">Book an appointment</a> : null}</div>
    {items?.length ? <ul className="customer-records">{items.map((item) => <li key={item.id}>{'serviceName' in item ? <>
      <div><span className="customer-status">{statusLabel(item.status)}</span><h3>{item.serviceName}</h3><p>{time(item.startsAt)} · {item.barberName ?? 'Professional to be assigned'}</p></div>
      <a href={`/account?view=appointments&record=${encodeURIComponent(item.id)}`} onClick={(event) => followAccountLink(event, () => onOpen(item.id))}>View appointment</a>
    </> : <><div><h3>Order {item.id.slice(-8)}</h3><p>{statusLabel(item.status)} · {statusLabel(item.fulfillment)} · {time(item.createdAt)}</p></div><div><strong>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.totalCents / 100)}</strong><p><a href={`/account?view=orders&record=${encodeURIComponent(item.id)}`} onClick={(event) => followAccountLink(event, () => onOpen(item.id))}>View order</a></p></div></>}</li>)}</ul> : items && !working && !error ? <div className="customer-empty">
      <h3>No {kind} linked yet.</h3>{kind === 'appointments' ? <p>Appointments booked through Booksy or Crowned by Steph are managed with that provider. They do not appear here automatically.</p> : <p>Your orders will appear here when online ordering opens. For product availability today, <a href={business.phoneHref}>call the shop</a>.</p>}
    </div> : null}
    {error ? <div role="alert"><p className="form-error">{error}</p><button className="button button-secondary" type="button" disabled={working} onClick={retry}>Try again</button></div> : null}
    <div className="customer-history-controls">
      <p role="status">{working ? `Loading your ${kind}…` : items?.length ? `${items.length} ${kind} shown${nextCursor ? '.' : '. You’re up to date.'}` : ''}</p>
      {nextCursor && !error ? <button className="button button-secondary" type="button" disabled={working} onClick={() => { setWorking(true); setCursor(nextCursor); }}>Load more {kind}</button> : null}
      {items ? <button className="text-button" type="button" disabled={working} onClick={refresh}>Refresh history</button> : null}
    </div>
    {kind === 'appointments' ? <p className="customer-fine-print">Times are shown in the shop’s time zone (Eastern), newest first. Booksy and Crowned by Steph bookings do not sync here automatically. An appointment request is only confirmed when the shop accepts it. Contact your booking provider or <a href={business.phoneHref}>call the shop</a> for changes.</p> : null}
  </section>;
}
