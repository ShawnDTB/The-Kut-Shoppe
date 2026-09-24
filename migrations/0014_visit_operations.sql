-- Native bookings and guest walk-ins share one audited, retry-safe lifecycle.
-- Existing walk-in creation/action receipts are retained unchanged.
CREATE TABLE visit_operations (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  request_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  appointment_id TEXT NOT NULL REFERENCES appointments(id),
  action TEXT NOT NULL CHECK(action IN ('checked_in','in_service','completed','cancelled','no_show')),
  created_at TEXT NOT NULL,
  UNIQUE(actor_user_id,request_key)
);
CREATE INDEX visit_operations_appointment ON visit_operations(appointment_id,created_at);
