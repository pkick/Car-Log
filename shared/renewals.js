import { daysBetween, parseISODate, todayISO } from './dates.js'

// Shared by the app and the server's reminders (PLAN.md D16); the app imports it through `app/src/lib/renewals.js`.

/**
 * How many days before its renewal date an insurance or registration renewal counts as coming up, unless the
 * caller passes the household's own setting (Settings › Reminder defaults).
 */
export const RENEWAL_WARN_DAYS = 30

/**
 * The renewals a vehicle can have, in display order, with the vehicle field that holds each one's date.
 * @type {ReadonlyArray<{ type: 'insurance' | 'registration', label: string, field: 'insuranceRenewal' | 'registrationRenewal' }>}
 */
export const RENEWAL_TYPES = [
  { type: 'insurance', label: 'Insurance', field: 'insuranceRenewal' },
  { type: 'registration', label: 'Registration', field: 'registrationRenewal' },
]

/**
 * @typedef {object} PolicyPayment
 * @property {number} [id]
 * @property {'insurance' | 'registration'} type
 * @property {string} date `YYYY-MM-DD` the payment was made
 * @property {number} cost
 * @property {string | null} [renewalDate] `YYYY-MM-DD` the paid-for term runs to
 * @property {string | null} [provider] insurer or agency
 *
 * @typedef {object} RenewalItem
 * @property {'insurance' | 'registration'} type
 * @property {string} label `Insurance` or `Registration`
 * @property {string} renewalDate `YYYY-MM-DD`
 * @property {number} daysUntil whole days from today to `renewalDate`; negative once it has passed
 * @property {'ok' | 'coming-up' | 'overdue'} status `overdue` once the date has passed, `coming-up` from the warn
 *   days ({@link RENEWAL_WARN_DAYS} unless given) before it through the day itself, `ok` before that
 * @property {{ date: string, cost: number, provider: string | null } | null} lastPayment the newest payment of
 *   this type, or `null` when none is logged
 */

/**
 * Payments newest first: by date, then by id, so the later of two payments on one day comes first.
 * @param {PolicyPayment[]} payments
 * @returns {PolicyPayment[]}
 */
const newestFirst = (payments) =>
  [...payments].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || (b.id ?? 0) - (a.id ?? 0))

/**
 * The insurance and registration renewals of one vehicle, most urgent first: overdue ones (longest overdue
 * first), then the soonest. Each renewal's date is the vehicle's own (`insuranceRenewal` /
 * `registrationRenewal`), or else the renewal date on the newest payment of that type that has one. A type
 * with neither gets no item, so every item has a date.
 * @param {{ insuranceRenewal?: string | null, registrationRenewal?: string | null }} vehicle
 * @param {PolicyPayment[]} policyRecords payments for this vehicle, in any order
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @param {number} [warnDays] how many days before its date a renewal counts as coming up; defaults to
 *   {@link RENEWAL_WARN_DAYS}.
 * @returns {RenewalItem[]}
 */
export function getRenewalItems(vehicle, policyRecords, today = todayISO(), warnDays = RENEWAL_WARN_DAYS) {
  const items = RENEWAL_TYPES.flatMap(({ type, label, field }) => {
    const payments = newestFirst(policyRecords.filter((r) => r.type === type))
    const fromPayment = payments.find((p) => parseISODate(p.renewalDate))?.renewalDate
    const renewalDate = parseISODate(vehicle[field]) ? vehicle[field] : fromPayment
    if (!renewalDate) return []

    const daysUntil = daysBetween(today, renewalDate)
    const status = daysUntil < 0 ? 'overdue' : daysUntil <= warnDays ? 'coming-up' : 'ok'
    const last = payments[0]
    const lastPayment = last ? { date: last.date, cost: last.cost, provider: last.provider || null } : null
    return [{ type, label, renewalDate, daysUntil, status, lastPayment }]
  })
  return items.sort((a, b) => a.daysUntil - b.daysUntil)
}

/**
 * How far off a renewal is, for its card: `Renews in 49 days`, `Renews tomorrow`, `Renews today`,
 * `1 day overdue`, `12 days overdue`.
 * @param {number} daysUntil from {@link getRenewalItems}
 * @returns {string}
 */
export function formatRenewalCountdown(daysUntil) {
  if (daysUntil > 1) return `Renews in ${daysUntil} days`
  if (daysUntil === 1) return 'Renews tomorrow'
  if (daysUntil === 0) return 'Renews today'
  const overdue = Math.abs(daysUntil)
  return `${overdue} ${overdue === 1 ? 'day' : 'days'} overdue`
}

/**
 * A date with its year, as the Documents page shows renewal and payment dates: `Nov 14, 2026`.
 * @param {string | null | undefined} iso `YYYY-MM-DD`
 * @returns {string} `iso` itself when it isn't a valid date, or `—` when it is empty.
 */
export function formatFullDate(iso) {
  const date = parseISODate(iso)
  if (!date) return iso || '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
