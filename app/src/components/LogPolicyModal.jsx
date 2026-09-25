import { useState, useContext } from 'react'
import { CalendarIcon } from './icons'
import { useRecords } from '../context/RecordsContext'
import { VehicleContext } from '../context/VehicleContext'

export default function LogPolicyModal({ vehicle, onClose, editingRecord = null, defaultType = 'insurance' }) {
  const { addPolicyRecord, updatePolicyRecord } = useRecords()
  const { updateVehicle } = useContext(VehicleContext)

  const [formData, setFormData] = useState({
    type: editingRecord?.type || defaultType,
    date: editingRecord?.date || new Date().toISOString().split('T')[0],
    cost: editingRecord ? String(editingRecord.cost) : '',
    renewalDate: editingRecord?.renewalDate || '',
    provider: editingRecord?.provider || '',
    notes: editingRecord?.notes || '',
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const cost = parseFloat(formData.cost) || 0

  const handleSave = () => {
    if (!vehicle || cost <= 0 || !formData.date) return
    const payload = {
      vehicleId: vehicle.id,
      type: formData.type,
      date: formData.date,
      cost,
      renewalDate: formData.renewalDate || null,
      provider: formData.provider,
      notes: formData.notes,
    }
    if (editingRecord) {
      updatePolicyRecord(editingRecord.id, payload)
    } else {
      addPolicyRecord(payload)
    }
    if (formData.renewalDate) {
      const field = formData.type === 'insurance' ? 'insuranceRenewal' : 'registrationRenewal'
      updateVehicle(vehicle.id, { [field]: formData.renewalDate })
    }
    onClose()
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
        <div className="border-t border-ink/8 px-6 py-3 flex gap-3 sticky bottom-0 bg-page">
          <button
            onClick={handleSave}
            disabled={cost <= 0 || !formData.date}
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
  )
}
