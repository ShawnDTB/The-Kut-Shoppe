export type NotificationChannel = 'email' | 'sms';
export type NotificationStatus = 'queued' | 'sent' | 'failed';
export type NotificationTemplate =
  | 'phone-verification'
  | 'appointment-requested'
  | 'appointment-confirmed'
  | 'appointment-declined'
  | 'appointment-reschedule-proposed'
  | 'appointment-reschedule-accepted'
  | 'appointment-reschedule-rejected'
  | 'walk-in-requested'
  | 'walk-in-claimed'
  | 'order-submitted'
  | 'order-accepted'
  | 'order-ready'
  | 'order-shipped'
  | 'order-declined';

export interface NotificationRecord {
  id: string;
  channel: NotificationChannel;
  template: NotificationTemplate;
  recipient: string;
  subject: string;
  message: string;
  relatedType: 'appointment' | 'order' | 'account' | 'verification';
  relatedId: string;
  status: NotificationStatus;
  createdAt: string;
  sentAt: string | null;
}

const storageKey = 'kut-shoppe.notification-outbox.v2';
const platformChangeEvent = 'kut-shoppe-platform-change';

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function publishChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(platformChangeEvent));
}

export function readNotifications() {
  return readJson<NotificationRecord[]>(storageKey, []);
}

export function queueNotification(
  notification: Omit<NotificationRecord, 'id' | 'status' | 'createdAt' | 'sentAt'>,
) {
  const record: NotificationRecord = {
    ...notification,
    id: createId('notification'),
    status: 'queued',
    createdAt: new Date().toISOString(),
    sentAt: null,
  };

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(storageKey, JSON.stringify([...readNotifications(), record]));
    publishChange();
  }

  return record;
}

export function updateNotificationStatus(id: string, status: NotificationStatus) {
  const next = readNotifications().map((notification) => (
    notification.id === id
      ? {
          ...notification,
          status,
          sentAt: status === 'sent' ? new Date().toISOString() : notification.sentAt,
        }
      : notification
  ));

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    publishChange();
  }

  return next;
}

export function subscribeToPlatformChanges(callback: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(platformChangeEvent, callback);
  return () => window.removeEventListener(platformChangeEvent, callback);
}

export const notificationStorageKey = storageKey;
