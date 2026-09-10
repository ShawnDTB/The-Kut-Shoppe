import { useEffect, useRef, useState, type ReactNode } from 'react';
import { accountApi, downloadAppointmentCalendar } from '../data/customer-api';
import { followAccountLink } from '../data/customer-navigation';
import { business } from '../data/site';
import type { CustomerAppointmentDetail, CustomerOrderDetail, CustomerProfile } from '../shared/customer';

const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Please try again.';
const label = (value: string) => value.replaceAll('_', ' ');
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100);
const time = (value: string | null, timeZone = 'America/New_York') => {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Time to be arranged';
  try { return new Intl.DateTimeFormat('en-US', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  catch { return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
};
function Address({ value }: { value: CustomerProfile['address'] }) {
  return <address>{value.line1}<br />{value.line2 ? <>{value.line2}<br /></> : null}{value.city}, {value.state} {value.postalCode}</address>;
}
function DetailFrame({ kind, onBack, children }: { kind: 'appointments' | 'orders'; onBack: () => void; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section className="customer-record-detail"><a href={`/account?view=${kind}`} onClick={(event) => followAccountLink(event, onBack)}>Back to {kind}</a>
    <h2 ref={heading} tabIndex={-1}>{kind === 'appointments' ? 'Appointment details' : 'Order details'}</h2>{children}</section>;
}

export function CustomerAppointmentDetails({ id, onBack }: { id: string; onBack: () => void }) {
  const [appointment, setAppointment] = useState<CustomerAppointmentDetail | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const actionButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let active = true;
    void accountApi<{ appointment: CustomerAppointmentDetail }>(`/me/appointments/${encodeURIComponent(id)}`)
      .then((data) => { if (active) { setAppointment(data.appointment); setError(''); } })
      .catch((failure) => { if (active) setError(messageOf(failure)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, attempt]);
  const refresh = () => { setLoading(true); setConfirming(false); setError(''); setAttempt((value) => value + 1); };
  const withdraw = async () => {
    if (working || !appointment) return;
    setWorking(true); setError(''); setNotice('');
    try {
      const result = await accountApi<{ appointment: CustomerAppointmentDetail; message: string }>(`/me/appointments/${encodeURIComponent(id)}/withdraw`, { updatedAt: appointment.updatedAt });
      setAppointment(result.appointment); setNotice(result.message); setConfirming(false);
    } catch (failure) { setError(messageOf(failure)); }
    finally { setWorking(false); }
  };
  const calendar = async () => {
    if (working) return;
    setWorking(true); setError(''); setNotice('');
    try { await downloadAppointmentCalendar(id); setNotice('Calendar download started. This copy won’t update automatically if your appointment changes.'); }
    catch (failure) { setError(messageOf(failure)); }
    finally { setWorking(false); }
  };
  return <DetailFrame kind="appointments" onBack={onBack}>
    {loading ? <p role="status">Loading appointment…</p> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}{notice ? <p className="customer-notice" role="status">{notice}</p> : null}
    {appointment ? <div aria-busy={working || loading}>
      <p className="customer-status">{appointment.withdrawnByCustomer ? 'Request withdrawn' : label(appointment.status)}</p>
      <h3>{appointment.serviceName}</h3>
      <dl className="customer-detail-facts">
        <div><dt>Professional</dt><dd>{appointment.barberName ?? 'To be assigned'}</dd></div>
        <div><dt>{appointment.status === 'requested' ? 'Requested time' : 'Start'}</dt><dd>{time(appointment.startsAt, appointment.location.timeZone)}</dd></div>
        {appointment.endsAt ? <div><dt>End</dt><dd>{time(appointment.endsAt, appointment.location.timeZone)}</dd></div> : null}
        <div><dt>Recorded service price</dt><dd>{money(appointment.priceCents)}</dd></div>
        <div><dt>Location</dt><dd>{appointment.location.name}<Address value={appointment.location.address} /></dd></div>
      </dl>
      <p className="customer-fine-print">Times use the appointment location’s time zone: {appointment.location.timeZone}. The recorded price is not a payment receipt.</p>
      {appointment.status === 'reschedule_proposed' && appointment.proposedStartsAt ? <section className="customer-notice"><h3>The shop proposed another time</h3><p>{time(appointment.proposedStartsAt, appointment.location.timeZone)}{appointment.proposedEndsAt ? ` to ${time(appointment.proposedEndsAt, appointment.location.timeZone)}` : ''}</p><p>This proposed time is not confirmed. Contact the shop to respond.</p></section> : null}
      {appointment.customerNote ? <section><h3>Your appointment note</h3><p className="customer-record-note">{appointment.customerNote}</p></section> : null}
      {appointment.canDownloadCalendar ? <div className="customer-detail-action"><button className="button button-secondary" type="button" disabled={working || loading} onClick={() => void calendar()}>Download calendar event</button><p className="customer-fine-print">Adds a copy of this confirmed visit. It is not a live calendar subscription. Your calendar provider may store the event details.</p></div> : null}
      {appointment.canWithdraw ? <section className="customer-security-section"><h3>Don’t need this request?</h3><p>You can withdraw this unconfirmed website request or waitlist entry. This does not cancel a confirmed visit or a booking made with another provider.</p>
        {confirming ? <div className="customer-withdraw-confirm"><p id="withdraw-description">Withdraw this request? You’ll need to make a new request if you change your mind.</p><div className="customer-form-actions"><button className="button button-secondary" type="button" disabled={working || loading} onClick={() => { setConfirming(false); window.requestAnimationFrame(() => actionButton.current?.focus()); }}>Keep request</button><button className="button" type="button" aria-describedby="withdraw-description" disabled={working || loading} onClick={() => void withdraw()}>{working ? 'Withdrawing…' : 'Withdraw request'}</button></div></div>
          : <button ref={actionButton} className="button button-secondary" type="button" disabled={working || loading} onClick={() => setConfirming(true)}>Withdraw unconfirmed request</button>}
      </section> : null}
      <p>For appointment changes or questions, <a href={business.phoneHref}>call {business.phone}</a>. Booksy and Crowned by Steph bookings must be managed with that provider.</p>
    </div> : null}
    <button className="text-button" type="button" disabled={working || loading} onClick={refresh}>{appointment ? 'Refresh details' : 'Try again'}</button>
  </DetailFrame>;
}

export function CustomerOrderDetails({ id, onBack }: { id: string; onBack: () => void }) {
  const [order, setOrder] = useState<CustomerOrderDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void accountApi<{ order: CustomerOrderDetail }>(`/me/orders/${encodeURIComponent(id)}`)
      .then((data) => { if (active) { setOrder(data.order); setError(''); } })
      .catch((failure) => { if (active) setError(messageOf(failure)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, attempt]);
  return <DetailFrame kind="orders" onBack={onBack}>
    {loading ? <p role="status">Loading order…</p> : null}{error ? <p className="form-error" role="alert">{error}</p> : null}
    {order ? <div aria-busy={loading}><p className="customer-status">{label(order.status)}</p><h3>Order {order.id.slice(-8)}</h3><p>Placed {time(order.createdAt)} (Eastern) · {label(order.fulfillment)}</p>
      {order.items.length ? <ul className="customer-order-items">{order.items.map((item) => <li key={item.id}><div><h4>{item.productName}</h4><p>{item.variantName}</p></div><span>{item.quantity} × {money(item.unitPriceCents)}</span><strong>{money(item.quantity * item.unitPriceCents)}</strong></li>)}</ul>
        : <p>Item details are not available for this order. Contact the shop for help.</p>}
      {!order.itemsComplete ? <p className="customer-notice">Showing the first 100 line items. Contact the shop for the complete itemized record. Totals below cover the whole order.</p> : null}
      <dl className="customer-order-totals">{([['Subtotal', order.subtotalCents], ['Shipping', order.shippingCents], ['Tax', order.taxCents], ['Recorded total', order.totalCents]] as const).map(([name, amount]) => <div key={name}><dt>{name}</dt><dd>{money(amount)}</dd></div>)}</dl>
      <p className="customer-fine-print">These are the amounts saved with the order, not current product prices. This page does not process payments or refunds.</p>
      {order.fulfillment === 'shipping' ? <section><h3>Ship-to address</h3>{order.shippingAddress ? <Address value={order.shippingAddress} /> : <p>The recorded shipping address is unavailable. Contact the shop to check it.</p>}{order.trackingNumber ? <p className="customer-record-note">Tracking number: {order.trackingNumber}</p> : null}</section> : <p>Check the order status or contact the shop before collecting your order.</p>}
      <p>For order changes, payment questions, or refund requests, <a href={business.phoneHref}>call {business.phone}</a>.</p>
    </div> : null}
    <button className="text-button" type="button" disabled={loading} onClick={() => { setLoading(true); setError(''); setAttempt((value) => value + 1); }}>{order ? 'Refresh details' : 'Try again'}</button>
  </DetailFrame>;
}
