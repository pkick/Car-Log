import { addMonths, daysBetween, isWithinDays, monthKey, parseISODate, todayISO } from './dates'
import { getAllInCostPerMile, getMonthToDateSpend, getMonthlySpendByCategory, getMpgTrend } from './vehicleStats'

/** Days in an average month (365.25 / 12), for miles per month. */
export const DAYS_PER_MONTH = 365.25 / 12

/** How many days of readings the driving pace for ranking due items looks back over, before falling back to all. */
export const RECENT_PACE_DAYS = 182

/** A month's pace needs readings spanning at least this many of its days, or one short gap would swing it. */
const MIN_MONTH_COVERAGE_DAYS = 7

/** How many of the latest full tanks the Avg MPG tile compares with the ones before them. */
export const MPG_COMPARE_TANKS = 5

/**
 * @typedef {'90d' | '1y' | 'all'} DashboardRangeValue
 *
 * @typedef {object} DashboardRange
 * @property {DashboardRangeValue} value
 * @property {string} label for the range control
 * @property {string} caption lower case, for captions: `last 90 days`
 * @property {number} days window length in days; `Infinity` for all time
 * @property {number | null} months calendar months the monthly sparklines cover, the current one included;
 *   `null` for all time (from the first record's month)
 */

/** @type {ReadonlyArray<DashboardRange>} */
export const DASHBOARD_RANGES = [
  { value: '90d', label: '90 days', caption: 'last 90 days', days: 90, months: 3 },
  { value: '1y', label: '1 year', caption: 'last year', days: 365, months: 12 },
  { value: 'all', label: 'All time', caption: 'all time', days: Infinity, months: null },
]

/** The range the Dashboard opens with until the viewer picks another. */
export const DEFAULT_RANGE = '90d'

/**
 * @param {string | null | undefined} value
 * @returns {DashboardRange} the range with that value, or the {@link DEFAULT_RANGE} one
 */
export function findDashboardRange(value) {
  return DASHBOARD_RANGES.find((r) => r.value === value) ?? DASHBOARD_RANGES.find((r) => r.value === DEFAULT_RANGE)
}

/**
 * @typedef {object} OdometerReading
 * @property {string} date `YYYY-MM-DD`
 * @property {number} odometer
 */

/**
 * Odometer readings from fill-ups and service records, oldest first. Readings without a valid date or a positive
 * odometer are left out, and a reading lower than an earlier one is raised to it, since an odometer never goes
 * back.
 * @param {OdometerReading[]} fills
 * @param {OdometerReading[]} services
 * @returns {OdometerReading[]}
 */
export function getOdometerReadings(fills, services) {
  const readings = [...fills, ...services]
    .filter((r) => monthKey(r.date) && Number.isFinite(r.odometer) && r.odometer > 0)
    .map(({ date, odometer }) => ({ date, odometer }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.odometer - b.odometer)
  let highest = 0
  return readings.map((r) => {
    highest = Math.max(highest, r.odometer)
    return { date: r.date, odometer: highest }
  })
}

/**
 * @typedef {object} DrivingPace
 * @property {number} milesPerDay unrounded
 * @property {number} milesPerMonth rounded to whole miles
 * @property {number} milesPerYear rounded to whole miles
 * @property {number} miles between the first and last reading in the window
 * @property {number} days between those readings
 */

/**
 * How far the vehicle is driven, from the first and last odometer readings in the `days` up to `today`.
 * @param {OdometerReading[]} readings from {@link getOdometerReadings}
 * @param {number} [days] window length; `Infinity` (the default) is every reading up to `today`.
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {DrivingPace | null} `null` without two readings on different days in the window.
 */
export function getDrivingPace(readings, days = Infinity, today = todayISO()) {
  const inWindow = readings.filter((r) => isWithinDays(r.date, days, today))
  if (inWindow.length < 2) return null
  const first = inWindow[0]
  const last = inWindow[inWindow.length - 1]
  const span = daysBetween(first.date, last.date)
  if (!(span > 0)) return null
  const miles = last.odometer - first.odometer
  const milesPerDay = miles / span
  return {
    milesPerDay,
    milesPerMonth: Math.round(milesPerDay * DAYS_PER_MONTH),
    milesPerYear: Math.round(milesPerDay * 365.25),
    miles,
    days: span,
  }
}

/**
 * The vehicle's recent driving pace in miles a day: over the last {@link RECENT_PACE_DAYS} days of readings, or
 * over all of them when those are too few.
 * @param {OdometerReading[]} readings from {@link getOdometerReadings}
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {number | null} `null` when no pace can be measured.
 */
export function getRecentMilesPerDay(readings, today = todayISO()) {
  const pace = getDrivingPace(readings, RECENT_PACE_DAYS, today) ?? getDrivingPace(readings, Infinity, today)
  return pace ? pace.milesPerDay : null
}

/**
 * The odometer on a day, interpolated in a straight line between the readings around it.
 * @param {OdometerReading[]} readings from {@link getOdometerReadings}
 * @param {string} iso `YYYY-MM-DD`
 * @returns {number | null} `null` before the first reading or after the last.
 */
function odometerOn(readings, iso) {
  if (!readings.length || iso < readings[0].date || iso > readings[readings.length - 1].date) return null
  let i = 0
  while (i + 1 < readings.length && readings[i + 1].date <= iso) i++
  const before = readings[i]
  const after = readings[i + 1]
  if (!after || before.date === iso) return before.odometer
  return before.odometer + (after.odometer - before.odometer) * (daysBetween(before.date, iso) / daysBetween(before.date, after.date))
}

/**
 * @typedef {object} MonthlyMiles
 * @property {string} month `YYYY-MM`
 * @property {number | null} miles driven in the part of the month the readings cover, interpolated between
 *   readings; `null` when they cover none of it
 * @property {number} days how many of the month's days the readings cover
 */

/**
 * Miles driven in each calendar month, reading the odometer at the month's first day and the next month's first
 * day by interpolating between readings. A month the readings only partly cover (the first, the last, the
 * current) counts the covered days alone.
 * @param {OdometerReading[]} readings from {@link getOdometerReadings}
 * @param {string[]} months `YYYY-MM`, in any order
 * @returns {MonthlyMiles[]} in the order of `months`
 */
export function getMonthlyMiles(readings, months) {
  if (!readings.length) return months.map((month) => ({ month, miles: null, days: 0 }))
  const firstDate = readings[0].date
  const lastDate = readings[readings.length - 1].date
  return months.map((month) => {
    const start = `${month}-01`
    const from = start > firstDate ? start : firstDate
    const nextMonth = addMonths(start, 1)
    const to = nextMonth < lastDate ? nextMonth : lastDate
    const days = daysBetween(from, to)
    if (!(days > 0)) return { month, miles: null, days: 0 }
    return { month, miles: odometerOn(readings, to) - odometerOn(readings, from), days }
  })
}

/**
 * The earliest valid date across a vehicle's records, which is where an all-time range starts.
 * @param {...Array<{ date: string }>} lists fill-ups, service records, payments
 * @returns {string | null} `YYYY-MM-DD`, or `null` when no record has a valid date
 */
export function getFirstRecordDate(...lists) {
  return lists.flat().reduce((first, r) => (monthKey(r.date) && (first == null || r.date < first) ? r.date : first), null)
}

/**
 * The calendar months a range's monthly sparklines cover, oldest first, ending with the current month.
 * @param {DashboardRange} range
 * @param {string | null} firstDate `YYYY-MM-DD` of the vehicle's first record, which starts an all-time range
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {string[]} `YYYY-MM`; at least the current month
 */
export function getRangeMonths(range, firstDate, today = todayISO()) {
  const current = monthKey(today)
  const first = monthKey(firstDate)
  const index = (key) => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7))
  const count = range.months ?? (first && first < current ? index(current) - index(first) + 1 : 1)
  const months = []
  for (let i = count - 1; i >= 0; i--) months.push(monthKey(addMonths(today, -i)))
  return months
}

/**
 * @typedef {object} MpgTile
 * @property {number | null} average of the full tanks in the range, to one decimal place
 * @property {import('./vehicleStats').TankMpg[]} points the full tanks in the range, oldest first
 * @property {number | null} delta the latest {@link MPG_COMPARE_TANKS} full tanks against the ones before them
 *   (up to as many), as a percent to one decimal place; `null` with fewer than {@link MPG_COMPARE_TANKS} + 1 tanks
 * @property {number} comparedWith how many earlier tanks `delta` compares with; 0 when `delta` is `null`
 */

/**
 * The Avg MPG tile: the average and per-tank MPG over the range, and how the latest five full tanks compare
 * with the five before them, whatever the range.
 * @param {import('./vehicleStats').FillUp[]} fills fill-ups for ONE vehicle
 * @param {number} days range length; `Infinity` for all time
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {MpgTile}
 */
export function getMpgTile(fills, days, today = todayISO()) {
  const { points, average } = getMpgTrend(fills, { days }, today)
  const all = getMpgTrend(fills, {}, today).points
  const mean = (tanks) => tanks.reduce((sum, t) => sum + t.mpg, 0) / tanks.length
  if (all.length <= MPG_COMPARE_TANKS) return { average, points, delta: null, comparedWith: 0 }

  const latest = all.slice(-MPG_COMPARE_TANKS)
  const earlier = all.slice(Math.max(0, all.length - 2 * MPG_COMPARE_TANKS), -MPG_COMPARE_TANKS)
  const before = mean(earlier)
  const delta = before > 0 ? Math.round(((mean(latest) - before) / before) * 1000) / 10 : null
  return { average, points, delta, comparedWith: delta == null ? 0 : earlier.length }
}

/**
 * @typedef {object} CostPerMileTile
 * @property {number | null} costPerMile all-in, over the range; `null` without two odometer readings in it
 * @property {{ fuel: number, service: number, policies: number } | null} perMile each part's spend over the
 *   range's miles, unrounded; `policies` is insurance and registration together
 * @property {number[]} trend all-in cost per mile of each month in `months` that has miles, oldest first
 */

/**
 * The Cost per mile tile: all-in cost per mile over the range (see `getAllInCostPerMile`), split into fuel,
 * service and policies, with a monthly trend.
 * @param {object} records for ONE vehicle
 * @param {import('./vehicleStats').FillUp[]} records.fills
 * @param {import('./vehicleStats').ServiceRecord[]} records.services
 * @param {import('./vehicleStats').PolicyRecord[]} records.policies
 * @param {number} days range length; `Infinity` for all time
 * @param {string[]} months `YYYY-MM`, oldest first, from {@link getRangeMonths}
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {CostPerMileTile}
 */
export function getCostPerMileTile({ fills, services, policies }, days, months, today = todayISO()) {
  const cpm = getAllInCostPerMile(fills, services, policies, days, today)
  const spendByMonth = getMonthlySpendByCategory(fills, services, policies, months.length, today)
  const milesByMonth = getMonthlyMiles(getOdometerReadings(fills, services), months)
  const trend = milesByMonth
    .map((m, i) => (m.miles > 0 ? spendByMonth[i].total / m.miles : null))
    .filter((value) => value != null)

  if (!cpm) return { costPerMile: null, perMile: null, trend }
  const { spend, miles } = cpm
  return {
    costPerMile: cpm.costPerMile,
    perMile: { fuel: spend.fuel / miles, service: spend.service / miles, policies: (spend.insurance + spend.registration) / miles },
    trend,
  }
}

/**
 * @typedef {object} MonthSpendTile
 * @property {number} current fuel and service spend from the 1st of this month through today
 * @property {number} fuel the fuel part of `current`
 * @property {number} service the service part of `current`
 * @property {number} previous fuel and service spend over the same days of last month
 * @property {number | null} delta percent change from `previous`, to one decimal place; `null` when `previous`
 *   is 0
 * @property {string} monthLabel this month, short: `Sep`
 * @property {string} previousLabel last month's comparison window: `Aug 1–26`, or `Aug 1`
 * @property {number[]} trend fuel and service spend of each month in `months`, oldest first, this one so far last
 */

/**
 * The Spent this month tile: fuel and service spend so far this month against the same days last month (see
 * `getMonthToDateSpend`), with a monthly trend.
 * @param {object} records for ONE vehicle
 * @param {import('./vehicleStats').FillUp[]} records.fills
 * @param {import('./vehicleStats').ServiceRecord[]} records.services
 * @param {string[]} months `YYYY-MM`, oldest first, ending with this month, from {@link getRangeMonths}
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {MonthSpendTile}
 */
export function getMonthSpendTile({ fills, services }, months, today = todayISO()) {
  const fuel = getMonthToDateSpend(fills, today)
  const service = getMonthToDateSpend(services.map((r) => ({ date: r.date, total: r.cost })), today)
  const current = fuel.current + service.current
  const previous = fuel.previous + service.previous
  const monthly = getMonthlySpendByCategory(fills, services, [], months.length, today)

  const short = (iso) => parseISODate(iso).toLocaleDateString('en-US', { month: 'short' })
  const previousEnd = addMonths(today, -1)
  const endDay = Number(previousEnd.slice(8))
  return {
    current,
    fuel: fuel.current,
    service: service.current,
    previous,
    delta: previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null,
    monthLabel: short(today),
    previousLabel: `${short(previousEnd)} 1${endDay > 1 ? `–${endDay}` : ''}`,
    trend: monthly.map((m) => m.fuel + m.service),
  }
}

/**
 * @typedef {object} PaceTile
 * @property {DrivingPace | null} pace over the range's readings
 * @property {number[]} trend miles per month of each month in `months` whose readings cover at least a week,
 *   oldest first
 */

/**
 * The Driving tile: miles per month from the odometer readings in the range, with a monthly trend.
 * @param {object} records for ONE vehicle
 * @param {OdometerReading[]} records.fills
 * @param {OdometerReading[]} records.services
 * @param {number} days range length; `Infinity` for all time
 * @param {string[]} months `YYYY-MM`, oldest first, from {@link getRangeMonths}
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {PaceTile}
 */
export function getPaceTile({ fills, services }, days, months, today = todayISO()) {
  const readings = getOdometerReadings(fills, services)
  const trend = getMonthlyMiles(readings, months)
    .filter((m) => m.miles != null && m.days >= MIN_MONTH_COVERAGE_DAYS)
    .map((m) => (m.miles / m.days) * DAYS_PER_MONTH)
  return { pace: getDrivingPace(readings, days, today), trend }
}
