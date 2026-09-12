CREATE TABLE commerce_revision (id INTEGER PRIMARY KEY CHECK(id=1), value INTEGER NOT NULL DEFAULT 0);
-- statement-boundary
INSERT INTO commerce_revision(id,value) VALUES(1,0);
-- statement-boundary
CREATE TABLE commerce_receipts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, created_at TEXT NOT NULL);
-- statement-boundary
ALTER TABLE orders ADD COLUMN request_key TEXT;
-- statement-boundary
ALTER TABLE orders ADD COLUMN request_fingerprint TEXT;
-- statement-boundary
CREATE UNIQUE INDEX orders_customer_request_idx ON orders(customer_user_id,request_key) WHERE request_key IS NOT NULL;
-- statement-boundary
CREATE TRIGGER commerce_products_insert AFTER INSERT ON products BEGIN UPDATE commerce_revision SET value=value+1 WHERE id=1; END;
-- statement-boundary
CREATE TRIGGER commerce_products_update AFTER UPDATE ON products BEGIN UPDATE commerce_revision SET value=value+1 WHERE id=1; END;
-- statement-boundary
CREATE TRIGGER commerce_products_delete AFTER DELETE ON products BEGIN UPDATE commerce_revision SET value=value+1 WHERE id=1; END;
-- statement-boundary
CREATE TRIGGER commerce_variants_insert AFTER INSERT ON product_variants BEGIN UPDATE commerce_revision SET value=value+1 WHERE id=1; END;
-- statement-boundary
CREATE TRIGGER commerce_variants_update AFTER UPDATE ON product_variants BEGIN UPDATE commerce_revision SET value=value+1 WHERE id=1; END;
-- statement-boundary
CREATE TRIGGER commerce_variants_delete AFTER DELETE ON product_variants BEGIN UPDATE commerce_revision SET value=value+1 WHERE id=1; END;
-- statement-boundary
CREATE TRIGGER commerce_orders_insert AFTER INSERT ON orders BEGIN UPDATE commerce_revision SET value=value+1 WHERE id=1; END;
-- statement-boundary
CREATE TRIGGER commerce_orders_update AFTER UPDATE ON orders BEGIN UPDATE commerce_revision SET value=value+1 WHERE id=1; END;
-- statement-boundary
CREATE TRIGGER commerce_images_insert AFTER INSERT ON product_images BEGIN UPDATE commerce_revision SET value=value+1 WHERE id=1; END;
-- statement-boundary
CREATE TRIGGER commerce_images_update AFTER UPDATE ON product_images BEGIN UPDATE commerce_revision SET value=value+1 WHERE id=1; END;
-- statement-boundary
CREATE TRIGGER commerce_images_delete AFTER DELETE ON product_images BEGIN UPDATE commerce_revision SET value=value+1 WHERE id=1; END;
-- statement-boundary
CREATE TRIGGER commerce_orders_delete AFTER DELETE ON orders BEGIN UPDATE commerce_revision SET value=value+1 WHERE id=1; END;
-- statement-boundary
CREATE TRIGGER commerce_items_insert AFTER INSERT ON order_items BEGIN UPDATE commerce_revision SET value=value+1 WHERE id=1; END;
-- statement-boundary
CREATE TRIGGER commerce_items_update AFTER UPDATE ON order_items BEGIN UPDATE commerce_revision SET value=value+1 WHERE id=1; END;
-- statement-boundary
CREATE TRIGGER commerce_items_delete AFTER DELETE ON order_items BEGIN UPDATE commerce_revision SET value=value+1 WHERE id=1; END;
