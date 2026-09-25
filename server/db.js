import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { SEED_VEHICLES, SEED_FILL_UPS, SEED_SERVICE_RECORDS, SEED_POLICY_RECORDS } from './seed.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
fs.mkdirSync(dataDir, { recursive: true })
const dbPath = path.join(dataDir, 'odometer.db')

export const db = new DatabaseSync(dbPath)

db.exec(`
  CREATE TABLE IF NOT EXISTS vehicles (
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

  CREATE TABLE IF NOT EXISTS fill_ups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicleId INTEGER NOT NULL,
    date TEXT NOT NULL,
    odometer INTEGER NOT NULL,
    gallons REAL NOT NULL,
    pricePerGal REAL NOT NULL,
    total REAL NOT NULL,
    isFull INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (vehicleId) REFERENCES vehicles(id)
  );

  CREATE TABLE IF NOT EXISTS service_records (
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
    FOREIGN KEY (vehicleId) REFERENCES vehicles(id)
  );

  CREATE TABLE IF NOT EXISTS policy_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicleId INTEGER NOT NULL,
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    cost REAL NOT NULL DEFAULT 0,
    renewalDate TEXT,
    provider TEXT,
    notes TEXT,
    FOREIGN KEY (vehicleId) REFERENCES vehicles(id)
  );
`)

// vehicles.color was added after the table already existed on disk — CREATE TABLE IF NOT EXISTS
// is a no-op there, so add the column if an older DB file doesn't have it yet.
const vehicleColumns = db.prepare(`PRAGMA table_info(vehicles)`).all().map((c) => c.name)
if (!vehicleColumns.includes('color')) {
  db.exec(`ALTER TABLE vehicles ADD COLUMN color TEXT`)
}

function seedIfEmpty() {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM vehicles').get()
  if (count > 0) return

  const insertVehicle = db.prepare(`
    INSERT INTO vehicles (id, nickname, year, make, model, trim, vin, plate, purchaseDate, purchaseOdometer, registrationRenewal, insuranceRenewal, tankSize, tracksFuel, tracksService, odometer, intervals, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const v of SEED_VEHICLES) {
    insertVehicle.run(
      v.id, v.nickname, v.year, v.make, v.model, v.trim, v.vin, v.plate,
      v.purchaseDate, v.purchaseOdometer, v.registrationRenewal, v.insuranceRenewal,
      v.tankSize, v.tracksFuel ? 1 : 0, v.tracksService ? 1 : 0, v.odometer, JSON.stringify(v.intervals),
      v.color ?? null
    )
  }

  const insertFillUp = db.prepare(`
    INSERT INTO fill_ups (id, vehicleId, date, odometer, gallons, pricePerGal, total, isFull)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const f of SEED_FILL_UPS) {
    insertFillUp.run(f.id, f.vehicleId, f.date, f.odometer, f.gallons, f.pricePerGal, f.total, f.isFull ? 1 : 0)
  }

  const insertServiceRecord = db.prepare(`
    INSERT INTO service_records (id, vehicleId, date, odometer, categoryId, services, cost, performedBy, shopName, partsUsed, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const r of SEED_SERVICE_RECORDS) {
    insertServiceRecord.run(r.id, r.vehicleId, r.date, r.odometer, r.categoryId, JSON.stringify(r.services), r.cost, r.performedBy, r.shopName, r.partsUsed, r.notes)
  }

  const insertPolicyRecord = db.prepare(`
    INSERT INTO policy_records (id, vehicleId, type, date, cost, renewalDate, provider, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const p of SEED_POLICY_RECORDS) {
    insertPolicyRecord.run(p.id, p.vehicleId, p.type, p.date, p.cost, p.renewalDate, p.provider, p.notes)
  }

  console.log(`Seeded database: ${SEED_VEHICLES.length} vehicles, ${SEED_FILL_UPS.length} fill-ups, ${SEED_SERVICE_RECORDS.length} service records, ${SEED_POLICY_RECORDS.length} policy records`)
}

seedIfEmpty()
