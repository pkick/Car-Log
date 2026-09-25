import { addMonths, currentYear, daysBetween, monthKey, parseISODate, todayISO } from './dates'
import { CATEGORY_ID_BY_SERVICE } from './serviceCategories'

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
 * @typedef {object} Interval
 * @property {number} id
 * @property {string} categoryId the category of the first of `services`, or `other`; picks the icon, and is
 *   what older intervals without `services` match on
 * @property {string} name
 * @property {string[]} [services] service names that reset this interval (D10)
 * @property {number | null} miles
 * @property {number | null} months
 * @property {number} warnMiles
 * @property {number} warnDays
 *
 * @typedef {object} Vehicle
 * @property {Interval[]} [intervals]
 * @property {number | null} [purchaseOdometer]
 * @property {string | null} [purchaseDate] `YYYY-MM-DD`
 *
 * @typedef {object} DueItem
 * @property {number} intervalId
 * @property {string} categoryId the interval's category
 * @property {string} name
 * @property {'overdue' | 'coming-up' | 'ok'} status
 * @property {string} remainingLabel what is left of whichever limit is closer to due
 * @property {string} detailLabel
 * @property {number | null} milesRemaining
 * @property {number | null} dueOdometer the reading the interval is due at, or `null` without a miles limit
 * @property {string | null} dueDate `YYYY-MM-DD` the interval is due on, or `null` without a months limit
 * @property {number} progress how far through the interval it is, from 0: the larger of the miles and days
 *   fractions. 1 or more once it is due.
 * @property {number | null} lastServiceOdometer
 * @property {string | null} lastServiceDate
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
 * Whether a service record resets an interval: one of the record's services is in the interval's `services`
 * (D10). An interval without `services` (older data) is reset by any service in its `categoryId`. The
 * record's own `categoryId` is never read, because it only reflects the record's first service.
 * @param {{ services?: string[] }} record
 * @param {{ categoryId?: string, services?: string[] }} interval
 * @returns {boolean}
 */
export function recordResetsInterval(record, interval) {
  const services = record.services ?? []
  if (interval.services?.length) return services.some((s) => interval.services.includes(s))
  return services.some((s) => CATEGORY_ID_BY_SERVICE[s] === interval.categoryId)
}

/**
 * How much of a limit has been used, from 0. A limit of 0 or less is used up at once.
 * @param {number} used
 * @param {number} limit
 * @returns {number}
 */
const fractionUsed = (used, limit) => (limit > 0 ? (used > 0 ? used / limit : 0) : 1)

/**
 * @param {string} iso a valid `YYYY-MM-DD`
 * @returns {string} `Mar 3`, or `Mar 3, 2025` outside the current year.
 */
function formatDueDay(iso) {
  const date = parseISODate(iso)
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return date.getFullYear() === currentYear() ? day : `${day}, ${date.getFullYear()}`
}

/**
 * Status of each maintenance interval, measured from the latest service that resets it (see
 * {@link recordResetsInterval}) or from the purchase. Most urgent first, then furthest through its interval.
 * @param {Vehicle} vehicle
 * @param {ServiceRecord[]} serviceRecords
 * @param {number} currentOdometer
 * @returns {DueItem[]}
 */
export function getDueSoonItems(vehicle, serviceRecords, currentOdometer) {
  const intervals = vehicle.intervals || []
  const today = todayISO()

  const items = intervals.map((interval) => {
    const last = serviceRecords
      .filter((r) => recordResetsInterval(r, interval))
      .sort((a, b) => b.odometer - a.odometer)[0]

    const baseOdometer = last ? last.odometer : vehicle.purchaseOdometer ?? 0
    const baseDate = last ? last.date : vehicle.purchaseDate || today

    const milesSince = currentOdometer - baseOdometer
    const dueOdometer = interval.miles != null ? baseOdometer + interval.miles : null
    const dueDate = interval.months != null ? addMonths(baseDate, interval.months) : null

    const milesRemaining = interval.miles != null ? interval.miles - milesSince : null
    const daysRemaining = interval.months != null ? daysBetween(today, dueDate) : null

    const milesProgress = interval.miles != null ? fractionUsed(milesSince, interval.miles) : null
    const dateProgress = dueDate ? fractionUsed(daysBetween(baseDate, today), daysBetween(baseDate, dueDate)) : null
    const progress = Math.max(milesProgress ?? 0, dateProgress ?? 0)

    let status = 'ok'
    if ((milesRemaining != null && milesRemaining <= 0) || (daysRemaining != null && daysRemaining <= 0)) {
      status = 'overdue'
    } else if (
      (milesRemaining != null && milesRemaining <= interval.warnMiles) ||
      (daysRemaining != null && daysRemaining <= interval.warnDays)
    ) {
      status = 'coming-up'
    }

    let remainingLabel = '—'
    if (dateProgress != null && (milesProgress == null || dateProgress > milesProgress)) {
      remainingLabel =
        daysRemaining <= 0
          ? `Overdue since ${formatDueDay(dueDate)}`
          : daysRemaining < 14
            ? `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`
            : `~${Math.round(daysRemaining / 7)} wks`
    } else if (milesRemaining != null) {
      remainingLabel =
        milesRemaining <= 0
          ? `Due ${Math.abs(milesRemaining).toLocaleString()} mi ago`
          : `${milesRemaining.toLocaleString()} mi`
    }

    const detailLabel = [
      interval.miles != null ? `every ${interval.miles.toLocaleString()} mi` : null,
      interval.months != null ? `${interval.miles != null ? 'or ' : 'every '}${interval.months} mo` : null,
    ]
      .filter(Boolean)
      .join(' ')

    return {
      intervalId: interval.id,
      categoryId: interval.categoryId,
      name: interval.name,
      status,
      remainingLabel,
      detailLabel,
      milesRemaining,
      dueOdometer,
      dueDate,
      progress,
      lastServiceOdometer: last?.odometer ?? null,
      lastServiceDate: last?.date ?? null,
    }
  })

  const order = { overdue: 0, 'coming-up': 1, ok: 2 }
  return items.sort((a, b) => order[a.status] - order[b.status] || b.progress - a.progress)
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

/**
 * Fuel and service spend for each of the last three months, ending with the current month.
 * @param {FillUp[]} fillsForVehicle
 * @param {ServiceRecord[]} recordsForVehicle
 * @returns {Array<{ month: string, fuel: number, service: number }>}
 */
export function getMonthlySpend(fillsForVehicle, recordsForVehicle) {
  const today = todayISO()
  const months = []
  for (let i = 2; i >= 0; i--) {
    const date = addMonths(today, -i)
    months.push({ key: monthKey(date), month: parseISODate(date).toLocaleString('en-US', { month: 'short' }) })
  }

  return months.map(({ key, month }) => ({
    month,
    fuel: Math.round(fillsForVehicle.filter((f) => monthKey(f.date) === key).reduce((s, f) => s + f.total, 0)),
    service: Math.round(recordsForVehicle.filter((r) => monthKey(r.date) === key).reduce((s, r) => s + r.cost, 0)),
  }))
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
