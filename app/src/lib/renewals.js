// The renewal math lives in `shared/` so the server's reminders use it too (PLAN.md D16).
export * from '../../../shared/renewals.js'

/**
 * @typedef {import('../../../shared/renewals.js').PolicyPayment} PolicyPayment
 * @typedef {import('../../../shared/renewals.js').RenewalItem} RenewalItem
 */
