import { deliverAppointmentNotifications } from './appointment-notifications';
import type { Env } from './types';

export default {
  fetch() { return new Response('Not found', { status: 404 }); },
  scheduled(_controller: unknown, env: Env, context: { waitUntil(promise: Promise<unknown>): void }) {
    context.waitUntil(deliverAppointmentNotifications(env).then((stats) => {
      console.log(JSON.stringify({ event: 'appointment_notification_batch', ...stats }));
    }).catch(() => { console.error('Appointment notification batch failed'); throw new Error('Appointment notification batch failed'); }));
  },
};
