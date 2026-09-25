import { Router } from 'express'
import { db } from '../db.js'
import { recomputeOdometer } from '../vehicles.js'
import { validateFillUp } from '../validate.js'

const router = Router()

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function rowToFillUp(row) {
  return { ...row, isFull: !!row.isFull }
}

// Split the string rather than using `new Date(date)`, which parses YYYY-MM-DD as UTC and can shift the day.
function formatDate(date) {
  const [year, month, day] = date.split('-').map(Number)
  return `${MONTHS[month - 1]} ${day}, ${year}`
}

function formatMiles(odometer) {
  return `${odometer.toLocaleString('en-US')} mi`
}

/**
 * Checks a fill-up's reading against the same vehicle's closest fill-ups by date. Fill-ups sharing a date
 * are ordered by id, so a new fill-up counts as the latest of its day.
 * @param {{ vehicleId: number, date: string, odometer: number }} fillUp The fill-up being written.
 * @param {number | null} [excludeId] The id of the fill-up being edited, so it isn't compared with itself.
 * @returns {string | null} A message naming the conflicting fill-up, or `null` if the reading fits.
 */
function findOdometerConflict({ vehicleId, date, odometer }, excludeId = null) {
  const reading = Number(odometer)
  const position = excludeId ?? Number.MAX_SAFE_INTEGER

  const duplicate = db.prepare(`
    SELECT * FROM fill_ups WHERE vehicleId = ? AND id IS NOT ? AND date = ? AND odometer = ? LIMIT 1
  `).get(vehicleId, excludeId, date, reading)
  if (duplicate) {
    return `Matches your ${formatDate(duplicate.date)} fill-up at ${formatMiles(duplicate.odometer)}.`
  }

  const earlier = db.prepare(`
    SELECT * FROM fill_ups WHERE vehicleId = ? AND (date < ? OR (date = ? AND id < ?))
    ORDER BY date DESC, id DESC LIMIT 1
  `).get(vehicleId, date, date, position)
  if (earlier && reading <= earlier.odometer) {
    return `Must be more than ${formatMiles(earlier.odometer)}, the reading on your ${formatDate(earlier.date)} fill-up.`
  }

  const later = db.prepare(`
    SELECT * FROM fill_ups WHERE vehicleId = ? AND (date > ? OR (date = ? AND id > ?))
    ORDER BY date ASC, id ASC LIMIT 1
  `).get(vehicleId, date, date, position)
  if (later && reading >= later.odometer) {
    return `Must be less than ${formatMiles(later.odometer)}, the reading on your ${formatDate(later.date)} fill-up.`
  }

  return null
}

router.get('/', (req, res) => {
  const vehicleId = req.query.vehicleId ? Number(req.query.vehicleId) : null
  const rows = vehicleId
    ? db.prepare('SELECT * FROM fill_ups WHERE vehicleId = ? ORDER BY odometer').all(vehicleId)
    : db.prepare('SELECT * FROM fill_ups ORDER BY odometer').all()
  res.json(rows.map(rowToFillUp))
})

router.post('/', (req, res) => {
  const f = req.body
  const invalid = validateFillUp(f)
  if (invalid) return res.status(400).json(invalid)

  const conflict = findOdometerConflict(f)
  if (conflict) return res.status(422).json({ error: conflict, field: 'odometer' })

  const total = Math.round(f.gallons * f.pricePerGal * 100) / 100
  const info = db.prepare(`
    INSERT INTO fill_ups (vehicleId, date, odometer, gallons, pricePerGal, total, isFull)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(f.vehicleId, f.date, f.odometer, f.gallons, f.pricePerGal, total, f.isFull === false ? 0 : 1)
  const row = db.prepare('SELECT * FROM fill_ups WHERE id = ?').get(info.lastInsertRowid)
  res.status(201).json({ fillUp: rowToFillUp(row), vehicle: recomputeOdometer(row.vehicleId) })
})

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM fill_ups WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Fill-up not found' })

  const merged = { ...rowToFillUp(existing), ...req.body, vehicleId: existing.vehicleId }
  const invalid = validateFillUp(merged)
  if (invalid) return res.status(400).json(invalid)

  const conflict = findOdometerConflict(merged, id)
  if (conflict) return res.status(422).json({ error: conflict, field: 'odometer' })

  const total = Math.round(merged.gallons * merged.pricePerGal * 100) / 100
  db.prepare(`
    UPDATE fill_ups SET date=?, odometer=?, gallons=?, pricePerGal=?, total=?, isFull=?
    WHERE id=?
  `).run(merged.date, merged.odometer, merged.gallons, merged.pricePerGal, total, merged.isFull ? 1 : 0, id)
  const row = db.prepare('SELECT * FROM fill_ups WHERE id = ?').get(id)
  res.json({ fillUp: rowToFillUp(row), vehicle: recomputeOdometer(row.vehicleId) })
})

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM fill_ups WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Fill-up not found' })

  db.prepare('DELETE FROM fill_ups WHERE id = ?').run(id)
  res.json({ vehicle: recomputeOdometer(existing.vehicleId) })
})

export default router
