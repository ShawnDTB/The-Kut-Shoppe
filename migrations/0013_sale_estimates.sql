-- An issued estimate is an immutable source/amount snapshot, never evidence of payment.
-- Source and actor identifiers are durable references rather than cascading foreign keys:
-- deleting an operational source must not rewrite an issued document.
CREATE TABLE sale_estimates (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  customer_user_id TEXT,
  appointment_id TEXT,
  order_id TEXT,
  request_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  review_key TEXT NOT NULL,
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  created_at TEXT NOT NULL,
  CHECK(appointment_id IS NOT NULL OR order_id IS NOT NULL),
  UNIQUE(actor_user_id, request_key),
  UNIQUE(actor_user_id, review_key)
);
-- statement-boundary
CREATE INDEX sale_estimates_customer_idx ON sale_estimates(customer_user_id,created_at DESC,id DESC);
-- statement-boundary
CREATE INDEX sale_estimates_history_idx ON sale_estimates(created_at DESC,id DESC);
-- statement-boundary
CREATE INDEX sale_estimates_appointment_idx ON sale_estimates(appointment_id,created_at DESC,id DESC);
-- statement-boundary
CREATE INDEX sale_estimates_order_idx ON sale_estimates(order_id,created_at DESC,id DESC);
-- statement-boundary
CREATE TRIGGER sale_estimates_no_update BEFORE UPDATE ON sale_estimates BEGIN SELECT RAISE(ABORT,'Issued estimates cannot be changed'); END;
-- statement-boundary
CREATE TRIGGER sale_estimates_no_delete BEFORE DELETE ON sale_estimates BEGIN SELECT RAISE(ABORT,'Issued estimates require a controlled retention process'); END;
