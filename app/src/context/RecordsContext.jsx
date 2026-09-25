import { createContext, useContext, useEffect, useState } from 'react'
import { VehicleContext } from './VehicleContext'

export const RecordsContext = createContext()

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw Object.assign(new Error(body.error || `Request failed: ${res.status}`), { field: body.field, status: res.status })
  }
  return res.status === 204 ? null : res.json()
}

export function RecordsProvider({ children }) {
  const { mergeVehicle } = useContext(VehicleContext)
  const [fillUps, setFillUps] = useState([])
  const [serviceRecords, setServiceRecords] = useState([])
  const [policyRecords, setPolicyRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([api('/api/fill-ups'), api('/api/service-records'), api('/api/policy-records')])
      .then(([fills, records, policies]) => {
        setFillUps(fills)
        setServiceRecords(records)
        setPolicyRecords(policies)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const getFillUpsForVehicle = (vehicleId) => fillUps.filter((f) => f.vehicleId === vehicleId)
  const getServiceRecordsForVehicle = (vehicleId) => serviceRecords.filter((r) => r.vehicleId === vehicleId)
  const getPolicyRecordsForVehicle = (vehicleId) => policyRecords.filter((p) => p.vehicleId === vehicleId)

  const addFillUp = async (data) => {
    const { fillUp, vehicle } = await api('/api/fill-ups', { method: 'POST', body: JSON.stringify(data) })
    setFillUps((fs) => [...fs, fillUp])
    mergeVehicle(vehicle)
    return fillUp.id
  }

  const updateFillUp = async (id, updates) => {
    const { fillUp, vehicle } = await api(`/api/fill-ups/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
    setFillUps((fs) => fs.map((f) => (f.id === id ? fillUp : f)))
    mergeVehicle(vehicle)
  }

  const deleteFillUp = async (id) => {
    const { vehicle } = await api(`/api/fill-ups/${id}`, { method: 'DELETE' })
    setFillUps((fs) => fs.filter((f) => f.id !== id))
    mergeVehicle(vehicle)
  }

  const addServiceRecord = async (data) => {
    const { serviceRecord, vehicle } = await api('/api/service-records', { method: 'POST', body: JSON.stringify(data) })
    setServiceRecords((rs) => [...rs, serviceRecord])
    mergeVehicle(vehicle)
    return serviceRecord.id
  }

  const updateServiceRecord = async (id, updates) => {
    const { serviceRecord, vehicle } = await api(`/api/service-records/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
    setServiceRecords((rs) => rs.map((r) => (r.id === id ? serviceRecord : r)))
    mergeVehicle(vehicle)
  }

  const deleteServiceRecord = async (id) => {
    const { vehicle } = await api(`/api/service-records/${id}`, { method: 'DELETE' })
    setServiceRecords((rs) => rs.filter((r) => r.id !== id))
    mergeVehicle(vehicle)
  }

  const addPolicyRecord = async (data) => {
    const created = await api('/api/policy-records', { method: 'POST', body: JSON.stringify(data) })
    setPolicyRecords((ps) => [...ps, created])
    return created.id
  }

  const updatePolicyRecord = async (id, updates) => {
    const updated = await api(`/api/policy-records/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
    setPolicyRecords((ps) => ps.map((p) => (p.id === id ? updated : p)))
  }

  const deletePolicyRecord = async (id) => {
    await api(`/api/policy-records/${id}`, { method: 'DELETE' })
    setPolicyRecords((ps) => ps.filter((p) => p.id !== id))
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
    <RecordsContext.Provider
      value={{
        fillUps,
        serviceRecords,
        policyRecords,
        getFillUpsForVehicle,
        getServiceRecordsForVehicle,
        getPolicyRecordsForVehicle,
        addFillUp,
        updateFillUp,
        deleteFillUp,
        addServiceRecord,
        updateServiceRecord,
        deleteServiceRecord,
        addPolicyRecord,
        updatePolicyRecord,
        deletePolicyRecord,
      }}
    >
      {children}
    </RecordsContext.Provider>
  )
}

export function useRecords() {
  const ctx = useContext(RecordsContext)
  if (!ctx) throw new Error('useRecords must be used within RecordsProvider')
  return ctx
}
