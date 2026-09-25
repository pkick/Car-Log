import { Router } from 'express'
import { db } from '../db.js'
import { validatePolicyRecord } from '../validate.js'

const router = Router()

router.get('/', (req, res) => {
  const vehicleId = req.query.vehicleId ? Number(req.query.vehicleId) : null
  const rows = vehicleId
    ? db.prepare('SELECT * FROM policy_records WHERE vehicleId = ? ORDER BY date').all(vehicleId)
    : db.prepare('SELECT * FROM policy_records ORDER BY date').all()
  res.json(rows)
})

router.post('/', (req, res) => {
  const p = req.body
  const invalid = validatePolicyRecord(p)
  if (invalid) return res.status(400).json(invalid)

  const info = db.prepare(`
    INSERT INTO policy_records (vehicleId, type, date, cost, renewalDate, provider, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(p.vehicleId, p.type, p.date, p.cost ?? 0, p.renewalDate ?? null, p.provider ?? null, p.notes ?? '')
  const row = db.prepare('SELECT * FROM policy_records WHERE id = ?').get(info.lastInsertRowid)
  res.status(201).json(row)
})

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM policy_records WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Policy record not found' })

  const merged = { ...existing, ...req.body }
  const invalid = validatePolicyRecord(merged)
  if (invalid) return res.status(400).json(invalid)

  db.prepare(`
    UPDATE policy_records SET vehicleId=?, type=?, date=?, cost=?, renewalDate=?, provider=?, notes=?
    WHERE id=?
  `).run(merged.vehicleId, merged.type, merged.date, merged.cost ?? 0, merged.renewalDate, merged.provider, merged.notes, id)
  const row = db.prepare('SELECT * FROM policy_records WHERE id = ?').get(id)
  res.json(row)
})

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM policy_records WHERE id = ?').run(Number(req.params.id))
  res.status(204).end()
})

export default router
