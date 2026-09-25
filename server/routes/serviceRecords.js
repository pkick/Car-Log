import { Router } from 'express'
import { db } from '../db.js'

const router = Router()

function rowToServiceRecord(row) {
  return { ...row, services: row.services ? JSON.parse(row.services) : [] }
}

router.get('/', (req, res) => {
  const vehicleId = req.query.vehicleId ? Number(req.query.vehicleId) : null
  const rows = vehicleId
    ? db.prepare('SELECT * FROM service_records WHERE vehicleId = ? ORDER BY date').all(vehicleId)
    : db.prepare('SELECT * FROM service_records ORDER BY date').all()
  res.json(rows.map(rowToServiceRecord))
})

router.post('/', (req, res) => {
  const r = req.body
  const info = db.prepare(`
    INSERT INTO service_records (vehicleId, date, odometer, categoryId, services, cost, performedBy, shopName, partsUsed, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    r.vehicleId, r.date, r.odometer, r.categoryId, JSON.stringify(r.services ?? []),
    r.cost ?? 0, r.performedBy ?? null, r.shopName ?? null, r.partsUsed ?? '', r.notes ?? ''
  )
  const row = db.prepare('SELECT * FROM service_records WHERE id = ?').get(info.lastInsertRowid)
  res.status(201).json(rowToServiceRecord(row))
})

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM service_records WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Service record not found' })

  const merged = { ...rowToServiceRecord(existing), ...req.body }
  db.prepare(`
    UPDATE service_records SET vehicleId=?, date=?, odometer=?, categoryId=?, services=?, cost=?, performedBy=?, shopName=?, partsUsed=?, notes=?
    WHERE id=?
  `).run(
    merged.vehicleId, merged.date, merged.odometer, merged.categoryId, JSON.stringify(merged.services ?? []),
    merged.cost, merged.performedBy, merged.shopName, merged.partsUsed, merged.notes, id
  )
  const row = db.prepare('SELECT * FROM service_records WHERE id = ?').get(id)
  res.json(rowToServiceRecord(row))
})

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM service_records WHERE id = ?').run(Number(req.params.id))
  res.status(204).end()
})

export default router
