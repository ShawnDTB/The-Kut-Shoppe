import { bookingPaths, business } from '../data/site';
import '../launch-placeholder.css';

export function LaunchPlaceholder({ kind }: { kind: 'booking' | 'shop' | 'account' }) {
  const booking = kind === 'booking';
  return <section className="launch-page" aria-labelledby="launch-title">
    <div className="container launch-inner">
      <div className="launch-art" aria-hidden="true"><span className="launch-spark spark-one">✦</span><div className="launch-pole"><div /></div><span className="launch-spark spark-two">✧</span><span className="launch-tag">Finishing touches</span></div>
      <p className="eyebrow">{booking ? 'A smoother way to book' : kind === 'shop' ? 'The Kut Shoppe · Online shop' : 'Your future Kut Shoppe account'}</p>
      <h1 id="launch-title">{booking ? 'A little trim. A fresh start.' : kind === 'shop' ? 'Good things are on the shelf.' : 'Your own little corner of the shop.'}</h1>
      <p className="launch-intro">{booking ? 'Our new booking experience is getting its finishing touches. Your next fresh cut doesn’t have to wait.' : kind === 'shop' ? 'We’re getting our online shop ready for its debut. Until then, call or stop by to ask about products.' : 'Appointments, account settings, and more—all together. We’re getting everything ready before opening sign-ups.'}</p>
      <p className="launch-status"><span aria-hidden="true" />{booking ? 'New website booking under construction' : kind === 'shop' ? 'Online shopping under construction' : 'Accounts coming soon'}</p>
      {booking ? <div className="launch-providers">{bookingPaths.map(provider => <a key={provider.id} className="launch-provider" href={provider.href} target="_blank" rel="noopener noreferrer"><strong>{provider.title}<span aria-hidden="true">↗</span></strong><span>{provider.type === 'barber' ? 'Haircuts, fades & beard care' : 'Locs, braids & styling with Steph'}</span><small>Continue to {provider.provider} · opens a new tab</small></a>)}</div> : <div className="launch-actions"><a className="button" href={kind === 'shop' ? business.phoneHref : '/book'}>{kind === 'shop' ? 'Call about products' : 'Book a visit'}</a><a className="button button-secondary" href="/visit">Visit the shop</a></div>}
      <p className="launch-help">{booking ? 'Prefer a familiar voice? ' : 'Need a hand? '}<a href={business.phoneHref}>Call {business.phone}</a></p>
      <a className="launch-back" href="/">← Back to the shop’s homepage</a>
    </div>
  </section>;
}
