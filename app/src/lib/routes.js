/**
 * URL helpers for the routes in D6: `/v/:vehicleId/<section>`, `/garage` and `/settings`.
 */

/** A vehicle's sections, in sidebar order. Each is the last segment of `/v/:vehicleId/<section>`. */
export const VEHICLE_SECTIONS = ['overview', 'fuel', 'maintenance', 'documents', 'trends']

/**
 * Whether a vehicle shows a section. Fuel and Trends need fuel tracking; Maintenance needs service tracking.
 *
 * @param {{ tracksFuel?: boolean, tracksService?: boolean }} vehicle
 * @param {string} section
 * @returns {boolean} False for anything that isn't one of VEHICLE_SECTIONS.
 */
export function tracksSection(vehicle, section) {
  switch (section) {
    case 'fuel':
    case 'trends':
      return vehicle.tracksFuel !== false
    case 'maintenance':
      return vehicle.tracksService !== false
    default:
      return VEHICLE_SECTIONS.includes(section)
  }
}

/**
 * The URL of a vehicle's section, or of its overview when the vehicle doesn't track that section.
 *
 * @param {{ id: number, tracksFuel?: boolean, tracksService?: boolean }} vehicle
 * @param {string} [section='overview']
 * @returns {string} e.g. `/v/2/trends`.
 */
export function vehiclePath(vehicle, section = 'overview') {
  return `/v/${vehicle.id}/${tracksSection(vehicle, section) ? section : 'overview'}`
}

/**
 * The vehicle a `:vehicleId` URL segment names. The segment must be the id exactly, so `02` and `2x` name
 * nothing.
 *
 * @template {{ id: number }} V
 * @param {V[]} vehicles
 * @param {string | undefined} vehicleId
 * @returns {V | undefined}
 */
export function findVehicle(vehicles, vehicleId) {
  return vehicles.find((v) => String(v.id) === vehicleId)
}
