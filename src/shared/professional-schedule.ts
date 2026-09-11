export interface SchedulePage {
  revision: number;
  locations: { id: string; name: string; timeZone: string }[];
  hours: { id: string; locationId: string; weekday: number; startTime: string; endTime: string }[];
  timeOff: { id: string; startsAt: string; endsAt: string; canRemove: boolean }[];
}
