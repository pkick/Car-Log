import { useState } from 'react'

const UNREACHABLE = "Can't reach the server. Check that it's running and try again."
// A proxy in front of the API (Vite in dev, or one on the NAS) answers these when the API is down.
const GATEWAY_STATUSES = [502, 503, 504]

/**
 * Loads (`POST /api/demo`) or clears (`DELETE /api/demo`) the demo data, then reloads the app at `/` so every
 * screen starts from the new data: the first demo vehicle after loading, and after clearing the first-run screen
 * (or the first real vehicle, if one was added alongside the demo data).
 *
 * @param {'POST' | 'DELETE'} method
 * @returns {{ run: () => Promise<void>, busy: boolean, error: string | null }} `busy` stays true through the
 *   reload; `error` is the server's message when the request fails.
 */
export function useDemoData(method) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const run = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      let res
      try {
        res = await fetch('/api/demo', { method })
      } catch (err) {
        throw new Error(UNREACHABLE, { cause: err })
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || (GATEWAY_STATUSES.includes(res.status) ? UNREACHABLE : `Request failed: ${res.status}`))
      }
      window.location.assign('/')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return { run, busy, error }
}
