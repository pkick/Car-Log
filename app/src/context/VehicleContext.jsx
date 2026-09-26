import { createContext, useCallback, useEffect, useState } from 'react'

export const VehicleContext = createContext()

// Named before routing, when it held the active vehicle.
const LAST_VEHICLE_KEY = 'odometer:active-vehicle-id'

const UNREACHABLE = "Can't reach the server. Check that it's running and try again."
// A proxy in front of the API (Vite in dev, or one on the NAS) answers these when the API is down.
const GATEWAY_STATUSES = [502, 503, 504]

async function api(path, options) {
  let res
  try {
    res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch (err) {
    throw new Error(UNREACHABLE, { cause: err })
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const message = body.error || (GATEWAY_STATUSES.includes(res.status) ? UNREACHABLE : `Request failed: ${res.status}`)
    throw Object.assign(new Error(message), { field: body.field, status: res.status })
  }
  return res.status === 204 ? null : res.json()
}

/**
 * Loads the vehicles and keeps them in sync with the server. It renders its children straight away and reports
 * `loading` and `error`, so the records load at the same time; the app shows one skeleton until both are in.
 */
export function VehicleProvider({ children }) {
  const [vehicles, setVehicles] = useState([])
  const [rememberedId, setRememberedId] = useState(() => {
    const stored = localStorage.getItem(LAST_VEHICLE_KEY)
    return stored ? parseInt(stored, 10) : null
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api('/api/vehicles')
      .then((data) => {
        setVehicles(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  // The URL says which vehicle is shown; this remembers it for `/` to open next time.
  const rememberVehicle = useCallback((id) => {
    setRememberedId(id)
    if (id == null) localStorage.removeItem(LAST_VEHICLE_KEY)
    else localStorage.setItem(LAST_VEHICLE_KEY, String(id))
  }, [])

  // The vehicle `/` opens: the last one shown if it still exists, else the first.
  const lastVehicleId = vehicles.some((v) => v.id === rememberedId) ? rememberedId : vehicles[0]?.id ?? null

  const updateVehicle = async (id, updates) => {
    const updated = await api(`/api/vehicles/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
    setVehicles((vs) => vs.map((v) => (v.id === id ? updated : v)))
  }

  const mergeVehicle = (vehicle) => {
    setVehicles((vs) => vs.map((v) => (v.id === vehicle.id ? vehicle : v)))
  }

  const addVehicle = async (vehicleData) => {
    const created = await api('/api/vehicles', { method: 'POST', body: JSON.stringify(vehicleData) })
    setVehicles((vs) => [...vs, created])
    rememberVehicle(created.id)
    return created
  }

  const getDefaultIntervals = () => api('/api/defaults/intervals')

  const deleteVehicle = async (id) => {
    await api(`/api/vehicles/${id}`, { method: 'DELETE' })
    setVehicles((vs) => vs.filter((v) => v.id !== id))
    if (rememberedId === id) rememberVehicle(null)
  }

  return (
    <VehicleContext.Provider value={{
      loading,
      error,
      vehicles,
      lastVehicleId,
      rememberVehicle,
      updateVehicle,
      mergeVehicle,
      addVehicle,
      deleteVehicle,
      getDefaultIntervals,
    }}>
      {children}
    </VehicleContext.Provider>
  )
}
