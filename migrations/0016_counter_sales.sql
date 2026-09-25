-- Financial records never replace estimates, appointment state or fulfillment.
CREATE TABLE finalized_sales (
 id TEXT PRIMARY KEY,
 estimate_id TEXT NOT NULL UNIQUE,
 actor_user_id TEXT NOT NULL,
 customer_user_id TEXT,
 appointment_id TEXT,
 order_id TEXT,
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
 total_cents INTEGER NOT NULL CHECK(total_cents>=0),
 created_at TEXT NOT NULL
);
-- statement-boundary
CREATE INDEX finalized_sales_customer ON finalized_sales(customer_user_id,created_at DESC,id DESC);
-- statement-boundary
CREATE INDEX finalized_sales_appointment ON finalized_sales(appointment_id);
-- statement-boundary
CREATE INDEX finalized_sales_order ON finalized_sales(order_id);
-- statement-boundary
CREATE TABLE cash_sale_events (
 id TEXT PRIMARY KEY,
 sale_id TEXT NOT NULL REFERENCES finalized_sales(id),
 actor_user_id TEXT NOT NULL,
 request_key TEXT NOT NULL,
 fingerprint TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('payment','refund','void')),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),
 tip_cents INTEGER NOT NULL DEFAULT 0 CHECK(tip_cents>=0),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
 created_at TEXT NOT NULL,
 UNIQUE(actor_user_id,request_key),
 UNIQUE(sale_id,kind)
);
-- statement-boundary
CREATE INDEX cash_sale_events_history ON cash_sale_events(created_at DESC,id DESC);
-- statement-boundary
CREATE TRIGGER finalized_sales_no_update BEFORE UPDATE ON finalized_sales BEGIN SELECT RAISE(ABORT,'Finalized sales are immutable'); END;
-- statement-boundary
CREATE TRIGGER finalized_sales_no_delete BEFORE DELETE ON finalized_sales BEGIN SELECT RAISE(ABORT,'Finalized sales require controlled retention'); END;
-- statement-boundary
CREATE TRIGGER cash_sale_events_no_update BEFORE UPDATE ON cash_sale_events BEGIN SELECT RAISE(ABORT,'Cash records are immutable'); END;
-- statement-boundary
CREATE TRIGGER cash_sale_events_no_delete BEFORE DELETE ON cash_sale_events BEGIN SELECT RAISE(ABORT,'Cash records require controlled retention'); END;
-- statement-boundary
CREATE TRIGGER finalized_sales_revision AFTER INSERT ON finalized_sales BEGIN UPDATE commerce_revision SET value=value+1 WHERE id=1; END;
-- statement-boundary
CREATE TRIGGER cash_sale_events_revision AFTER INSERT ON cash_sale_events BEGIN UPDATE commerce_revision SET value=value+1 WHERE id=1; END;
