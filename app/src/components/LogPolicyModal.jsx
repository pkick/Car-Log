import { useState, useContext, useRef } from 'react'
import { CalendarIcon } from './icons'
import { useRecords } from '../context/RecordsContext'
import { VehicleContext } from '../context/VehicleContext'
import { todayISO } from '../lib/dates'

// Fields with an error line under their input. Errors for any other field show above the buttons.
const FORM_FIELDS = ['date', 'cost', 'renewalDate']

export default function LogPolicyModal({ vehicle, onClose, editingRecord = null, defaultType = 'insurance' }) {
  const { addPolicyRecord, updatePolicyRecord } = useRecords()
  const { updateVehicle } = useContext(VehicleContext)

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
  // Set once the record exists, so retrying after the renewal-date update failed doesn't add it twice.
  const savedRecordId = useRef(editingRecord?.id ?? null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
    setFieldErrors({ ...fieldErrors, [name]: null })
  }

  const fieldError = (name) => fieldErrors[name] && <p className="text-xs text-red mt-1.5">{fieldErrors[name]}</p>

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
      if (savedRecordId.current) {
        await updatePolicyRecord(savedRecordId.current, payload)
      } else {
        savedRecordId.current = await addPolicyRecord(payload)
      }
      if (formData.renewalDate) {
        const field = formData.type === 'insurance' ? 'insuranceRenewal' : 'registrationRenewal'
        await updateVehicle(vehicle.id, { [field]: formData.renewalDate })
      }
      onClose()
    } catch (err) {
      if (FORM_FIELDS.includes(err.field)) setFieldErrors({ [err.field]: err.message })
      else setSaveError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/42 flex items-center justify-center z-50 modal-rise">
      <div className="bg-page rounded-2xl shadow-modal w-[650px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-slate text-page px-8 py-6 flex items-center justify-between border-b border-ink/10 sticky top-0">
          <div>
            <h2 className="text-2xl font-bold">{editingRecord ? 'Edit payment' : 'Log payment'}</h2>
            <p className="text-sm text-page/70">{vehicle?.nickname} · {vehicle?.odometer?.toLocaleString()} mi</p>
          </div>
          <button onClick={onClose} className="text-3xl font-light hover:opacity-70">×</button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Type */}
          <div>
            <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2.5">Type</label>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'insurance' })}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  formData.type === 'insurance' ? 'bg-slate text-white' : 'bg-white border border-ink/10 text-ink hover:bg-ink/3'
                }`}
              >
                Insurance
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'registration' })}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  formData.type === 'registration' ? 'bg-slate text-white' : 'bg-white border border-ink/10 text-ink hover:bg-ink/3'
                }`}
              >
                Registration
              </button>
            </div>
          </div>

          {/* Date & Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 mb-2 flex items-center gap-1.5">
                <CalendarIcon size={14} className="flex-none" />
                Date paid
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-base focus:outline-none focus:border-accent"
              />
              {fieldError('date')}
            </div>
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Cost</label>
              <input
                type="number"
                step="0.01"
                name="cost"
                value={formData.cost}
                onChange={handleChange}
                placeholder="0.00"
                className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-base focus:outline-none focus:border-accent"
              />
              {fieldError('cost')}
            </div>
          </div>

          {/* Renewal Date & Provider */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 mb-2 flex items-center gap-1.5">
                <CalendarIcon size={14} className="flex-none" />
                Renewal date
              </label>
              <input
                type="date"
                name="renewalDate"
                value={formData.renewalDate}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-base focus:outline-none focus:border-accent"
              />
              {fieldError('renewalDate')}
            </div>
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">
                {formData.type === 'insurance' ? 'Insurer' : 'Agency'}
              </label>
              <input
                type="text"
                name="provider"
                value={formData.provider}
                onChange={handleChange}
                placeholder={formData.type === 'insurance' ? 'State Farm' : 'DMV'}
                className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-base focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-sm focus:outline-none focus:border-accent resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-ink/8 px-6 py-3 sticky bottom-0 bg-page">
          {saveError && <p className="text-xs text-red mb-2">{saveError}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={cost <= 0 || !formData.date || saving}
              className="flex-1 py-2.5 bg-slate text-white font-semibold rounded-lg hover:bg-slate/90 transition-colors text-sm disabled:opacity-40 disabled:cursor-default"
            >
              {editingRecord ? 'Save changes' : 'Save payment'}
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
