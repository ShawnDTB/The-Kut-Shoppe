CREATE TABLE walk_in_operations (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  request_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  appointment_id TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(actor_user_id,request_key)
);
CREATE INDEX walk_in_operations_appointment ON walk_in_operations(appointment_id);
