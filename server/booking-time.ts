import { ApiError } from './types';

export const MINUTE = 60_000;
export const DAY = 86_400_000;
export type Interval = { start: number; end: number };
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
function formatter(zone: string) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
  catch { throw new ApiError(409, 'The shop needs to review this schedule before it can accept requests.'); }
}
function parts(format: Intl.DateTimeFormat, instant: number) {
  const values = Object.fromEntries(format.formatToParts(instant).map(({ type, value }) => [type, value]));
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}
export function localDate(instant: number, zone: string) { return parts(formatter(zone), instant).date; }
// Resolve wall times explicitly instead of using the host machine's time zone.
// Missing DST wall times yield no window. Ambiguous boundaries shrink a window
// conservatively (latest opening / earliest closing), never invent extra hours.
export function wallWindow(date: string, start: string, end: string, zone: string): Interval | null {
  const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!validDate(date) || !clock.test(start) || !(clock.test(end) || end === '24:00') || end <= start) return null;
  const format = formatter(zone);
  const midnight = Date.parse(`${date}T00:00:00Z`);
  const offsets = new Set<number>();
  for (let delta = -36; delta <= 36; delta += 6) {
    const utc = midnight + delta * 3_600_000;
    const local = parts(format, utc);
    offsets.add(Date.parse(`${local.date}T${local.time}:00Z`) - utc);
  }
  const resolve = (time: string) => {
    const nextDate = time === '24:00' ? new Date(midnight + DAY).toISOString().slice(0, 10) : date;
    const clockTime = time === '24:00' ? '00:00' : time;
    const wall = Date.parse(`${nextDate}T${clockTime}:00Z`);
    return [...offsets].map((offset) => wall - offset).filter((instant) => {
      const local = parts(format, instant); return local.date === nextDate && local.time === clockTime;
    });
  };
  const starts = resolve(start); const ends = resolve(end);
  if (!starts.length || !ends.length) return null;
  const first = Math.max(...starts); const last = Math.min(...ends);
  return last > first ? { start: first, end: last } : null;
}
export function overlaps(a: Interval, b: Interval) { return a.start < b.end && a.end > b.start; }
export function mergeWindows(windows: Interval[]) {
  const merged: Interval[] = [];
  for (const window of windows.sort((a, b) => a.start - b.start)) {
    const previous = merged.at(-1);
    if (previous && window.start <= previous.end) previous.end = Math.max(previous.end, window.end);
    else merged.push({ ...window });
  }
  return merged;
}
