-- Staff access is a short-lived privilege of an existing account session.
ALTER TABLE sessions ADD COLUMN mfa_version TEXT;
-- statement-boundary
ALTER TABLE sessions ADD COLUMN mfa_role TEXT;
-- statement-boundary
ALTER TABLE sessions ADD COLUMN mfa_until TEXT;
-- statement-boundary
CREATE TABLE staff_authenticators (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  version TEXT NOT NULL UNIQUE,
  encrypted_secret TEXT NOT NULL,
  last_counter INTEGER NOT NULL,
  receipt TEXT,
  created_at TEXT NOT NULL
);
-- statement-boundary
CREATE TABLE staff_mfa_enrollments (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL UNIQUE,
  session_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,
  credential_hash TEXT NOT NULL,
  previous_version TEXT NOT NULL,
  encrypted_secret TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_receipt TEXT,
  expires_at TEXT NOT NULL
);
-- statement-boundary
CREATE TABLE staff_mfa_recovery_codes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version TEXT NOT NULL REFERENCES staff_authenticators(version) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_receipt TEXT,
  PRIMARY KEY(user_id, code_hash)
);
-- statement-boundary
CREATE TRIGGER staff_mfa_account_changed AFTER UPDATE OF role,status,email_verified_at ON users
WHEN OLD.role IS NOT NEW.role OR OLD.status IS NOT NEW.status OR OLD.email_verified_at IS NOT NEW.email_verified_at
BEGIN
  UPDATE sessions SET mfa_version=NULL,mfa_role=NULL,mfa_until=NULL WHERE user_id=NEW.id;
  DELETE FROM staff_mfa_enrollments WHERE user_id=NEW.id;
END;
