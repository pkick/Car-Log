import { Router } from 'express'
import { db } from '../db.js'
import { validateVehicleId } from '../validate.js'

const router = Router()

/** How many stations `GET /api/stations` suggests. */
const LIMIT = 10

/**
 * `GET /api/stations?vehicleId=` lists the stations on a vehicle's fill-ups, most recently used first, for the
 * fill-up form's suggestions. Stations that differ only in case count once, spelled as on their latest fill-up.
 */
router.get('/', (req, res) => {
  const vehicleId = /^\d+$/.test(req.query.vehicleId ?? '') ? Number(req.query.vehicleId) : req.query.vehicleId
  const invalid = validateVehicleId(vehicleId)
  if (invalid) return res.status(400).json(invalid)

  const rows = db.prepare(`
    SELECT station FROM (
      SELECT station, date, id,
        ROW_NUMBER() OVER (PARTITION BY station COLLATE NOCASE ORDER BY date DESC, id DESC) AS latest
      FROM fill_ups
      WHERE vehicleId = ? AND station IS NOT NULL AND station <> ''
    )
    WHERE latest = 1
    ORDER BY date DESC, id DESC
    LIMIT ?
  `).all(vehicleId, LIMIT)
  res.json(rows.map((row) => row.station))
})

export default router
