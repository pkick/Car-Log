import { useEffect, useState } from 'react'

/**
 * The stations a vehicle's fill-ups name, most recently used first (`GET /api/stations`), for the fill-up form's
 * suggestions. They're only a convenience, so a failed request leaves the list empty.
 *
 * @param {number | undefined} vehicleId
 * @returns {string[]}
 */
export function useStations(vehicleId) {
  const [stations, setStations] = useState([])

  useEffect(() => {
    if (vehicleId == null) return
    let cancelled = false
    fetch(`/api/stations?vehicleId=${vehicleId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => !cancelled && setStations(Array.isArray(list) ? list : []))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [vehicleId])

  return stations
}
