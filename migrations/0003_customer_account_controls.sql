-- Additive only: preserve existing accounts, credentials, and history.
-- Existing pending codes become invalid; customers can request new codes.
ALTER TABLE account_challenges ADD COLUMN email TEXT;

CREATE TABLE account_email_changes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  session_hash TEXT NOT NULL,
  current_email TEXT NOT NULL,
  new_email TEXT NOT NULL,
  current_code_hash TEXT NOT NULL,
  new_code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  consumed_by TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX account_email_change_expiry_idx ON account_email_changes(expires_at);

-- Match the cursor's deterministic order, including appointments without a time.
CREATE INDEX appointments_customer_history_idx
  ON appointments(customer_user_id, COALESCE(starts_at, '') DESC, id DESC);
CREATE INDEX orders_customer_history_idx
  ON orders(customer_user_id, created_at DESC, id DESC);
