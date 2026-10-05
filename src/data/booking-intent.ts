// Public crew links use readable handles; native booking IDs remain server-owned.
export function readBookingIntent(search: string) {
  const query = new URLSearchParams(search);
  if (query.get('type') === 'loctician') return { provider: 'styling' as const, professional: 'Steph' };
  const names: Record<string, string> = { kash: 'KasH', 'mr-glen': 'Mr. Glen', 'kris-p': 'Kris-P' };
  const barber = query.get('barber');
  return { provider: barber || query.get('type') === 'barber' ? 'barber' as const : null, professional: barber ? Object.hasOwn(names, barber) ? names[barber]! : null : null };
}
