const VIN_LENGTH = 17

// Position weights and letter values from 49 CFR 565.15. Position 9 (weight 0) is the check digit itself.
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]
const LETTER_VALUES = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
}

// The vehicle fields a decode can fill, in form order.
const DECODED_FIELDS = ['year', 'make', 'model', 'trim']

/**
 * What `GET /api/vin/:vin` answers for a VIN NHTSA could decode.
 * @typedef {object} DecodedVin
 * @property {string} vin The normalized VIN.
 * @property {number | null} year
 * @property {string} make `''` when NHTSA didn't return one.
 * @property {string} model
 * @property {string} trim
 * @property {string[]} [warnings] NHTSA's notes on a partial decode; empty for a clean one.
 */

/**
 * @param {string | null | undefined} str What the user typed or pasted.
 * @returns {string} The VIN trimmed and uppercased; `''` for nothing.
 */
export function normalizeVin(str) {
  return (str ?? '').trim().toUpperCase()
}

/**
 * Checks a VIN's length, characters and North American check digit (position 9). VINs from outside North
 * America may not use the check digit, so treat that failure as a warning.
 * @param {string} vin A VIN in any case; it's normalized first.
 * @returns {{ ok: true } | { ok: false, reason: string }} `reason` is a sentence to show under the field.
 */
export function checkVin(vin) {
  const value = normalizeVin(vin)
  if (value.length !== VIN_LENGTH) {
    return { ok: false, reason: `A VIN has ${VIN_LENGTH} characters; this one has ${value.length}.` }
  }
  if (/[IOQ]/.test(value)) {
    return { ok: false, reason: 'A VIN never uses the letters I, O or Q; look for a 1 or 0 typed as a letter.' }
  }
  if (!/^[A-Z0-9]+$/.test(value)) {
    return { ok: false, reason: 'A VIN has only letters and digits.' }
  }
  if (value[8] !== checkDigit(value)) {
    return { ok: false, reason: "The check digit doesn't match; look for a mistyped character." }
  }
  return { ok: true }
}

/**
 * @param {string} vin 17 uppercase letters and digits, without I, O or Q.
 * @returns {string} The expected check digit: `0` to `9`, or `X` for a remainder of 10.
 */
function checkDigit(vin) {
  const sum = [...vin].reduce((total, char, i) => total + (LETTER_VALUES[char] ?? Number(char)) * WEIGHTS[i], 0)
  const remainder = sum % 11
  return remainder === 10 ? 'X' : String(remainder)
}

const isBlank = (value) => value === undefined || value === null || String(value).trim() === ''
const sameValue = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase()

/**
 * Sorts a decode into fields to fill without asking and fields that would replace the user's own values.
 * @param {Record<string, unknown>} form The form's current year, make, model and trim.
 * @param {DecodedVin} decoded
 * @param {Record<string, unknown>} [filled] Values the app put in the form, such as a default year or an
 *   earlier decode. A field still holding one isn't the user's, so it fills without asking.
 * @returns {{ fill: Partial<DecodedVin>, conflicts: string[] }} `fill` holds blank and app-filled fields;
 *   `conflicts` names, in form order, the fields where the user entered something different. Fields the decode
 *   left blank, or that already match it (ignoring case), are in neither.
 */
export function planDecodedFill(form, decoded, filled = {}) {
  const fill = {}
  const conflicts = []
  for (const field of DECODED_FIELDS) {
    const value = decoded[field]
    if (isBlank(value) || sameValue(form[field], value)) continue
    if (isBlank(form[field]) || (!isBlank(filled[field]) && sameValue(form[field], filled[field]))) fill[field] = value
    else conflicts.push(field)
  }
  return { fill, conflicts }
}

/**
 * @param {Pick<DecodedVin, 'year' | 'make' | 'model' | 'trim'>} decoded
 * @returns {string} e.g. `2019 Volvo V60 T5 Momentum`, skipping blank parts.
 */
export function describeDecoded({ year, make, model, trim }) {
  return [year, make, model, trim].filter((part) => !isBlank(part)).join(' ')
}

/**
 * @param {DecodedVin} decoded
 * @returns {string} The line shown under the VIN after a decode, with NHTSA's warnings when it was partial.
 */
export function decodedSummary(decoded) {
  const summary = `Decoded ${describeDecoded(decoded)}.`
  return decoded.warnings?.length ? `${summary} NHTSA warns: ${decoded.warnings.join('; ')}.` : summary
}

/**
 * @param {string[]} words
 * @returns {string} `a`, `a and b`, `a, b and c`.
 */
function joinWords(words) {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/**
 * @param {DecodedVin} decoded
 * @param {string[]} conflicts From `planDecodedFill`.
 * @returns {string} e.g. `Decoded 2019 Volvo V60 T5 Momentum. Replace the year, make and model you entered?`
 */
export function replacePrompt(decoded, conflicts) {
  return `Decoded ${describeDecoded(decoded)}. Replace the ${joinWords(conflicts)} you entered?`
}
