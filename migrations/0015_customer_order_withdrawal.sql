-- Preserve the reviewed version so an uncertain customer retry can recover
-- the same withdrawal without releasing reserved inventory twice.
ALTER TABLE orders ADD COLUMN customer_withdrawn_from TEXT;
