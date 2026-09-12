import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { accountApi, AccountApiError, getCustomerSession, subscribeToCustomerSession } from '../data/customer-api';
import { getBookingPath } from '../data/site';
import type { BookingAvailability, BookingOption } from '../shared/booking';
import { CustomerAccount } from './CustomerAccount';
import { ServiceIcon } from './ServiceIcon';

type Step = 'service' | 'barber' | 'schedule' | 'details' | 'complete';
type Opening = { availability: BookingAvailability; startsAt: string; endsAt: string };
const money = (value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value/100);
const clock = (value:string,zone:string)=>new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(value));
const dayLabel = (value:string)=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric'}).format(new Date(`${value}T12:00:00Z`));
const message = (error:unknown)=>error instanceof Error?error.message:'Please try again.';

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

export function RestoredBooking({onBack,onOpen}:{onBack:()=>void;onOpen:(id:string)=>void}) {
  const account=useSyncExternalStore(subscribeToCustomerSession,getCustomerSession,()=>null);
  const apiRoot=account?'/me/booking':'/booking';
  const [step,setStep]=useState<Step>('service');
  const [options,setOptions]=useState<BookingOption[]>([]);
  const [serviceId,setServiceId]=useState('');
  const [staffId,setStaffId]=useState('any');
  const [locationId,setLocationId]=useState('');
  const [week,setWeek]=useState(0);
  const [date,setDate]=useState('');
  const [matches,setMatches]=useState<BookingAvailability[]>([]);
  const [candidateTime,setCandidateTime]=useState('');
  const [chosen,setChosen]=useState<Opening|null>(null);
  const [note,setNote]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [checking,setChecking]=useState(false);
  const [saving,setSaving]=useState(false);
  const [uncertain,setUncertain]=useState(false);
  const [receipt,setReceipt]=useState('');
  const [attempt,setAttempt]=useState(0);
  const pending=useRef<Record<string,string>|null>(null);
  const sequence=useRef(0);
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus();},[step]);
  useEffect(()=>()=>{sequence.current++;},[]);
  useEffect(()=>{
    let active=true;
    void accountApi<{options:BookingOption[]}>(`${apiRoot}/options`).then(data=>{if(active)setOptions(data.options);}).catch(e=>{if(active)setError(message(e));}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[apiRoot,attempt]);
  const services=options.filter((item,index)=>options.findIndex(other=>other.serviceId===item.serviceId)===index);
  const professionals=options.filter(item=>item.serviceId===serviceId).filter((item,index,all)=>all.findIndex(other=>other.staffId===item.staffId)===index);
  const eligible=options.filter(item=>item.serviceId===serviceId&&(staffId==='any'||item.staffId===staffId));
  const locations=eligible.filter((item,index)=>eligible.findIndex(other=>other.locationId===item.locationId)===index);
  const selected=eligible.find(item=>item.locationId===locationId);
  const service=services.find(item=>item.serviceId===serviceId);
  const zone=selected?.timeZone??'America/New_York';
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const today=`${parts.find(p=>p.type==='year')!.value}-${parts.find(p=>p.type==='month')!.value}-${parts.find(p=>p.type==='day')!.value}`;
  const days=Array.from({length:7},(_,index)=>{const value=new Date(`${today}T12:00:00Z`);value.setUTCDate(value.getUTCDate()+week*7+index);return {key:value.toISOString().slice(0,10),day:value.getUTCDate(),weekday:new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short'}).format(value),month:new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short'}).format(value)};});
  const openings:Opening[]=matches.flatMap(availability=>availability.slots.map(slot=>({...slot,availability}))).sort((a,b)=>a.startsAt.localeCompare(b.startsAt)||a.availability.option.professionalName.localeCompare(b.availability.option.professionalName));
  const times=[...new Set(openings.map(slot=>slot.startsAt))];
  const resetTimes=()=>{sequence.current++;setChecking(false);setMatches([]);setCandidateTime('');setChosen(null);setDate('');setError('');pending.current=null;};
  const selectService=(item:BookingOption)=>{resetTimes();setServiceId(item.serviceId);setWeek(0);const preferred=new URLSearchParams(window.location.search).get('barber');const choices=options.filter(other=>other.serviceId===item.serviceId&&other.staffId===preferred);if(choices.length){setStaffId(preferred!);setLocationId(choices.length===1?choices[0]!.locationId:'');setStep('schedule');}else{setStaffId('any');setLocationId('');setStep('barber');}};
  const selectBarber=(id:string)=>{resetTimes();setStaffId(id);const available=options.filter(item=>item.serviceId===serviceId&&(id==='any'||item.staffId===id));const ids=[...new Set(available.map(item=>item.locationId))];setLocationId(ids.length===1?ids[0]!: '');setStep('schedule');};
  const loadDay=async(value:string)=>{
    if(!selected||saving||uncertain)return;
    const ticket=++sequence.current;setDate(value);setMatches([]);setCandidateTime('');setChosen(null);setError('');setChecking(true);pending.current=null;
    const results=await Promise.allSettled(eligible.filter(item=>item.locationId===locationId).map(item=>accountApi<BookingAvailability>(`${apiRoot}/availability?${new URLSearchParams({serviceId:item.serviceId,staffId:item.staffId,locationId:item.locationId,date:value})}`)));
    if(ticket!==sequence.current)return;
    const available=results.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);setMatches(available);setChecking(false);
    if(results.some(result=>result.status==='rejected'))setError(available.length?'Some barbers could not be checked. Showing the available results.':'Availability could not be loaded for this date. Try again or choose another date.');
  };
  const selectOpening=(opening:Opening)=>{setChosen(opening);setCandidateTime('');setStep('details');};
  const back=()=>{if(saving||uncertain)return;if(step==='service')onBack();else if(step==='barber')setStep('service');else if(step==='schedule'){resetTimes();setStep('barber');}else if(step==='details')setStep('schedule');};
  const submit=async()=>{
    if(!account||!chosen||saving)return;setSaving(true);setError('');
    const {option,quote}=chosen.availability;
    pending.current??={staffId:option.staffId,serviceId:option.serviceId,locationId:option.locationId,date:chosen.availability.date,startsAt:chosen.startsAt,note,quote,requestKey:crypto.randomUUID()};
    try{const result=await accountApi<{appointmentId:string}>('/me/booking/requests',pending.current);setReceipt(result.appointmentId);setUncertain(false);setStep('complete');}
    catch(e){setError(message(e));const unknown=!(e instanceof AccountApiError)||e.status===0||e.status>=500;setUncertain(unknown);if(!unknown){pending.current=null;setChosen(null);setMatches([]);setStep('schedule');}}
    finally{setSaving(false);}
  };
  const steps:Step[]=['service','barber','schedule','details'];
  return <section className="section booking-v2-page booking-v4-page booking-v5-page booking-v6-page platform-pattern platform-pattern-booking"><div className="container route-wide">
    <h1 className="sr-only">Book a Barber appointment</h1>
    <ol className="booking-v2-progress booking-v4-progress" aria-label="Booking progress">{steps.map((value,index)=><li key={value} aria-current={step===value?'step':undefined} className={step===value?'is-current':step==='complete'||index<steps.indexOf(step)?'is-complete':''}><span>{index+1}</span><small>{['Service','Barber','Appointment','Details'][index]}</small></li>)}</ol>
    {step!=='complete'?<section className={`booking-v2-panel booking-v4-panel${step==='schedule'?' booking-v4-schedule':''}`} aria-busy={loading||checking||saving}>
      <div className="booking-v5-panel-toolbar"><button className="text-button" disabled={saving||uncertain} onClick={back}>← Back</button><a className="text-link" href={getBookingPath('styling').href} target="_blank" rel="noopener noreferrer">Book with the Loctician ↗</a></div>
      <div className="booking-v2-panel-heading"><h2 ref={heading} tabIndex={-1}>{step==='service'?'Choose a service':step==='barber'?'Choose your Barber':step==='schedule'?'Choose a date and time':'Review your appointment'}</h2>{service&&step!=='service'?<p>{service.serviceName}{step==='schedule'?` with ${staffId==='any'?'any available Barber':professionals.find(item=>item.staffId===staffId)?.professionalName??'your Barber'}`:''}.</p>:null}</div>
      {error?<p role="alert" className="form-error">{error}</p>:null}
      {loading?<p role="status">Loading services…</p>:!options.length?<><p>No website appointment options are available right now.</p><a className="button" href={getBookingPath('barber').href}>Continue to Booksy</a><button className="text-button" onClick={()=>{setLoading(true);setError('');setAttempt(value=>value+1);}}>Try again</button></>:null}
      {step==='service'?<div className="booking-v2-service-list">{services.map(item=>{const choices=options.filter(other=>other.serviceId===item.serviceId);return <button key={item.serviceId} onClick={()=>selectService(item)}><span><small>Barber services</small><strong>{item.serviceName}</strong></span><span><strong>From {money(Math.min(...choices.map(other=>other.priceCents)))}</strong><small>{Math.min(...choices.map(other=>other.durationMinutes))} min{new Set(choices.map(other=>other.durationMinutes)).size>1?' and up':''}</small></span></button>;})}</div>:null}
      {step==='barber'?<div className="booking-v2-barber-grid"><button onClick={()=>selectBarber('any')}><strong>Any available Barber</strong><span>Compare every eligible chair for the selected opening.</span></button>{professionals.map(item=><button key={item.staffId} onClick={()=>selectBarber(item.staffId)}><strong>{item.professionalName}</strong><span>Uses published availability · from {money(Math.min(...options.filter(other=>other.serviceId===serviceId&&other.staffId===item.staffId).map(other=>other.priceCents)))}</span></button>)}</div>:null}
      {step==='schedule'?<>
        {locations.length>1?<label>Location<select value={locationId} onChange={event=>{resetTimes();setLocationId(event.target.value);setWeek(0);}}><option value="">Choose a location</option>{locations.map(item=><option key={item.locationId} value={item.locationId}>{item.locationName}</option>)}</select></label>:null}
        {selected?<><p className="booking-v6-timezone">{selected.locationName} · Times use {zone}. Each Barber’s booking window and minimum notice apply.</p><div className="booking-v4-calendar"><div className="booking-v4-calendar-toolbar"><button disabled={week===0} aria-label="Previous week" onClick={()=>{resetTimes();setWeek(value=>value-1);}}>←</button><strong>{days[0]!.month} {days[0]!.day} – {days[6]!.month} {days[6]!.day}</strong><button disabled={week>=12} aria-label="Next week" onClick={()=>{resetTimes();setWeek(value=>value+1);}}>→</button></div>
          <div className="booking-v4-week" role="group" aria-label="Appointment week">{days.map(day=><button key={day.key} className={date===day.key?'is-selected':''} aria-pressed={date===day.key} aria-label={dayLabel(day.key)} onClick={()=>void loadDay(day.key)}><small>{day.key===today?'Today':day.weekday}</small><strong>{day.day}</strong><span>{day.month}</span><em>{date===day.key?checking?'Checking':error?'Retry':times.length?'Open':'Full':'View times'}</em></button>)}</div></div>
          {date?<div className="booking-v2-times booking-v4-times"><h3>{dayLabel(date)}</h3>{checking?<p role="status">Checking available times…</p>:times.length?<div>{times.map(value=><button key={value} onClick={()=>{const choices=openings.filter(item=>item.startsAt===value);if(choices.length===1)selectOpening(choices[0]!);else setCandidateTime(value);}}>{clock(value,zone)}</button>)}</div>:<div className="booking-v2-no-times"><strong>{error?'Availability could not be confirmed.':'No openings match this selection.'}</strong><p>Choose another day or Barber, or check this date again.</p><button className="text-button" onClick={()=>void loadDay(date)}>Refresh times</button></div>}</div>:<p className="booking-v2-prompt">Choose a day to view available appointment times.</p>}
          {candidateTime?<div className="booking-v5-candidate-picker"><p className="eyebrow">Multiple chairs are open at {clock(candidateTime,zone)}</p><h3>Choose the Barber for this opening</h3><div>{openings.filter(item=>item.startsAt===candidateTime).map(item=><button key={item.availability.option.staffId} onClick={()=>selectOpening(item)}><strong>{item.availability.option.professionalName}</strong><span>{money(item.availability.option.priceCents)} · {item.availability.option.durationMinutes} minutes</span></button>)}</div></div>:null}
        </>:null}
      </>:null}
      {step==='details'&&chosen?<><div className="booking-v2-review"><div><small>Service</small><strong>{chosen.availability.option.serviceName}</strong></div><div><small>Barber</small><strong>{chosen.availability.option.professionalName}</strong></div><div><small>Date</small><strong>{dayLabel(chosen.availability.date)}</strong></div><div><small>Time</small><strong>{clock(chosen.startsAt,zone)} – {clock(chosen.endsAt,zone)}</strong></div><div><small>Price</small><strong>{money(chosen.availability.option.priceCents)}</strong></div></div>
        {account?<div className="booking-v2-fields booking-v4-fields"><label>Name<input readOnly value={account.profile.name}/></label><label>Email<input readOnly value={account.email}/></label><label>Mobile phone<input readOnly value={account.profile.phone}/></label><p><a href="/account?view=profile" target="_blank" rel="noopener noreferrer">Update your profile</a></p></div>:<div className="customer-booking-signin"><h3>Sign in or create an account</h3><p>Your selection stays here while you verify your email.</p><CustomerAccount/></div>}
        <div className="booking-v2-fields booking-v4-fields"><label className="booking-v2-wide">Note for the Barber (optional)<textarea rows={4} maxLength={500} disabled={saving||uncertain} value={note} onChange={event=>setNote(event.target.value)}/></label></div>
        <p className="booking-v2-disclaimer">Submitting sends a request to the shop. It is not confirmed until the assigned Barber or shop approves it. No payment is collected here. Availability is checked again when you submit.</p>
        {uncertain?<p role="alert">We could not confirm whether your request saved. Retry the same request below, or check your appointments before starting another.</p>:null}
        <div className="booking-v2-submit-row"><button className="button" disabled={!account||saving} onClick={()=>void submit()}>{saving?'Sending request…':uncertain?'Retry same request':'Request appointment'}</button></div>
      </>:null}
    </section>:<section className="booking-v2-confirmation booking-v5-confirmation"><p className="eyebrow">Request received</p><h2 ref={heading} tabIndex={-1}>Your appointment request was sent.</h2><p>The appointment is pending until the assigned Barber or shop confirms it.</p>{chosen?<dl><div><dt>Service</dt><dd>{chosen.availability.option.serviceName}</dd></div><div><dt>Barber</dt><dd>{chosen.availability.option.professionalName}</dd></div><div><dt>Date</dt><dd>{dayLabel(chosen.availability.date)}</dd></div><div><dt>Time</dt><dd>{clock(chosen.startsAt,chosen.availability.option.timeZone)}</dd></div></dl>:null}<div className="booking-v2-complete-actions"><button className="button" onClick={()=>onOpen(receipt)}>Manage appointment</button><a className="button button-secondary" href="/book">Back to booking</a></div></section>}
  </div></section>;
}
