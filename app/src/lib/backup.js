const LISTS = ['vehicles', 'fillUps', 'serviceRecords', 'policyRecords']
const RECORD_LISTS = ['fillUps', 'serviceRecords', 'policyRecords']

/**
 * Counts what a backup file would restore, or says why it isn't one. The server checks the file again,
 * record by record, before it replaces anything.
 * @param {unknown} data The parsed file.
 * @returns {{ vehicles: number, records: number } | { error: string }} `records` counts fill-ups, services
 *   and payments together.
 */
export function summarizeBackup(data) {
  if (data?.app !== 'odometer') return { error: "This file isn't an Odometer backup." }
  const missing = LISTS.find((key) => !Array.isArray(data[key]))
  if (missing) return { error: `This backup has no ${missing} list.` }
  return {
    vehicles: data.vehicles.length,
    records: RECORD_LISTS.reduce((sum, key) => sum + data[key].length, 0),
  }
}

const count = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`

/**
 * @param {{ vehicles: number, records: number }} summary From `summarizeBackup`.
 * @returns {string} The confirmation shown before a restore.
 */
export function restoreWarning({ vehicles, records }) {
  return `This replaces every vehicle and record with the backup's ${count(vehicles, 'vehicle')} and ${count(records, 'record')}.`
}

/**
 * @param {string | null} header A `Content-Disposition` header.
 * @returns {string | null} Its quoted or bare `filename`, or `null` when it has none.
 */
export function filenameFromDisposition(header) {
  const match = /filename="([^"]+)"|filename=([^;\s]+)/.exec(header ?? '')
  return match ? match[1] ?? match[2] : null
}
