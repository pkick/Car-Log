import { addMonths, monthKey, parseISODate, todayISO } from './dates'
import { CATEGORY_ID_BY_SERVICE, SERVICE_CATEGORIES } from './serviceCategories'
import { formatIntervalRule, recordResetsInterval } from './vehicleStats'

/** @typedef {import('./vehicleStats').Interval} Interval */
/** @typedef {import('./vehicleStats').ServiceRecord} ServiceRecord */

/**
 * How many due items have each status, for the schedule's filter.
 * @param {Array<{ status: 'overdue' | 'coming-up' | 'ok' }>} items from `getDueSoonItems`
 * @returns {{ all: number, overdue: number, 'coming-up': number, ok: number }}
 */
export function countByStatus(items) {
  const counts = { all: items.length, overdue: 0, 'coming-up': 0, ok: 0 }
  items.forEach((item) => {
    if (item.status in counts) counts[item.status] += 1
  })
  return counts
}

/**
 * The service categories a record's services belong to, in the order the services were picked, each once. A
 * service that isn't in any category counts as `other`.
 * @param {{ services?: string[] }} record
 * @returns {string[]} category ids
 */
export function getRecordCategoryIds(record) {
  return [...new Set((record.services ?? []).map((s) => CATEGORY_ID_BY_SERVICE[s] ?? 'other'))]
}

/**
 * The categories that appear in a list of service records, for the history's filter chips.
 * @param {Array<{ services?: string[] }>} records
 * @returns {string[]} category ids, in the order of `SERVICE_CATEGORIES`
 */
export function getHistoryCategoryIds(records) {
  const used = new Set(records.flatMap(getRecordCategoryIds))
  return SERVICE_CATEGORIES.map((c) => c.id).filter((id) => used.has(id))
}

/**
 * Whether a service record matches a history search: every word of `query` appears, ignoring case, somewhere in
 * the record's services, shop name, parts or notes. An empty query matches every record.
 * @param {{ services?: string[], shopName?: string | null, partsUsed?: string | null, notes?: string | null }} record
 * @param {string} query as typed
 * @returns {boolean}
 */
export function matchesServiceSearch(record, query) {
  const words = String(query ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const text = [...(record.services ?? []), record.shopName, record.partsUsed, record.notes].filter(Boolean).join('\n').toLowerCase()
  return words.every((word) => text.includes(word))
}

/**
 * Service records that match the history's search and category filter, in their original order.
 * @template {ServiceRecord} T
 * @param {T[]} records
 * @param {object} [filters]
 * @param {string} [filters.query] see {@link matchesServiceSearch}
 * @param {string | null} [filters.categoryId] keep records with a service in this category
 *   (see {@link getRecordCategoryIds}); `null` keeps all
 * @returns {T[]}
 */
export function filterServiceHistory(records, { query = '', categoryId = null } = {}) {
  return records.filter(
    (r) => matchesServiceSearch(r, query) && (categoryId == null || getRecordCategoryIds(r).includes(categoryId))
  )
}

const toCents = (amount) => Math.round(amount * 100) / 100

/**
 * @typedef {object} CategorySpend
 * @property {string} categoryId
 * @property {number} amount rounded to the cent
 * @property {number} share of the year's total, from 0 to 1; 0 when the total is 0
 * @property {number} count how many of the year's records have a service in this category
 */

/**
 * Service spend in one calendar year, by category. A record's cost is shared equally between the categories of its
 * services (see {@link getRecordCategoryIds}), so the categories add up to the total. Records with a malformed date
 * are left out, and a cost that isn't a number counts as $0.
 * @param {ServiceRecord[]} records service records for ONE vehicle
 * @param {number} year e.g. 2026
 * @returns {{ year: number, total: number, count: number, categories: CategorySpend[] }} `total` is rounded to the
 *   cent and `count` is the number of records. `categories` lists every category with a record that year, even at
 *   $0, largest amount first, then in the order of `SERVICE_CATEGORIES`.
 */
export function getYearlyServiceSpend(records, year) {
  const inYear = records.filter((r) => monthKey(r.date)?.slice(0, 4) === String(year))
  const byCategory = new Map()
  let total = 0
  for (const record of inYear) {
    const cost = Number.isFinite(record.cost) ? record.cost : 0
    const categoryIds = getRecordCategoryIds(record)
    const ids = categoryIds.length ? categoryIds : ['other']
    total += cost
    for (const id of ids) {
      const entry = byCategory.get(id) ?? { amount: 0, count: 0 }
      entry.amount += cost / ids.length
      entry.count += 1
      byCategory.set(id, entry)
    }
  }

  const order = SERVICE_CATEGORIES.map((c) => c.id)
  const categories = [...byCategory.entries()]
    .map(([categoryId, { amount, count }]) => ({
      categoryId,
      amount: toCents(amount),
      share: total > 0 ? amount / total : 0,
      count,
    }))
    .sort((a, b) => b.amount - a.amount || order.indexOf(a.categoryId) - order.indexOf(b.categoryId))
  return { year, total: toCents(total), count: inYear.length, categories }
}

/**
 * Checks the "Set last done" form of an interval with no service on record and turns it into the interval's
 * baseline. The date is required and can't be after `today`. The reading is required when the interval has a miles
 * limit, optional otherwise, and can't be past the vehicle's current reading. Both may be before the purchase:
 * the previous owner may have done the job.
 * @param {{ date: string, odometer: string }} form as typed; the reading may have thousands separators
 * @param {object} [context]
 * @param {boolean} [context.needsOdometer] the interval has a miles limit
 * @param {number | null} [context.currentOdometer] the vehicle's current reading
 * @param {string} [context.today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {{ baselineDate: string, baselineOdometer: number | null } | { error: string, field: 'date' | 'odometer' }}
 */
export function parseBaseline({ date, odometer }, { needsOdometer = true, currentOdometer = null, today = todayISO() } = {}) {
  if (!date) return { error: 'Enter the date it was last done.', field: 'date' }
  if (!parseISODate(date)) return { error: 'Enter a real date.', field: 'date' }
  if (date > today) return { error: "That date hasn't happened yet.", field: 'date' }

  const text = String(odometer ?? '').replace(/,/g, '').trim()
  if (!text) {
    return needsOdometer ? { error: 'Enter the odometer reading it was done at.', field: 'odometer' } : { baselineDate: date, baselineOdometer: null }
  }
  if (!/^\d+$/.test(text)) return { error: 'Enter whole miles.', field: 'odometer' }
  const reading = Number(text)
  if (currentOdometer > 0 && reading > currentOdometer) {
    return { error: `That's past the current ${currentOdometer.toLocaleString()} mi.`, field: 'odometer' }
  }
  return { baselineDate: date, baselineOdometer: reading }
}

/**
 * @param {string} iso a valid `YYYY-MM-DD`
 * @returns {string} `Sep 26, 2027`
 */
const formatFullDay = (iso) => parseISODate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/**
 * @typedef {object} NextDue
 * @property {number} intervalId
 * @property {string} name the interval's name
 * @property {string} rule `every 5,000 mi or 12 mo, whichever comes first`
 * @property {number | null} dueOdometer the reading it next comes due at; `null` without a miles limit or a reading
 * @property {string | null} dueDate `YYYY-MM-DD` it next comes due on; `null` without a months limit or a date
 * @property {string} label `at 89,210 mi or on Sep 26, 2027`; `in 5,000 mi` while there is no reading
 */

/**
 * The intervals a service being logged would reset (see {@link recordResetsInterval}), and when each would next
 * come due, measured from that service. For the Log service modal's "Next due" callout.
 * @param {Interval[]} intervals the vehicle's intervals
 * @param {{ services: string[], date: string, odometer: number | null }} service as entered so far
 * @returns {NextDue[]} in the order of `intervals`; an interval that nothing can be said about yet (a months-only
 *   interval without a date) is left out.
 */
export function getNextDueAfterService(intervals, { services, date, odometer }) {
  const validDate = parseISODate(date) ? date : null
  const reading = odometer > 0 ? odometer : null

  return intervals
    .filter((interval) => services?.length && recordResetsInterval({ services }, interval))
    .map((interval) => {
      const dueOdometer = interval.miles != null && reading != null ? reading + interval.miles : null
      const dueDate = interval.months != null && validDate ? addMonths(validDate, interval.months) : null
      const milesPart =
        interval.miles == null ? null : dueOdometer != null ? `at ${dueOdometer.toLocaleString()} mi` : `in ${interval.miles.toLocaleString()} mi`
      const datePart = dueDate ? `on ${formatFullDay(dueDate)}` : null
      const both = interval.miles != null && interval.months != null
      return {
        intervalId: interval.id,
        name: interval.name,
        rule: `${formatIntervalRule(interval)}${both ? ', whichever comes first' : ''}`,
        dueOdometer,
        dueDate,
        label: [milesPart, datePart].filter(Boolean).join(' or '),
      }
    })
    .filter((next) => next.label)
}
