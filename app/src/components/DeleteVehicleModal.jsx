import { useContext } from 'react'
import { VehicleContext } from '../context/VehicleContext'

export default function DeleteVehicleModal({ vehicleId, onClose }) {
  const { vehicles, deleteVehicle } = useContext(VehicleContext)
  const vehicle = vehicles.find((v) => v.id === vehicleId)
  if (!vehicle) return null

  const isLastVehicle = vehicles.length <= 1

  const handleDelete = () => {
    deleteVehicle(vehicleId)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-ink/42 flex items-center justify-center z-50 modal-rise">
      <div className="bg-page rounded-2xl shadow-modal w-[420px]">
        <div className="p-6">
          {isLastVehicle ? (
            <>
              <h2 className="text-lg font-bold mb-2">Can't delete {vehicle.nickname}</h2>
              <p className="text-sm text-ink/60 mb-6">
                You need at least one vehicle. Add another vehicle before deleting this one.
              </p>
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-slate text-white font-semibold rounded-lg hover:bg-slate/90 transition-colors text-sm"
              >
                Got it
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold mb-2">Delete {vehicle.nickname}?</h2>
              <p className="text-sm text-ink/60 mb-6">
                This permanently removes the vehicle and all of its fuel and service history. This can't be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2.5 bg-red text-white font-semibold rounded-lg hover:bg-[oklch(0.55_0.17_28/90%)] transition-colors text-sm"
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
