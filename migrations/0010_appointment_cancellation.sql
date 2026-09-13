-- Requests preserve the confirmed appointment until its professional decides.
ALTER TABLE appointments ADD COLUMN customer_cancellation_id TEXT;
ALTER TABLE appointments ADD COLUMN cancellation_requested_at TEXT;
ALTER TABLE appointments ADD COLUMN cancellation_state TEXT CHECK (cancellation_state IN ('pending','approved','declined'));
