import { useEffect, useState } from 'react'

let pending = null

/**
 * `GET /api/defaults/intervals`, fetched once per page load and shared. A failed request is tried again by the
 * next caller.
 * @returns {Promise<object[]>}
 */
function loadDefaultIntervals() {
  pending ??= fetch('/api/defaults/intervals')
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Request failed: ${res.status}`))))
    .catch((err) => {
      pending = null
      throw err
    })
  return pending
}

/**
 * The intervals every new vehicle starts with, which the server owns.
 *
 * @param {boolean} [enabled=true] false skips the request; the status then stays `loading`.
 * @returns {{ status: 'loading' | 'ready' | 'failed', intervals: object[] | null }}
 */
export function useDefaultIntervals(enabled = true) {
  const [state, setState] = useState({ status: 'loading', intervals: null })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    loadDefaultIntervals().then(
      (intervals) => !cancelled && setState({ status: 'ready', intervals }),
      () => !cancelled && setState({ status: 'failed', intervals: null })
    )
    return () => {
      cancelled = true
    }
  }, [enabled])

  return state
}
