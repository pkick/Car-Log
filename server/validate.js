import { db } from './db.js'

/**
 * A field rule: gets the field's value and returns a short user-facing sentence when it fails, or `null`.
 * @typedef {(value: unknown) => string | null} Rule
 */

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

const isBlank = (value) => value === undefined || value === null || value === ''

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * Checks for a real calendar date written as `YYYY-MM-DD`, without parsing it through `new Date(str)` (D8).
 * @param {unknown} value The value to check.
 * @returns {boolean} `true` for a date that exists, such as `2024-02-29`; `false` for `2026-02-30` or `09/25/2026`.
 */
export function isValidDate(value) {
  const match = typeof value === 'string' && DATE_PATTERN.exec(value)
  if (!match) return false
  const [year, month, day] = match.slice(1).map(Number)
  if (month < 1 || month > 12 || day < 1) return false
  return day <= (month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1])
}

/**
 * @param {string} noun The field as it reads after "Enter", e.g. `a date`.
 * @param {{ required?: boolean }} [options] Optional dates may be omitted, `null` or `''`.
 * @returns {Rule}
 */
function date(noun, { required = false } = {}) {
  return (value) => {
    if (isBlank(value)) return required ? `Enter ${noun}.` : null
    if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return `Enter ${noun} as YYYY-MM-DD.`
    return isValidDate(value) ? null : `${value} isn't a real date.`
  }
}

/**
 * Accepts only JSON numbers, so `"12"` fails. Optional numbers may be omitted or `null`.
 * @param {string} label The field as it reads at the start of a sentence, e.g. `Gallons`.
 * @param {object} [options]
 * @param {string} [options.noun] The field as it reads after "Enter". Giving one makes the field required.
 * @param {boolean} [options.integer] Only whole numbers pass.
 * @param {boolean} [options.positive] Only values above 0 pass.
 * @param {boolean} [options.nonNegative] Only values of 0 or more pass.
 * @param {[number, number]} [options.range] Only values between these bounds (inclusive) pass.
 * @returns {Rule}
 */
function number(label, { noun, integer = false, positive = false, nonNegative = false, range } = {}) {
  return (value) => {
    if (noun && isBlank(value)) return `Enter ${noun}.`
    if (value === undefined || value === null) return null
    if (typeof value !== 'number' || !Number.isFinite(value)) return `${label} must be a number.`
    if (integer && !Number.isInteger(value)) return `${label} must be a whole number.`
    if (positive && value <= 0) return `${label} must be more than 0.`
    if (nonNegative && value < 0) return `${label} can't be negative.`
    if (range && (value < range[0] || value > range[1])) return `${label} must be between ${range[0]} and ${range[1]}.`
    return null
  }
}

/**
 * @param {string} label The field as it reads at the start of a sentence.
 * @returns {Rule} Passes `true`, `false`, or an omitted or `null` value.
 */
function boolean(label) {
  return (value) => (value === undefined || value === null || typeof value === 'boolean' ? null : `${label} must be true or false.`)
}

/**
 * @param {string} message The sentence to show when the value is missing or blank.
 * @returns {Rule} Passes a string with at least one non-space character.
 */
function requiredText(message) {
  return (value) => (typeof value === 'string' && value.trim() ? null : message)
}

/**
 * @param {unknown[]} options The allowed values.
 * @param {string} message The sentence to show for anything else.
 * @returns {Rule}
 */
function oneOf(options, message) {
  return (value) => (options.includes(value) ? null : message)
}

/**
 * @param {string} label The field as it reads at the start of a sentence.
 * @returns {Rule} Passes an array (its items aren't checked), or an omitted or `null` value.
 */
function list(label) {
  return (value) => (value === undefined || value === null || Array.isArray(value) ? null : `${label} must be a list.`)
}

/**
 * @param {string} label The field as it reads at the start of a sentence.
 * @param {number} max The most characters allowed.
 * @returns {Rule} Passes a string of at most `max` characters, or an omitted or `null` value.
 */
function optionalText(label, max) {
  return (value) => {
    if (value === undefined || value === null) return null
    if (typeof value !== 'string') return `${label} must be text.`
    return value.length > max ? `${label} must be ${max.toLocaleString('en-US')} characters or fewer.` : null
  }
}

/** @type {Rule} */
function serviceNames(value) {
  if (!Array.isArray(value) || value.length === 0) return 'Choose at least one service.'
  return value.every((name) => typeof name === 'string' && name.trim()) ? null : 'Each service must be a name.'
}

/** @type {Rule} */
function existingVehicle(value) {
  if (isBlank(value)) return 'Choose a vehicle.'
  const found = Number.isInteger(value) && db.prepare('SELECT 1 FROM vehicles WHERE id = ?').get(value)
  return found ? null : 'Vehicle not found.'
}

/**
 * Runs each rule against its field, in order, and stops at the first failure.
 * @param {object} record The record to check. For a PATCH, pass the existing row merged with the body.
 * @param {Record<string, Rule>} rules Rules keyed by request-body field, in the order they're checked.
 * @returns {{ error: string, field: string } | null} The first failure as a `400` body, or `null` if all pass.
 */
export function validate(record, rules) {
  for (const [field, rule] of Object.entries(rules)) {
    const error = rule(record[field])
    if (error) return { error, field }
  }
  return null
}

const VEHICLE_RULES = {
  nickname: requiredText('Enter a nickname.'),
  year: number('Year', { integer: true, range: [1900, 2100] }),
  purchaseDate: date('the purchase date'),
  purchaseOdometer: number('Purchase odometer', { integer: true, nonNegative: true }),
  registrationRenewal: date('the registration renewal date'),
  insuranceRenewal: date('the insurance renewal date'),
  tankSize: number('Tank size', { positive: true }),
  tracksFuel: boolean('Fuel tracking'),
  tracksService: boolean('Service tracking'),
  intervals: list('Intervals'),
}

const FILL_UP_RULES = {
  vehicleId: existingVehicle,
  date: date('a date', { required: true }),
  odometer: number('Odometer', { noun: 'the odometer reading', integer: true, positive: true }),
  gallons: number('Gallons', { noun: 'the gallons', positive: true }),
  pricePerGal: number('Price per gallon', { noun: 'the price per gallon', positive: true }),
  isFull: boolean('Full tank'),
  station: optionalText('Station', 80),
  notes: optionalText('Notes', 1000),
}

const IMPORTED_FILL_UP_RULES = {
  ...FILL_UP_RULES,
  total: number('Total', { positive: true }),
}

const SERVICE_RECORD_RULES = {
  vehicleId: existingVehicle,
  date: date('a date', { required: true }),
  odometer: number('Odometer', { noun: 'the odometer reading', integer: true, positive: true }),
  categoryId: requiredText('Choose a category.'),
  services: serviceNames,
  cost: number('Cost', { nonNegative: true }),
}

const POLICY_RECORD_RULES = {
  vehicleId: existingVehicle,
  type: oneOf(['insurance', 'registration'], 'Choose insurance or registration.'),
  date: date('a date', { required: true }),
  cost: number('Cost', { nonNegative: true }),
  renewalDate: date('the renewal date'),
}

/**
 * Checks a vehicle for POST or PATCH. Interval contents aren't checked, only that `intervals` is a list.
 * @param {object} vehicle The request body, or for a PATCH the existing vehicle merged with it.
 * @returns {{ error: string, field: string } | null} The first failure, or `null`.
 */
export const validateVehicle = (vehicle) => validate(vehicle, VEHICLE_RULES)

/**
 * Checks a fill-up for POST or PATCH, including that `vehicleId` names an existing vehicle.
 * @param {object} fillUp The request body, or for a PATCH the existing fill-up merged with it.
 * @returns {{ error: string, field: string } | null} The first failure, or `null`.
 */
export const validateFillUp = (fillUp) => validate(fillUp, FILL_UP_RULES)

/**
 * Checks a fill-up from a CSV import: the rules of {@link validateFillUp}, plus an optional `total` that must be
 * gallons × price per gallon give or take rounding (5 cents, or 1% on a large total), since the file may carry all three.
 * @param {object} fillUp The row, with `vehicleId` set.
 * @returns {{ error: string, field: string } | null} The first failure, or `null`.
 */
export function validateImportedFillUp(fillUp) {
  const invalid = validate(fillUp, IMPORTED_FILL_UP_RULES)
  if (invalid || fillUp.total == null) return invalid
  const expected = fillUp.gallons * fillUp.pricePerGal
  if (Math.abs(fillUp.total - expected) <= Math.max(0.05, fillUp.total * 0.01)) return null
  return {
    error: `Total $${fillUp.total.toFixed(2)} doesn't match ${fillUp.gallons} gal at $${fillUp.pricePerGal}/gal ($${expected.toFixed(2)}).`,
    field: 'total',
  }
}

/**
 * Trims a fill-up's optional text fields and turns blank ones into `null`, so "  " isn't stored as a station.
 * Values that aren't strings are left for {@link validateFillUp} to reject.
 * @param {object} fillUp The request body, or for a PATCH the existing fill-up merged with it.
 * @returns {object} A copy with `station` and `notes` cleaned up.
 */
export function trimFillUpText(fillUp) {
  const trim = (value) => (typeof value === 'string' ? value.trim() || null : value ?? null)
  return { ...fillUp, station: trim(fillUp.station), notes: trim(fillUp.notes) }
}

/**
 * Checks that `vehicleId` names an existing vehicle, for requests that act on one vehicle's records.
 * @param {unknown} vehicleId
 * @returns {{ error: string, field: string } | null} The failure, or `null`.
 */
export const validateVehicleId = (vehicleId) => validate({ vehicleId }, { vehicleId: existingVehicle })

/**
 * Checks a service record for POST or PATCH, including that `vehicleId` names an existing vehicle.
 * @param {object} record The request body, or for a PATCH the existing record merged with it.
 * @returns {{ error: string, field: string } | null} The first failure, or `null`.
 */
export const validateServiceRecord = (record) => validate(record, SERVICE_RECORD_RULES)

/**
 * Checks an insurance or registration payment for POST or PATCH, including that `vehicleId` names an existing vehicle.
 * @param {object} record The request body, or for a PATCH the existing record merged with it.
 * @returns {{ error: string, field: string } | null} The first failure, or `null`.
 */
export const validatePolicyRecord = (record) => validate(record, POLICY_RECORD_RULES)
