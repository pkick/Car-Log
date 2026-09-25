import { db } from './db.js'

/**
 * Maps a `vehicles` row to the API shape (booleans and parsed intervals).
 * @param {object} row A row from the `vehicles` table.
 * @returns {object} The vehicle as the API returns it.
 */
export function rowToVehicle(row) {
  return {
    ...row,
    tracksFuel: !!row.tracksFuel,
    tracksService: !!row.tracksService,
    intervals: row.intervals ? JSON.parse(row.intervals) : [],
  }
}

/**
 * Loads one vehicle in API shape.
 * @param {number} id The vehicle id.
 * @returns {object | null} The vehicle, or `null` if no vehicle has that id.
 */
export function getVehicle(id) {
  const row = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id)
  return row ? rowToVehicle(row) : null
}

/**
 * Sets `vehicles.odometer` to the highest of `purchaseOdometer` and every fill-up and service reading (D9).
 * @param {number} vehicleId The vehicle to recompute.
 * @returns {object | null} The updated vehicle, or `null` if no vehicle has that id.
 */
export function recomputeOdometer(vehicleId) {
  db.prepare(`
    UPDATE vehicles SET odometer = MAX(
      COALESCE(purchaseOdometer, 0),
      COALESCE((SELECT MAX(f.odometer) FROM fill_ups f WHERE f.vehicleId = vehicles.id), 0),
      COALESCE((SELECT MAX(s.odometer) FROM service_records s WHERE s.vehicleId = vehicles.id), 0)
    )
    WHERE id = ?
  `).run(vehicleId)
  return getVehicle(vehicleId)
}
