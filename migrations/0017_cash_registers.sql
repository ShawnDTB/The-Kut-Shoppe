-- One shared Main Street drawer; later drawers require explicit configuration.
-- Historical cash receipts are deliberately not assigned to invented shifts.
CREATE TABLE register_operations (
 id TEXT PRIMARY KEY,
 register_id TEXT NOT NULL,
 actor_user_id TEXT NOT NULL,
 request_key TEXT NOT NULL,
 fingerprint TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('open','paid_in','paid_out','deposit','close')),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),
 reason TEXT NOT NULL,
 created_at TEXT NOT NULL,
 UNIQUE(actor_user_id,request_key)
);
-- statement-boundary
CREATE TABLE cash_register_sessions (
 id TEXT PRIMARY KEY,
 opening_operation_id TEXT NOT NULL UNIQUE REFERENCES register_operations(id),
 opening_cents INTEGER NOT NULL CHECK(opening_cents>=0),
 created_at TEXT NOT NULL
);
-- statement-boundary
CREATE TABLE cash_register_closures (
 register_id TEXT PRIMARY KEY REFERENCES cash_register_sessions(id),
 operation_id TEXT NOT NULL UNIQUE REFERENCES register_operations(id),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
 created_at TEXT NOT NULL
);
-- statement-boundary
CREATE TABLE cash_register_entries (
 id TEXT PRIMARY KEY,
 register_id TEXT NOT NULL REFERENCES cash_register_sessions(id),
 operation_id TEXT UNIQUE REFERENCES register_operations(id),
 cash_event_id TEXT UNIQUE REFERENCES cash_sale_events(id),
 kind TEXT NOT NULL CHECK(kind IN ('payment','refund','paid_in','paid_out','deposit')),
 amount_cents INTEGER NOT NULL,
 reason TEXT NOT NULL,
 created_at TEXT NOT NULL,
 CHECK((kind IN ('payment','refund') AND cash_event_id IS NOT NULL AND operation_id IS NULL)
    OR (kind IN ('paid_in','paid_out','deposit') AND operation_id IS NOT NULL AND cash_event_id IS NULL)),
 CHECK((kind IN ('payment','paid_in') AND amount_cents>=0) OR (kind IN ('refund','paid_out','deposit') AND amount_cents<=0))
);
-- statement-boundary
CREATE INDEX register_entries_session ON cash_register_entries(register_id,created_at DESC,id DESC);
-- statement-boundary
CREATE INDEX register_sessions_history ON cash_register_sessions(created_at DESC,id DESC);
-- statement-boundary
CREATE TRIGGER register_single_open BEFORE INSERT ON cash_register_sessions
 WHEN EXISTS(SELECT 1 FROM cash_register_sessions r WHERE NOT EXISTS(SELECT 1 FROM cash_register_closures c WHERE c.register_id=r.id))
 BEGIN SELECT RAISE(ABORT,'Close the current register before opening another'); END;
-- statement-boundary
CREATE TRIGGER register_no_late_entries BEFORE INSERT ON cash_register_entries
 WHEN EXISTS(SELECT 1 FROM cash_register_closures c WHERE c.register_id=NEW.register_id)
 BEGIN SELECT RAISE(ABORT,'The register is closed'); END;
-- statement-boundary
CREATE TRIGGER register_cash_amount BEFORE INSERT ON cash_register_entries
 WHEN NEW.cash_event_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM cash_sale_events e WHERE e.id=NEW.cash_event_id AND e.kind=NEW.kind
   AND NEW.amount_cents=CASE WHEN e.kind='refund' THEN -e.amount_cents ELSE e.amount_cents END)
 BEGIN SELECT RAISE(ABORT,'The register entry must match the cash receipt'); END;
-- statement-boundary
CREATE TRIGGER register_operations_no_update BEFORE UPDATE ON register_operations BEGIN SELECT RAISE(ABORT,'Register operations are immutable'); END;
-- statement-boundary
CREATE TRIGGER register_operations_no_delete BEFORE DELETE ON register_operations BEGIN SELECT RAISE(ABORT,'Register records require controlled retention'); END;
-- statement-boundary
CREATE TRIGGER register_sessions_no_update BEFORE UPDATE ON cash_register_sessions BEGIN SELECT RAISE(ABORT,'Register sessions are immutable'); END;
-- statement-boundary
CREATE TRIGGER register_sessions_no_delete BEFORE DELETE ON cash_register_sessions BEGIN SELECT RAISE(ABORT,'Register records require controlled retention'); END;
-- statement-boundary
CREATE TRIGGER register_entries_no_update BEFORE UPDATE ON cash_register_entries BEGIN SELECT RAISE(ABORT,'Register entries are immutable'); END;
-- statement-boundary
CREATE TRIGGER register_entries_no_delete BEFORE DELETE ON cash_register_entries BEGIN SELECT RAISE(ABORT,'Register records require controlled retention'); END;
-- statement-boundary
CREATE TRIGGER register_closures_no_update BEFORE UPDATE ON cash_register_closures BEGIN SELECT RAISE(ABORT,'Register closures are immutable'); END;
-- statement-boundary
CREATE TRIGGER register_closures_no_delete BEFORE DELETE ON cash_register_closures BEGIN SELECT RAISE(ABORT,'Register records require controlled retention'); END;
