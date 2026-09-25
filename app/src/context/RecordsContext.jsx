import { createContext, useContext, useEffect, useState } from 'react'

export const RecordsContext = createContext()

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

export function RecordsProvider({ children }) {
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
    const created = await api('/api/fill-ups', { method: 'POST', body: JSON.stringify(data) })
    setFillUps((fs) => [...fs, created])
    return created.id
  }

  const updateFillUp = async (id, updates) => {
    const updated = await api(`/api/fill-ups/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
    setFillUps((fs) => fs.map((f) => (f.id === id ? updated : f)))
  }

  const deleteFillUp = async (id) => {
    await api(`/api/fill-ups/${id}`, { method: 'DELETE' })
    setFillUps((fs) => fs.filter((f) => f.id !== id))
  }

  const addServiceRecord = async (data) => {
    const created = await api('/api/service-records', { method: 'POST', body: JSON.stringify(data) })
    setServiceRecords((rs) => [...rs, created])
    return created.id
  }

  const updateServiceRecord = async (id, updates) => {
    const updated = await api(`/api/service-records/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
    setServiceRecords((rs) => rs.map((r) => (r.id === id ? updated : r)))
  }

  const deleteServiceRecord = async (id) => {
    await api(`/api/service-records/${id}`, { method: 'DELETE' })
    setServiceRecords((rs) => rs.filter((r) => r.id !== id))
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
