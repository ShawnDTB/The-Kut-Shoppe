CREATE TABLE professional_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  professional_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  location_ids TEXT NOT NULL DEFAULT '[]',
  service_ids TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK(status IN ('draft','submitted','returned','approved')),
  version INTEGER NOT NULL DEFAULT 1,
  review_note TEXT NOT NULL DEFAULT '',
  submitted_at TEXT,
  updated_at TEXT NOT NULL,
  last_receipt TEXT NOT NULL UNIQUE
);
CREATE INDEX professional_submissions_queue_idx ON professional_submissions(status,id);
