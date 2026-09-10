ALTER TABLE appointments ADD COLUMN staff_decision_key TEXT;
ALTER TABLE appointments ADD COLUMN staff_decision_receipt TEXT;
ALTER TABLE appointments ADD COLUMN staff_decision_action TEXT;

CREATE INDEX appointments_staff_queue_idx ON appointments(COALESCE(assigned_staff_id, requested_staff_id), status, created_at, id) WHERE source='website';

-- Separate from the legacy prototype notification_outbox. Never import its
-- arbitrary recipient/message rows into the authenticated delivery service.
CREATE TABLE appointment_notifications (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES appointment_events(id) ON DELETE CASCADE,
  recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  audience TEXT NOT NULL CHECK (audience IN ('customer','professional')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','retry','accepted','failed','suppressed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  lease_token TEXT,
  lease_until TEXT,
  first_attempt_at TEXT,
  recipient_email TEXT,
  payload_json TEXT,
  accepted_at TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(event_id,recipient_user_id,audience)
);
CREATE INDEX appointment_notifications_due_idx ON appointment_notifications(status,next_attempt_at);
