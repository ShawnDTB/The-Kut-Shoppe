import type { AccountRole } from '../shared/customer';

export const accountSections = [
  ['overview', 'Dashboard', 'work'], ['front-desk', 'Front desk', 'work'], ['sales', 'Sales preparation', 'work'],
  ['counter', 'Sales & cash', 'work'], ['register', 'Cash register', 'work'],
  ['accounts', 'Staff access', 'work'], ['setup-reviews', 'Setup reviews', 'work'],
  ['professional', 'Appointment requests', 'chair'], ['professional-visits', 'Assigned visits', 'chair'],
  ['professional-schedule', 'Availability', 'chair'], ['professional-setup', 'Professional profile', 'chair'],
  ['booking', 'Book a visit', 'personal'], ['appointments', 'My appointments', 'personal'], ['orders', 'My orders', 'personal'],
  ['receipts', 'My receipts', 'personal'], ['estimates', 'My estimates', 'personal'], ['profile', 'Profile', 'account'], ['security', 'Security', 'account'],
] as const;
export type AccountView = typeof accountSections[number][0];
export function canOpenAccountView(role: AccountRole, view: AccountView) {
  if (view === 'front-desk' || view === 'sales' || view === 'accounts' || view === 'counter' || view === 'register') return ['manager', 'owner', 'developer'].includes(role);
  if (view === 'setup-reviews') return role === 'owner' || role === 'developer';
  if (view.startsWith('professional')) return role !== 'customer';
  return true;
}
export function readAccountRoute(): { view: AccountView; record: string | null } {
  const query = new URLSearchParams(window.location.search);
  const requested = query.get('view'); const path = window.location.pathname.replace(/\/$/, '');
  const aliases: Record<string, AccountView> = { '/staff': 'overview', '/staff/calendar': 'professional-visits', '/staff/requests': 'professional', '/staff/setup': 'professional-setup', '/staff/settings': 'professional-schedule', '/admin/access': 'accounts' };
  const view = path === '/book' ? 'booking' : accountSections.some(([key]) => key === requested) ? requested as AccountView : aliases[path] ?? 'overview';
  return { view, record: view === 'appointments' || view === 'orders' ? query.get('record') : null };
}
