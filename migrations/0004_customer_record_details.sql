-- Preserve all history; this receipt distinguishes customer withdrawal from
-- a shop/provider cancellation and makes repeated submissions safe.
ALTER TABLE appointments ADD COLUMN customer_withdrawal_id TEXT;
CREATE INDEX order_items_order_detail_idx ON order_items(order_id, created_at, id);
