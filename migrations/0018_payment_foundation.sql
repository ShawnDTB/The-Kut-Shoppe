-- Stripe sandbox only. A durable attempt reserves the entire finalized sale.
-- Never unlock a sale on a browser redirect, timeout or unverified event.
CREATE TABLE payment_attempts (
 id TEXT PRIMARY KEY,
 sale_id TEXT NOT NULL UNIQUE REFERENCES finalized_sales(id),
 actor_user_id TEXT NOT NULL,
 merchant_id TEXT NOT NULL,
 currency TEXT NOT NULL CHECK(currency='usd'),
 amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 50 AND 99999999),
 sandbox INTEGER NOT NULL CHECK(sandbox=1),
 request_body TEXT NOT NULL,
 create_before INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('pending','paid','expired','review')),
 provider_session_id TEXT UNIQUE,
 checkout_url TEXT,
 created_at TEXT NOT NULL
);
-- statement-boundary
CREATE TABLE payment_provider_events (
 id TEXT PRIMARY KEY,
 event_type TEXT NOT NULL,
 attempt_id TEXT,
 payload_hash TEXT NOT NULL,
 outcome TEXT NOT NULL CHECK(outcome IN ('applied','ignored','review')),
 created_at TEXT NOT NULL
);
-- statement-boundary
CREATE TABLE payment_allocations (
 id TEXT PRIMARY KEY,
 attempt_id TEXT NOT NULL UNIQUE REFERENCES payment_attempts(id),
 sale_id TEXT NOT NULL UNIQUE REFERENCES finalized_sales(id),
 provider_payment_id TEXT NOT NULL UNIQUE,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 currency TEXT NOT NULL CHECK(currency='usd'),
 sandbox INTEGER NOT NULL CHECK(sandbox=1),
 created_at TEXT NOT NULL
);
-- statement-boundary
CREATE TRIGGER payment_attempt_freeze BEFORE UPDATE ON payment_attempts
WHEN NEW.id IS NOT OLD.id OR NEW.sale_id IS NOT OLD.sale_id OR NEW.actor_user_id IS NOT OLD.actor_user_id
 OR NEW.merchant_id IS NOT OLD.merchant_id OR NEW.currency IS NOT OLD.currency OR NEW.amount_cents IS NOT OLD.amount_cents
 OR NEW.sandbox IS NOT OLD.sandbox OR NEW.request_body IS NOT OLD.request_body OR NEW.create_before IS NOT OLD.create_before
 OR NEW.created_at IS NOT OLD.created_at OR (OLD.provider_session_id IS NOT NULL AND NEW.provider_session_id IS NOT OLD.provider_session_id)
BEGIN SELECT RAISE(ABORT,'Payment identity and amounts are immutable'); END;
-- statement-boundary
CREATE TRIGGER payment_attempt_no_delete BEFORE DELETE ON payment_attempts BEGIN SELECT RAISE(ABORT,'Payment attempts require controlled retention'); END;
-- statement-boundary
CREATE TRIGGER payment_allocation_no_update BEFORE UPDATE ON payment_allocations BEGIN SELECT RAISE(ABORT,'Payment allocations are immutable'); END;
-- statement-boundary
CREATE TRIGGER payment_allocation_no_delete BEFORE DELETE ON payment_allocations BEGIN SELECT RAISE(ABORT,'Payment allocations require controlled retention'); END;
-- statement-boundary
CREATE TRIGGER payment_event_no_update BEFORE UPDATE ON payment_provider_events BEGIN SELECT RAISE(ABORT,'Provider events are immutable'); END;
-- statement-boundary
CREATE TRIGGER payment_event_no_delete BEFORE DELETE ON payment_provider_events BEGIN SELECT RAISE(ABORT,'Provider events require controlled retention'); END;
-- statement-boundary
-- Database boundary protects existing cash paths and concurrent cashiers too.
CREATE TRIGGER cash_blocks_card BEFORE INSERT ON payment_attempts
WHEN EXISTS(SELECT 1 FROM cash_sale_events WHERE sale_id=NEW.sale_id)
BEGIN SELECT RAISE(ABORT,'This sale already has a cash record'); END;
-- statement-boundary
CREATE TRIGGER card_blocks_cash BEFORE INSERT ON cash_sale_events
WHEN EXISTS(SELECT 1 FROM payment_attempts WHERE sale_id=NEW.sale_id AND state!='expired')
BEGIN SELECT RAISE(ABORT,'Reconcile the card attempt before recording cash'); END;
