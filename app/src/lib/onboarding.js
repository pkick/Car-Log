/**
 * First-run guidance (P4-G): the three setup steps, when each one is done, and the stat rail of a vehicle with
 * nothing logged yet.
 */

/**
 * @typedef {'vehicle' | 'intervals' | 'fillUp'} OnboardingStepId
 *
 * @typedef {object} OnboardingStep
 * @property {OnboardingStepId} id
 * @property {number} n The step's number as shown, counting only the steps that apply.
 * @property {string} title
 * @property {string} body One short line under the title.
 * @property {boolean} done
 *
 * @typedef {object} EmptyStatTile
 * @property {string} label
 * @property {string | null} value `null` until there is something to show: the tile shows an em-dash.
 * @property {string | null} unit
 * @property {string | null} hint What fills the tile in, e.g. "needs 2 fill-ups"; `null` once it has a value.
 * @property {string | null} delta
 * @property {'good' | 'bad' | 'neutral'} deltaTone
 */

/** The setup steps in order, with the copy the first-run screen and the Dashboard show. */
export const ONBOARDING_STEPS = [
  { id: 'vehicle', title: 'Add the vehicle', body: 'Nickname, year, make and model, current odometer.' },
  { id: 'intervals', title: 'Set intervals', body: 'Miles or months, whichever comes first.' },
  { id: 'fillUp', title: 'Log a fill-up', body: 'Two fill-ups and MPG trends appear.' },
]

/**
 * An interval reduced to what the person can change in Edit vehicle. Ids and the derived `categoryId` are left
 * out, services are sorted, and numbers typed as text compare equal to numbers.
 * @param {object} interval
 * @returns {string}
 */
function intervalKey(interval) {
  const number = (value) => (value === '' || value == null ? null : Number(value))
  return JSON.stringify([
    (interval.name ?? '').trim(),
    [...(interval.services ?? [])].sort(),
    interval.trackBy ?? null,
    number(interval.miles),
    number(interval.months),
    number(interval.warnMiles),
    number(interval.warnDays),
  ])
}

/**
 * Whether a vehicle's service intervals differ from the defaults every new vehicle gets. Order doesn't matter.
 * Removing every interval counts as a change.
 * @param {object[] | null | undefined} intervals The vehicle's intervals.
 * @param {object[] | null | undefined} defaults `GET /api/defaults/intervals`, or `null` while unknown.
 * @returns {boolean} False when `defaults` is unknown.
 */
export function intervalsCustomized(intervals, defaults) {
  if (!Array.isArray(defaults)) return false
  const mine = (intervals ?? []).map(intervalKey).sort()
  const theirs = defaults.map(intervalKey).sort()
  return mine.length !== theirs.length || mine.some((key, i) => key !== theirs[i])
}

/**
 * The setup steps for one vehicle, or for the first-run screen when there is none yet.
 *
 * - **Add the vehicle** is done once the vehicle exists.
 * - **Set intervals** is done once the vehicle has a service record (reminders then count from a real service,
 *   not the purchase) or its intervals differ from the server's defaults (someone edited them). A vehicle that
 *   doesn't track service skips it.
 * - **Log a fill-up** is done once the vehicle has a fill-up. A vehicle that doesn't track fuel skips it.
 *
 * @param {{ tracksFuel?: boolean, tracksService?: boolean, intervals?: object[] } | null} vehicle
 * @param {object} [logs]
 * @param {object[]} [logs.fillUps] The vehicle's fill-ups.
 * @param {object[]} [logs.serviceRecords] The vehicle's service records.
 * @param {object[] | null} [logs.defaultIntervals] `GET /api/defaults/intervals`, or `null` while unknown.
 * @returns {OnboardingStep[]} The steps that apply, numbered from 1.
 */
export function getOnboardingSteps(vehicle, { fillUps = [], serviceRecords = [], defaultIntervals = null } = {}) {
  const tracksFuel = vehicle?.tracksFuel !== false
  const tracksService = vehicle?.tracksService !== false
  const done = {
    vehicle: vehicle != null,
    intervals: vehicle != null && (serviceRecords.length > 0 || intervalsCustomized(vehicle.intervals, defaultIntervals)),
    fillUp: vehicle != null && fillUps.length > 0,
  }
  return ONBOARDING_STEPS
    .filter((step) => (step.id === 'intervals' ? tracksService : step.id === 'fillUp' ? tracksFuel : true))
    .map((step, i) => ({ ...step, n: i + 1, done: done[step.id] }))
}

/**
 * Whether "Set intervals" can only be decided once the defaults are known: the vehicle tracks service, has no
 * service record yet, and so its intervals have to be compared with the defaults.
 * @param {{ tracksService?: boolean }} vehicle
 * @param {object[]} serviceRecords The vehicle's service records.
 * @returns {boolean}
 */
export function needsDefaultIntervals(vehicle, serviceRecords) {
  return vehicle.tracksService !== false && serviceRecords.length === 0
}

/**
 * Whether a vehicle has nothing logged yet, so the Dashboard shows its empty state. A vehicle that tracks
 * neither fuel nor service never does: it has nothing to invite.
 * @param {{ tracksFuel?: boolean, tracksService?: boolean }} vehicle
 * @param {object[]} fillUps The vehicle's fill-ups.
 * @param {object[]} serviceRecords The vehicle's service records.
 * @returns {boolean}
 */
export function isEmptyVehicle(vehicle, fillUps, serviceRecords) {
  const tracksAnything = vehicle.tracksFuel !== false || vehicle.tracksService !== false
  return tracksAnything && fillUps.length === 0 && serviceRecords.length === 0
}

/**
 * The Dashboard stat rail for a vehicle with nothing logged: em-dashes with a hint saying what fills each tile
 * in. The services tile shows the real due count when intervals are already due from the purchase date or
 * odometer. Fuel tiles need fuel tracking and the services tile needs service tracking, as on the full Dashboard.
 * @param {{ tracksFuel?: boolean, tracksService?: boolean }} vehicle
 * @param {{ status: 'overdue' | 'coming-up' | 'ok' }[]} dueItems `getDueSoonItems` for the vehicle.
 * @returns {EmptyStatTile[]}
 */
export function getEmptyStatTiles(vehicle, dueItems) {
  const empty = (label, hint) => ({ label, value: null, unit: null, hint, delta: null, deltaTone: 'neutral' })
  const dueCount = dueItems.filter((item) => item.status !== 'ok').length
  const overdueCount = dueItems.filter((item) => item.status === 'overdue').length
  const fuel = [
    empty('Avg MPG', 'needs 2 fill-ups'),
    empty('Cost / mile', 'needs 2 fill-ups'),
    empty('Fuel spend', 'log a fill-up'),
  ]
  const services = dueCount > 0
    ? {
      label: 'Services',
      value: String(dueCount),
      unit: 'due soon',
      hint: null,
      delta: overdueCount > 0 ? `${overdueCount} overdue` : null,
      deltaTone: 'bad',
    }
    : empty('Services', 'no intervals due')
  return [...(vehicle.tracksFuel !== false ? fuel : []), ...(vehicle.tracksService !== false ? [services] : [])]
}
