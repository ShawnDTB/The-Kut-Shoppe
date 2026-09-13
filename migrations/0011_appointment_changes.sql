-- A replacement is only a request until accepted. The original appointment
-- continues to occupy the schedule, with one unresolved change at a time.
ALTER TABLE appointments ADD COLUMN change_version INTEGER NOT NULL DEFAULT 0;
CREATE TABLE appointment_changes (
  id TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL REFERENCES appointments(id),
  requested_by TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK(kind IN ('customer_request','professional_proposal')),
  status TEXT NOT NULL CHECK(status IN ('pending','approved','declined','withdrawn','expired')),
  original_starts_at TEXT NOT NULL,
  original_ends_at TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE UNIQUE INDEX appointment_one_pending_change ON appointment_changes(appointment_id) WHERE status='pending';
CREATE INDEX appointment_change_history ON appointment_changes(appointment_id,created_at DESC,id DESC);
CREATE TABLE appointment_change_operations (
  id TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL REFERENCES appointments(id),
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  request_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(actor_user_id,request_key)
);
