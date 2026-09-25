import { addMonths, daysBetween, monthKey, parseISODate, todayISO } from './dates'

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
 * @property {string} categoryId
 * @property {number} cost
 *
 * @typedef {object} Interval
 * @property {number} id
 * @property {string} categoryId
 * @property {string} name
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
 * @property {string} categoryId
 * @property {string} name
 * @property {'overdue' | 'coming-up' | 'ok'} status
 * @property {string} remainingLabel
 * @property {string} detailLabel
 * @property {number | null} milesRemaining
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
 * Average MPG, cost per mile, and this month's fuel spend with its change from last month.
 * @param {FillUp[]} fillsForVehicle
 * @returns {{
 *   avgMpg: number | null,
 *   costPerMile: number | null,
 *   spendThisMonth: number,
 *   spendDelta: number | null,
 *   withMpg: Array<FillUp & { mpg: number | null }>,
 * }}
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

  const today = todayISO()
  const thisMonthKey = monthKey(today)
  const lastMonthKey = monthKey(addMonths(today, -1))

  const spendThisMonth = sorted.filter((f) => monthKey(f.date) === thisMonthKey).reduce((s, f) => s + f.total, 0)
  const spendLastMonth = sorted.filter((f) => monthKey(f.date) === lastMonthKey).reduce((s, f) => s + f.total, 0)
  const spendDelta = spendLastMonth > 0 ? Math.round(((spendThisMonth - spendLastMonth) / spendLastMonth) * 1000) / 10 : null

  return { avgMpg, costPerMile, spendThisMonth: Math.round(spendThisMonth), spendDelta, withMpg }
}

/**
 * Status of each maintenance interval, measured from its last service (or the purchase), most urgent first.
 * @param {Vehicle} vehicle
 * @param {ServiceRecord[]} serviceRecords
 * @param {number} currentOdometer
 * @returns {DueItem[]}
 */
export function getDueSoonItems(vehicle, serviceRecords, currentOdometer) {
  const intervals = vehicle.intervals || []
  const today = todayISO()

  const items = intervals.map((interval) => {
    const matching = serviceRecords
      .filter((r) => r.categoryId === interval.categoryId)
      .sort((a, b) => b.odometer - a.odometer)
    const last = matching[0]

    const baseOdometer = last ? last.odometer : vehicle.purchaseOdometer ?? 0
    const baseDate = last ? last.date : vehicle.purchaseDate || today

    const milesSince = currentOdometer - baseOdometer

    const milesRemaining = interval.miles != null ? interval.miles - milesSince : null
    const daysRemaining = interval.months != null ? daysBetween(today, addMonths(baseDate, interval.months)) : null

    let status = 'ok'
    if ((milesRemaining != null && milesRemaining <= 0) || (daysRemaining != null && daysRemaining <= 0)) {
      status = 'overdue'
    } else if (
      (milesRemaining != null && milesRemaining <= interval.warnMiles) ||
      (daysRemaining != null && daysRemaining <= interval.warnDays)
    ) {
      status = 'coming-up'
    }

    const remainingLabel =
      milesRemaining != null
        ? milesRemaining <= 0
          ? `Due ${Math.abs(milesRemaining).toLocaleString()} mi ago`
          : `${milesRemaining.toLocaleString()} mi`
        : daysRemaining <= 0
          ? 'OVERDUE'
          : `~${Math.round(daysRemaining / 7)} wks`

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
      lastServiceOdometer: last?.odometer ?? null,
      lastServiceDate: last?.date ?? null,
    }
  })

  const order = { overdue: 0, 'coming-up': 1, ok: 2 }
  return items.sort(
    (a, b) => order[a.status] - order[b.status] || (a.milesRemaining ?? Infinity) - (b.milesRemaining ?? Infinity)
  )
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

/**
 * How many fills were bought at each price per gallon, cheapest first.
 * @param {FillUp[]} fillsForVehicle
 * @returns {Array<{ price: number, count: number }>}
 */
export function getPricePaidBuckets(fillsForVehicle) {
  const buckets = {}
  fillsForVehicle.forEach((f) => {
    const key = f.pricePerGal.toFixed(2)
    buckets[key] = (buckets[key] || 0) + 1
  })
  return Object.entries(buckets)
    .map(([price, count]) => ({ price: parseFloat(price), count }))
    .sort((a, b) => a.price - b.price)
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
