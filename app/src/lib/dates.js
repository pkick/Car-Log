// Calendar dates are local `YYYY-MM-DD` strings end to end (PLAN.md D8). This is the only module that
// constructs `Date` objects; everything else passes the strings around and compares them as text.
// Malformed input yields `null` (or `NaN` / `false`) instead of throwing, so one bad stored record
// can't crash a page while the server still accepts any string.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86400000

const pad = (n) => String(n).padStart(2, '0')

/**
 * @param {number} year
 * @param {number} month 1-12
 * @param {number} day
 * @returns {string}
 */
const formatParts = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`

/**
 * @param {number} year
 * @param {number} month 1-12
 * @returns {number}
 */
const daysInMonth = (year, month) => new Date(year, month, 0).getDate()

/**
 * @param {string} iso
 * @returns {{ year: number, month: number, day: number } | null} `null` unless `iso` is a real calendar date.
 */
function splitISO(iso) {
  const match = ISO_DATE.exec(iso ?? '')
  if (!match) return null
  const [year, month, day] = match.slice(1).map(Number)
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null
  return { year, month, day }
}

/**
 * Today's date in the local time zone.
 * @returns {string} `YYYY-MM-DD`
 */
export function todayISO() {
  const now = new Date()
  return formatParts(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/**
 * The current local calendar year.
 * @returns {number}
 */
export function currentYear() {
  return new Date().getFullYear()
}

/**
 * Parses a `YYYY-MM-DD` string as local midnight, for display formatting with `toLocaleDateString`.
 * @param {string} str
 * @returns {Date | null} `null` when `str` is not a valid calendar date.
 */
export function parseISODate(str) {
  const parts = splitISO(str)
  return parts && new Date(parts.year, parts.month - 1, parts.day)
}

/**
 * Adds calendar months. When the target month is shorter, the day clamps to its last day
 * (Jan 31 + 1 month is Feb 28, or Feb 29 in a leap year).
 * @param {string} iso `YYYY-MM-DD`
 * @param {number} n months to add; may be negative.
 * @returns {string | null} `YYYY-MM-DD`, or `null` when `iso` is malformed.
 */
export function addMonths(iso, n) {
  const parts = splitISO(iso)
  if (!parts) return null
  const { year, month, day } = parts
  const monthIndex = year * 12 + (month - 1) + n
  const targetYear = Math.floor(monthIndex / 12)
  const targetMonth = monthIndex - targetYear * 12 + 1
  return formatParts(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)))
}

/**
 * Whole calendar days from `a` to `b`. Positive when `b` is later. Unaffected by DST changes.
 * @param {string} a `YYYY-MM-DD`
 * @param {string} b `YYYY-MM-DD`
 * @returns {number} `NaN` when either date is malformed.
 */
export function daysBetween(a, b) {
  const from = splitISO(a)
  const to = splitISO(b)
  if (!from || !to) return NaN
  return (
    (Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)) / MS_PER_DAY
  )
}

/**
 * The month a date falls in, for grouping.
 * @param {string} iso `YYYY-MM-DD`
 * @returns {string | null} `YYYY-MM`, or `null` when `iso` is malformed.
 */
export function monthKey(iso) {
  return splitISO(iso) && iso.slice(0, 7)
}

/**
 * Whether `iso` falls in the `n` days up to and including `today`. Dates after `today` are outside
 * the window, and malformed dates are never inside it.
 * @param {string} iso `YYYY-MM-DD`
 * @param {number} n window length in days; `Infinity` matches every date up to `today`.
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {boolean}
 */
export function isWithinDays(iso, n, today = todayISO()) {
  const age = daysBetween(iso, today)
  return age >= 0 && age <= n
}
