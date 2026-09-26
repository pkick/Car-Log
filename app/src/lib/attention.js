import { DAYS_PER_MONTH } from './dashboardStats'
import { daysBetween, todayISO } from './dates'
import { formatFullDate, formatRenewalCountdown } from './renewals'

/** How long "Snooze 2 wks" hides an attention item, in days. */
export const SNOOZE_DAYS = 14

/**
 * Miles a day assumed when a vehicle's own pace is unknown, so a mileage limit can still be ranked against a
 * date: 1,000 miles a month, close to the US average of about 12,000 a year.
 */
export const FALLBACK_MILES_PER_DAY = 1000 / DAYS_PER_MONTH

const TIER = { overdue: 0, 'coming-up': 1, ok: 2 }

const miles = (n) => `${n.toLocaleString('en-US')} mi`
const money = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * @typedef {import('./vehicleStats').DueItem} DueItem
 * @typedef {import('./renewals').RenewalItem} RenewalItem
 *
 * @typedef {object} DueDistance how far a service interval is from due, in days
 * @property {number} days whole days until due, negative once past it: the closer of the date limit and the
 *   mileage limit, the mileage converted at the driving pace. `Infinity` when the interval has no limits.
 * @property {'miles' | 'date' | null} limit which limit `days` comes from
 */

/**
 * How many days a service interval has until it is due (negative once past due), so intervals measured in
 * miles and in months, and renewals, can be ranked on one scale. A mileage limit is converted at `milesPerDay`,
 * or at {@link FALLBACK_MILES_PER_DAY} when the vehicle's pace is unknown.
 * @param {DueItem} item from `getDueSoonItems`
 * @param {number | null} [milesPerDay] the vehicle's driving pace
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {DueDistance}
 */
export function getDueDistance(item, milesPerDay = null, today = todayISO()) {
  const pace = milesPerDay > 0 ? milesPerDay : FALLBACK_MILES_PER_DAY
  const byMiles = Number.isFinite(item.milesRemaining) ? item.milesRemaining / pace : NaN
  const byDate = item.dueDate ? daysBetween(today, item.dueDate) : NaN
  // Compared before rounding, so a few miles left never outrank a date that has already passed.
  if (Number.isFinite(byMiles) && !(byDate <= byMiles)) return { days: Math.round(byMiles) || 0, limit: 'miles' }
  if (Number.isFinite(byDate)) return { days: byDate, limit: 'date' }
  return { days: Infinity, limit: null }
}

/**
 * Service intervals most urgent first: overdue, then coming up, then on track; within each, the furthest past
 * due or the soonest due first (see {@link getDueDistance}). Ties keep their order.
 * @template {DueItem} T
 * @param {T[]} dueItems from `getDueSoonItems`
 * @param {number | null} [milesPerDay] the vehicle's driving pace
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {T[]} a new array
 */
export function rankDueItems(dueItems, milesPerDay = null, today = todayISO()) {
  const days = new Map(dueItems.map((item) => [item, getDueDistance(item, milesPerDay, today).days]))
  return [...dueItems].sort((a, b) => TIER[a.status] - TIER[b.status] || days.get(a) - days.get(b))
}

/**
 * @typedef {object} AttentionItem
 * @property {string} key what a snooze is stored under: `service:<intervalId>` or `renewal:<type>`
 * @property {'service' | 'renewal'} kind
 * @property {'overdue' | 'coming-up'} status
 * @property {number} days whole days until due, negative once past due
 * @property {string} title e.g. `Tire rotation is overdue`, `Insurance renews in 12 days`
 * @property {string} detail e.g. `2,410 mi past due · every 5,000 mi`
 * @property {string} [categoryId] services: the interval's category, to preset Log service
 * @property {number} [intervalId] services
 * @property {'insurance' | 'registration'} [type] renewals: to preset Log payment
 */

/**
 * @param {DueItem} item
 * @param {DueDistance} distance
 * @returns {string} how far past or before due the closer limit is
 */
function serviceDistanceText(item, { days, limit }) {
  const overdue = item.status === 'overdue'
  if (limit === 'miles') {
    const left = item.milesRemaining
    if (left === 0) return 'due now'
    return overdue ? `${miles(Math.abs(left))} past due` : `due in ${miles(left)}`
  }
  if (limit === 'date') {
    if (days === 0) return 'due today'
    if (days === 1) return 'due tomorrow'
    if (days > 0) return `due in ${plural(days, 'day')}`
    return -days <= 60 ? `${plural(-days, 'day')} past due` : `past due since ${formatFullDate(item.dueDate)}`
  }
  return null
}

/**
 * @param {DueItem} item
 * @param {number | null} milesPerDay
 * @param {string} today
 * @returns {AttentionItem}
 */
function fromDueItem(item, milesPerDay, today) {
  const distance = getDueDistance(item, milesPerDay, today)
  return {
    key: `service:${item.intervalId}`,
    kind: 'service',
    status: item.status,
    days: distance.days,
    title: `${item.name} ${item.status === 'overdue' ? 'is overdue' : 'is due soon'}`,
    detail: [serviceDistanceText(item, distance), item.detailLabel].filter(Boolean).join(' · '),
    categoryId: item.categoryId,
    intervalId: item.intervalId,
  }
}

/**
 * @param {RenewalItem} renewal
 * @returns {AttentionItem}
 */
function fromRenewal(renewal) {
  const { type, label, renewalDate, daysUntil, status, lastPayment } = renewal
  const overdue = status === 'overdue'
  const countdown = formatRenewalCountdown(daysUntil)
  const detail = overdue
    ? [countdown, `was due ${formatFullDate(renewalDate)}`]
    : [formatFullDate(renewalDate), lastPayment && `last paid ${money(lastPayment.cost)}`, lastPayment?.provider]
  return {
    key: `renewal:${type}`,
    kind: 'renewal',
    status,
    days: daysUntil,
    title: overdue ? `${label} renewal is overdue` : `${label} ${countdown.charAt(0).toLowerCase()}${countdown.slice(1)}`,
    detail: detail.filter(Boolean).join(' · '),
    type,
  }
}

/**
 * Everything that needs attention, most urgent first: overdue before coming up; within each, the furthest past
 * due or the soonest due first, with services before renewals on a tie. Service intervals come from
 * `getDueSoonItems` and renewals from `getRenewalItems`; items that are on track are left out.
 * @param {object} sources
 * @param {DueItem[]} [sources.dueItems] from `getDueSoonItems`; pass none for a vehicle that doesn't track service
 * @param {RenewalItem[]} [sources.renewals] from `getRenewalItems`
 * @param {number | null} [sources.milesPerDay] the vehicle's driving pace, to rank mileage limits against dates
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {AttentionItem[]}
 */
export function getAttentionItems({ dueItems = [], renewals = [], milesPerDay = null }, today = todayISO()) {
  const services = dueItems.filter((item) => item.status !== 'ok').map((item) => fromDueItem(item, milesPerDay, today))
  const due = renewals.filter((item) => item.status !== 'ok').map(fromRenewal)
  const kindOrder = { service: 0, renewal: 1 }
  return [...services, ...due].sort(
    (a, b) => TIER[a.status] - TIER[b.status] || a.days - b.days || kindOrder[a.kind] - kindOrder[b.kind],
  )
}

/**
 * Snoozed attention items: each item key maps to the `YYYY-MM-DD` it was snoozed on.
 * @typedef {Record<string, string>} Snoozes
 */

/**
 * Whether an item is snoozed: it was snoozed in the last {@link SNOOZE_DAYS} days, today included. A snooze
 * with a malformed date, or a date after `today`, doesn't hide anything.
 * @param {Snoozes | null | undefined} snoozes
 * @param {string} key an {@link AttentionItem} key
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {boolean}
 */
export function isSnoozed(snoozes, key, today = todayISO()) {
  const age = daysBetween(snoozes?.[key], today)
  return age >= 0 && age < SNOOZE_DAYS
}

/**
 * The snoozes still in effect, dropping expired and malformed ones so stored snoozes don't pile up.
 * @param {Snoozes | null | undefined} snoozes
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {Snoozes} a new object
 */
export function activeSnoozes(snoozes, today = todayISO()) {
  return Object.fromEntries(Object.keys(snoozes ?? {}).filter((key) => isSnoozed(snoozes, key, today)).map((key) => [key, snoozes[key]]))
}

/**
 * Snoozes an item for {@link SNOOZE_DAYS} days from today.
 * @param {Snoozes | null | undefined} snoozes
 * @param {string} key an {@link AttentionItem} key
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {Snoozes} a new object: the active snoozes plus this one
 */
export function snoozeItem(snoozes, key, today = todayISO()) {
  return { ...activeSnoozes(snoozes, today), [key]: today }
}

/**
 * The item the attention banner shows: the most urgent one that isn't snoozed.
 * @param {AttentionItem[]} items from {@link getAttentionItems}, most urgent first
 * @param {Snoozes | null | undefined} snoozes
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {AttentionItem | null} `null` when nothing needs attention.
 */
export function pickAttentionItem(items, snoozes, today = todayISO()) {
  return items.find((item) => !isSnoozed(snoozes, item.key, today)) ?? null
}
