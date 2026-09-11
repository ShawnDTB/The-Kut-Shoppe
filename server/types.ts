export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch<T = unknown>(statements: Statement[]): Promise<T[]>;
}
export interface Env {
  DB: Database;
  APP_ORIGIN: string;
  ACCOUNTS_ENABLED?: string;
  CUSTOMER_BOOKING_ENABLED?: string;
  STAFF_OPERATIONS_ENABLED?: string;
  APPOINTMENT_EMAIL_ENABLED?: string;
  AUTH_SECRET?: string;
  MFA_ENCRYPTION_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
}
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
