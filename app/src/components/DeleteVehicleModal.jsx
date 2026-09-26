import { useContext, useState } from 'react'
import { VehicleContext } from '../context/VehicleContext'
import { useRecords } from '../context/RecordsContext'
import { Modal } from './ui'
import FormActions from './FormActions'

export default function DeleteVehicleModal({ vehicleId, onClose, onDeleted }) {
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
      onDeleted?.(vehicleId)
      onClose()
    } catch (err) {
      setDeleteError(err.message)
      setDeleting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Delete ${vehicle.nickname}?`}
      footer={
        <FormActions
          submitLabel="Delete vehicle"
          submitVariant="danger"
          onSubmit={handleDelete}
          onCancel={onClose}
          saving={deleting}
          error={deleteError}
        />
      }
    >
      <p className="text-sm text-ink/60">
        This permanently removes the vehicle and all of its fill-ups, service records and payments. This can't be undone.
      </p>
    </Modal>
  )
}
