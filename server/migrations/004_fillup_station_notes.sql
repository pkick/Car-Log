-- P3-C1: where a fill-up was bought and a free-text note. Both are optional, so existing fill-ups get NULL.
-- P4-E: the index serves the odometer-order and duplicate checks, which a CSV import runs for up to 5,000 rows at a
-- time, and the station suggestions; all of them look up one vehicle's fill-ups by date.

ALTER TABLE fill_ups ADD COLUMN station TEXT;
ALTER TABLE fill_ups ADD COLUMN notes TEXT;

CREATE INDEX fill_ups_vehicle_date ON fill_ups (vehicleId, date, id);
