-- The schema as of P2-F: vehicles plus the three record tables, which go with their vehicle on delete.

CREATE TABLE vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  year INTEGER,
  make TEXT,
  model TEXT,
  trim TEXT,
  vin TEXT,
  plate TEXT,
  purchaseDate TEXT,
  purchaseOdometer INTEGER,
  registrationRenewal TEXT,
  insuranceRenewal TEXT,
  tankSize REAL,
  tracksFuel INTEGER NOT NULL DEFAULT 1,
  tracksService INTEGER NOT NULL DEFAULT 1,
  odometer INTEGER,
  intervals TEXT,
  color TEXT
);

CREATE TABLE fill_ups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicleId INTEGER NOT NULL,
  date TEXT NOT NULL,
  odometer INTEGER NOT NULL,
  gallons REAL NOT NULL,
  pricePerGal REAL NOT NULL,
  total REAL NOT NULL,
  isFull INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (vehicleId) REFERENCES vehicles(id) ON DELETE CASCADE
);

CREATE TABLE service_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicleId INTEGER NOT NULL,
  date TEXT NOT NULL,
  odometer INTEGER NOT NULL,
  categoryId TEXT NOT NULL,
  services TEXT NOT NULL,
  cost REAL NOT NULL DEFAULT 0,
  performedBy TEXT,
  shopName TEXT,
  partsUsed TEXT,
  notes TEXT,
  FOREIGN KEY (vehicleId) REFERENCES vehicles(id) ON DELETE CASCADE
);

CREATE TABLE policy_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicleId INTEGER NOT NULL,
  type TEXT NOT NULL,
  date TEXT NOT NULL,
  cost REAL NOT NULL DEFAULT 0,
  renewalDate TEXT,
  provider TEXT,
  notes TEXT,
  FOREIGN KEY (vehicleId) REFERENCES vehicles(id) ON DELETE CASCADE
);
