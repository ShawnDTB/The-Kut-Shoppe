import { isValidEmail, isValidPhone, normalizeEmail, normalizePhone } from './auth';
import { queueNotification, subscribeToPlatformChanges } from './notifications';
import { business, services, team } from './site';

export type StaffRole = 'barber' | 'manager' | 'owner';
export type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type AppointmentStatus =
  | 'requested'
  | 'confirmed'
  | 'reschedule-proposed'
  | 'waitlisted'
  | 'declined'
  | 'cancelled'
  | 'completed'
  | 'no-show';
export type AppointmentSource = 'website' | 'walk-in' | 'staff';
export type AppointmentClientResponse = 'pending' | 'accepted' | 'rejected' | null;

export interface WeeklyWindow {
  day: DayKey;
  label: string;
  enabled: boolean;
  start: string;
  end: string;
}

export interface StaffProfile {
  id: string;
  professionalName: string;
  email: string;
  phone: string;
  publicBio: string;
  role: StaffRole;
  locationName: string;
  locationAddress: string;
  serviceIds: string[];
  schedule: WeeklyWindow[];
  bookingRules: {
    bufferMinutes: number;
    minimumNoticeHours: number;
    bookingWindowDays: number;
    acceptsNewClients: boolean;
    allowAnyAvailable: boolean;
    acceptsWalkIns: boolean;
  };
  payoutProfile: {
    mode: 'manual-ledger';
    frequency: 'weekly' | 'biweekly' | 'monthly';
    relationshipStatus: 'pending-admin-review';
    destinationStatus: 'not-connected';
  };
  setupComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformAppointment {
  id: string;
  serviceId: string;
  serviceName: string;
  price: string;
  priceCents: number;
  durationMinutes: number;
  requestedBarberId: string;
  assignedBarberId: string | null;
  barberName: string;
  date: string;
  time: string;
  startMinutes: number;
  endMinutes: number;
  proposedDate: string | null;
  proposedTime: string | null;
  proposedStartMinutes: number | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  phoneVerified: boolean;
  accountPreference: 'guest' | 'account';
  source: AppointmentSource;
  status: AppointmentStatus;
  clientResponse: AppointmentClientResponse;
  customerNote: string;
  staffNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface BarberServiceOption {
  id: string;
  category: string;
  name: string;
  price: string;
  priceCents: number;
  durationMinutes: number;
}

export interface BarberDirectoryEntry {
  id: string;
  name: string;
  shortName: string;
  photo: string | null;
  profile: StaffProfile | null;
}

export interface TimeSlot {
  label: string;
  startMinutes: number;
  endMinutes: number;
}

const dayLabels: Record<DayKey, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export const defaultWeeklySchedule: WeeklyWindow[] = [
  { day: 'monday', label: dayLabels.monday, enabled: true, start: '10:00', end: '16:00' },
  { day: 'tuesday', label: dayLabels.tuesday, enabled: true, start: '10:00', end: '18:00' },
  { day: 'wednesday', label: dayLabels.wednesday, enabled: true, start: '10:00', end: '18:00' },
  { day: 'thursday', label: dayLabels.thursday, enabled: true, start: '10:00', end: '19:00' },
  { day: 'friday', label: dayLabels.friday, enabled: true, start: '10:00', end: '19:00' },
  { day: 'saturday', label: dayLabels.saturday, enabled: true, start: '10:00', end: '18:00' },
  { day: 'sunday', label: dayLabels.sunday, enabled: false, start: '10:00', end: '16:00' },
];

function durationToMinutes(duration: string) {
  const hours = Number.parseFloat(duration);
  return Number.isFinite(hours) ? Math.round(hours * 60) : 60;
}

function priceToCents(price: string) {
  const value = Number.parseFloat(price.replace(/[^0-9.]/g, ''));
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const serviceMap = new Map<string, BarberServiceOption>();

for (const category of services.filter((item) => item.bookingType === 'barber')) {
  for (const item of category.prices) {
    const id = slugify(item.name);
    if (!serviceMap.has(id)) {
      serviceMap.set(id, {
        id,
        category: category.title,
        name: item.name,
        price: item.price,
        priceCents: priceToCents(item.price),
        durationMinutes: durationToMinutes(item.duration),
      });
    }
  }
}

export const barberServiceOptions = Array.from(serviceMap.values()).sort((a, b) => (
  a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
));

const baseBarberDirectory = team
  .filter((member) => member.bookingType === 'barber')
  .map((member) => ({
    id: slugify(member.shortName),
    name: member.name,
    shortName: member.shortName,
    photo: member.photo,
  }));

export const primaryLocation = {
  id: 'main-street',
  name: business.name,
  address: business.address,
};

export const platformStorageKeys = {
  staffProfiles: 'kut-shoppe.staff-profiles.v2',
  appointments: 'kut-shoppe.appointments.v2',
} as const;

const blockingStatuses = new Set<AppointmentStatus>([
  'requested',
  'confirmed',
  'reschedule-proposed',
]);

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('kut-shoppe-platform-change'));
}

export function readStaffProfiles() {
  return readJson<StaffProfile[]>(platformStorageKeys.staffProfiles, []).map((profile) => ({
    ...profile,
    publicBio: profile.publicBio ?? '',
    bookingRules: {
      ...profile.bookingRules,
      acceptsWalkIns: profile.bookingRules.acceptsWalkIns ?? true,
    },
    createdAt: profile.createdAt ?? profile.updatedAt ?? new Date().toISOString(),
  }));
}

export function saveStaffProfile(profile: StaffProfile) {
  const profiles = readStaffProfiles();
  const next = [...profiles.filter((item) => item.id !== profile.id), profile]
    .sort((a, b) => a.professionalName.localeCompare(b.professionalName));
  writeJson(platformStorageKeys.staffProfiles, next);
  return next;
}

export function deleteStaffProfile(profileId: string) {
  const next = readStaffProfiles().filter((profile) => profile.id !== profileId);
  writeJson(platformStorageKeys.staffProfiles, next);
  return next;
}

export function createStaffProfileDraft(): StaffProfile {
  const now = new Date().toISOString();
  return {
    id: createId('staff'),
    professionalName: '',
    email: '',
    phone: '',
    publicBio: '',
    role: 'barber',
    locationName: primaryLocation.name,
    locationAddress: primaryLocation.address,
    serviceIds: [],
    schedule: defaultWeeklySchedule.map((window) => ({ ...window })),
    bookingRules: {
      bufferMinutes: 10,
      minimumNoticeHours: 2,
      bookingWindowDays: 30,
      acceptsNewClients: true,
      allowAnyAvailable: true,
      acceptsWalkIns: true,
    },
    payoutProfile: {
      mode: 'manual-ledger',
      frequency: 'weekly',
      relationshipStatus: 'pending-admin-review',
      destinationStatus: 'not-connected',
    },
    setupComplete: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function validateStaffProfile(profile: StaffProfile) {
  const errors: Record<string, string> = {};
  if (profile.professionalName.trim().length < 2) errors.professionalName = 'Enter the professional name customers will see.';
  if (!isValidEmail(profile.email)) errors.email = 'Enter a valid email address.';
  if (!isValidPhone(profile.phone)) errors.phone = 'Enter a valid 10-digit phone number.';
  if (!profile.locationName.trim()) errors.locationName = 'Enter a location name.';
  if (!profile.locationAddress.trim()) errors.locationAddress = 'Enter the work address.';
  if (!profile.serviceIds.length) errors.serviceIds = 'Select at least one service.';

  const enabledWindows = profile.schedule.filter((window) => window.enabled);
  if (!enabledWindows.length) errors.schedule = 'Enable at least one working day.';
  for (const window of enabledWindows) {
    if (timeValueToMinutes(window.start) >= timeValueToMinutes(window.end)) {
      errors[`schedule-${window.day}`] = `${window.label} must end after it begins.`;
    }
  }

  if (profile.bookingRules.bookingWindowDays < 1) errors.bookingWindowDays = 'Choose a booking window.';
  if (profile.bookingRules.minimumNoticeHours < 0) errors.minimumNoticeHours = 'Minimum notice cannot be negative.';
  if (profile.bookingRules.bufferMinutes < 0) errors.bufferMinutes = 'Buffer time cannot be negative.';
  return errors;
}

export function getBarberDirectory(profiles = readStaffProfiles()): BarberDirectoryEntry[] {
  const completed = profiles.filter((profile) => profile.setupComplete && profile.role === 'barber');
  const byName = new Map(completed.map((profile) => [profile.professionalName.toLowerCase(), profile]));
  const mapped: BarberDirectoryEntry[] = baseBarberDirectory.map((barber) => ({
    ...barber,
    profile: byName.get(barber.name.toLowerCase()) ?? null,
  }));

  for (const profile of completed) {
    if (!mapped.some((barber) => barber.profile?.id === profile.id)) {
      mapped.push({
        id: profile.id,
        name: profile.professionalName,
        shortName: profile.professionalName,
        photo: null,
        profile,
      });
    }
  }

  return mapped.sort((a, b) => a.name.localeCompare(b.name));
}

export const barberDirectory = getBarberDirectory([]);

export function getEligibleBarbers(serviceId: string, profiles = readStaffProfiles()) {
  return getBarberDirectory(profiles).filter((barber) => (
    !barber.profile
    || (
      barber.profile.bookingRules.acceptsNewClients
      && barber.profile.serviceIds.includes(serviceId)
    )
  ));
}

export function getScheduleForBarber(barber: BarberDirectoryEntry) {
  return barber.profile?.schedule ?? defaultWeeklySchedule;
}

export function getWindowForDate(dateKey: string, schedule: WeeklyWindow[]) {
  const date = new Date(`${dateKey}T12:00:00`);
  const keys: DayKey[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const day = keys[date.getDay()];
  return day ? schedule.find((window) => window.day === day) : undefined;
}

export function timeValueToMinutes(value: string) {
  const [hours = '0', minutes = '0'] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}

export function timeLabelToMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  const rawHours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const suffix = (match[3] ?? 'AM').toUpperCase();
  const hours = rawHours % 12 + (suffix === 'PM' ? 12 : 0);
  return hours * 60 + minutes;
}

export function minutesToTimeLabel(value: number) {
  const hours24 = Math.floor(value / 60);
  const minutes = value % 60;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function generateTimeSlots(
  dateKey: string,
  durationMinutes: number,
  schedule: WeeklyWindow[],
  bufferMinutes = 10,
) {
  const window = getWindowForDate(dateKey, schedule);
  if (!window?.enabled) return [];

  const start = timeValueToMinutes(window.start);
  const end = timeValueToMinutes(window.end);
  const step = Math.max(15, durationMinutes + bufferMinutes);
  const slots: TimeSlot[] = [];

  for (let time = start; time + durationMinutes <= end; time += step) {
    slots.push({
      label: minutesToTimeLabel(time),
      startMinutes: time,
      endMinutes: time + durationMinutes,
    });
  }

  return slots;
}

function normalizeAppointment(appointment: Partial<PlatformAppointment> & Pick<PlatformAppointment, 'id'>): PlatformAppointment {
  const time = appointment.time ?? '10:00 AM';
  const startMinutes = appointment.startMinutes ?? timeLabelToMinutes(time);
  const durationMinutes = appointment.durationMinutes ?? 60;
  const status = appointment.status === 'confirmed' ? 'confirmed' : appointment.status ?? 'requested';
  const now = appointment.updatedAt ?? appointment.createdAt ?? new Date().toISOString();

  return {
    id: appointment.id,
    serviceId: appointment.serviceId ?? '',
    serviceName: appointment.serviceName ?? 'Service',
    price: appointment.price ?? '$0',
    priceCents: appointment.priceCents ?? priceToCents(appointment.price ?? '$0'),
    durationMinutes,
    requestedBarberId: appointment.requestedBarberId ?? appointment.assignedBarberId ?? 'any',
    assignedBarberId: appointment.assignedBarberId ?? (appointment.requestedBarberId === 'any' ? null : appointment.requestedBarberId ?? null),
    barberName: appointment.barberName ?? 'Any available barber',
    date: appointment.date ?? new Date().toISOString().slice(0, 10),
    time,
    startMinutes,
    endMinutes: appointment.endMinutes ?? startMinutes + durationMinutes,
    proposedDate: appointment.proposedDate ?? null,
    proposedTime: appointment.proposedTime ?? null,
    proposedStartMinutes: appointment.proposedStartMinutes ?? null,
    customerName: appointment.customerName ?? '',
    customerEmail: normalizeEmail(appointment.customerEmail ?? ''),
    customerPhone: normalizePhone(appointment.customerPhone ?? ''),
    phoneVerified: appointment.phoneVerified ?? false,
    accountPreference: appointment.accountPreference ?? 'guest',
    source: appointment.source ?? 'website',
    status,
    clientResponse: appointment.clientResponse ?? null,
    customerNote: appointment.customerNote ?? '',
    staffNote: appointment.staffNote ?? '',
    createdAt: appointment.createdAt ?? now,
    updatedAt: now,
  };
}

export function readAppointments() {
  return readJson<Array<Partial<PlatformAppointment> & Pick<PlatformAppointment, 'id'>>>(platformStorageKeys.appointments, [])
    .map(normalizeAppointment)
    .sort((a, b) => `${a.date}-${String(a.startMinutes).padStart(4, '0')}`.localeCompare(`${b.date}-${String(b.startMinutes).padStart(4, '0')}`));
}

export function isBlockingAppointment(appointment: PlatformAppointment) {
  return blockingStatuses.has(appointment.status);
}

export function hasAppointmentConflict(
  barberId: string,
  date: string,
  startMinutes: number,
  endMinutes: number,
  appointments = readAppointments(),
  excludeAppointmentId?: string,
) {
  return appointments.some((appointment) => (
    appointment.id !== excludeAppointmentId
    && appointment.assignedBarberId === barberId
    && appointment.date === date
    && isBlockingAppointment(appointment)
    && startMinutes < appointment.endMinutes
    && endMinutes > appointment.startMinutes
  ));
}

export function chooseAvailableBarber(input: {
  serviceId: string;
  requestedBarberId: string;
  date: string;
  startMinutes: number;
  durationMinutes: number;
  profiles?: StaffProfile[];
  appointments?: PlatformAppointment[];
}) {
  const profiles = input.profiles ?? readStaffProfiles();
  const appointments = input.appointments ?? readAppointments();
  const eligible = getEligibleBarbers(input.serviceId, profiles);
  const requested = input.requestedBarberId === 'any'
    ? eligible.filter((barber) => barber.profile?.bookingRules.allowAnyAvailable ?? true)
    : eligible.filter((barber) => barber.id === input.requestedBarberId || barber.profile?.id === input.requestedBarberId);

  return requested.find((barber) => {
    const schedule = getScheduleForBarber(barber);
    const window = getWindowForDate(input.date, schedule);
    if (!window?.enabled) return false;
    const start = timeValueToMinutes(window.start);
    const end = timeValueToMinutes(window.end);
    const appointmentEnd = input.startMinutes + input.durationMinutes;
    if (input.startMinutes < start || appointmentEnd > end) return false;
    return !hasAppointmentConflict(barber.profile?.id ?? barber.id, input.date, input.startMinutes, appointmentEnd, appointments);
  }) ?? null;
}

export function getAvailableTimeSlots(input: {
  service: BarberServiceOption;
  requestedBarberId: string;
  date: string;
  profiles?: StaffProfile[];
  appointments?: PlatformAppointment[];
}) {
  const profiles = input.profiles ?? readStaffProfiles();
  const appointments = input.appointments ?? readAppointments();
  const eligible = getEligibleBarbers(input.service.id, profiles);
  const candidates = input.requestedBarberId === 'any'
    ? eligible.filter((barber) => barber.profile?.bookingRules.allowAnyAvailable ?? true)
    : eligible.filter((barber) => barber.id === input.requestedBarberId || barber.profile?.id === input.requestedBarberId);
  const slots = new Map<number, TimeSlot>();

  for (const barber of candidates) {
    const buffer = barber.profile?.bookingRules.bufferMinutes ?? 10;
    for (const slot of generateTimeSlots(input.date, input.service.durationMinutes, getScheduleForBarber(barber), buffer)) {
      const barberId = barber.profile?.id ?? barber.id;
      if (!hasAppointmentConflict(barberId, input.date, slot.startMinutes, slot.endMinutes, appointments)) {
        slots.set(slot.startMinutes, slot);
      }
    }
  }

  return Array.from(slots.values()).sort((a, b) => a.startMinutes - b.startMinutes);
}

function appointmentNotificationTemplate(status: AppointmentStatus) {
  if (status === 'confirmed') return 'appointment-confirmed' as const;
  if (status === 'declined') return 'appointment-declined' as const;
  if (status === 'reschedule-proposed') return 'appointment-reschedule-proposed' as const;
  return null;
}

function queueAppointmentNotification(appointment: PlatformAppointment, template: ReturnType<typeof appointmentNotificationTemplate> | 'appointment-requested' | 'walk-in-requested' | 'walk-in-claimed' | 'appointment-reschedule-accepted' | 'appointment-reschedule-rejected') {
  if (!template) return;
  const subject = template === 'appointment-requested'
    ? 'The Kut Shoppe received your appointment request'
    : template === 'walk-in-requested'
      ? 'The Kut Shoppe received your walk-in request'
      : template === 'appointment-confirmed' || template === 'walk-in-claimed' || template === 'appointment-reschedule-accepted'
        ? 'Your The Kut Shoppe appointment is confirmed'
        : template === 'appointment-declined'
          ? 'Update about your The Kut Shoppe request'
          : template === 'appointment-reschedule-rejected'
            ? 'The proposed appointment time was declined'
            : 'A new appointment time was proposed';
  const message = `${appointment.customerName}, your ${appointment.serviceName} request is ${appointment.status.replace('-', ' ')} for ${appointment.date} at ${appointment.time}.`;

  queueNotification({
    channel: 'email',
    template,
    recipient: appointment.customerEmail,
    subject,
    message,
    relatedType: 'appointment',
    relatedId: appointment.id,
  });
  queueNotification({
    channel: 'sms',
    template,
    recipient: appointment.customerPhone,
    subject,
    message,
    relatedType: 'appointment',
    relatedId: appointment.id,
  });
}

export function saveAppointment(appointment: PlatformAppointment) {
  const appointments = readAppointments();
  const normalized = normalizeAppointment(appointment);
  const next = [...appointments.filter((item) => item.id !== normalized.id), normalized];
  writeJson(platformStorageKeys.appointments, next);
  return readAppointments();
}

export function createAppointmentRequest(input: Omit<PlatformAppointment, 'id' | 'status' | 'clientResponse' | 'createdAt' | 'updatedAt'>) {
  const now = new Date().toISOString();
  const appointment = normalizeAppointment({
    ...input,
    id: createId(input.source === 'walk-in' ? 'walk-in' : 'appointment'),
    status: input.source === 'walk-in' ? 'waitlisted' : 'requested',
    clientResponse: null,
    createdAt: now,
    updatedAt: now,
  });
  saveAppointment(appointment);
  queueAppointmentNotification(appointment, input.source === 'walk-in' ? 'walk-in-requested' : 'appointment-requested');
  return appointment;
}

export function updateAppointment(appointmentId: string, patch: Partial<PlatformAppointment>) {
  const appointments = readAppointments();
  const current = appointments.find((appointment) => appointment.id === appointmentId);
  if (!current) return null;

  const nextAppointment = normalizeAppointment({
    ...current,
    ...patch,
    id: current.id,
    updatedAt: new Date().toISOString(),
  });
  saveAppointment(nextAppointment);

  if (patch.status && patch.status !== current.status) {
    queueAppointmentNotification(nextAppointment, appointmentNotificationTemplate(patch.status));
  }

  return nextAppointment;
}

export function confirmAppointment(appointmentId: string, staffId?: string) {
  const appointments = readAppointments();
  const appointment = appointments.find((item) => item.id === appointmentId);
  if (!appointment) return null;
  const assigned = staffId ?? appointment.assignedBarberId;
  return updateAppointment(appointmentId, {
    assignedBarberId: assigned,
    status: 'confirmed',
    clientResponse: null,
  });
}

export function declineAppointment(appointmentId: string, staffNote = '') {
  return updateAppointment(appointmentId, { status: 'declined', staffNote });
}

export function proposeAppointmentTime(
  appointmentId: string,
  input: { date: string; time: string; startMinutes: number; assignedBarberId: string; barberName: string; staffNote?: string },
) {
  return updateAppointment(appointmentId, {
    status: 'reschedule-proposed',
    proposedDate: input.date,
    proposedTime: input.time,
    proposedStartMinutes: input.startMinutes,
    assignedBarberId: input.assignedBarberId,
    barberName: input.barberName,
    clientResponse: 'pending',
    staffNote: input.staffNote ?? '',
  });
}

export function respondToAppointmentProposal(appointmentId: string, accepted: boolean) {
  const appointment = readAppointments().find((item) => item.id === appointmentId);
  if (!appointment || !appointment.proposedDate || !appointment.proposedTime || appointment.proposedStartMinutes === null) return null;

  const next = updateAppointment(appointmentId, accepted
    ? {
        date: appointment.proposedDate,
        time: appointment.proposedTime,
        startMinutes: appointment.proposedStartMinutes,
        endMinutes: appointment.proposedStartMinutes + appointment.durationMinutes,
        proposedDate: null,
        proposedTime: null,
        proposedStartMinutes: null,
        status: 'confirmed',
        clientResponse: 'accepted',
      }
    : {
        status: 'requested',
        proposedDate: null,
        proposedTime: null,
        proposedStartMinutes: null,
        clientResponse: 'rejected',
      });

  if (next) {
    queueAppointmentNotification(next, accepted ? 'appointment-reschedule-accepted' : 'appointment-reschedule-rejected');
  }
  return next;
}

export function claimWalkIn(appointmentId: string, input: { staffId: string; barberName: string; date: string; time: string; startMinutes: number }) {
  const appointment = readAppointments().find((item) => item.id === appointmentId);
  if (!appointment) return null;
  const next = updateAppointment(appointmentId, {
    assignedBarberId: input.staffId,
    barberName: input.barberName,
    date: input.date,
    time: input.time,
    startMinutes: input.startMinutes,
    endMinutes: input.startMinutes + appointment.durationMinutes,
    status: 'confirmed',
  });
  if (next) queueAppointmentNotification(next, 'walk-in-claimed');
  return next;
}

export function subscribeToAppointmentChanges(callback: () => void) {
  return subscribeToPlatformChanges(callback);
}
