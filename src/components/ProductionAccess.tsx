import { bookingPaths, business } from '../data/site';
import { useEffect, useState } from 'react';
import { accountApi } from '../data/customer-api';
import type { AccountConfig } from '../shared/customer';
import { CustomerAccount } from './CustomerAccount';

export function ProductionBooking() {
  const [native, setNative] = useState(false);
  useEffect(() => {
    let active = true;
    void accountApi<AccountConfig>('/config').then((config) => { if (active) setNative(config.enabled && Boolean(config.bookingEnabled)); }).catch(() => { /* Provider links remain usable when the account service is unavailable. */ });
    return () => { active = false; };
  }, []);
  if (native && window.location.pathname.replace(/\/$/, '') === '/book') return <CustomerAccount />;
  return <section className="section customer-account"><div className="container narrow-container"><header><h1>Book your next visit</h1><p>Choose your professional to see current availability and book directly.</p></header><div className="customer-booking-options">{bookingPaths.map((path) => <article key={path.id}><h2>{path.title}</h2><p>{path.description}</p><a className="button" href={path.href} rel="noopener noreferrer">Continue to {path.provider}</a></article>)}</div><p>Questions or looking for a walk-in? <a href={business.phoneHref}>Call {business.phone}</a>.</p></div></section>;
}

export function ProductionShop() {
  return <section className="section customer-account"><div className="container narrow-container"><h1>Shop at The Kut Shoppe</h1><p>For current products, pricing, and pickup availability, contact the shop. Online ordering is not open yet.</p><a className="button" href={business.phoneHref}>Call {business.phone}</a><p><a href="/visit">Plan your visit</a></p></div></section>;
}
