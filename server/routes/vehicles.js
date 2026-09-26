import { Router } from 'express'
import { db } from '../db.js'
import { rowToVehicle, recomputeOdometer } from '../vehicles.js'
import { DEFAULT_INTERVALS } from '../seed.js'
import { validateVehicle } from '../validate.js'
import { removeReceiptFiles, vehicleReceipts } from './receipts.js'

const router = Router()

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM vehicles ORDER BY id').all()
  res.json(rows.map(rowToVehicle))
})

router.post('/', (req, res) => {
  const v = req.body
  const invalid = validateVehicle(v)
  if (invalid) return res.status(400).json(invalid)

  const info = db.prepare(`
    INSERT INTO vehicles (nickname, year, make, model, trim, vin, plate, purchaseDate, purchaseOdometer, registrationRenewal, insuranceRenewal, tankSize, tracksFuel, tracksService, intervals, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    v.nickname, v.year ?? null, v.make ?? null, v.model ?? null, v.trim ?? null, v.vin ?? null, v.plate ?? null,
    v.purchaseDate ?? null, v.purchaseOdometer ?? null, v.registrationRenewal ?? null, v.insuranceRenewal ?? null,
    v.tankSize ?? null, v.tracksFuel === false ? 0 : 1, v.tracksService === false ? 0 : 1,
    JSON.stringify(Array.isArray(v.intervals) && v.intervals.length ? v.intervals : DEFAULT_INTERVALS), v.color ?? 'slate'
  )
  res.status(201).json(recomputeOdometer(info.lastInsertRowid))
})

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Vehicle not found' })

  const merged = { ...rowToVehicle(existing), ...req.body }
  const invalid = validateVehicle(merged)
  if (invalid) return res.status(400).json(invalid)

  db.prepare(`
    UPDATE vehicles SET nickname=?, year=?, make=?, model=?, trim=?, vin=?, plate=?, purchaseDate=?, purchaseOdometer=?, registrationRenewal=?, insuranceRenewal=?, tankSize=?, tracksFuel=?, tracksService=?, intervals=?, color=?
    WHERE id=?
  `).run(
    merged.nickname, merged.year, merged.make, merged.model, merged.trim, merged.vin, merged.plate,
    merged.purchaseDate, merged.purchaseOdometer, merged.registrationRenewal, merged.insuranceRenewal,
    merged.tankSize, merged.tracksFuel ? 1 : 0, merged.tracksService ? 1 : 0,
    JSON.stringify(merged.intervals ?? []), merged.color ?? 'slate', id
  )
  res.json(recomputeOdometer(id))
})

// Fill-ups, service records, policy records and receipt rows go with the vehicle through ON DELETE CASCADE; the
// receipts' files are removed once the rows are gone.
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  const receipts = vehicleReceipts(id)
  const { changes } = db.prepare('DELETE FROM vehicles WHERE id = ?').run(id)
  if (changes === 0) return res.status(404).json({ error: 'Vehicle not found' })
  removeReceiptFiles(receipts)
  res.status(204).end()
})

export default router
