import { daysBetween } from '../../shared/dates.js'
import { formatDueDay, getDueSoonItems } from '../../shared/dueSoon.js'
import { RENEWAL_WARN_DAYS, getRenewalItems } from '../../shared/renewals.js'

/**
 * @typedef {object} ReminderItem
 * @property {number} vehicleId
 * @property {string} itemKey `interval:<id>` or `renewal:<type>`
 * @property {'ok' | 'coming-up' | 'overdue'} state
 * @property {string} message the reminder, e.g. `The Wagon: Tire rotation is overdue (2,410 mi past due).`
 *
 * @typedef {{ vehicleId: number | null, itemKey: string, state: string }} LogEntry a `notification_log` row
 *
 * @typedef {object} ReminderData
 * @property {object[]} vehicles in API shape (`rowToVehicle`)
 * @property {Array<{ vehicleId: number, odometer: number }>} [fills]
 * @property {Array<{ vehicleId: number, date: string, odometer: number, services: string[] }>} [services]
 * @property {Array<{ vehicleId: number, type: string, date: string, renewalDate?: string | null }>} [policies]
 * @property {string} today `YYYY-MM-DD`
 * @property {number} [renewalWarnDays] how early a renewal counts as coming up; defaults to 30
 */

const miles = (n) => `${n.toLocaleString('en-US')} mi`

/**
 * @param {number} days whole days from today, 0 or more
 * @returns {string} `today`, `tomorrow` or `in 12 days`
 */
const inDays = (days) => (days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`)

/**
 * The reading a vehicle is at: the highest of its purchase reading, its stored odometer and every logged
 * reading, as the server keeps it (D9).
 * @param {{ purchaseOdometer?: number | null, odometer?: number | null }} vehicle
 * @param {Array<{ odometer: number }>} readings the vehicle's fill-ups and service records
 * @returns {number}
 */
export function currentOdometer(vehicle, readings) {
  return Math.max(vehicle.purchaseOdometer ?? 0, vehicle.odometer ?? 0, ...readings.map((r) => r.odometer).filter(Number.isFinite))
}

/**
 * Which limit a due item's reminder should name: the one that put it in its state, or, when both did, the one
 * closer to due.
 * @param {import('../../shared/dueSoon.js').DueItem} item
 * @param {{ warnMiles?: number, warnDays?: number }} interval
 * @param {string} today
 * @returns {'miles' | 'date'}
 */
function limitToName(item, interval, today) {
  const overdue = item.status === 'overdue'
  const daysLeft = item.dueDate ? daysBetween(today, item.dueDate) : null
  const byMiles = item.milesRemaining != null && item.milesRemaining <= (overdue ? 0 : interval.warnMiles ?? 0)
  const byDate = daysLeft != null && daysLeft <= (overdue ? 0 : interval.warnDays ?? 0)
  if (byMiles !== byDate) return byMiles ? 'miles' : 'date'
  return item.dueBy ?? (item.milesRemaining != null ? 'miles' : 'date')
}

/**
 * The reminder for a service interval that is coming up or overdue, without the vehicle.
 * @param {import('../../shared/dueSoon.js').DueItem} item
 * @param {object} interval the interval the item is for
 * @param {string} today
 * @returns {string} e.g. `Tire rotation is overdue (2,410 mi past due).` or `Oil + filter is due in 420 mi (at 84,630).`
 */
export function describeService(item, interval, today) {
  const limit = limitToName(item, interval, today)
  if (item.status === 'overdue') {
    if (limit === 'miles') {
      const past = -item.milesRemaining
      return `${item.name} is overdue (${past > 0 ? `${miles(past)} past due` : `due at ${item.dueOdometer.toLocaleString('en-US')}`}).`
    }
    const due = item.dueDate === today ? 'due today' : `due ${formatDueDay(item.dueDate, today)}`
    return `${item.name} is overdue (${due}).`
  }
  if (limit === 'miles') return `${item.name} is due in ${miles(item.milesRemaining)} (at ${item.dueOdometer.toLocaleString('en-US')}).`
  return `${item.name} is due ${inDays(daysBetween(today, item.dueDate))} (${formatDueDay(item.dueDate, today)}).`
}

/**
 * The reminder for a renewal that is coming up or overdue, without the vehicle.
 * @param {import('../../shared/renewals.js').RenewalItem} renewal
 * @param {string} today
 * @returns {string} e.g. `insurance renews in 12 days (Oct 8).` or `registration renewal is overdue (due Sep 20).`
 */
export function describeRenewal(renewal, today) {
  const label = renewal.label.toLowerCase()
  const day = formatDueDay(renewal.renewalDate, today)
  if (renewal.status === 'overdue') return `${label} renewal is overdue (due ${day}).`
  return `${label} renews ${inDays(renewal.daysUntil)} (${day}).`
}

/**
 * Every interval and renewal of every vehicle, with its state today and the reminder for it. Intervals count only
 * on vehicles that track service; renewals count on every vehicle. Per vehicle, intervals come first, most urgent
 * first, then renewals, soonest first.
 * @param {ReminderData} data
 * @returns {ReminderItem[]}
 */
export function getReminderItems({ vehicles, fills = [], services = [], policies = [], today, renewalWarnDays = RENEWAL_WARN_DAYS }) {
  return vehicles.flatMap((vehicle) => {
    const name = vehicle.nickname || `Vehicle ${vehicle.id}`
    const own = (record) => record.vehicleId === vehicle.id
    const vehicleServices = services.filter(own)
    const items = []

    if (vehicle.tracksService ?? true) {
      const odometer = currentOdometer(vehicle, [...fills.filter(own), ...vehicleServices])
      const intervals = new Map((vehicle.intervals ?? []).map((interval) => [interval.id, interval]))
      for (const item of getDueSoonItems(vehicle, vehicleServices, odometer, today)) {
        const message = item.status === 'ok' ? null : `${name}: ${describeService(item, intervals.get(item.intervalId) ?? {}, today)}`
        items.push({ vehicleId: vehicle.id, itemKey: `interval:${item.intervalId}`, state: item.status, message })
      }
    }

    for (const renewal of getRenewalItems(vehicle, policies.filter(own), today, renewalWarnDays)) {
      const message = renewal.status === 'ok' ? null : `${name}: ${describeRenewal(renewal, today)}`
      items.push({ vehicleId: vehicle.id, itemKey: `renewal:${renewal.type}`, state: renewal.status, message })
    }
    return items
  })
}

/**
 * What the daily check should send and which `notification_log` rows it should delete.
 *
 * An item sends once when it becomes coming up and once when it becomes overdue; the log remembers both. An item
 * that is back to ok (a service reset it, or its renewal date moved), or that no longer exists (a deleted interval,
 * a vehicle that stopped tracking service), has its rows cleared so its next change sends again. An item that goes
 * from overdue back to coming up (its interval was lengthened) loses its overdue row, so it can be overdue again.
 * @param {ReminderData & { log?: LogEntry[] }} data
 * @returns {{ send: Array<LogEntry & { message: string }>, clear: LogEntry[] }} `send` in the order of
 *   {@link getReminderItems}; `clear` in log order.
 */
export function planNotifications({ log = [], ...data }) {
  const items = getReminderItems(data)
  const keyOf = (vehicleId, itemKey) => `${vehicleId}|${itemKey}`
  const stateOf = new Map(items.map((item) => [keyOf(item.vehicleId, item.itemKey), item.state]))
  const logged = new Set(log.map((row) => `${keyOf(row.vehicleId, row.itemKey)}|${row.state}`))

  const clear = log
    .filter((row) => {
      const state = stateOf.get(keyOf(row.vehicleId, row.itemKey))
      return !state || state === 'ok' || (state === 'coming-up' && row.state === 'overdue')
    })
    .map(({ vehicleId, itemKey, state }) => ({ vehicleId, itemKey, state }))

  const send = items
    .filter((item) => item.state !== 'ok' && !logged.has(`${keyOf(item.vehicleId, item.itemKey)}|${item.state}`))
    .map(({ vehicleId, itemKey, state, message }) => ({ vehicleId, itemKey, state, message }))

  return { send, clear }
}
