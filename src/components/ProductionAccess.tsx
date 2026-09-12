import { bookingPaths, business } from '../data/site';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { accountApi } from '../data/customer-api';
import type { AccountConfig } from '../shared/customer';
import { BookingGateway, RestoredBooking } from './RestoredBooking';

const subscribeRoute=(listener:()=>void)=>{window.addEventListener('popstate',listener);return()=>window.removeEventListener('popstate',listener);};
export function ProductionBooking() {
  const [native, setNative] = useState<boolean|null>(null);
  const address=useSyncExternalStore(subscribeRoute,()=>window.location.href,()=>'https://www.thekutshoppe.com/book');
  const url=new URL(address);const query=url.searchParams;const editing=query.get('appointment')??'';
  const entry=url.pathname.replace(/\/$/,'')==='/book/walk-in'?'walk-in':query.get('type')==='loctician'?'loctician':query.has('barber')||query.has('service')||query.has('type')||query.has('appointment')?'barber':'gateway';
  useEffect(() => {
    let active = true;
    void accountApi<AccountConfig>('/config').then(config=>{if(active)setNative(config.enabled&&Boolean(config.bookingEnabled));}).catch(()=>{if(active)setNative(false);});
    return()=>{active=false;};
  },[]);
  if(entry==='gateway')return <BookingGateway/>;
  if(editing)return <section className="section customer-account"><div className="container"><h1>Change your appointment</h1><p>Your existing appointment has not changed. Online changes remain unavailable.</p><a className="button" href={`/account?view=appointments&record=${encodeURIComponent(editing)}`}>Open existing appointment</a><p><a href={business.phoneHref}>Call {business.phone}</a> to arrange a change.</p></div></section>;
  if(entry==='barber'&&native===null)return <section className="section"><div className="container"><p role="status">Opening Barber booking…</p></div></section>;
  if(entry==='barber'&&native)return <RestoredBooking onBack={()=>window.location.assign('/book')} onOpen={id=>window.location.assign(`/account?view=appointments&record=${encodeURIComponent(id)}`)}/>;
  const providers=bookingPaths.filter(path=>entry==='loctician'?path.id==='styling':entry==='barber'?path.id==='barber':true);
  return <section className="section booking-v2-page booking-v4-page platform-pattern platform-pattern-booking"><div className="container narrow-container"><div className="booking-v2-panel booking-v4-panel"><a className="text-link" href="/book">← Back</a><h1>{entry==='loctician'?'Continue with Crowned by Steph.':'Book your next visit'}</h1>{providers.map(path=><article key={path.id}><h2>{path.title}</h2><p>{path.description}</p><a className="button" href={path.href} target="_blank" rel="noopener noreferrer">Continue to {path.provider}</a></article>)}<p>Questions or looking for a walk-in? <a href={business.phoneHref}>Call {business.phone}</a>.</p></div></div></section>;
}
