export const shopHours = [
  { days: 'Monday', hours: '10:00 AM - 4:00 PM' },
  { days: 'Tuesday', hours: '10:00 AM - 6:00 PM' },
  { days: 'Wednesday', hours: '10:00 AM - 6:00 PM' },
  { days: 'Thursday', hours: '10:00 AM - 7:00 PM' },
  { days: 'Friday', hours: '10:00 AM - 7:00 PM' },
  { days: 'Saturday', hours: '10:00 AM - 6:00 PM' },
  { days: 'Sunday', hours: 'Closed' },
] as const;

export const shopHoursSummary =
  'Mon 10 AM-4 PM · Tue-Wed 10 AM-6 PM · Thu-Fri 10 AM-7 PM · Sat 10 AM-6 PM';
export const shopClosedSummary = 'Sun · Closed';
export const shopHoursNote =
  'Walk-in reference hours. Individual professional schedules may vary.';
