import { Router } from 'express'
import { db } from '../db.js'
import { recomputeOdometer } from '../vehicles.js'
import { validateServiceRecord } from '../validate.js'
import { rowToServiceRecord } from '../records.js'

const router = Router()

router.get('/', (req, res) => {
  const vehicleId = req.query.vehicleId ? Number(req.query.vehicleId) : null
  const rows = vehicleId
    ? db.prepare('SELECT * FROM service_records WHERE vehicleId = ? ORDER BY date').all(vehicleId)
    : db.prepare('SELECT * FROM service_records ORDER BY date').all()
  res.json(rows.map(rowToServiceRecord))
})

router.post('/', (req, res) => {
  const r = req.body
  const invalid = validateServiceRecord(r)
  if (invalid) return res.status(400).json(invalid)

  const info = db.prepare(`
    INSERT INTO service_records (vehicleId, date, odometer, categoryId, services, cost, performedBy, shopName, partsUsed, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    r.vehicleId, r.date, r.odometer, r.categoryId, JSON.stringify(r.services ?? []),
    r.cost ?? 0, r.performedBy ?? null, r.shopName ?? null, r.partsUsed ?? '', r.notes ?? ''
  )
  const row = db.prepare('SELECT * FROM service_records WHERE id = ?').get(info.lastInsertRowid)
  res.status(201).json({ serviceRecord: rowToServiceRecord(row), vehicle: recomputeOdometer(row.vehicleId) })
})

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM service_records WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Service record not found' })

  const merged = { ...rowToServiceRecord(existing), ...req.body, vehicleId: existing.vehicleId }
  const invalid = validateServiceRecord(merged)
  if (invalid) return res.status(400).json(invalid)

  db.prepare(`
    UPDATE service_records SET date=?, odometer=?, categoryId=?, services=?, cost=?, performedBy=?, shopName=?, partsUsed=?, notes=?
    WHERE id=?
  `).run(
    merged.date, merged.odometer, merged.categoryId, JSON.stringify(merged.services),
    merged.cost ?? 0, merged.performedBy, merged.shopName, merged.partsUsed, merged.notes, id
  )
  const row = db.prepare('SELECT * FROM service_records WHERE id = ?').get(id)
  res.json({ serviceRecord: rowToServiceRecord(row), vehicle: recomputeOdometer(row.vehicleId) })
})

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM service_records WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Service record not found' })

  db.prepare('DELETE FROM service_records WHERE id = ?').run(id)
  res.json({ vehicle: recomputeOdometer(existing.vehicleId) })
})

export default router
