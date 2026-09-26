import { rollback } from './migrate.js'

/**
 * Intervals every new vehicle starts with. Each interval is reset by a service record that includes any of
 * its `services` (D10); `categoryId` is the category of its first service and picks the icon.
 */
export const DEFAULT_INTERVALS = [
  { id: 1, categoryId: 'oil', name: 'Oil + filter', services: ['Oil + filter change'], trackBy: 'both', miles: 5000, months: 12, warnMiles: 500, warnDays: 14 },
  { id: 2, categoryId: 'tires', name: 'Tire rotation', services: ['Tire rotation'], trackBy: 'miles', miles: 5000, months: null, warnMiles: 500, warnDays: 14 },
  { id: 3, categoryId: 'brakes', name: 'Brake fluid', services: ['Brake fluid'], trackBy: 'both', miles: 30000, months: 36, warnMiles: 1000, warnDays: 30 },
  { id: 4, categoryId: 'filters', name: 'Cabin air filter', services: ['Cabin air filter'], trackBy: 'months', miles: null, months: 24, warnMiles: 750, warnDays: 21 },
]

export const SEED_VEHICLES = [
  {
    id: 1,
    nickname: 'The Wagon',
    year: 2019,
    make: 'Volvo',
    model: 'V60',
    trim: 'T5 Momentum',
    vin: 'YV1A22AK1K1234567',
    plate: '7KRM429',
    purchaseDate: '2021-04-02',
    purchaseOdometer: 41880,
    registrationRenewal: '2027-03-31',
    insuranceRenewal: '2026-11-14',
    tankSize: 15.9,
    tracksFuel: true,
    tracksService: true,
    odometer: 84210,
    intervals: structuredClone(DEFAULT_INTERVALS),
    color: 'accent',
  },
  {
    id: 2,
    nickname: 'The Truck',
    year: 2021,
    make: 'Ford',
    model: 'F-150',
    trim: 'XLT',
    vin: '1FTFW1E5XMKD12345',
    plate: '8LTC201',
    purchaseDate: '2022-09-10',
    purchaseOdometer: 18500,
    registrationRenewal: '2027-01-15',
    insuranceRenewal: '2027-02-01',
    tankSize: 26,
    tracksFuel: true,
    tracksService: true,
    odometer: 47850,
    intervals: structuredClone(DEFAULT_INTERVALS),
    color: 'teal',
  },
]

function fillUp(id, vehicleId, date, odometer, gallons, pricePerGal, isFull) {
  return {
    id,
    vehicleId,
    date,
    odometer,
    gallons,
    pricePerGal,
    total: Math.round(gallons * pricePerGal * 100) / 100,
    isFull,
  }
}

function serviceRecord(id, vehicleId, date, odometer, categoryId, services, cost, performedBy, shopName, partsUsed = '', notes = '') {
  return { id, vehicleId, date, odometer, categoryId, services, cost, performedBy, shopName, partsUsed, notes }
}

export const SEED_FILL_UPS = [
  // The Wagon (vehicleId: 1) — ~31.4 mpg average, two partial fills mixed in
  fillUp(1, 1, '2026-04-24', 79710, 15.9, 3.28, true),
  fillUp(2, 1, '2026-05-06', 80210, 15.9, 3.31, true),
  fillUp(3, 1, '2026-05-18', 80710, 15.9, 3.35, true),
  fillUp(4, 1, '2026-05-30', 80960, 8.0, 3.30, false),
  fillUp(5, 1, '2026-06-11', 81460, 15.9, 3.42, true),
  fillUp(6, 1, '2026-06-23', 81960, 15.9, 3.39, true),
  fillUp(7, 1, '2026-07-05', 82460, 16.0, 3.44, true),
  fillUp(8, 1, '2026-07-17', 82960, 15.8, 3.46, true),
  fillUp(9, 1, '2026-07-29', 83460, 16.1, 3.41, true),
  fillUp(10, 1, '2026-08-10', 83710, 8.2, 3.38, false),
  fillUp(11, 1, '2026-08-28', 84210, 15.9, 3.46, true),

  // The Truck (vehicleId: 2) — ~17.2 mpg average, two partial fills mixed in
  fillUp(12, 2, '2026-04-28', 44070, 24.4, 3.29, true),
  fillUp(13, 2, '2026-05-11', 44490, 24.4, 3.33, true),
  fillUp(14, 2, '2026-05-24', 44910, 24.4, 3.28, true),
  fillUp(15, 2, '2026-06-05', 45120, 12.2, 3.35, false),
  fillUp(16, 2, '2026-06-17', 45540, 24.4, 3.40, true),
  fillUp(17, 2, '2026-06-29', 45960, 24.6, 3.37, true),
  fillUp(18, 2, '2026-07-11', 46380, 24.2, 3.44, true),
  fillUp(19, 2, '2026-07-23', 46800, 24.5, 3.46, true),
  fillUp(20, 2, '2026-08-04', 47220, 24.3, 3.41, true),
  fillUp(21, 2, '2026-08-16', 47430, 12.3, 3.38, false),
  fillUp(22, 2, '2026-08-25', 47850, 24.4, 3.46, true),
]

export const SEED_SERVICE_RECORDS = [
  // The Wagon — tires overdue, oil coming up. The brake pads and engine air filter don't reset Brake fluid or
  // Cabin air filter (D10), so both are overdue from the purchase date.
  serviceRecord(1, 1, '2026-02-01', 76800, 'tires', ['Tire rotation'], 0, 'shop', 'Costco'),
  serviceRecord(2, 1, '2026-04-22', 79630, 'oil', ['Oil + filter change'], 58.0, 'shop', 'Ridge Auto', 'Mobil 1 0W-20 · Volvo 31372212 filter'),
  serviceRecord(3, 1, '2026-05-01', 80105, 'filters', ['Air filter'], 28.5, 'diy', 'DIY'),
  serviceRecord(4, 1, '2026-06-10', 81890, 'brakes', ['Brake pads'], 285.0, 'shop', 'Ridge Auto'),

  // The Truck — oil coming up, Brake fluid overdue by date (36 months since purchase), tires/cabin filter fresh
  serviceRecord(5, 2, '2026-04-10', 43230, 'oil', ['Oil + filter change'], 74.0, 'shop', 'Ford Quick Lane', 'Motorcraft 5W-30 · FL-820-S filter'),
  serviceRecord(6, 2, '2026-06-01', 45300, 'filters', ['Cabin air filter'], 24.0, 'diy', 'DIY'),
  serviceRecord(7, 2, '2026-07-20', 46700, 'tires', ['Tire rotation'], 0, 'shop', 'Discount Tire'),
]

function policyRecord(id, vehicleId, type, date, cost, renewalDate, provider, notes = '') {
  return { id, vehicleId, type, date, cost, renewalDate, provider, notes }
}

export const SEED_POLICY_RECORDS = [
  // The Wagon — matches vehicle.insuranceRenewal / registrationRenewal
  policyRecord(1, 1, 'insurance', '2026-05-14', 612.0, '2026-11-14', 'State Farm'),
  policyRecord(2, 1, 'registration', '2026-03-15', 145.0, '2027-03-31', 'DMV'),

  // The Truck — matches vehicle.insuranceRenewal / registrationRenewal
  policyRecord(3, 2, 'insurance', '2026-08-01', 780.0, '2027-02-01', 'Progressive'),
  policyRecord(4, 2, 'registration', '2026-01-15', 168.0, '2027-01-15', 'DMV'),
]

/**
 * Loads the demo vehicles and their records in one transaction, with every vehicle flagged `isDemo` so
 * `DELETE /api/demo` removes exactly them. The database assigns the ids, so demo data never reuses the id of a
 * vehicle or record that was deleted; on an empty database they match the ids above. `POST /api/demo` calls it,
 * and so does `db.js` on start when `SEED_DEMO=1` and the database has no vehicles.
 * @param {import('node:sqlite').DatabaseSync} database A migrated database, not inside a transaction.
 * @returns {number[]} The new vehicles' ids, in `SEED_VEHICLES` order.
 */
export function seedDemoData(database) {
  const insertVehicle = database.prepare(`
    INSERT INTO vehicles (nickname, year, make, model, trim, vin, plate, purchaseDate, purchaseOdometer, registrationRenewal, insuranceRenewal, tankSize, tracksFuel, tracksService, odometer, intervals, color, isDemo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `)
  const insertFillUp = database.prepare(`
    INSERT INTO fill_ups (vehicleId, date, odometer, gallons, pricePerGal, total, isFull)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const insertServiceRecord = database.prepare(`
    INSERT INTO service_records (vehicleId, date, odometer, categoryId, services, cost, performedBy, shopName, partsUsed, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertPolicyRecord = database.prepare(`
    INSERT INTO policy_records (vehicleId, type, date, cost, renewalDate, provider, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  database.exec('BEGIN')
  try {
    const vehicleIds = new Map()
    for (const v of SEED_VEHICLES) {
      const { lastInsertRowid } = insertVehicle.run(
        v.nickname, v.year, v.make, v.model, v.trim, v.vin, v.plate,
        v.purchaseDate, v.purchaseOdometer, v.registrationRenewal, v.insuranceRenewal,
        v.tankSize, v.tracksFuel ? 1 : 0, v.tracksService ? 1 : 0, v.odometer, JSON.stringify(v.intervals),
        v.color ?? null
      )
      vehicleIds.set(v.id, Number(lastInsertRowid))
    }
    for (const f of SEED_FILL_UPS) {
      insertFillUp.run(vehicleIds.get(f.vehicleId), f.date, f.odometer, f.gallons, f.pricePerGal, f.total, f.isFull ? 1 : 0)
    }
    for (const r of SEED_SERVICE_RECORDS) {
      insertServiceRecord.run(
        vehicleIds.get(r.vehicleId), r.date, r.odometer, r.categoryId, JSON.stringify(r.services), r.cost, r.performedBy,
        r.shopName, r.partsUsed, r.notes
      )
    }
    for (const p of SEED_POLICY_RECORDS) {
      insertPolicyRecord.run(vehicleIds.get(p.vehicleId), p.type, p.date, p.cost, p.renewalDate, p.provider, p.notes)
    }
    database.exec('COMMIT')

    console.log(`Seeded demo data: ${SEED_VEHICLES.length} vehicles, ${SEED_FILL_UPS.length} fill-ups, ${SEED_SERVICE_RECORDS.length} service records, ${SEED_POLICY_RECORDS.length} policy records`)
    return [...vehicleIds.values()]
  } catch (err) {
    rollback(database)
    throw err
  }
}
