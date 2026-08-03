import { business, services, team } from './site';

export type StaffRole = 'barber' | 'manager' | 'owner';
export type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type AppointmentStatus = 'confirmed' | 'completed' | 'cancelled' | 'no-show';

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
  };
  payoutProfile: {
    mode: 'manual-ledger';
    frequency: 'weekly' | 'biweekly' | 'monthly';
    relationshipStatus: 'pending-admin-review';
    destinationStatus: 'not-connected';
  };
  setupComplete: boolean;
  updatedAt: string;
}

export interface PlatformAppointment {
  id: string;
  serviceId: string;
  serviceName: string;
  price: string;
  durationMinutes: number;
  barberId: string;
  barberName: string;
  date: string;
  time: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  accountPreference: 'guest' | 'account';
  status: AppointmentStatus;
  createdAt: string;
}

export interface BarberServiceOption {
  id: string;
  category: string;
  name: string;
  price: string;
  durationMinutes: number;
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
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
        durationMinutes: durationToMinutes(item.duration),
      });
    }
  }
}

export const barberServiceOptions = Array.from(serviceMap.values());

export const barberDirectory = team
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
  staffProfiles: 'kut-shoppe.staff-profiles.v1',
  appointments: 'kut-shoppe.appointments.v1',
} as const;

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
}

export function readStaffProfiles() {
  return readJson<StaffProfile[]>(platformStorageKeys.staffProfiles, []);
}

export function saveStaffProfile(profile: StaffProfile) {
  const profiles = readStaffProfiles();
  const next = [...profiles.filter((item) => item.id !== profile.id), profile];
  writeJson(platformStorageKeys.staffProfiles, next);
  return next;
}

export function readAppointments() {
  return readJson<PlatformAppointment[]>(platformStorageKeys.appointments, []);
}

export function saveAppointment(appointment: PlatformAppointment) {
  const next = [...readAppointments(), appointment];
  writeJson(platformStorageKeys.appointments, next);
  return next;
}

export function createStaffProfileDraft(): StaffProfile {
  return {
    id: `staff-${Date.now()}`,
    professionalName: '',
    email: '',
    phone: '',
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
    },
    payoutProfile: {
      mode: 'manual-ledger',
      frequency: 'weekly',
      relationshipStatus: 'pending-admin-review',
      destinationStatus: 'not-connected',
    },
    setupComplete: false,
    updatedAt: new Date().toISOString(),
  };
}

export function getScheduleForBarber(barberName: string, profiles: StaffProfile[]) {
  const profile = profiles.find((item) => item.professionalName.toLowerCase() === barberName.toLowerCase());
  return profile?.schedule ?? defaultWeeklySchedule;
}

export function getWindowForDate(dateKey: string, schedule: WeeklyWindow[]) {
  const date = new Date(`${dateKey}T12:00:00`);
  const dayIndex = date.getDay();
  const keys: DayKey[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const day = keys[dayIndex];
  return day ? schedule.find((window) => window.day === day) : undefined;
}

function timeToMinutes(value: string) {
  const [hours = '0', minutes = '0'] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}

function minutesToTime(value: number) {
  const hours24 = Math.floor(value / 60);
  const minutes = value % 60;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function generateTimeSlots(dateKey: string, durationMinutes: number, schedule: WeeklyWindow[], bufferMinutes = 10) {
  const window = getWindowForDate(dateKey, schedule);
  if (!window?.enabled) return [];

  const start = timeToMinutes(window.start);
  const end = timeToMinutes(window.end);
  const step = Math.max(15, durationMinutes + bufferMinutes);
  const slots: string[] = [];

  for (let time = start; time + durationMinutes <= end; time += step) {
    slots.push(minutesToTime(time));
  }

  return slots;
}
