import { Router } from 'express'
import { db } from '../db.js'

const router = Router()

function rowToFillUp(row) {
  return { ...row, isFull: !!row.isFull }
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
  const total = Math.round(f.gallons * f.pricePerGal * 100) / 100
  const info = db.prepare(`
    INSERT INTO fill_ups (vehicleId, date, odometer, gallons, pricePerGal, total, isFull)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(f.vehicleId, f.date, f.odometer, f.gallons, f.pricePerGal, total, f.isFull === false ? 0 : 1)
  const row = db.prepare('SELECT * FROM fill_ups WHERE id = ?').get(info.lastInsertRowid)
  res.status(201).json(rowToFillUp(row))
})

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM fill_ups WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Fill-up not found' })

  const merged = { ...rowToFillUp(existing), ...req.body }
  const total = Math.round(merged.gallons * merged.pricePerGal * 100) / 100
  db.prepare(`
    UPDATE fill_ups SET vehicleId=?, date=?, odometer=?, gallons=?, pricePerGal=?, total=?, isFull=?
    WHERE id=?
  `).run(merged.vehicleId, merged.date, merged.odometer, merged.gallons, merged.pricePerGal, total, merged.isFull ? 1 : 0, id)
  const row = db.prepare('SELECT * FROM fill_ups WHERE id = ?').get(id)
  res.json(rowToFillUp(row))
})

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM fill_ups WHERE id = ?').run(Number(req.params.id))
  res.status(204).end()
})

export default router
