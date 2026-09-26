-- P4-D: reminders. `settings` holds JSON values by key (the notification channels, schedule and warn-at defaults,
-- and when the daily check and weekly digest last ran). `notification_log` records each reminder sent, so the
-- daily check sends one per interval or renewal per state; a vehicle's rows go with it.

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE notification_log (
  id INTEGER PRIMARY KEY,
  vehicleId INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  itemKey TEXT NOT NULL,
  state TEXT NOT NULL,
  sentAt TEXT NOT NULL
);

CREATE INDEX notification_log_item ON notification_log (vehicleId, itemKey);
