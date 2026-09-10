export interface BookingOption {
  staffId: string; professionalName: string; serviceId: string; serviceName: string;
  locationId: string; locationName: string; timeZone: string;
  durationMinutes: number; priceCents: number;
}
export interface BookingSlot { startsAt: string; endsAt: string }
export interface BookingAvailability {
  option: BookingOption; date: string; slots: BookingSlot[]; quote: string;
}
