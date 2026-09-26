import { useEffect, useState } from 'react'

const UNREACHABLE = "Can't reach the server. Check that it's running and try again."
// A proxy in front of the API (Vite in dev, or one on the NAS) answers these when the API is down.
const GATEWAY_STATUSES = [502, 503, 504]

/**
 * Calls a `/api/settings` endpoint with a JSON body.
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<any>} the parsed response
 * @throws {Error & { field?: string, status?: number }} the server's message, and the field it is about
 */
export async function settingsRequest(path, options) {
  let res
  try {
    res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options })
  } catch (err) {
    throw new Error(UNREACHABLE, { cause: err })
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    // A provider's refusal comes back as a 502 with its message, so only a bare gateway error means the API is down.
    const message = body.error || (GATEWAY_STATUSES.includes(res.status) ? UNREACHABLE : `Request failed: ${res.status}`)
    throw Object.assign(new Error(message), { field: body.field, status: res.status })
  }
  return body
}

/** Used until the server answers, or if it can't be reached; the server starts with the same values. */
export const FALLBACK_REMINDER_DEFAULTS = { warnMiles: 500, warnDays: 14, renewalWarnDays: 30 }

let pending = null

/**
 * `GET /api/settings/defaults`, fetched once per page load and shared. A failed request is tried again by the
 * next caller.
 * @returns {Promise<typeof FALLBACK_REMINDER_DEFAULTS>}
 */
function loadReminderDefaults() {
  pending ??= settingsRequest('/api/settings/defaults').catch((err) => {
    pending = null
    throw err
  })
  return pending
}

/**
 * Saves the warn-at defaults, and makes them what every later {@link useReminderDefaults} sees.
 * @param {Record<string, number | string | null>} values
 * @returns {Promise<typeof FALLBACK_REMINDER_DEFAULTS>} the saved defaults
 * @throws {Error & { field?: string }} the server's message, e.g. for a negative number
 */
export async function saveReminderDefaults(values) {
  const saved = await settingsRequest('/api/settings/defaults', { method: 'PATCH', body: JSON.stringify(values) })
  pending = Promise.resolve(saved)
  return saved
}

/**
 * The household's warn-at defaults (Settings › Reminder defaults): how early a new interval warns, in miles and
 * days, and how early a renewal counts as coming up.
 * @returns {{ status: 'loading' | 'ready' | 'failed', defaults: typeof FALLBACK_REMINDER_DEFAULTS }} `defaults`
 *   holds the fallback values until the server answers, and if it can't be reached.
 */
export function useReminderDefaults() {
  const [state, setState] = useState({ status: 'loading', defaults: FALLBACK_REMINDER_DEFAULTS })

  useEffect(() => {
    let cancelled = false
    loadReminderDefaults().then(
      (defaults) => !cancelled && setState({ status: 'ready', defaults }),
      () => !cancelled && setState({ status: 'failed', defaults: FALLBACK_REMINDER_DEFAULTS })
    )
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
