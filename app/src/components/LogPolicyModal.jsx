import { useState, useContext } from 'react'
import { CalendarIcon } from './icons'
import { Field, Input, Modal, NumberInput, Segmented, Textarea } from './ui'
import FormActions from './FormActions'
import ReceiptDropZone from './ReceiptDropZone'
import { useRecords } from '../context/RecordsContext'
import { VehicleContext } from '../context/VehicleContext'
import { useToast } from '../context/toast'
import { useReceiptQueue } from '../hooks/useReceiptQueue'
import { useVehicleReceipts } from '../hooks/useReceipts'
import { todayISO } from '../lib/dates'
import { failedUploadMessage } from '../lib/receipts'
import { paymentSavedDetail } from '../lib/toastDetails'

// Fields with an error line under their input. Errors for any other field show above the buttons.
const FORM_FIELDS = ['date', 'cost', 'renewalDate']

const TYPES = [
  { value: 'insurance', label: 'Insurance' },
  { value: 'registration', label: 'Registration' },
]

export default function LogPolicyModal({ vehicle, onClose, editingRecord = null, defaultType = 'insurance' }) {
  const { addPolicyRecord, updatePolicyRecord } = useRecords()
  const { updateVehicle } = useContext(VehicleContext)
  const toast = useToast()

  const [formData, setFormData] = useState({
    type: editingRecord?.type || defaultType,
    date: editingRecord?.date || todayISO(),
    cost: editingRecord ? String(editingRecord.cost) : '',
    renewalDate: editingRecord?.renewalDate || '',
    provider: editingRecord?.provider || '',
    notes: editingRecord?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saveError, setSaveError] = useState(null)
  // Set once the record exists, so retrying after the renewal-date update or an upload failed doesn't add it twice.
  // Its receipts upload straight away from then on.
  const [recordId, setRecordId] = useState(editingRecord?.id ?? null)
  const receiptQueue = useReceiptQueue({ recordType: 'policy', recordId })
  const { receipts: vehicleReceipts } = useVehicleReceipts(vehicle?.id)
  const attachedReceipts = recordId == null ? [] : vehicleReceipts.filter((r) => r.recordType === 'policy' && r.recordId === recordId)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
    setFieldErrors({ ...fieldErrors, [name]: null })
  }

  const cost = parseFloat(formData.cost) || 0

  const handleSave = async () => {
    if (!vehicle || cost <= 0 || !formData.date || saving) return
    const payload = {
      vehicleId: vehicle.id,
      type: formData.type,
      date: formData.date,
      cost,
      renewalDate: formData.renewalDate || null,
      provider: formData.provider,
      notes: formData.notes,
    }
    setSaving(true)
    setFieldErrors({})
    setSaveError(null)
    try {
      let id = recordId
      if (id) {
        await updatePolicyRecord(id, payload)
      } else {
        id = await addPolicyRecord(payload)
        setRecordId(id)
      }
      if (formData.renewalDate) {
        const field = formData.type === 'insurance' ? 'insuranceRenewal' : 'registrationRenewal'
        await updateVehicle(vehicle.id, { [field]: formData.renewalDate })
      }
      const failed = await receiptQueue.uploadAll(id)
      if (failed > 0) {
        setSaveError(failedUploadMessage('Payment', failed))
        setSaving(false)
        return
      }
      toast.success('Payment saved', paymentSavedDetail({ type: formData.type, cost }))
      onClose()
    } catch (err) {
      if (FORM_FIELDS.includes(err.field)) setFieldErrors({ [err.field]: err.message })
      else setSaveError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={editingRecord ? 'Edit payment' : 'Log payment'}
      subtitle={<>{vehicle?.nickname} · {vehicle?.odometer?.toLocaleString()} mi</>}
      footer={
        <FormActions
          submitLabel={recordId ? 'Save changes' : 'Save payment'}
          onSubmit={handleSave}
          onCancel={onClose}
          saving={saving}
          submitDisabled={cost <= 0 || !formData.date}
          error={saveError}
        />
      }
    >
      <div className="space-y-5">
        <Field label="Type">
          <Segmented
            fullWidth
            options={TYPES}
            value={formData.type}
            onChange={(type) => setFormData({ ...formData, type })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={<><CalendarIcon size={14} className="flex-none" />Date paid</>} error={fieldErrors.date}>
            <Input type="date" name="date" value={formData.date} onChange={handleChange} />
          </Field>
          <Field label="Cost" error={fieldErrors.cost}>
            <NumberInput name="cost" value={formData.cost} onChange={handleChange} placeholder="0.00" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label={<><CalendarIcon size={14} className="flex-none" />Renewal date</>} error={fieldErrors.renewalDate}>
            <Input type="date" name="renewalDate" value={formData.renewalDate} onChange={handleChange} />
          </Field>
          <Field label={formData.type === 'insurance' ? 'Insurer' : 'Agency'}>
            <Input
              name="provider"
              value={formData.provider}
              onChange={handleChange}
              placeholder={formData.type === 'insurance' ? 'State Farm' : 'DMV'}
            />
          </Field>
        </div>

        <Field label="Notes">
          <Textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} />
        </Field>

        <ReceiptDropZone queue={receiptQueue} attached={attachedReceipts} />
      </div>
    </Modal>
  )
}
