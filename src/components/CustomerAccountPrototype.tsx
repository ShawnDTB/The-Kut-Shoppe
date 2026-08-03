import { useEffect, useMemo, useState } from 'react';
import { readAppointments, type PlatformAppointment } from '../data/platform';
import { business, getBookingPath } from '../data/site';
import { originalAssets } from '../data/visuals';

function formatDate(dateKey: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${dateKey}T12:00:00`));
}

export function CustomerAccountPrototype() {
  const [appointments, setAppointments] = useState<PlatformAppointment[]>([]);
  const loctician = getBookingPath('styling');

  useEffect(() => {
    setAppointments(readAppointments());
  }, []);

  const upcoming = useMemo(
    () => appointments.filter((appointment) => appointment.status === 'confirmed'),
    [appointments],
  );

  return (
    <section className="section account-app-page">
      <div className="container route-wide">
        <header className="account-app-header">
          <div>
            <p className="eyebrow">Customer account</p>
            <h1>Your appointments and orders in one place.</h1>
            <p className="lede">
              This feature branch connects internal barber appointments to the customer account. Product orders will join the same account through the commerce branch.
            </p>
          </div>
          <div className="account-app-profile-card">
            <img src={originalAssets.logo} alt="" width="72" height="72" />
            <div><small>Prototype account</small><strong>Local browser session</strong></div>
            <span>Not signed in</span>
          </div>
        </header>

        <nav className="account-app-nav" aria-label="Customer account sections">
          <a href="#appointments">Appointments</a>
          <a href="#orders">Orders</a>
          <a href="#details">Saved details</a>
        </nav>

        <div className="account-app-grid">
          <main>
            <section className="account-app-panel" id="appointments" aria-labelledby="account-appointments-heading">
              <div className="account-panel-heading">
                <div>
                  <p className="eyebrow">Barber appointments</p>
                  <h2 id="account-appointments-heading">Upcoming appointments</h2>
                </div>
                <a className="button" href="/book">Book an appointment</a>
              </div>

              {upcoming.length ? (
                <div className="account-appointment-list">
                  {upcoming.map((appointment) => (
                    <article key={appointment.id}>
                      <time>
                        <strong>{formatDate(appointment.date)}</strong>
                        <span>{appointment.time}</span>
                      </time>
                      <div>
                        <p className="eyebrow">{appointment.barberName}</p>
                        <h3>{appointment.serviceName}</h3>
                        <p>{appointment.durationMinutes} minutes · {appointment.price}</p>
                      </div>
                      <span className="account-status">{appointment.status}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="account-empty-state">
                  <h3>No barber appointments yet.</h3>
                  <p>Test appointments confirmed through the internal booking flow will appear here.</p>
                </div>
              )}

              <div className="account-external-appointments">
                <div>
                  <p className="eyebrow">Loctician appointments</p>
                  <h3>Managed by Crowned by Steph</h3>
                  <p>Loc, braid, twist, and retwist appointments remain in Steph’s external booking account.</p>
                </div>
                <a className="button button-secondary" href={loctician.href} target="_blank" rel="noopener noreferrer">
                  Manage with Steph <span aria-hidden="true">↗</span>
                </a>
              </div>
            </section>

            <section className="account-app-panel" id="orders" aria-labelledby="account-orders-heading">
              <div className="account-panel-heading">
                <div>
                  <p className="eyebrow">Shop orders</p>
                  <h2 id="account-orders-heading">Orders and pickup</h2>
                </div>
                <a className="button button-secondary" href="/shop">Browse the shop</a>
              </div>
              <div className="account-empty-state">
                <h3>No product orders yet.</h3>
                <p>The commerce branch will add cart, checkout, shipping, pickup, receipts, and order history to this account.</p>
              </div>
            </section>

            <section className="account-app-panel" id="details" aria-labelledby="account-details-heading">
              <div className="account-panel-heading">
                <div>
                  <p className="eyebrow">Saved details</p>
                  <h2 id="account-details-heading">Contact and fulfillment preferences</h2>
                </div>
              </div>
              <div className="account-detail-grid">
                <article><small>Contact</small><strong>Added during secure account registration</strong><p>Name, email, and phone will be editable by the customer.</p></article>
                <article><small>Pickup</small><strong>{business.address}</strong><p>Pickup instructions will appear with eligible orders.</p></article>
                <article><small>Shipping</small><strong>No address stored</strong><p>Addresses will be optional and encrypted or tokenized where appropriate.</p></article>
              </div>
            </section>
          </main>

          <aside className="account-app-sidebar">
            <section>
              <p className="eyebrow">Account security</p>
              <h2>Authentication comes next.</h2>
              <p>The production platform will replace this local browser session with secure sign-in, account recovery, session management, and audit logs.</p>
              <button className="button" type="button" disabled>Sign in when platform core is ready</button>
            </section>
            <section>
              <p className="eyebrow">Need help?</p>
              <p>Call the shop for appointment guidance or questions about current in-store products.</p>
              <a href={business.phoneHref}>Call {business.phone}</a>
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
}
