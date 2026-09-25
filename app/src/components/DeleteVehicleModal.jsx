import { useContext, useState } from 'react'
import { VehicleContext } from '../context/VehicleContext'
import { useRecords } from '../context/RecordsContext'

export default function DeleteVehicleModal({ vehicleId, onClose }) {
  const { vehicles, deleteVehicle } = useContext(VehicleContext)
  const { removeVehicleRecords } = useRecords()
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const vehicle = vehicles.find((v) => v.id === vehicleId)
  if (!vehicle) return null

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteVehicle(vehicleId)
      removeVehicleRecords(vehicleId)
      onClose()
    } catch (err) {
      setDeleteError(err.message)
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/42 flex items-center justify-center z-50 modal-rise">
      <div className="bg-page rounded-2xl shadow-modal w-[420px]">
        <div className="p-6">
          <h2 className="text-lg font-bold mb-2">Delete {vehicle.nickname}?</h2>
          <p className="text-sm text-ink/60 mb-6">
            This permanently removes the vehicle and all of its fill-ups, service records and payments. This can't be undone.
          </p>
          {deleteError && <p className="text-xs text-red mb-2">{deleteError}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-2.5 bg-red text-white font-semibold rounded-lg hover:bg-[oklch(0.55_0.17_28/90%)] transition-colors text-sm disabled:opacity-40 disabled:cursor-default"
            >
              Delete vehicle
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-ink/12 text-ink font-semibold rounded-lg hover:bg-ink/3 transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
