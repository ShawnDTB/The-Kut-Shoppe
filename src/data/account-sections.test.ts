import { expect, it } from 'vitest';
import { canOpenAccountView, readAccountRoute } from './account-sections';
it('keeps direct staff URLs out of client access and separates management from barber access', () => {
  for (const view of ['accounts','front-desk','sales','setup-reviews','professional-visits'] as const) expect(canOpenAccountView('customer', view)).toBe(false);
  expect(canOpenAccountView('barber', 'accounts')).toBe(false);
  expect(canOpenAccountView('manager', 'setup-reviews')).toBe(false);
  expect(canOpenAccountView('owner', 'accounts')).toBe(true);
  expect(canOpenAccountView('barber', 'professional-visits')).toBe(true);
});
it('preserves record links and sends staff home to their dashboard', () => {
  window.history.replaceState({}, '', '/account?view=orders&record=order%2F1');
  expect(readAccountRoute()).toEqual({ view: 'orders', record: 'order/1' });
  window.history.replaceState({}, '', '/staff'); expect(readAccountRoute().view).toBe('overview');
  window.history.replaceState({}, '', '/admin/access'); expect(readAccountRoute().view).toBe('accounts');
  window.history.replaceState({}, '', '/account?view=unknown'); expect(readAccountRoute().view).toBe('overview');
});
