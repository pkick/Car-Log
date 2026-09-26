/**
 * The detail line of a success toast: the one fact worth seeing after a save ("Fill-up saved · 32.2 mpg").
 */

/**
 * @param {{ isFull: boolean, mpg: number | null | undefined }} fillUp The saved fill-up and the MPG of the
 *   tank it closed.
 * @returns {string | undefined} `32.2 mpg`, `partial` for a partial fill, or `undefined` while there's no MPG
 *   yet (the vehicle's first full tank).
 */
export function fillUpSavedDetail({ isFull, mpg }) {
  if (!isFull) return 'partial'
  return mpg != null && Number.isFinite(mpg) ? `${mpg.toFixed(1)} mpg` : undefined
}

/**
 * @param {string[]} services The services on a record, in the order they were picked.
 * @returns {string | undefined} The first service, plus how many more: `Brake pads + 1 more`.
 */
export function summarizeServices(services) {
  if (!services?.length) return undefined
  return services.length === 1 ? services[0] : `${services[0]} + ${services.length - 1} more`
}

const POLICY_LABELS = { insurance: 'Insurance', registration: 'Registration' }

/**
 * @param {{ type: 'insurance' | 'registration', cost: number }} payment
 * @returns {string} e.g. `Insurance $612.00`.
 */
export function paymentSavedDetail({ type, cost }) {
  return `${POLICY_LABELS[type] ?? 'Payment'} $${cost.toFixed(2)}`
}
