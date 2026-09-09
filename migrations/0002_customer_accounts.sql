-- Extends the original schema without changing or importing browser records.
-- 0001 is an unapplied design baseline; its phone column is now nullable so
-- email registration does not require a phone or insert fabricated contact data.
-- Customer contact phone is optional; never a proof of ownership.
ALTER TABLE customer_profiles ADD COLUMN phone TEXT NOT NULL DEFAULT '';
ALTER TABLE customer_profiles ADD COLUMN address_json TEXT NOT NULL DEFAULT '{"line1":"","line2":"","city":"","state":"","postalCode":""}';

CREATE TABLE account_credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE account_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  consumed_by TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX account_challenge_expiry_idx ON account_challenges(expires_at);

CREATE TABLE auth_rate_limits (
  key_hash TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL
);
CREATE INDEX auth_rate_expiry_idx ON auth_rate_limits(expires_at);
