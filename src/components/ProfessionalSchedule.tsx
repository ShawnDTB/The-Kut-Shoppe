import { useEffect, useState } from 'react';
import { accountApi } from '../data/customer-api';
import { StaffAuthenticator } from './StaffAuthenticator';
import type { SchedulePage } from '../shared/professional-schedule';
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function ScheduleEditor() {
  const [page, setPage] = useState<SchedulePage | null>(null); const [attempt, setAttempt] = useState(0);
  const [location, setLocation] = useState(''); const [weekday, setWeekday] = useState(1); const [date, setDate] = useState('');
  const [start, setStart] = useState('09:00'); const [end, setEnd] = useState('17:00'); const [mode, setMode] = useState<'add_hours' | 'add_time_off'>('add_hours');
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [working, setWorking] = useState(false);
  useEffect(() => {
    let active = true;
    void accountApi<SchedulePage>('/me/professional/schedule').then((data) => { if (active) { setPage(data); setLocation((previous) => data.locations.some((item) => item.id === previous) ? previous : data.locations[0]?.id ?? ''); setError(''); } })
      .catch((failure: unknown) => { if (active) { setPage(null); setError(failure instanceof Error ? failure.message : 'Please try again.'); } });
    return () => { active = false; };
  }, [attempt]);
  const change = async (body: Record<string, unknown>) => {
    if (!page || working) return; setWorking(true); setError(''); setNotice('');
    try {
      const result = await accountApi<{ message: string }>('/me/professional/schedule', { ...body, revision: page.revision });
      setNotice(result.message); setPage(null); setAttempt((value) => value + 1);
    } catch (failure) { setError(`${failure instanceof Error ? failure.message : 'Please try again.'} Reload the schedule to check its saved state.`); }
    finally { setWorking(false); }
  };
  return <section aria-busy={working}><h2>Your availability</h2><p>Weekly windows offer appointment times at your approved locations. Time off blocks your availability at every location. Existing appointments and their cleanup allowance must remain protected.</p>
    {error ? <p role="alert" className="form-error">{error}</p> : null}{notice ? <p role="status" className="customer-notice">{notice}</p> : null}
    {page ? <><h3>Weekly hours</h3><ul className="customer-records">{page.hours.map((item) => <li key={item.id}><div><strong>{days[item.weekday]} · {item.startTime}–{item.endTime}</strong><p>{page.locations.find((entry) => entry.id === item.locationId)?.name ?? 'Location needs review'}</p></div><button className="button button-secondary" disabled={working} onClick={() => void change({ action: 'remove_hours', id: item.id })}>Remove hours</button></li>)}</ul>{!page.hours.length ? <p>No weekly hours are set.</p> : null}
      <h3>Upcoming time off</h3><ul className="customer-records">{page.timeOff.map((item) => <li key={item.id}><div><p>{new Date(item.startsAt).toLocaleString()} to {new Date(item.endsAt).toLocaleString()} (your device’s time zone)</p></div>{item.canRemove ? <button className="button button-secondary" disabled={working} onClick={() => void change({ action: 'remove_time_off', id: item.id })}>Remove time off</button> : <p>Contact the shop to change this entry.</p>}</li>)}</ul>{!page.timeOff.length ? <p>No upcoming time off is recorded.</p> : null}
      <form className="customer-form" onSubmit={(event) => { event.preventDefault(); void change({ action: mode, locationId: location, startTime: start, endTime: end, ...(mode === 'add_hours' ? { weekday } : { date }) }); }}><fieldset disabled={working || !page.locations.length}><legend>Add availability or time off</legend>
        <label>Change<select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="add_hours">Weekly working hours</option><option value="add_time_off">Time off on one date</option></select></label>
        <label>Location and time zone<select required value={location} onChange={(event) => setLocation(event.target.value)}>{page.locations.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.timeZone})</option>)}</select></label>
        {mode === 'add_hours' ? <label>Weekday<select value={weekday} onChange={(event) => setWeekday(Number(event.target.value))}>{days.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label> : <label>Date<input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></label>}
        <label>Start<input type="time" required value={start} onChange={(event) => setStart(event.target.value)} /></label><label>End<input type="time" required value={end} onChange={(event) => setEnd(event.target.value)} /></label>
        <p>Enter times in the selected location’s time zone, within one day. For longer time off, add each date separately. Clock-change dates and schedules across different time zones need shop review.</p><button className="button">{mode === 'add_hours' ? 'Add weekly hours' : 'Add time off'}</button>
      </fieldset></form></> : !error ? <p role="status">Loading schedule…</p> : null}
    <button className="text-button" disabled={working} onClick={() => { setPage(null); setAttempt((value) => value + 1); }}>Reload schedule</button>
  </section>;
}
export function ProfessionalSchedule() { return <StaffAuthenticator><ScheduleEditor /></StaffAuthenticator>; }
