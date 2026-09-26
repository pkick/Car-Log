import { addMonths, daysBetween, parseISODate, todayISO } from './dates.js'
import { CATEGORY_ID_BY_SERVICE } from './serviceCategories.js'

// The due-soon math, shared by the app and the server's reminders (PLAN.md D16). The app imports it through
// `app/src/lib/vehicleStats.js`.

/**
 * @typedef {object} ServiceRecord
 * @property {string} date `YYYY-MM-DD`
 * @property {number} odometer
 * @property {string[]} services service names from `SUBCATEGORIES`
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
 * @property {string | null} [baselineDate] `YYYY-MM-DD` it was last done, entered by hand ("Set last done") for an
 *   interval with no service on record; used in place of the purchase date until a record resets the interval
 * @property {number | null} [baselineOdometer] the reading it was last done at, likewise
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
 * @property {'miles' | 'date' | null} dueBy the limit that is closer to due, which `remainingLabel` and `dueLabel`
 *   describe; `null` without limits
 * @property {string} remainingLabel what is left of whichever limit is closer to due
 * @property {string} detailLabel
 * @property {'record' | 'baseline' | 'purchase'} measuredFrom what the interval is measured from: the latest
 *   service that resets it, the interval's baseline (see {@link Interval}), or the purchase
 * @property {string} lastLabel where the interval is measured from: `Apr 22 · 79,630` for the last service or the
 *   baseline (leaving out a malformed date or a missing reading), or `Since purchase`
 * @property {string | null} dueLabel where that closer limit falls due: `due 84,630` or `due Apr 22, 2027`;
 *   `null` without limits
 * @property {number | null} milesRemaining
 * @property {number | null} dueOdometer the reading the interval is due at, or `null` without a miles limit
 * @property {string | null} dueDate `YYYY-MM-DD` the interval is due on, or `null` without a months limit
 * @property {number} progress how far through the interval it is, from 0: the larger of the miles and days
 *   fractions. 1 or more once it is due.
 * @property {number | null} lastServiceOdometer
 * @property {string | null} lastServiceDate
 */

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
 * A day as due labels and reminders show it.
 * @param {string} iso a valid `YYYY-MM-DD`
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {string} `Mar 3`, or `Mar 3, 2025` outside `today`'s year.
 */
export function formatDueDay(iso, today = todayISO()) {
  const date = parseISODate(iso)
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return iso.slice(0, 4) === today.slice(0, 4) ? day : `${day}, ${date.getFullYear()}`
}

/**
 * Where an interval is measured from, for a due item's `lastLabel`: `Apr 22 · 79,630`, leaving out a malformed
 * date or a missing reading.
 * @param {string | null | undefined} date `YYYY-MM-DD`
 * @param {number | null | undefined} odometer
 * @param {string} today `YYYY-MM-DD`
 * @returns {string}
 */
const formatReadingLabel = (date, odometer, today) =>
  [parseISODate(date) && formatDueDay(date, today), odometer > 0 && odometer.toLocaleString()].filter(Boolean).join(' · ')

/**
 * An interval's rule, as shown next to its name: `every 5,000 mi or 12 mo`, `every 24 mo`.
 * @param {{ miles: number | null, months: number | null }} interval
 * @returns {string} empty when the interval has no limits.
 */
export function formatIntervalRule(interval) {
  return [
    interval.miles != null ? `every ${interval.miles.toLocaleString()} mi` : null,
    interval.months != null ? `${interval.miles != null ? 'or ' : 'every '}${interval.months} mo` : null,
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * Status of each maintenance interval, measured from the latest service that resets it (see
 * {@link recordResetsInterval}), else from the interval's baseline date and reading where it has them, else from
 * the purchase. Most urgent first, then furthest through its interval.
 * @param {Vehicle} vehicle
 * @param {ServiceRecord[]} serviceRecords
 * @param {number} currentOdometer
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {DueItem[]}
 */
export function getDueSoonItems(vehicle, serviceRecords, currentOdometer, today = todayISO()) {
  const intervals = vehicle.intervals || []

  const items = intervals.map((interval) => {
    const last = serviceRecords
      .filter((r) => recordResetsInterval(r, interval))
      .sort((a, b) => b.odometer - a.odometer)[0]

    const baselineDate = !last && parseISODate(interval.baselineDate) ? interval.baselineDate : null
    const baselineOdometer =
      !last && Number.isFinite(interval.baselineOdometer) && interval.baselineOdometer >= 0 ? interval.baselineOdometer : null
    const measuredFrom = last ? 'record' : baselineDate || baselineOdometer != null ? 'baseline' : 'purchase'

    const baseOdometer = last ? last.odometer : baselineOdometer ?? vehicle.purchaseOdometer ?? 0
    const baseDate = last ? last.date : baselineDate || vehicle.purchaseDate || today

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

    let dueBy = null
    let remainingLabel = '—'
    let dueLabel = null
    if (dateProgress != null && (milesProgress == null || dateProgress > milesProgress)) {
      dueBy = 'date'
      remainingLabel =
        daysRemaining <= 0
          ? `Overdue since ${formatDueDay(dueDate, today)}`
          : daysRemaining < 14
            ? `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`
            : `~${Math.round(daysRemaining / 7)} wks`
      dueLabel = `due ${formatDueDay(dueDate, today)}`
    } else if (milesRemaining != null) {
      dueBy = 'miles'
      remainingLabel =
        milesRemaining <= 0
          ? `Due ${Math.abs(milesRemaining).toLocaleString()} mi ago`
          : `${milesRemaining.toLocaleString()} mi`
      dueLabel = `due ${dueOdometer.toLocaleString()}`
    }

    const lastLabel = last
      ? formatReadingLabel(last.date, last.odometer, today)
      : measuredFrom === 'baseline'
        ? formatReadingLabel(baselineDate, baselineOdometer, today)
        : 'Since purchase'

    const detailLabel = formatIntervalRule(interval)

    return {
      intervalId: interval.id,
      categoryId: interval.categoryId,
      name: interval.name,
      status,
      dueBy,
      remainingLabel,
      detailLabel,
      measuredFrom,
      lastLabel,
      dueLabel,
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
