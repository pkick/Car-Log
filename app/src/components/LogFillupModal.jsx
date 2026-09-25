import { useState } from 'react'
import { FuelIcon, CalendarIcon } from './icons'
import { useRecords } from '../context/RecordsContext'
import { computeFillMpg, formatLastReading, getLastReading } from '../lib/vehicleStats'
import { todayISO } from '../lib/dates'

export default function LogFillupModal({ vehicle, onClose, editingFillUp = null }) {
  const { getFillUpsForVehicle, getServiceRecordsForVehicle, addFillUp, updateFillUp } = useRecords()

  const [formData, setFormData] = useState({
    date: editingFillUp?.date || todayISO(),
    odometer: editingFillUp?.odometer ?? '',
    gallons: editingFillUp ? String(editingFillUp.gallons) : '',
    priceMode: 'perGallon',
    priceValue: editingFillUp ? String(editingFillUp.pricePerGal) : '',
    isFull: editingFillUp?.isFull ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [odometerError, setOdometerError] = useState(null)
  const [saveError, setSaveError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
    if (name === 'odometer') setOdometerError(null)
  }

  const gallons = parseFloat(formData.gallons) || 0
  const odometer = parseInt(formData.odometer, 10) || 0
  const priceValue = parseFloat(formData.priceValue) || 0
  const pricePerGal = formData.priceMode === 'total'
    ? (gallons > 0 ? Math.round((priceValue / gallons) * 100) / 100 : 0)
    : priceValue
  const totalCost = formData.priceMode === 'total' ? priceValue : gallons * pricePerGal

  const mpg = (() => {
    if (!vehicle || gallons <= 0 || odometer <= 0) return null
    const others = getFillUpsForVehicle(vehicle.id).filter((f) => f.id !== editingFillUp?.id)
    const candidate = { id: -1, odometer, gallons, isFull: formData.isFull }
    const merged = [...others, candidate].sort((a, b) => a.odometer - b.odometer)
    return computeFillMpg(merged).find((f) => f.id === -1)?.mpg ?? null
  })()

  const odometerHint = vehicle
    ? formatLastReading(
        getLastReading(
          getFillUpsForVehicle(vehicle.id),
          getServiceRecordsForVehicle(vehicle.id),
          editingFillUp ? { type: 'fill', id: editingFillUp.id } : null
        ),
        vehicle.purchaseOdometer
      )
    : null

  const handleSave = async () => {
    if (!vehicle || gallons <= 0 || pricePerGal <= 0 || saving) return
    if (odometer <= 0) {
      setOdometerError('Enter the current odometer reading.')
      return
    }
    const payload = {
      vehicleId: vehicle.id,
      date: formData.date,
      odometer,
      gallons,
      pricePerGal,
      isFull: formData.isFull,
    }
    setSaving(true)
    setOdometerError(null)
    setSaveError(null)
    try {
      if (editingFillUp) {
        await updateFillUp(editingFillUp.id, payload)
      } else {
        await addFillUp(payload)
      }
      onClose()
    } catch (err) {
      if (err.field === 'odometer') setOdometerError(err.message)
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
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FuelIcon size={20} className="text-accent" />
              {editingFillUp ? 'Edit fill-up' : 'Log fill-up'}
            </h2>
            <p className="text-sm text-page/70">{vehicle?.nickname} · {vehicle?.odometer?.toLocaleString()} mi</p>
          </div>
          <button onClick={onClose} className="text-3xl font-light hover:opacity-70">×</button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Date & Odometer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 mb-2 flex items-center gap-1.5">
                <CalendarIcon size={14} className="flex-none" />
                Date
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
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Odometer</label>
              <input
                type="number"
                name="odometer"
                value={formData.odometer}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-base focus:outline-none focus:border-accent"
              />
              {odometerError ? (
                <p className="text-xs text-red mt-1.5">{odometerError}</p>
              ) : odometerHint && (
                <p className="text-xs font-mono text-ink/50 mt-1.5">{odometerHint}</p>
              )}
            </div>
          </div>

          {/* Gallons & Price/Total */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Gallons</label>
              <input
                type="number"
                step="0.1"
                name="gallons"
                value={formData.gallons}
                onChange={handleChange}
                placeholder="13.2"
                className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-base focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45">
                  {formData.priceMode === 'total' ? 'Total paid' : '$/Gal'}
                </label>
                <div className="flex rounded-md border border-ink/12 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, priceMode: 'perGallon' })}
                    className={`px-2 py-0.5 text-xs font-mono font-semibold transition-colors ${
                      formData.priceMode === 'perGallon' ? 'bg-slate text-white' : 'bg-white text-ink/50 hover:bg-ink/3'
                    }`}
                  >
                    $/gal
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, priceMode: 'total' })}
                    className={`px-2 py-0.5 text-xs font-mono font-semibold transition-colors ${
                      formData.priceMode === 'total' ? 'bg-slate text-white' : 'bg-white text-ink/50 hover:bg-ink/3'
                    }`}
                  >
                    total
                  </button>
                </div>
              </div>
              <input
                type="number"
                step="0.01"
                name="priceValue"
                value={formData.priceValue}
                onChange={handleChange}
                placeholder={formData.priceMode === 'total' ? '45.67' : '3.46'}
                className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-base focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Full / Partial */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45">Tank</span>
            <div role="group" aria-label="Tank" className="flex rounded-md border border-ink/12 overflow-hidden">
              <button
                type="button"
                aria-pressed={formData.isFull}
                onClick={() => setFormData({ ...formData, isFull: true })}
                className={`px-2 py-0.5 text-xs font-mono font-semibold transition-colors ${
                  formData.isFull ? 'bg-slate text-white' : 'bg-white text-ink/50 hover:bg-ink/3'
                }`}
              >
                full
              </button>
              <button
                type="button"
                aria-pressed={!formData.isFull}
                onClick={() => setFormData({ ...formData, isFull: false })}
                className={`px-2 py-0.5 text-xs font-mono font-semibold transition-colors ${
                  !formData.isFull ? 'bg-slate text-white' : 'bg-white text-ink/50 hover:bg-ink/3'
                }`}
              >
                partial
              </button>
            </div>
          </div>

          {/* Calculated Values */}
          <div className="bg-slate text-white rounded-lg p-5 mt-6">
            <div className="text-xs font-mono font-semibold tracking-widest uppercase text-page/70 mb-3">Calculated</div>
            <div className="space-y-2">
              {formData.isFull ? (
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold tracking-tighter ${mpg != null ? 'text-accent' : 'text-page/40'}`}>
                    {mpg != null ? mpg : '—'}
                  </span>
                  <span className="text-sm text-page/80">mpg</span>
                </div>
              ) : (
                <p className="text-sm text-page/80">Partial fills aren't averaged until the next full tank</p>
              )}
              <div className="text-lg font-mono text-page/80">
                {formData.priceMode === 'total'
                  ? `$${pricePerGal.toFixed(2)}/gal`
                  : `$${totalCost.toFixed(2)} total`}
              </div>
            </div>
          </div>

          {/* Validation Callout */}
          {vehicle?.tankSize > 0 && gallons > vehicle.tankSize && (
            <div className="bg-[oklch(0.55_0.17_28/10%)] border border-[oklch(0.55_0.17_28/30%)] rounded-lg p-3 mt-4">
              <p className="font-semibold text-red text-sm mb-1">Gallons exceed tank size</p>
              <p className="text-xs text-ink/60">
                The {vehicle.nickname}'s tank holds {vehicle.tankSize} gal. Save anyway if the pump receipt says otherwise.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-ink/8 px-6 py-3 sticky bottom-0 bg-page">
          {saveError && <p className="text-xs text-red mb-2">{saveError}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={gallons <= 0 || pricePerGal <= 0 || saving}
              className="flex-1 py-2.5 bg-slate text-white font-semibold rounded-lg hover:bg-slate/90 transition-colors text-sm disabled:opacity-40 disabled:cursor-default"
            >
              {editingFillUp ? 'Save changes' : 'Save fill-up'}
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
