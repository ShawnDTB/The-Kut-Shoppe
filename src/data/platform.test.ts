// Tests for the booking engine's data layer: conflict detection, the
// appointment request/update/confirm/decline lifecycle, and the
// email-matching contract that account dashboards rely on to show "your"
// appointments (see CustomerAccountDashboard.tsx's
// `appointments.filter((item) => item.customerEmail === account.email)`).
// That filter itself lives inline in a component and isn't exported, so
// this proves the underlying data guarantee it depends on (normalized,
// case-insensitive email matching) rather than rendering the component.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  confirmAppointment,
  createAppointmentRequest,
  declineAppointment,
  hasAppointmentConflict,
  readAppointments,
  updateAppointment,
  type PlatformAppointment,
} from './platform';

beforeEach(() => {
  localStorage.clear();
});

function baseRequest(overrides: Partial<Parameters<typeof createAppointmentRequest>[0]> = {}) {
  return createAppointmentRequest({
    serviceId: 'haircut',
    serviceName: 'Haircut',
    price: '$35',
    priceCents: 3500,
    durationMinutes: 45,
    requestedBarberId: 'barber-1',
    assignedBarberId: 'barber-1',
    barberName: 'Sam Barber',
    date: '2026-08-20',
    time: '10:00 AM',
    startMinutes: 600,
    endMinutes: 645,
    proposedDate: null,
    proposedTime: null,
    proposedStartMinutes: null,
    customerName: 'Jordan Visitor',
    customerEmail: 'jordan@example.com',
    customerPhone: '5705551234',
    phoneVerified: false,
    accountPreference: 'guest',
    source: 'website',
    customerNote: '',
    staffNote: '',
    ...overrides,
  });
}

describe('createAppointmentRequest', () => {
  it('starts website bookings as "requested"', () => {
    const appointment = baseRequest();
    expect(appointment.status).toBe('requested');
  });

  it('starts walk-in bookings as "waitlisted"', () => {
    const appointment = baseRequest({ source: 'walk-in' });
    expect(appointment.status).toBe('waitlisted');
  });

  it('normalizes the customer email to lowercase and trimmed', () => {
    const appointment = baseRequest({ customerEmail: '  Jordan@Example.com  ' });
    expect(appointment.customerEmail).toBe('jordan@example.com');
  });

  it('persists the appointment so readAppointments() finds it', () => {
    const appointment = baseRequest();
    expect(readAppointments().map((item) => item.id)).toContain(appointment.id);
  });
});

describe('hasAppointmentConflict', () => {
  function blockingAppointment(overrides: Partial<PlatformAppointment> = {}): PlatformAppointment {
    return {
      id: 'existing',
      serviceId: 'haircut', serviceName: 'Haircut', price: '$35', priceCents: 3500, durationMinutes: 45,
      requestedBarberId: 'barber-1', assignedBarberId: 'barber-1', barberName: 'Sam Barber',
      date: '2026-08-20', time: '10:00 AM', startMinutes: 600, endMinutes: 645,
      proposedDate: null, proposedTime: null, proposedStartMinutes: null,
      customerName: 'Existing Customer', customerEmail: 'existing@example.com', customerPhone: '5705550000',
      phoneVerified: false, accountPreference: 'guest', source: 'website', status: 'confirmed', clientResponse: null,
      customerNote: '', staffNote: '', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
      ...overrides,
    };
  }

  it('flags an overlapping time range for the same barber as a conflict', () => {
    const existing = [blockingAppointment()];
    // 10:15-11:00 overlaps the existing 10:00-10:45 slot.
    expect(hasAppointmentConflict('barber-1', '2026-08-20', 615, 660, existing)).toBe(true);
  });

  it('does not flag a back-to-back, non-overlapping slot', () => {
    const existing = [blockingAppointment()];
    // 10:45-11:30 starts exactly when the existing appointment ends.
    expect(hasAppointmentConflict('barber-1', '2026-08-20', 645, 690, existing)).toBe(false);
  });

  it('does not flag the same time slot for a different barber', () => {
    const existing = [blockingAppointment()];
    expect(hasAppointmentConflict('barber-2', '2026-08-20', 600, 645, existing)).toBe(false);
  });

  it('ignores non-blocking statuses (declined/cancelled) when checking conflicts', () => {
    const existing = [blockingAppointment({ status: 'cancelled' })];
    expect(hasAppointmentConflict('barber-1', '2026-08-20', 600, 645, existing)).toBe(false);
  });

  it('excludes the appointment being edited via excludeAppointmentId', () => {
    const existing = [blockingAppointment({ id: 'target' })];
    expect(hasAppointmentConflict('barber-1', '2026-08-20', 600, 645, existing, 'target')).toBe(false);
  });
});

describe('appointment lifecycle transitions', () => {
  it('confirmAppointment moves status to confirmed and clears clientResponse', () => {
    const appointment = baseRequest();
    const confirmed = confirmAppointment(appointment.id, 'barber-1');
    expect(confirmed?.status).toBe('confirmed');
    expect(confirmed?.assignedBarberId).toBe('barber-1');
    expect(confirmed?.clientResponse).toBeNull();
  });

  it('declineAppointment moves status to declined and records a staff note', () => {
    const appointment = baseRequest();
    const declined = declineAppointment(appointment.id, 'Fully booked that day.');
    expect(declined?.status).toBe('declined');
    expect(declined?.staffNote).toBe('Fully booked that day.');
  });

  it('updateAppointment returns null for an unknown id instead of throwing', () => {
    expect(updateAppointment('not-a-real-id', { status: 'confirmed' })).toBeNull();
  });
});

describe('account appointment visibility contract', () => {
  it('lets a customer\'s appointments be isolated by normalized email, matching how CustomerAccountDashboard filters them', () => {
    const mine = baseRequest({ customerEmail: 'jordan@example.com', customerName: 'Jordan Visitor' });
    baseRequest({ customerEmail: 'someone-else@example.com', customerName: 'Someone Else' });

    // Account emails are normalized the same way at signup (auth-v2's
    // normalizeEmail); simulate a mixed-case lookup like a real login would produce.
    const accountEmail = 'Jordan@Example.com'.trim().toLowerCase();
    const visible = readAppointments().filter((item) => item.customerEmail === accountEmail);

    expect(visible).toHaveLength(1);
    expect(visible[0]?.id).toBe(mine.id);
  });
});
