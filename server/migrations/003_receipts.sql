-- P4-C: receipts and documents. The files live in $DATA_DIR/receipts under random names (D17); a row holds what the
-- app shows about one. `recordId` is a service record, a payment, or for 'vehicle' the vehicle itself. Rows go with
-- their vehicle through ON DELETE CASCADE; the routes that delete records remove the rows and the files.

CREATE TABLE receipts (
  id INTEGER PRIMARY KEY,
  recordType TEXT NOT NULL CHECK (recordType IN ('service', 'policy', 'vehicle')),
  recordId INTEGER NOT NULL,
  vehicleId INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  storedName TEXT NOT NULL,
  thumbName TEXT,
  filename TEXT NOT NULL,
  mimeType TEXT NOT NULL,
  size INTEGER NOT NULL,
  label TEXT,
  createdAt TEXT NOT NULL
);

CREATE INDEX receipts_record ON receipts (recordType, recordId);
CREATE INDEX receipts_vehicle ON receipts (vehicleId);
