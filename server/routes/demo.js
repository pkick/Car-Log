import { Router } from 'express'
import { db } from '../db.js'
import { rollback } from '../migrate.js'
import { seedDemoData } from '../seed.js'
import { rowToVehicle } from '../vehicles.js'

const router = Router()

// The record tables, keyed as DELETE /api/demo reports their counts.
const RECORD_TABLES = { fillUps: 'fill_ups', serviceRecords: 'service_records', policyRecords: 'policy_records' }

// "Explore with demo data" on the first-run screen. Only into an empty database, so demo rows never mix with real ones.
router.post('/', (req, res) => {
  if (db.prepare('SELECT 1 FROM vehicles LIMIT 1').get()) {
    return res.status(409).json({ error: 'Demo data can only be loaded when there are no vehicles.' })
  }
  const ids = seedDemoData(db)
  const rows = db.prepare(`SELECT * FROM vehicles WHERE id IN (${ids.map(() => '?').join(', ')}) ORDER BY id`).all(...ids)
  res.status(201).json(rows.map(rowToVehicle))
})

// "Clear demo data": removes every demo vehicle and, through ON DELETE CASCADE, everything logged on it.
router.delete('/', (req, res) => {
  db.exec('BEGIN')
  try {
    const counts = Object.fromEntries(Object.entries(RECORD_TABLES).map(([key, table]) => [
      key,
      db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE vehicleId IN (SELECT id FROM vehicles WHERE isDemo = 1)`).get().n,
    ]))
    const { changes } = db.prepare('DELETE FROM vehicles WHERE isDemo = 1').run()
    db.exec('COMMIT')
    res.json({ vehicles: Number(changes), ...counts })
  } catch (err) {
    rollback(db)
    throw err
  }
})

export default router
