-- A database-maintained revision protects availability snapshots against any
-- concurrent schedule, eligibility, hold, or appointment change. Keep these
-- triggers when adding staff APIs. Delimiters preserve complete trigger bodies
-- in the local Workers migration runner; Wrangler accepts this as ordinary SQL.
-- statement-boundary
CREATE TABLE booking_revision (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL);

-- statement-boundary
INSERT INTO booking_revision(id, version) VALUES (1, 0);

-- statement-boundary
ALTER TABLE appointments ADD COLUMN client_request_key TEXT;

-- statement-boundary
ALTER TABLE appointments ADD COLUMN client_request_hash TEXT;

-- statement-boundary
ALTER TABLE appointments ADD COLUMN reserved_until TEXT;

-- statement-boundary
CREATE UNIQUE INDEX appointments_customer_request_key_idx ON appointments(customer_user_id, client_request_key) WHERE client_request_key IS NOT NULL;

-- statement-boundary
CREATE TRIGGER booking_revision_users_insert AFTER INSERT ON users
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_users_update AFTER UPDATE ON users
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_users_delete AFTER DELETE ON users
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_staff_profiles_insert AFTER INSERT ON staff_profiles
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_staff_profiles_update AFTER UPDATE ON staff_profiles
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_staff_profiles_delete AFTER DELETE ON staff_profiles
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_staff_locations_insert AFTER INSERT ON staff_locations
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_staff_locations_update AFTER UPDATE ON staff_locations
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_staff_locations_delete AFTER DELETE ON staff_locations
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_services_insert AFTER INSERT ON services
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_services_update AFTER UPDATE ON services
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_services_delete AFTER DELETE ON services
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_staff_services_insert AFTER INSERT ON staff_services
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_staff_services_update AFTER UPDATE ON staff_services
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_staff_services_delete AFTER DELETE ON staff_services
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_locations_insert AFTER INSERT ON locations
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_locations_update AFTER UPDATE ON locations
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_locations_delete AFTER DELETE ON locations
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_weekly_availability_insert AFTER INSERT ON weekly_availability
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_weekly_availability_update AFTER UPDATE ON weekly_availability
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_weekly_availability_delete AFTER DELETE ON weekly_availability
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_schedule_exceptions_insert AFTER INSERT ON schedule_exceptions
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_schedule_exceptions_update AFTER UPDATE ON schedule_exceptions
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_schedule_exceptions_delete AFTER DELETE ON schedule_exceptions
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_appointment_holds_insert AFTER INSERT ON appointment_holds
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_appointment_holds_update AFTER UPDATE ON appointment_holds
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_appointment_holds_delete AFTER DELETE ON appointment_holds
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_appointments_insert AFTER INSERT ON appointments
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_appointments_update AFTER UPDATE ON appointments
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;

-- statement-boundary
CREATE TRIGGER booking_revision_appointments_delete AFTER DELETE ON appointments
BEGIN
  UPDATE booking_revision SET version = version + 1 WHERE id = 1;
END;
