import { useRef } from 'react'
import { FuelIcon } from './icons'
import { Modal } from './ui'
import FillUpForm from './FillUpForm'

export default function LogFillupModal({ vehicle, onClose, editingFillUp = null }) {
  const odometerRef = useRef(null)
  return (
    <FillUpForm vehicle={vehicle} editingFillUp={editingFillUp} onSaved={onClose} onCancel={onClose} odometerRef={odometerRef}>
      {({ fields, actions }) => (
        <Modal
          open
          onClose={onClose}
          size="md"
          initialFocus={odometerRef}
          title={
            <>
              <FuelIcon size={20} className="text-accent" />
              {editingFillUp ? 'Edit fill-up' : 'Log fill-up'}
            </>
          }
          subtitle={<>{vehicle?.nickname} · {vehicle?.odometer?.toLocaleString()} mi</>}
          footer={actions}
        >
          {fields}
        </Modal>
      )}
    </FillUpForm>
  )
}
