import { createContext, useEffect, useState } from 'react'

export const VehicleContext = createContext()

const ACTIVE_VEHICLE_KEY = 'odometer:active-vehicle-id'

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
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
    localStorage.setItem(ACTIVE_VEHICLE_KEY, String(id))
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
    if (vehicles.length <= 1) return
    await api(`/api/vehicles/${id}`, { method: 'DELETE' })
    setVehicles((vs) => {
      const next = vs.filter((v) => v.id !== id)
      if (activeVehicleId === id) setActiveVehicleId(next[0]?.id)
      return next
    })
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
