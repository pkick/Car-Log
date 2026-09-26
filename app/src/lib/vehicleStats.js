import { addMonths, currentYear, daysBetween, isWithinDays, monthKey, parseISODate, todayISO } from './dates'

// The due-soon math lives in `shared/` so the server's reminders use it too (PLAN.md D16).
export { formatIntervalRule, getDueSoonItems, recordResetsInterval } from '../../../shared/dueSoon.js'

/**
 * @typedef {object} FillUp
 * @property {string} date `YYYY-MM-DD`
 * @property {number} odometer
 * @property {number} gallons
 * @property {number} pricePerGal
 * @property {number} total
 * @property {boolean} isFull
 *
 * @typedef {object} ServiceRecord
 * @property {string} date `YYYY-MM-DD`
 * @property {number} odometer
 * @property {string[]} services service names from `SUBCATEGORIES`
 * @property {string} categoryId the category of the first service, for display. Never used for matching.
 * @property {number} cost
 *
 * @typedef {object} PolicyRecord
 * @property {'insurance' | 'registration'} type
 * @property {string} date `YYYY-MM-DD` the payment was made
 * @property {number} cost
 *
 * @typedef {import('../../../shared/dueSoon.js').Interval} Interval
 * @typedef {import('../../../shared/dueSoon.js').Vehicle} Vehicle
 * @typedef {import('../../../shared/dueSoon.js').DueItem} DueItem
 */

/**
 * Annotates each fill with the MPG of the tank it closed; partial and first full fills get `mpg: null`.
 *
 * Accumulates gallons across partial fills until the next full fill, so MPG
 * is only ever computed for a tank-to-tank span that actually started and
 * ended full. Expects fills for ONE vehicle sorted ascending by odometer.
 * @template {FillUp} T
 * @param {T[]} fillsAsc
 * @returns {Array<T & { mpg: number | null }>}
 */
export function computeFillMpg(fillsAsc) {
  let lastFullOdometer = null
  let accumulatedGallons = 0

  return fillsAsc.map((fill) => {
    accumulatedGallons += fill.gallons

    if (!fill.isFull) {
      return { ...fill, mpg: null }
    }

    let mpg = null
    if (lastFullOdometer != null && accumulatedGallons > 0) {
      const milesDriven = fill.odometer - lastFullOdometer
      mpg = Math.round((milesDriven / accumulatedGallons) * 10) / 10
    }

    lastFullOdometer = fill.odometer
    accumulatedGallons = 0
    return { ...fill, mpg }
  })
}

/**
 * Month-to-date fuel spend next to the same days of last month: the 1st through `today`, against the 1st
 * through the same day number last month. When last month is shorter, its window clamps to its last day,
 * so on Mar 31 the comparison is all of February.
 * @param {Array<{ date: string, total: number }>} fillsForVehicle
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {{ current: number, previous: number, delta: number | null }} spend in each window, and the
 *   percent change to one decimal place. `delta` is `null` when last month's window has no spend.
 */
export function getMonthToDateSpend(fillsForVehicle, today = todayISO()) {
  const spendFromFirstThrough = (end) =>
    fillsForVehicle
      .filter((f) => monthKey(f.date) === monthKey(end) && f.date <= end)
      .reduce((sum, f) => sum + f.total, 0)

  const current = spendFromFirstThrough(today)
  const previous = spendFromFirstThrough(addMonths(today, -1))
  const delta = previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null
  return { current, previous, delta }
}

/**
 * Average MPG, cost per mile, and month-to-date fuel spend with its change from the same days last month.
 * @param {FillUp[]} fillsForVehicle
 * @returns {{
 *   avgMpg: number | null,
 *   costPerMile: number | null,
 *   spendThisMonth: number,
 *   spendDelta: number | null,
 *   withMpg: Array<FillUp & { mpg: number | null }>,
 * }} `spendDelta` is `null` when nothing was spent in last month's comparison window;
 *   see {@link getMonthToDateSpend}.
 */
export function getFuelStats(fillsForVehicle) {
  const sorted = [...fillsForVehicle].sort((a, b) => a.odometer - b.odometer)
  const withMpg = computeFillMpg(sorted)
  const validMpgs = withMpg.filter((f) => f.mpg != null).map((f) => f.mpg)
  const avgMpg = validMpgs.length
    ? Math.round((validMpgs.reduce((a, b) => a + b, 0) / validMpgs.length) * 10) / 10
    : null

  const totalSpend = sorted.reduce((sum, f) => sum + f.total, 0)
  const totalMiles = sorted.length >= 2 ? sorted[sorted.length - 1].odometer - sorted[0].odometer : 0
  const costPerMile = totalMiles > 0 ? Math.round((totalSpend / totalMiles) * 100) / 100 : null

  const { current, delta } = getMonthToDateSpend(sorted)

  return { avgMpg, costPerMile, spendThisMonth: Math.round(current), spendDelta: delta, withMpg }
}

/**
 * The highest odometer reading logged for a vehicle, for the "Last: …" hint under odometer inputs.
 * Readings that are missing or not positive are ignored.
 * @param {Array<{ id: number, date: string, odometer: number }>} fills fill-ups for ONE vehicle
 * @param {Array<{ id: number, date: string, odometer: number }>} records service records for the same vehicle
 * @param {{ type: 'fill' | 'service', id: number } | null} [exclude] the record being edited. Fill-up and
 *   service ids come from separate tables and can collide, so the type says which list to skip it in.
 * @returns {{ odometer: number, date: string } | null} `null` when there is no reading.
 */
export function getLastReading(fills, records, exclude = null) {
  const keep = (type) => (r) => r.odometer > 0 && !(exclude?.type === type && exclude.id === r.id)
  const readings = [...fills.filter(keep('fill')), ...records.filter(keep('service'))]
  if (!readings.length) return null

  const last = readings.reduce((best, r) => (r.odometer > best.odometer ? r : best))
  return { odometer: last.odometer, date: last.date }
}

/**
 * Hint text for an odometer input: `Last: 84,210 on Aug 28` (with the year when it isn't this year),
 * falling back to the purchase reading when nothing has been logged.
 * @param {{ odometer: number, date: string } | null} reading from {@link getLastReading}
 * @param {number | null} [purchaseOdometer]
 * @returns {string | null} `null` when there is nothing to show.
 */
export function formatLastReading(reading, purchaseOdometer) {
  if (!reading) return purchaseOdometer > 0 ? `Last: ${purchaseOdometer.toLocaleString()} at purchase` : null
  const date = parseISODate(reading.date)
  if (!date) return `Last: ${reading.odometer.toLocaleString()}`
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const year = date.getFullYear() === currentYear() ? '' : `, ${date.getFullYear()}`
  return `Last: ${reading.odometer.toLocaleString()} on ${day}${year}`
}

/**
 * Service records, newest first.
 * @template {{ date: string }} T
 * @param {T[]} records
 * @returns {T[]}
 */
export function getServiceHistorySorted(records) {
  return [...records].sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * Best and worst MPG, cheapest price per gallon, and miles covered by the fill log.
 * @param {FillUp[]} fillsForVehicle
 * @returns {{ bestMpg: number | null, worstMpg: number | null, cheapestGal: number | null, totalMiles: number }}
 */
export function getRecords(fillsForVehicle) {
  const sorted = [...fillsForVehicle].sort((a, b) => a.odometer - b.odometer)
  const withMpg = computeFillMpg(sorted)
  const validMpgs = withMpg.filter((f) => f.mpg != null).map((f) => f.mpg)

  return {
    bestMpg: validMpgs.length ? Math.max(...validMpgs) : null,
    worstMpg: validMpgs.length ? Math.min(...validMpgs) : null,
    cheapestGal: sorted.length ? Math.min(...sorted.map((f) => f.pricePerGal)) : null,
    totalMiles: sorted.length >= 2 ? sorted[sorted.length - 1].odometer - sorted[0].odometer : 0,
  }
}

/** How far from its own average a fill's price must be, as a fraction, to count as high or low. */
const PRICE_BAND = 0.03

/**
 * @typedef {object} PricePoint
 * @property {number} id
 * @property {string} date `YYYY-MM-DD`
 * @property {number} pricePerGal
 * @property {number} change difference from the average, as a fraction of it (0.05 is 5% above)
 * @property {'high' | 'low' | 'normal'} level `high` when more than 3% above the average, `low` when more
 *   than 3% below it.
 */

/**
 * Price per gallon of the latest fill-ups, oldest first, each compared with the average of those same
 * fills, so the levels depend only on what this vehicle usually pays. Fills without a valid date are left out.
 * @param {FillUp[]} fillsForVehicle fill-ups for ONE vehicle, in any order
 * @param {number} [count] how many of the latest fill-ups to include
 * @returns {{ average: number | null, low: number | null, high: number | null, points: PricePoint[] }}
 *   `average` is the unrounded mean of the points' prices; `average`, `low` and `high` are `null` when
 *   there are no points.
 */
export function getPriceHistory(fillsForVehicle, count = 12) {
  const dated = fillsForVehicle
    .filter((f) => monthKey(f.date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.odometer - b.odometer)
  const recent = dated.slice(Math.max(0, dated.length - count))
  if (!recent.length) return { average: null, low: null, high: null, points: [] }

  const prices = recent.map((f) => f.pricePerGal)
  const average = prices.reduce((sum, p) => sum + p, 0) / prices.length
  const points = recent.map(({ id, date, pricePerGal }) => {
    const change = (pricePerGal - average) / average
    const level = change > PRICE_BAND ? 'high' : change < -PRICE_BAND ? 'low' : 'normal'
    return { id, date, pricePerGal, change, level }
  })

  return { average, low: Math.min(...prices), high: Math.max(...prices), points }
}

/**
 * Average monthly fuel spend and gallons bought over the last `months` calendar months, including the
 * current one.
 *
 * A month with no fill-ups counts as $0 and 0 gal: the car was being tracked and no fuel was bought.
 * Months before the vehicle's first logged fill-up are left out instead, so a vehicle whose log starts two
 * months ago averages over those two months rather than being diluted by four empty ones. The current
 * month counts as a whole month even though it isn't over.
 * @param {FillUp[]} fillsForVehicle
 * @param {number} [months] window length, in calendar months
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {{ spendPerMonth: number | null, gallonsPerMonth: number | null, months: number }} spend
 *   rounded to whole dollars and gallons to one decimal place; `months` is how many months were averaged.
 *   Both averages are `null` when that is 0.
 */
export function getMonthlyFuelAverages(fillsForVehicle, months = 6, today = todayISO()) {
  const dated = fillsForVehicle.filter((f) => monthKey(f.date))
  const firstMonth = dated.reduce((first, f) => (first && first <= monthKey(f.date) ? first : monthKey(f.date)), null)

  const windowMonths = []
  for (let i = months - 1; i >= 0; i--) windowMonths.push(monthKey(addMonths(today, -i)))
  const counted = firstMonth ? windowMonths.filter((key) => key >= firstMonth) : []
  if (!counted.length) return { spendPerMonth: null, gallonsPerMonth: null, months: 0 }

  const inWindow = dated.filter((f) => counted.includes(monthKey(f.date)))
  const spend = inWindow.reduce((sum, f) => sum + f.total, 0)
  const gallons = inWindow.reduce((sum, f) => sum + f.gallons, 0)

  return {
    spendPerMonth: Math.round(spend / counted.length),
    gallonsPerMonth: Math.round((gallons / counted.length) * 10) / 10,
    months: counted.length,
  }
}

/**
 * Average miles driven per month and year, and fills per year, over the span of the fill log.
 * @param {FillUp[]} fillsForVehicle
 * @returns {{ milesPerMonth: number, milesPerYear: number, fillsPerYear: number }}
 */
export function getDrivingRate(fillsForVehicle) {
  const sorted = [...fillsForVehicle].sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length < 2) return { milesPerMonth: 0, milesPerYear: 0, fillsPerYear: 0 }

  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const daysSpan = Math.max(1, daysBetween(first.date, last.date))
  const milesSpan = last.odometer - first.odometer
  const milesPerMonth = Math.round(milesSpan / (daysSpan / 30))

  return {
    milesPerMonth,
    milesPerYear: Math.round(milesPerMonth * 12),
    fillsPerYear: Math.round(sorted.length / (daysSpan / 365)),
  }
}

/**
 * @typedef {object} TankMpg
 * @property {number} id the fill-up that closed the tank
 * @property {string} date `YYYY-MM-DD` of that fill-up
 * @property {number} mpg
 * @property {boolean} includesPartial partial fills since the previous full fill were added into this tank
 */

/**
 * MPG of each full tank, for the fuel economy chart: oldest first, with the average of the tanks returned.
 * Tanks closed on a malformed date are left out, since they can't be placed in time.
 * @param {FillUp[]} fillsForVehicle fill-ups for ONE vehicle, in any order
 * @param {object} [range] both limits apply when both are given
 * @param {number} [range.tanks] keep only the latest this many tanks
 * @param {number} [range.days] keep only tanks closed in this many days up to `today`
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {{ points: TankMpg[], average: number | null }} `average` is rounded to one decimal place, and
 *   `null` when there are no points.
 */
export function getMpgTrend(fillsForVehicle, { tanks, days } = {}, today = todayISO()) {
  const sorted = [...fillsForVehicle].sort((a, b) => a.odometer - b.odometer)
  const all = []
  let partialSinceFull = false
  for (const fill of computeFillMpg(sorted)) {
    if (!fill.isFull) {
      partialSinceFull = true
      continue
    }
    if (fill.mpg != null && monthKey(fill.date)) {
      all.push({ id: fill.id, date: fill.date, mpg: fill.mpg, includesPartial: partialSinceFull })
    }
    partialSinceFull = false
  }
  all.sort((a, b) => a.date.localeCompare(b.date))

  const recent = days != null && Number.isFinite(days) ? all.filter((t) => isWithinDays(t.date, days, today)) : all
  const points = tanks != null ? recent.slice(Math.max(0, recent.length - tanks)) : recent
  const average = points.length
    ? Math.round((points.reduce((sum, t) => sum + t.mpg, 0) / points.length) * 10) / 10
    : null
  return { points, average }
}

const SPEND_CATEGORIES = ['fuel', 'service', 'insurance', 'registration']

const toCents = (amount) => Math.round(amount * 100) / 100

/**
 * @typedef {object} CategorySpend
 * @property {number} fuel fill-up totals
 * @property {number} service service record costs
 * @property {number} insurance insurance payments
 * @property {number} registration registration payments
 * @property {number} total
 */

/**
 * Adds up fill-ups, service records and policy payments by category. Amounts that aren't numbers, and
 * policy records of another type, are skipped.
 * @param {FillUp[]} fills
 * @param {ServiceRecord[]} services
 * @param {PolicyRecord[]} policies
 * @returns {CategorySpend} rounded to the cent
 */
function sumSpend(fills, services, policies) {
  const spend = { fuel: 0, service: 0, insurance: 0, registration: 0 }
  const add = (category, amount) => {
    if (Number.isFinite(amount)) spend[category] += amount
  }
  fills.forEach((f) => add('fuel', f.total))
  services.forEach((r) => add('service', r.cost))
  policies.forEach((p) => {
    if (p.type === 'insurance' || p.type === 'registration') add(p.type, p.cost)
  })
  const rounded = Object.fromEntries(SPEND_CATEGORIES.map((c) => [c, toCents(spend[c])]))
  return { ...rounded, total: toCents(SPEND_CATEGORIES.reduce((sum, c) => sum + spend[c], 0)) }
}

/**
 * Spend per calendar month for the last `months` months, the current one included, split into fuel,
 * service, insurance and registration. A policy payment counts in the month of its `date`. Records with a
 * malformed date are left out.
 * @param {FillUp[]} fills fill-ups for ONE vehicle
 * @param {ServiceRecord[]} services service records for the same vehicle
 * @param {PolicyRecord[]} policies insurance and registration payments for the same vehicle
 * @param {number} [months] window length, in calendar months
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {Array<{ month: string } & CategorySpend>} oldest first; `month` is `YYYY-MM`, amounts are
 *   rounded to the cent, and a month with nothing logged is all zeros.
 */
export function getMonthlySpendByCategory(fills, services, policies, months = 12, today = todayISO()) {
  const inMonth = (key) => (record) => monthKey(record.date) === key
  const result = []
  for (let i = months - 1; i >= 0; i--) {
    const key = monthKey(addMonths(today, -i))
    result.push({ month: key, ...sumSpend(fills.filter(inMonth(key)), services.filter(inMonth(key)), policies.filter(inMonth(key))) })
  }
  return result
}

/**
 * Splits 100 in proportion to `values` in whole numbers that add up to exactly 100, giving the points
 * lost to rounding down to the largest remainders (earlier values first on a tie).
 * @param {number[]} values not negative
 * @returns {number[]} all zeros when the values add up to 0
 */
function wholePercents(values) {
  const total = values.reduce((sum, v) => sum + v, 0)
  if (!(total > 0)) return values.map(() => 0)
  const exact = values.map((v) => (v / total) * 100)
  const percents = exact.map(Math.floor)
  const byRemainder = exact.map((e, i) => i).sort((a, b) => exact[b] - percents[b] - (exact[a] - percents[a]) || a - b)
  let left = 100 - percents.reduce((sum, p) => sum + p, 0)
  for (const i of byRemainder) {
    if (left <= 0) break
    percents[i] += 1
    left -= 1
  }
  return percents
}

/**
 * @typedef {object} AllInCostPerMile
 * @property {number} costPerMile all spend in the window over `miles`, rounded to the cent
 * @property {number} miles between the lowest and highest odometer readings in the window
 * @property {string} firstDate `YYYY-MM-DD` of the earliest reading in the window
 * @property {string} lastDate `YYYY-MM-DD` of the latest reading in the window
 * @property {CategorySpend} spend dated in the window
 * @property {{ fuel: number, service: number, policies: number }} percent each part's share of the spend in
 *   whole percents that add up to 100 (all 0 when nothing was spent); `policies` is insurance and
 *   registration together
 */

/**
 * All-in cost per mile over the `days` up to and including `today`: fuel, service, insurance and
 * registration spend dated in the window, divided by the miles between the lowest and highest odometer
 * readings dated in the window. Readings come from fill-ups and service records; missing or zero readings
 * are ignored. A policy payment counts on its `date`, so a window holding a premium carries all of it.
 * @param {FillUp[]} fills fill-ups for ONE vehicle
 * @param {ServiceRecord[]} services service records for the same vehicle
 * @param {PolicyRecord[]} policies insurance and registration payments for the same vehicle
 * @param {number} [days] window length in days; `Infinity` (the default) is all time up to `today`.
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {AllInCostPerMile | null} `null` when the window holds fewer than two readings, or they are all
 *   the same.
 */
export function getAllInCostPerMile(fills, services, policies, days = Infinity, today = todayISO()) {
  const inWindow = (record) => isWithinDays(record.date, days, today)
  const windowFills = fills.filter(inWindow)
  const windowServices = services.filter(inWindow)

  const readings = [...windowFills, ...windowServices].filter((r) => Number.isFinite(r.odometer) && r.odometer > 0)
  if (readings.length < 2) return null
  const odometers = readings.map((r) => r.odometer)
  const miles = Math.max(...odometers) - Math.min(...odometers)
  if (miles <= 0) return null

  const dates = readings.map((r) => r.date).sort()
  const spend = sumSpend(windowFills, windowServices, policies.filter(inWindow))
  const [fuel, service, policiesShare] = wholePercents([spend.fuel, spend.service, spend.insurance + spend.registration])

  return {
    costPerMile: toCents(spend.total / miles),
    miles,
    firstDate: dates[0],
    lastDate: dates[dates.length - 1],
    spend,
    percent: { fuel, service, policies: policiesShare },
  }
}

/**
 * @typedef {object} StationPrice
 * @property {string} station the name as written on the station's latest fill-up
 * @property {number} averagePrice price per gallon weighted by gallons (what was paid per gallon there
 *   overall), unrounded
 * @property {number} fills how many fill-ups were made there
 */

/**
 * Average price per gallon at each station, cheapest first. Fill-ups are grouped by `station`, trimmed
 * and ignoring case; fill-ups without a station, or without gallons and a price, are left out.
 * @param {Array<FillUp & { station?: string | null }>} fills fill-ups for ONE vehicle, in any order
 * @returns {{ stations: StationPrice[], cheapest: StationPrice | null }} stations sorted by average
 *   price, then by more fill-ups, then by name; `cheapest` is the first, or `null` when no fill-up has a
 *   station.
 */
export function getStationInsights(fills) {
  const groups = new Map()
  const dated = [...fills].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  for (const fill of dated) {
    const name = typeof fill.station === 'string' ? fill.station.trim() : ''
    if (!name || !(fill.gallons > 0) || !Number.isFinite(fill.pricePerGal)) continue
    const key = name.toLowerCase()
    const group = groups.get(key) ?? { station: name, gallons: 0, paid: 0, fills: 0 }
    group.station = name
    group.gallons += fill.gallons
    group.paid += fill.gallons * fill.pricePerGal
    group.fills += 1
    groups.set(key, group)
  }

  const stations = [...groups.values()]
    .map(({ station, gallons, paid, fills: count }) => ({ station, averagePrice: paid / gallons, fills: count }))
    .sort((a, b) => a.averagePrice - b.averagePrice || b.fills - a.fills || a.station.localeCompare(b.station))
  return { stations, cheapest: stations[0] ?? null }
}
