PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'staff', 'manager', 'owner', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended', 'disabled')),
  email_verified_at TEXT,
  phone_verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE phone_verification_challenges (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('account_access', 'account_creation', 'booking', 'staff_setup', 'staff_access')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at TEXT NOT NULL,
  verified_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX phone_verification_phone_idx ON phone_verification_challenges(phone, expires_at);

CREATE TABLE customer_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  marketing_consent INTEGER NOT NULL DEFAULT 0 CHECK (marketing_consent IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  phone TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE staff_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  professional_name TEXT NOT NULL,
  public_slug TEXT NOT NULL UNIQUE,
  public_bio TEXT,
  photo_url TEXT,
  accepts_new_clients INTEGER NOT NULL DEFAULT 1 CHECK (accepts_new_clients IN (0, 1)),
  participates_in_any_available INTEGER NOT NULL DEFAULT 1 CHECK (participates_in_any_available IN (0, 1)),
  accepts_walk_ins INTEGER NOT NULL DEFAULT 1 CHECK (accepts_walk_ins IN (0, 1)),
  booking_buffer_minutes INTEGER NOT NULL DEFAULT 10 CHECK (booking_buffer_minutes >= 0),
  minimum_notice_hours INTEGER NOT NULL DEFAULT 2 CHECK (minimum_notice_hours >= 0),
  booking_window_days INTEGER NOT NULL DEFAULT 30 CHECK (booking_window_days > 0),
  setup_status TEXT NOT NULL DEFAULT 'draft' CHECK (setup_status IN ('draft', 'pending_review', 'approved', 'disabled')),
  relationship_status TEXT NOT NULL DEFAULT 'pending_review' CHECK (relationship_status IN ('pending_review', 'employee', 'contractor', 'booth_renter', 'other')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE staff_locations (
  staff_id TEXT NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  PRIMARY KEY (staff_id, location_id)
);

CREATE TABLE services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  external_source TEXT,
  external_reference TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE staff_services (
  staff_id TEXT NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  custom_duration_minutes INTEGER CHECK (custom_duration_minutes > 0),
  custom_price_cents INTEGER CHECK (custom_price_cents >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (staff_id, service_id)
);

CREATE TABLE weekly_availability (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (staff_id, location_id, weekday, start_time, end_time)
);

CREATE TABLE schedule_exceptions (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  location_id TEXT REFERENCES locations(id) ON DELETE CASCADE,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  exception_type TEXT NOT NULL CHECK (exception_type IN ('time_off', 'blocked', 'added_availability', 'break')),
  note TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX schedule_exceptions_staff_time_idx ON schedule_exceptions(staff_id, starts_at, ends_at);

CREATE TABLE appointment_holds (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL REFERENCES services(id),
  location_id TEXT NOT NULL REFERENCES locations(id),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX appointment_holds_staff_time_idx ON appointment_holds(staff_id, starts_at, ends_at);
CREATE INDEX appointment_holds_expiry_idx ON appointment_holds(expires_at);

CREATE TABLE appointments (
  id TEXT PRIMARY KEY,
  customer_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_email TEXT,
  guest_phone TEXT,
  phone_verified INTEGER NOT NULL DEFAULT 0 CHECK (phone_verified IN (0, 1)),
  requested_staff_id TEXT REFERENCES staff_profiles(id) ON DELETE SET NULL,
  assigned_staff_id TEXT REFERENCES staff_profiles(id) ON DELETE SET NULL,
  service_id TEXT NOT NULL REFERENCES services(id),
  location_id TEXT NOT NULL REFERENCES locations(id),
  starts_at TEXT,
  ends_at TEXT,
  proposed_starts_at TEXT,
  proposed_ends_at TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  status TEXT NOT NULL CHECK (status IN ('requested', 'confirmed', 'reschedule_proposed', 'waitlisted', 'declined', 'cancelled', 'checked_in', 'in_service', 'completed', 'no_show')),
  client_response TEXT CHECK (client_response IS NULL OR client_response IN ('pending', 'accepted', 'rejected')),
  source TEXT NOT NULL DEFAULT 'website' CHECK (source IN ('website', 'staff', 'walk_in', 'migration')),
  customer_note TEXT,
  internal_note TEXT,
  cancellation_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  cancelled_at TEXT
);

CREATE INDEX appointments_assigned_time_idx ON appointments(assigned_staff_id, starts_at, ends_at);
CREATE INDEX appointments_requested_time_idx ON appointments(requested_staff_id, starts_at, ends_at);
CREATE INDEX appointments_customer_idx ON appointments(customer_user_id, starts_at);
CREATE INDEX appointments_status_idx ON appointments(status, starts_at);
CREATE INDEX appointments_guest_contact_idx ON appointments(guest_email, guest_phone);

CREATE TABLE appointment_events (
  id TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX appointment_events_appointment_idx ON appointment_events(appointment_id, created_at);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  base_sku TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  amazon_url TEXT,
  pickup_enabled INTEGER NOT NULL DEFAULT 1 CHECK (pickup_enabled IN (0, 1)),
  shipping_enabled INTEGER NOT NULL DEFAULT 0 CHECK (shipping_enabled IN (0, 1)),
  weight_ounces REAL NOT NULL DEFAULT 0 CHECK (weight_ounces >= 0),
  package_length_inches REAL NOT NULL DEFAULT 0 CHECK (package_length_inches >= 0),
  package_width_inches REAL NOT NULL DEFAULT 0 CHECK (package_width_inches >= 0),
  package_height_inches REAL NOT NULL DEFAULT 0 CHECK (package_height_inches >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  alt_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX product_images_product_idx ON product_images(product_id, sort_order);

CREATE TABLE product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  stock_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (stock_on_hand >= 0),
  stock_reserved INTEGER NOT NULL DEFAULT 0 CHECK (stock_reserved >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),
  image_id TEXT REFERENCES product_images(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX product_variants_product_idx ON product_variants(product_id, active);

CREATE TABLE product_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  preset_json TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE inventory_movements (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL REFERENCES product_variants(id),
  quantity_delta INTEGER NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('initial_stock', 'restock', 'reservation', 'reservation_release', 'online_sale', 'in_store_sale', 'return', 'damage', 'manual_adjustment')),
  reference_type TEXT,
  reference_id TEXT,
  note TEXT,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX inventory_movements_variant_idx ON inventory_movements(variant_id, created_at);

CREATE TABLE carts (
  id TEXT PRIMARY KEY,
  customer_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  guest_token_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'converted', 'abandoned', 'expired')),
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE cart_items (
  cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL REFERENCES product_variants(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (cart_id, variant_id)
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  customer_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_email TEXT,
  guest_phone TEXT,
  status TEXT NOT NULL CHECK (status IN ('submitted', 'accepted', 'payment_required', 'paid', 'preparing', 'ready_for_pickup', 'shipped', 'completed', 'declined', 'cancelled', 'refunded')),
  owner_action_required INTEGER NOT NULL DEFAULT 1 CHECK (owner_action_required IN (0, 1)),
  fulfillment_type TEXT NOT NULL CHECK (fulfillment_type IN ('pickup', 'shipping')),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  shipping_cents INTEGER NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  tax_cents INTEGER NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  shipping_address_json TEXT,
  tracking_number TEXT,
  internal_note TEXT,
  payment_provider TEXT,
  payment_reference TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL REFERENCES product_variants(id),
  product_name TEXT NOT NULL,
  variant_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  created_at TEXT NOT NULL
);

CREATE INDEX orders_customer_idx ON orders(customer_user_id, created_at);
CREATE INDEX orders_status_idx ON orders(status, created_at);
CREATE INDEX orders_guest_contact_idx ON orders(guest_email, guest_phone);

CREATE TABLE notification_outbox (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  template TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  related_type TEXT NOT NULL CHECK (related_type IN ('appointment', 'order', 'account', 'verification')),
  related_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'cancelled')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE INDEX notification_outbox_status_idx ON notification_outbox(status, next_attempt_at, created_at);
CREATE INDEX notification_outbox_related_idx ON notification_outbox(related_type, related_id);

CREATE TABLE earning_entries (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff_profiles(id),
  appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('service_sale', 'tip', 'product_commission', 'adjustment', 'deduction')),
  gross_cents INTEGER NOT NULL,
  shop_share_cents INTEGER NOT NULL DEFAULT 0,
  staff_share_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'void')),
  note TEXT,
  created_at TEXT NOT NULL,
  approved_at TEXT,
  approved_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX earning_entries_staff_status_idx ON earning_entries(staff_id, status, created_at);

CREATE TABLE payout_accounts (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL UNIQUE REFERENCES staff_profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'manual' CHECK (mode IN ('manual', 'processor')),
  provider TEXT,
  provider_account_reference TEXT,
  frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'manual')),
  status TEXT NOT NULL DEFAULT 'not_connected' CHECK (status IN ('not_connected', 'pending_review', 'active', 'restricted', 'disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE payouts (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff_profiles(id),
  payout_account_id TEXT REFERENCES payout_accounts(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'processing', 'paid', 'failed', 'cancelled')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'check', 'payroll', 'bank_transfer', 'other')),
  external_reference TEXT,
  period_start TEXT,
  period_end TEXT,
  approved_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  paid_at TEXT
);

CREATE TABLE payout_items (
  payout_id TEXT NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  earning_entry_id TEXT NOT NULL UNIQUE REFERENCES earning_entries(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  PRIMARY KEY (payout_id, earning_entry_id)
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata_json TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX audit_events_entity_idx ON audit_events(entity_type, entity_id, created_at);
CREATE INDEX audit_events_actor_idx ON audit_events(actor_user_id, created_at);

INSERT INTO locations (
  id,
  name,
  address_line_1,
  city,
  state,
  postal_code,
  timezone,
  phone,
  active,
  created_at,
  updated_at
) VALUES (
  'main-street',
  'The Kut Shoppe',
  '518 Main Street',
  'Stroudsburg',
  'PA',
  '18360',
  'America/New_York',
  '570-421-5887',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
