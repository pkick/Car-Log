// Dates in this app are local calendar dates stored as 'YYYY-MM-DD' strings. `new Date('YYYY-MM-DD')`
// parses those as UTC midnight and `toISOString()` reports the UTC date, and either one shifts the day
// by one in US evenings. All date math goes through these helpers instead.
//
// Malformed input yields null (or NaN / an invalid Date) rather than throwing, so one bad record
// can't take down a whole page.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86400000

function parts(iso) {
  const match = ISO_DATE.exec(iso ?? '')
  return match ? [Number(match[1]), Number(match[2]) - 1, Number(match[3])] : null
}

/**
 * Formats a Date as its local calendar date.
 * @param {Date} date
 * @returns {string} 'YYYY-MM-DD'
 */
export function toISODate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Today's local calendar date.
 * @returns {string} 'YYYY-MM-DD'
 */
export function todayISO() {
  return toISODate(new Date())
}

/**
 * Parses a 'YYYY-MM-DD' string as local midnight.
 * @param {string} iso
 * @returns {Date}
 */
export function parseISODate(iso) {
  const p = parts(iso)
  return p ? new Date(p[0], p[1], p[2]) : new Date(NaN)
}

/**
 * Adds calendar days (negative to subtract).
 * @param {string} iso
 * @param {number} days
 * @returns {string | null} 'YYYY-MM-DD'
 */
export function addDays(iso, days) {
  const p = parts(iso)
  return p ? toISODate(new Date(p[0], p[1], p[2] + days)) : null
}

/**
 * Adds calendar months, clamping to the end of shorter months (Jan 31 + 1 month = Feb 28).
 * @param {string} iso
 * @param {number} months
 * @returns {string | null} 'YYYY-MM-DD'
 */
export function addMonths(iso, months) {
  const p = parts(iso)
  if (!p) return null
  const [y, m, d] = p
  const lastDayOfTarget = new Date(y, m + months + 1, 0).getDate()
  return toISODate(new Date(y, m + months, Math.min(d, lastDayOfTarget)))
}

/**
 * Whole calendar days from `from` to `to`; positive when `to` is later. Unaffected by DST.
 * @param {string} from
 * @param {string} to
 * @returns {number} NaN if either date is malformed
 */
export function daysBetween(from, to) {
  const f = parts(from)
  const t = parts(to)
  if (!f || !t) return NaN
  return Math.round((Date.UTC(t[0], t[1], t[2]) - Date.UTC(f[0], f[1], f[2])) / MS_PER_DAY)
}

/**
 * The calendar month a date falls in, for grouping.
 * @param {string} iso
 * @returns {string | null} 'YYYY-MM'
 */
export function monthKey(iso) {
  return parts(iso) ? iso.slice(0, 7) : null
}
