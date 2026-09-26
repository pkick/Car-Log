import { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import { VehicleContext } from './VehicleContext'
import { useToast } from './toast'
import { EMPTY_RECORDS, recordsReducer, visibleRecords } from '../lib/recordsState'

export const RecordsContext = createContext()

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

const ENDPOINTS = {
  fillUps: '/api/fill-ups',
  serviceRecords: '/api/service-records',
  policyRecords: '/api/policy-records',
}

// "Fill-up deleted", "Couldn't delete the fill-up".
const NOUNS = {
  fillUps: 'Fill-up',
  serviceRecords: 'Service',
  policyRecords: 'Payment',
}

/**
 * Loads every fill-up, service record and payment and keeps them in sync with the server. It renders its
 * children straight away and reports `loading` and `error`; the app shows one skeleton until this and the
 * vehicles have loaded.
 */
export function RecordsProvider({ children }) {
  const { mergeVehicle } = useContext(VehicleContext)
  const toast = useToast()
  const [state, dispatch] = useReducer(recordsReducer, EMPTY_RECORDS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([api(ENDPOINTS.fillUps), api(ENDPOINTS.serviceRecords), api(ENDPOINTS.policyRecords)])
      .then(([fillUps, serviceRecords, policyRecords]) => {
        dispatch({ type: 'load', records: { fillUps, serviceRecords, policyRecords } })
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  // Records whose delete is pending are left out here, so every page, stat and count skips them.
  const fillUps = useMemo(() => visibleRecords(state, 'fillUps'), [state])
  const serviceRecords = useMemo(() => visibleRecords(state, 'serviceRecords'), [state])
  const policyRecords = useMemo(() => visibleRecords(state, 'policyRecords'), [state])

  const getFillUpsForVehicle = (vehicleId) => fillUps.filter((f) => f.vehicleId === vehicleId)
  const getServiceRecordsForVehicle = (vehicleId) => serviceRecords.filter((r) => r.vehicleId === vehicleId)
  const getPolicyRecordsForVehicle = (vehicleId) => policyRecords.filter((p) => p.vehicleId === vehicleId)

  /**
   * Hides the record at once and offers Undo. The DELETE is only sent once the undo window closes; if it fails,
   * the record comes back with an error toast. The response's vehicle carries the recomputed odometer.
   */
  const deleteWithUndo = (kind, id) => {
    const noun = NOUNS[kind]
    dispatch({ type: 'hide', kind, id })
    toast.undo(`${noun} deleted`, {
      onUndo: () => dispatch({ type: 'restore', kind, id }),
      onExpire: async () => {
        try {
          // keepalive lets the request finish when the window closed because the page is going away.
          const body = await api(`${ENDPOINTS[kind]}/${id}`, { method: 'DELETE', keepalive: true })
          dispatch({ type: 'commit', kind, id })
          if (body?.vehicle) mergeVehicle(body.vehicle)
        } catch (err) {
          // Already gone on the server (say its vehicle was deleted meanwhile), which is what was asked for.
          if (err.status === 404) {
            dispatch({ type: 'commit', kind, id })
            return
          }
          dispatch({ type: 'restore', kind, id })
          toast.error(`Couldn't delete the ${noun.toLowerCase()}`, err.message)
        }
      },
    })
  }

  const addFillUp = async (data) => {
    const { fillUp, vehicle } = await api(ENDPOINTS.fillUps, { method: 'POST', body: JSON.stringify(data) })
    dispatch({ type: 'save', kind: 'fillUps', record: fillUp })
    mergeVehicle(vehicle)
    return fillUp.id
  }

  const updateFillUp = async (id, updates) => {
    const { fillUp, vehicle } = await api(`${ENDPOINTS.fillUps}/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
    dispatch({ type: 'save', kind: 'fillUps', record: fillUp })
    mergeVehicle(vehicle)
  }

  const deleteFillUp = (id) => deleteWithUndo('fillUps', id)

  const addServiceRecord = async (data) => {
    const { serviceRecord, vehicle } = await api(ENDPOINTS.serviceRecords, { method: 'POST', body: JSON.stringify(data) })
    dispatch({ type: 'save', kind: 'serviceRecords', record: serviceRecord })
    mergeVehicle(vehicle)
    return serviceRecord.id
  }

  const updateServiceRecord = async (id, updates) => {
    const { serviceRecord, vehicle } = await api(`${ENDPOINTS.serviceRecords}/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
    dispatch({ type: 'save', kind: 'serviceRecords', record: serviceRecord })
    mergeVehicle(vehicle)
  }

  const deleteServiceRecord = (id) => deleteWithUndo('serviceRecords', id)

  const addPolicyRecord = async (data) => {
    const created = await api(ENDPOINTS.policyRecords, { method: 'POST', body: JSON.stringify(data) })
    dispatch({ type: 'save', kind: 'policyRecords', record: created })
    return created.id
  }

  const updatePolicyRecord = async (id, updates) => {
    const updated = await api(`${ENDPOINTS.policyRecords}/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
    dispatch({ type: 'save', kind: 'policyRecords', record: updated })
  }

  const deletePolicyRecord = (id) => deleteWithUndo('policyRecords', id)

  // The server cascades a vehicle's delete to its records; call this after deleteVehicle resolves.
  const removeVehicleRecords = (vehicleId) => dispatch({ type: 'removeVehicle', vehicleId })

  return (
    <RecordsContext.Provider
      value={{
        loading,
        error,
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
        removeVehicleRecords,
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
