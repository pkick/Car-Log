import { Router } from 'express'
import { db } from '../db.js'
import { currentSchemaVersion, rollback } from '../migrate.js'
import { rowToVehicle, recomputeOdometer } from '../vehicles.js'
import { rowToFillUp, rowToServiceRecord } from '../records.js'
import { validateVehicle, validateFillUp, validateServiceRecord, validatePolicyRecord } from '../validate.js'

const router = Router()

const LISTS = ['vehicles', 'fillUps', 'serviceRecords', 'policyRecords']
const TABLES = ['vehicles', 'fill_ups', 'service_records', 'policy_records']

const pad = (n) => String(n).padStart(2, '0')

/**
 * @param {Date} now
 * @returns {string} The server's local date as `YYYY-MM-DD`.
 */
function localDate(now) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * @param {Date} now
 * @returns {string} The server's local time with its UTC offset, e.g. `2026-09-25T16:48:37-07:00`.
 */
function localTimestamp(now) {
  const offset = -now.getTimezoneOffset()
  const sign = offset < 0 ? '-' : '+'
  const zone = `${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
  return `${localDate(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${zone}`
}

router.get('/export', (req, res) => {
  const now = new Date()
  const backup = {
    app: 'odometer',
    schemaVersion: currentSchemaVersion(db),
    exportedAt: localTimestamp(now),
    vehicles: db.prepare('SELECT * FROM vehicles ORDER BY id').all().map(rowToVehicle),
    fillUps: db.prepare('SELECT * FROM fill_ups ORDER BY id').all().map(rowToFillUp),
    serviceRecords: db.prepare('SELECT * FROM service_records ORDER BY id').all().map(rowToServiceRecord),
    policyRecords: db.prepare('SELECT * FROM policy_records ORDER BY id').all(),
  }
  res.attachment(`odometer-backup-${localDate(now)}.json`)
  res.send(JSON.stringify(backup, null, 2))
})

/** A reason to reject a backup, written for the person restoring it. */
class ImportError extends Error {}

/**
 * Rejects a file that isn't a backup this server can restore.
 * @param {unknown} backup The request body.
 * @returns {void}
 * @throws {ImportError}
 */
function checkBackup(backup) {
  if (backup?.app !== 'odometer') throw new ImportError("This file isn't an Odometer backup.")
  const current = currentSchemaVersion(db)
  if (!Number.isInteger(backup.schemaVersion) || backup.schemaVersion < 1) {
    throw new ImportError("This backup doesn't say which schema version it uses.")
  }
  if (backup.schemaVersion > current) {
    throw new ImportError(
      `This backup is from a newer version of Odometer (schema ${backup.schemaVersion}; this server is on ${current}). ` +
      'Upgrade Odometer, then restore it.'
    )
  }
  const missing = LISTS.find((key) => !Array.isArray(backup[key]))
  if (missing) throw new ImportError(`This backup has no ${missing} list.`)
}

/**
 * @param {string[]} fields Fields that must be text when present.
 * @returns {(record: object) => { error: string, field: string } | null}
 */
const textFields = (fields) => (record) => {
  const field = fields.find((name) => record[name] != null && typeof record[name] !== 'string')
  return field ? { error: `${field} must be text.`, field } : null
}

const checkVehicleText = textFields(['make', 'model', 'trim', 'vin', 'plate', 'color'])
const checkServiceText = textFields(['performedBy', 'shopName', 'partsUsed', 'notes'])
const checkPolicyText = textFields(['provider', 'notes'])

/**
 * Checks each record of one list and inserts it, keeping its id.
 * @param {unknown[]} records The list from the backup.
 * @param {string} label What one record is called at the start of a sentence, e.g. `Fill-up`.
 * @param {(record: object) => { error: string } | null} check Returns the record's first problem, or `null`.
 * @param {(record: object) => void} insert Writes one checked record.
 * @returns {void}
 * @throws {ImportError} At the first record that fails.
 */
function insertAll(records, label, check, insert) {
  const ids = new Set()
  records.forEach((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new ImportError(`${label} ${index + 1} in the backup isn't a record.`)
    }
    if (!Number.isInteger(record.id) || record.id < 1) throw new ImportError(`${label} ${index + 1} in the backup has no id.`)
    if (ids.has(record.id)) throw new ImportError(`The backup has two ${label.toLowerCase()}s with id ${record.id}.`)
    ids.add(record.id)

    const problem = check(record)
    if (problem) throw new ImportError(`${label} #${record.id} in the backup: ${problem.error}`)
    insert(record)
  })
}

/**
 * Deletes every vehicle and record, then writes the backup's, keeping their ids. Call it inside a transaction.
 * @param {object} backup A backup that passed `checkBackup`.
 * @returns {{ vehicles: number, fillUps: number, serviceRecords: number, policyRecords: number }} What was restored.
 * @throws {ImportError} When a record fails validation.
 */
function replaceAllData(backup) {
  for (const table of [...TABLES].reverse()) db.exec(`DELETE FROM ${table}`)
  db.prepare(`DELETE FROM sqlite_sequence WHERE name IN (${TABLES.map(() => '?').join(', ')})`).run(...TABLES)

  const insertVehicle = db.prepare(`
    INSERT INTO vehicles (id, nickname, year, make, model, trim, vin, plate, purchaseDate, purchaseOdometer, registrationRenewal, insuranceRenewal, tankSize, tracksFuel, tracksService, intervals, color, isDemo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  // Backups from before schema 2 have no isDemo: everything in them is real data.
  insertAll(backup.vehicles, 'Vehicle', (v) => validateVehicle(v) ?? checkVehicleText(v), (v) => insertVehicle.run(
    v.id, v.nickname, v.year ?? null, v.make ?? null, v.model ?? null, v.trim ?? null, v.vin ?? null, v.plate ?? null,
    v.purchaseDate ?? null, v.purchaseOdometer ?? null, v.registrationRenewal ?? null, v.insuranceRenewal ?? null,
    v.tankSize ?? null, v.tracksFuel === false ? 0 : 1, v.tracksService === false ? 0 : 1,
    JSON.stringify(v.intervals ?? []), v.color ?? 'slate', v.isDemo === true ? 1 : 0
  ))

  const insertFillUp = db.prepare(`
    INSERT INTO fill_ups (id, vehicleId, date, odometer, gallons, pricePerGal, total, isFull)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  insertAll(backup.fillUps, 'Fill-up', validateFillUp, (f) => insertFillUp.run(
    f.id, f.vehicleId, f.date, f.odometer, f.gallons, f.pricePerGal,
    Number.isFinite(f.total) && f.total >= 0 ? f.total : Math.round(f.gallons * f.pricePerGal * 100) / 100,
    f.isFull === false ? 0 : 1
  ))

  const insertServiceRecord = db.prepare(`
    INSERT INTO service_records (id, vehicleId, date, odometer, categoryId, services, cost, performedBy, shopName, partsUsed, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  insertAll(backup.serviceRecords, 'Service record', (r) => validateServiceRecord(r) ?? checkServiceText(r), (r) => insertServiceRecord.run(
    r.id, r.vehicleId, r.date, r.odometer, r.categoryId, JSON.stringify(r.services),
    r.cost ?? 0, r.performedBy ?? null, r.shopName ?? null, r.partsUsed ?? '', r.notes ?? ''
  ))

  const insertPolicyRecord = db.prepare(`
    INSERT INTO policy_records (id, vehicleId, type, date, cost, renewalDate, provider, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  insertAll(backup.policyRecords, 'Payment', (p) => validatePolicyRecord(p) ?? checkPolicyText(p), (p) => insertPolicyRecord.run(
    p.id, p.vehicleId, p.type, p.date, p.cost ?? 0, p.renewalDate ?? null, p.provider ?? null, p.notes ?? ''
  ))

  for (const { id } of backup.vehicles) recomputeOdometer(id)

  return Object.fromEntries(LISTS.map((key) => [key, backup[key].length]))
}

router.post('/import', (req, res) => {
  const backup = req.body
  try {
    checkBackup(backup)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }

  db.exec('BEGIN')
  try {
    const counts = replaceAllData(backup)
    db.exec('COMMIT')
    res.json(counts)
  } catch (err) {
    rollback(db)
    if (!(err instanceof ImportError)) console.error(err)
    res.status(400).json({ error: err instanceof ImportError ? err.message : `Couldn't restore this backup: ${err.message}` })
  }
})

export default router
