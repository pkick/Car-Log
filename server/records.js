/**
 * Maps a `fill_ups` row to the API shape.
 * @param {object} row A row from the `fill_ups` table.
 * @returns {object} The fill-up as the API returns it, with a boolean `isFull`.
 */
export function rowToFillUp(row) {
  return { ...row, isFull: !!row.isFull }
}

/**
 * Maps a `service_records` row to the API shape.
 * @param {object} row A row from the `service_records` table.
 * @returns {object} The record as the API returns it, with `services` parsed into an array.
 */
export function rowToServiceRecord(row) {
  return { ...row, services: row.services ? JSON.parse(row.services) : [] }
}
