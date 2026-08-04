import { subscribeToPlatformChanges } from './notifications';

export type OrderChannelV5 = 'online' | 'in-person';
export type PaymentStatusV5 = 'unpaid' | 'pending' | 'paid' | 'refunded';

export interface OrderOperationsV5 {
  orderId: string;
  channel: OrderChannelV5;
  paymentStatus: PaymentStatusV5;
  customerAccountId: string | null;
  locked: boolean;
  updatedAt: string;
}

const storageKey = 'kut-shoppe.order-operations.v5';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function write(value: OrderOperationsV5[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('kut-shoppe-platform-change'));
}

export function readOrderOperationsV5() {
  return readJson<OrderOperationsV5[]>(storageKey, []);
}

export function getOrderOperationsV5(orderId: string) {
  return readOrderOperationsV5().find((item) => item.orderId === orderId) ?? {
    orderId,
    channel: 'online' as const,
    paymentStatus: 'unpaid' as const,
    customerAccountId: null,
    locked: false,
    updatedAt: new Date().toISOString(),
  };
}

export function saveOrderOperationsV5(value: OrderOperationsV5) {
  const next = { ...value, updatedAt: new Date().toISOString() };
  write([...readOrderOperationsV5().filter((item) => item.orderId !== value.orderId), next]);
  return next;
}

export function subscribeToOrderOperationsV5(callback: () => void) {
  return subscribeToPlatformChanges(callback);
}
