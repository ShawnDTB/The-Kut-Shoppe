import { createHash } from 'node:crypto';
import type { CustomerAppointmentDetail } from '../src/shared/customer';
import { ApiError } from './types';

// RFC 5545 TEXT escaping prevents a stored label from injecting properties or
// additional events. Fold by UTF-8 octets without splitting a Unicode character.
function textValue(value: string) {
  return value.replaceAll('\\', '\\\\').replace(/\r\n|\r|\n/g, '\\n').replaceAll(';', '\\;').replaceAll(',', '\\,')
    .split('').filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127).join('');
}
function fold(line: string) {
  let result = ''; let width = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character, 'utf8');
    if (width + size > 75) { result += '\r\n '; width = 1; }
    result += character; width += size;
  }
  return result;
}
function dateValue(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1000 || date.getUTCFullYear() > 9999) {
    throw new ApiError(409, 'This appointment does not have a valid calendar time.');
  }
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
export function appointmentCalendar(appointment: CustomerAppointmentDetail) {
  if (!appointment.canDownloadCalendar || !appointment.startsAt || !appointment.endsAt) {
    throw new ApiError(409, 'Calendar downloads are available only for confirmed appointments with a set start and end time.');
  }
  const address = appointment.location.address;
  const uid = createHash('sha256').update(`kut-shoppe-appointment:${appointment.id}`).digest('hex');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The Kut Shoppe//Customer Appointments//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${uid}@thekutshoppe.com`, `DTSTAMP:${dateValue(new Date().toISOString())}`,
    `LAST-MODIFIED:${dateValue(appointment.updatedAt)}`, `SEQUENCE:${appointment.changeVersion ?? 0}`,
    `DTSTART:${dateValue(appointment.startsAt)}`, `DTEND:${dateValue(appointment.endsAt)}`,
    `SUMMARY:${textValue(`${appointment.serviceName} at ${appointment.location.name}`)}`,
    `LOCATION:${textValue([address.line1, address.line2, `${address.city}, ${address.state} ${address.postalCode}`].filter(Boolean).join(', '))}`,
    'DESCRIPTION:Check your Kut Shoppe account for changes. This downloaded calendar copy does not update automatically.',
    'STATUS:CONFIRMED', 'CLASS:PRIVATE', 'TRANSP:OPAQUE', 'END:VEVENT', 'END:VCALENDAR',
  ].map(fold).join('\r\n') + '\r\n';
}
