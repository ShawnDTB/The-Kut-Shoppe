import { getBookingPath } from '../data/site';
import { BookingV2 } from './BookingV2';

export function BookingGatewayV3() {
  const search = typeof window === 'undefined' ? '' : window.location.search;
  if (search) return <BookingV2 />;

  const loctician = getBookingPath('styling');

  return (
    <section className="section booking-gateway-v3 platform-pattern platform-pattern-booking">
      <div className="container booking-gateway-v3-inner">
        <div className="booking-gateway-v3-heading">
          <p className="eyebrow">Book now</p>
          <h1>Who do you need?</h1>
        </div>
        <div className="booking-gateway-v3-grid">
          <a className="booking-gateway-v3-card booking-gateway-v3-barber" href="/book?barber=any">
            <span className="booking-gateway-v3-icon" aria-hidden="true">✂</span>
            <div><p className="eyebrow">Haircuts and grooming</p><h2>Barber</h2><p>Choose a service, barber, date, and available time.</p></div>
            <strong>Book with a Barber <span aria-hidden="true">→</span></strong>
          </a>
          <a className="booking-gateway-v3-card booking-gateway-v3-loctician" href={loctician.href} target="_blank" rel="noopener noreferrer">
            <span className="booking-gateway-v3-icon" aria-hidden="true">CS</span>
            <div><p className="eyebrow">Crowned by Steph</p><h2>Loctician</h2><p>Continue to Steph’s loc, braid, twist, and retwist availability.</p></div>
            <strong>Book with the Loctician <span aria-hidden="true">↗</span></strong>
          </a>
        </div>
      </div>
    </section>
  );
}
