import { createContext, useEffect, useState } from 'react'

export const VehicleContext = createContext()

const ACTIVE_VEHICLE_KEY = 'odometer:active-vehicle-id'

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

export function VehicleProvider({ children }) {
  const [vehicles, setVehicles] = useState([])
  const [activeVehicleId, setActiveVehicleIdState] = useState(() => {
    const stored = localStorage.getItem(ACTIVE_VEHICLE_KEY)
    return stored ? parseInt(stored, 10) : null
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api('/api/vehicles')
      .then((data) => {
        setVehicles(data)
        setActiveVehicleIdState((prev) => (prev && data.some((v) => v.id === prev) ? prev : data[0]?.id ?? null))
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const setActiveVehicleId = (id) => {
    setActiveVehicleIdState(id)
    if (id == null) localStorage.removeItem(ACTIVE_VEHICLE_KEY)
    else localStorage.setItem(ACTIVE_VEHICLE_KEY, String(id))
  }

  const getActiveVehicle = () => vehicles.find((v) => v.id === activeVehicleId)

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
    setActiveVehicleId(created.id)
  }

  const getDefaultIntervals = () => api('/api/defaults/intervals')

  const deleteVehicle = async (id) => {
    await api(`/api/vehicles/${id}`, { method: 'DELETE' })
    setVehicles((vs) => vs.filter((v) => v.id !== id))
    if (activeVehicleId === id) setActiveVehicleId(vehicles.find((v) => v.id !== id)?.id ?? null)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-sm text-ink/50">Loading…</div>
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-2 text-center px-6">
        <p className="text-sm font-semibold text-red">Couldn't reach the server</p>
        <p className="text-xs text-ink/50">Is the backend running? ({error})</p>
      </div>
    )
  }

  return (
    <VehicleContext.Provider value={{
      vehicles,
      activeVehicleId,
      setActiveVehicleId,
      getActiveVehicle,
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
