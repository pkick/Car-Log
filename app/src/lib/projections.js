import { addDays, addMonths, daysBetween, monthKey, parseISODate, todayISO } from './dates'

/** How far back the driving pace looks, in calendar months. */
export const PACE_MONTHS = 6

/**
 * Miles driven per day, from the odometer readings (fill-ups and service records) dated in the last
 * {@link PACE_MONTHS} months up to and including `today`: the miles from the earliest reading to the latest one,
 * over the days between them. Readings that are missing or not positive, and malformed or later dates, are ignored.
 * @param {Array<{ date: string, odometer: number }>} fills fill-ups for ONE vehicle
 * @param {Array<{ date: string, odometer: number }>} services service records for the same vehicle
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {number | null} miles per day, unrounded; `null` with fewer than two readings, or when they span no
 *   days or no miles.
 */
export function getDrivingPace(fills, services, today = todayISO()) {
  const from = addMonths(today, -PACE_MONTHS)
  if (!from) return null
  const readings = [...fills, ...services]
    .filter((r) => Number.isFinite(r.odometer) && r.odometer > 0 && monthKey(r.date) && r.date >= from && r.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.odometer - b.odometer)
  if (readings.length < 2) return null

  const first = readings[0]
  const last = readings[readings.length - 1]
  const days = daysBetween(first.date, last.date)
  const miles = last.odometer - first.odometer
  return days > 0 && miles > 0 ? miles / days : null
}

/**
 * The day a due item is expected to come due. A miles limit comes due once the `milesRemaining` to its
 * `dueOdometer` are driven at `pace`, counting from `today`; a months limit comes due on its `dueDate`. With both,
 * whichever comes first. Without a pace, only the months limit can be projected.
 * @param {{ status?: string, milesRemaining: number | null, dueDate: string | null }} item a due item from
 *   `getDueSoonItems`
 * @param {number | null} pace miles per day, from {@link getDrivingPace}
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {string | null} `YYYY-MM-DD`: `today` when the item is already due, or `null` when it can't be
 *   projected (a miles-only item without a pace, or an item without limits).
 */
export function projectDueDate(item, pace, today = todayISO()) {
  const dueDate = parseISODate(item.dueDate) ? item.dueDate : null
  const milesDue = item.milesRemaining != null && item.milesRemaining <= 0
  if (item.status === 'overdue' || milesDue || (dueDate && dueDate <= today)) return today

  const byMiles = item.milesRemaining != null && pace > 0 ? addDays(today, Math.ceil(item.milesRemaining / pace)) : null
  const dates = [byMiles, dueDate].filter(Boolean).sort()
  return dates[0] ?? null
}

/**
 * A projected date as the schedule shows it: `~Nov 3`, with the year when it isn't `today`'s year.
 * @param {string | null} iso `YYYY-MM-DD`
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {string | null} `null` when `iso` isn't a valid date.
 */
export function formatProjectedDate(iso, today = todayISO()) {
  const date = parseISODate(iso)
  if (!date) return null
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return iso.slice(0, 4) === String(today).slice(0, 4) ? `~${day}` : `~${day}, ${date.getFullYear()}`
}

/**
 * Adds `projectedDate` ({@link projectDueDate}) and `projectedLabel` ({@link formatProjectedDate}) to each due
 * item, keeping the order.
 * @template {{ milesRemaining: number | null, dueDate: string | null }} T
 * @param {T[]} items from `getDueSoonItems`
 * @param {number | null} pace miles per day, from {@link getDrivingPace}
 * @param {string} [today] `YYYY-MM-DD`; defaults to {@link todayISO}.
 * @returns {Array<T & { projectedDate: string | null, projectedLabel: string | null }>}
 */
export function withProjectedDates(items, pace, today = todayISO()) {
  return items.map((item) => {
    const projectedDate = projectDueDate(item, pace, today)
    return { ...item, projectedDate, projectedLabel: formatProjectedDate(projectedDate, today) }
  })
}

/**
 * A driving pace per month, for "driving 1,070 mi/mo": the average month is 365.25 / 12 days.
 * @param {number | null} pace miles per day
 * @returns {number | null} whole miles, or `null` without a pace.
 */
export function milesPerMonth(pace) {
  return pace > 0 ? Math.round((pace * 365.25) / 12) : null
}
