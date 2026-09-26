import { Router } from 'express'
import { db } from '../db.js'
import { rollback } from '../migrate.js'
import { recomputeOdometer } from '../vehicles.js'
import { trimFillUpText, validateImportedFillUp, validateVehicleId } from '../validate.js'
import { describeDuplicate, findDuplicateFillUp, findOdometerConflict, insertFillUp } from './fillUps.js'

const router = Router()

/** The most fill-ups one import may carry. */
export const MAX_IMPORT_ROWS = 5000

const FIELDS = ['date', 'odometer', 'gallons', 'pricePerGal', 'total', 'isFull', 'station', 'notes']

/**
 * Picks a row's fill-up fields, so a row can't name another vehicle or an id.
 * @param {object} row One entry of the request's `rows`.
 * @param {number} vehicleId
 * @returns {object} The fill-up to check, with `station` and `notes` trimmed.
 */
function toFillUp(row, vehicleId) {
  const picked = Object.fromEntries(FIELDS.filter((field) => row[field] !== undefined).map((field) => [field, row[field]]))
  return trimFillUpText({ ...picked, vehicleId })
}

const byDateThenReading = (a, b) => (a.fillUp.date < b.fillUp.date ? -1 : a.fillUp.date > b.fillUp.date ? 1 : a.fillUp.odometer - b.fillUp.odometer)

/**
 * Writes the rows in date order, one at a time, so each is checked against the vehicle's fill-ups plus the rows
 * before it, with the same duplicate and odometer-order rules as `POST /api/fill-ups`. Call it inside a transaction.
 * @param {Array<{ index: number, fillUp: object }>} entries Rows that passed validation.
 * @returns {{ inserted: number, skipped: Array<{ index: number, reason: string }>, errors: Array<{ index: number, error: string, field: string }> }}
 */
function insertInOrder(entries) {
  const result = { inserted: 0, skipped: [], errors: [] }
  for (const { index, fillUp } of [...entries].sort(byDateThenReading)) {
    const duplicate = findDuplicateFillUp(fillUp)
    if (duplicate) {
      result.skipped.push({ index, reason: describeDuplicate(duplicate) })
      continue
    }
    const conflict = findOdometerConflict(fillUp)
    if (conflict) {
      result.errors.push({ index, error: conflict, field: 'odometer' })
      continue
    }
    insertFillUp(fillUp)
    result.inserted += 1
  }
  return result
}

/**
 * Imports many fill-ups for one vehicle in one transaction. Rows that match a fill-up already logged (same date and
 * reading) are skipped. If any row fails, nothing is written and every failure is listed.
 * Body: `{ vehicleId, rows: [{ date, odometer, gallons, pricePerGal, total?, isFull?, station?, notes? }] }`.
 */
router.post('/fill-ups', (req, res) => {
  const { vehicleId, rows } = req.body ?? {}
  const invalidVehicle = validateVehicleId(vehicleId)
  if (invalidVehicle) return res.status(400).json(invalidVehicle)
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'Send the fill-ups as a list of rows.', field: 'rows' })
  if (rows.length === 0) return res.status(400).json({ error: 'There are no fill-ups to import.', field: 'rows' })
  if (rows.length > MAX_IMPORT_ROWS) {
    return res.status(400).json({
      error: `That's ${rows.length.toLocaleString('en-US')} fill-ups; import at most ${MAX_IMPORT_ROWS.toLocaleString('en-US')} at a time.`,
      field: 'rows',
    })
  }

  const errors = []
  const valid = []
  rows.forEach((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      errors.push({ index, error: "This row isn't a fill-up.", field: null })
      return
    }
    const fillUp = toFillUp(row, vehicleId)
    const invalid = validateImportedFillUp(fillUp)
    if (invalid) errors.push({ index, ...invalid })
    else valid.push({ index, fillUp })
  })

  db.exec('BEGIN')
  try {
    const result = insertInOrder(valid)
    errors.push(...result.errors)
    if (errors.length > 0) {
      rollback(db)
      errors.sort((a, b) => a.index - b.index)
      const noun = errors.length === 1 ? 'A row has a problem' : `${errors.length} rows have problems`
      return res.status(400).json({ error: `${noun}, so nothing was imported.`, inserted: 0, skipped: result.skipped, errors })
    }
    const vehicle = recomputeOdometer(vehicleId)
    db.exec('COMMIT')
    result.skipped.sort((a, b) => a.index - b.index)
    res.json({ inserted: result.inserted, skipped: result.skipped, errors: [], vehicle })
  } catch (err) {
    rollback(db)
    throw err
  }
})

export default router
