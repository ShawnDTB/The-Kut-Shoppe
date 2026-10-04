import { getBookingPath } from '../data/site';
import { ServiceIcon } from './ServiceIcon';

export function BookingGateway() {
  const loctician=getBookingPath('styling');
  return <section className="section booking-gateway-v3 booking-gateway-v4 booking-gateway-v6 platform-pattern platform-pattern-booking"><div className="container booking-gateway-v3-inner">
    <div className="booking-gateway-v3-heading booking-gateway-v4-heading"><h1>Who do you need?</h1></div>
    <div className="booking-gateway-v3-grid">
      <a className="booking-gateway-v3-card booking-gateway-v3-barber" href="/book?barber=any"><span className="booking-gateway-v3-icon"><ServiceIcon name="scissors" /></span><div><p className="eyebrow">Haircuts and grooming</p><h2>Barber</h2><p>Choose a service, barber, date, and available time.</p></div><strong>Book with a Barber <span aria-hidden="true">→</span></strong></a>
      <a className="booking-gateway-v3-card booking-gateway-v3-loctician" href={loctician.href} target="_blank" rel="noopener noreferrer"><span className="booking-gateway-v3-icon"><ServiceIcon name="locs" /></span><div><p className="eyebrow">Crowned by Steph</p><h2>Loctician</h2><p>Continue to Steph’s loc, braid, twist, and retwist availability.</p></div><strong>Book with the Loctician <span aria-hidden="true">↗</span></strong></a>
    </div>
  </div></section>;
}
