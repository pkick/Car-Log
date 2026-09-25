import { useState } from 'react'
import { SERVICE_CATEGORIES, CATEGORY_TEXT_CLASS, CATEGORY_TILE_CLASS, CATEGORY_ICON, SUBCATEGORIES, CATEGORY_ID_BY_SERVICE } from '../lib/serviceCategories'
import { CalendarIcon } from './icons'
import { useRecords } from '../context/RecordsContext'
import { getDueSoonItems, formatLastReading, getLastReading } from '../lib/vehicleStats'
import { todayISO } from '../lib/dates'

export default function LogServiceModal({ vehicle, onClose, editingRecord = null, defaultCategoryId = 'oil' }) {
  const { getFillUpsForVehicle, getServiceRecordsForVehicle, addServiceRecord, updateServiceRecord } = useRecords()

  const [activeCategory, setActiveCategory] = useState(editingRecord?.categoryId || defaultCategoryId)
  const [selectedServices, setSelectedServices] = useState(editingRecord?.services || [])
  const [formData, setFormData] = useState({
    date: editingRecord?.date || todayISO(),
    odometer: editingRecord?.odometer ?? '',
    cost: editingRecord ? String(editingRecord.cost) : '',
    performedBy: editingRecord?.performedBy || 'shop',
    shopName: editingRecord?.shopName || '',
    partsUsed: editingRecord?.partsUsed || '',
    notes: editingRecord?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [odometerError, setOdometerError] = useState(null)
  const [saveError, setSaveError] = useState(null)

  const handleServiceToggle = (service) => {
    if (selectedServices.includes(service)) {
      setSelectedServices(selectedServices.filter(s => s !== service))
    } else {
      setSelectedServices([...selectedServices, service])
    }
  }

  const removeService = (service) => {
    setSelectedServices(selectedServices.filter(s => s !== service))
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
    if (name === 'odometer') setOdometerError(null)
  }

  const odometer = parseInt(formData.odometer, 10) || 0

  const handleSave = async () => {
    if (!vehicle || selectedServices.length === 0 || saving) return
    if (odometer <= 0) {
      setOdometerError('Enter the current odometer reading.')
      return
    }
    // categoryId drives interval/due-soon matching, so it needs to reflect what was actually
    // selected rather than whichever tab happened to be open when Save was clicked.
    const derivedCategoryId = CATEGORY_ID_BY_SERVICE[selectedServices[0]] || activeCategory
    const payload = {
      vehicleId: vehicle.id,
      date: formData.date,
      odometer,
      categoryId: derivedCategoryId,
      services: selectedServices,
      cost: parseFloat(formData.cost) || 0,
      performedBy: formData.performedBy,
      shopName: formData.shopName,
      partsUsed: formData.partsUsed,
      notes: formData.notes,
    }
    setSaving(true)
    setOdometerError(null)
    setSaveError(null)
    try {
      if (editingRecord) {
        await updateServiceRecord(editingRecord.id, payload)
      } else {
        await addServiceRecord(payload)
      }
      onClose()
    } catch (err) {
      if (err.field === 'odometer') setOdometerError(err.message)
      else setSaveError(err.message)
      setSaving(false)
    }
  }

  const dueForActiveCategory = vehicle
    ? getDueSoonItems(vehicle, getServiceRecordsForVehicle(vehicle.id), vehicle.odometer).find(
        (item) => item.categoryId === activeCategory
      )
    : null

  const odometerHint = vehicle
    ? formatLastReading(
        getLastReading(
          getFillUpsForVehicle(vehicle.id),
          getServiceRecordsForVehicle(vehicle.id),
          editingRecord ? { type: 'service', id: editingRecord.id } : null
        ),
        vehicle.purchaseOdometer
      )
    : null

  return (
    <div className="fixed inset-0 bg-ink/42 flex items-center justify-center z-50 modal-rise">
      <div className="bg-page rounded-2xl shadow-modal w-[1000px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-slate text-page px-8 py-6 flex items-center justify-between border-b border-ink/10 sticky top-0">
          <div>
            <h2 className="text-2xl font-bold">{editingRecord ? 'Edit service' : 'Log service'}</h2>
            <p className="text-sm text-page/70">{vehicle?.nickname} · {vehicle?.odometer?.toLocaleString()} mi</p>
          </div>
          <button onClick={onClose} className="text-3xl font-light hover:opacity-70">×</button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Services Performed */}
          <div>
            <p className="text-xs font-mono text-ink/45 mb-3 tracking-wider">SERVICES PERFORMED {selectedServices.length > 0 && `${selectedServices.length} selected`}</p>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2.5 mb-5">
              {SERVICE_CATEGORIES.map((cat) => {
                const Icon = CATEGORY_ICON[cat.id]
                return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`pl-2 pr-3 py-2 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2 ${
                    activeCategory === cat.id
                      ? 'bg-slate text-white'
                      : 'bg-white border border-ink/10 text-ink hover:bg-ink/3'
                  }`}
                >
                  <span className={`w-7 h-7 rounded-md flex items-center justify-center flex-none ${CATEGORY_TILE_CLASS[cat.color]} ${CATEGORY_TEXT_CLASS[cat.color]}`}>
                    <Icon size={16} className="flex-none" />
                  </span>
                  {cat.label}
                  {selectedServices.some(s => SUBCATEGORIES[cat.id]?.includes(s)) && (
                    <span className="ml-1 bg-accent text-white text-xs px-1.5 py-0.5 rounded-full font-mono">
                      {selectedServices.filter(s => SUBCATEGORIES[cat.id]?.includes(s)).length}
                    </span>
                  )}
                </button>
                )
              })}
            </div>

            {/* Subcategory Panel */}
            <div className="bg-ink/3 border border-ink/10 rounded-lg p-4 mb-5">
              <p className="text-xs font-mono text-ink/45 mb-3 uppercase tracking-wider">
                {activeCategory.toUpperCase()} – Pick what was done
              </p>
              <div className="flex flex-wrap gap-2.5">
                {SUBCATEGORIES[activeCategory]?.map((subcategory) => (
                  <button
                    key={subcategory}
                    onClick={() => handleServiceToggle(subcategory)}
                    className={`px-3 py-1.5 rounded-lg font-semibold text-sm transition-colors ${
                      selectedServices.includes(subcategory)
                        ? 'bg-slate text-white'
                        : 'bg-white border border-ink/10 text-ink hover:bg-white/80'
                    }`}
                  >
                    {subcategory}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Services */}
            {selectedServices.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {selectedServices.map((service) => (
                  <button
                    key={service}
                    onClick={() => removeService(service)}
                    className="px-2.5 py-1.5 bg-[oklch(0.56_0.19_258/15%)] text-accent rounded-lg text-sm font-semibold flex items-center gap-1.5 hover:bg-[oklch(0.56_0.19_258/25%)] transition-colors"
                  >
                    {service}
                    <span className="font-bold">×</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date, Odometer, Cost */}
          <div className="grid grid-cols-3 gap-4">
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
                className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Odometer</label>
              <input
                type="number"
                name="odometer"
                value={formData.odometer}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-sm focus:outline-none focus:border-accent"
              />
              {odometerError ? (
                <p className="text-xs text-red mt-1.5">{odometerError}</p>
              ) : odometerHint && (
                <p className="text-xs font-mono text-ink/50 mt-1.5">{odometerHint}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Cost</label>
              <input
                type="number"
                step="0.01"
                name="cost"
                value={formData.cost}
                onChange={handleChange}
                placeholder="$0.00"
                className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Performed By */}
          <div>
            <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2.5">Performed by</label>
            <div className="flex gap-2.5">
              <button
                onClick={() => setFormData({ ...formData, performedBy: 'shop' })}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  formData.performedBy === 'shop'
                    ? 'bg-slate text-white'
                    : 'bg-white border border-ink/10 text-ink hover:bg-ink/3'
                }`}
              >
                Shop
              </button>
              <button
                onClick={() => setFormData({ ...formData, performedBy: 'diy' })}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  formData.performedBy === 'diy'
                    ? 'bg-slate text-white'
                    : 'bg-white border border-ink/10 text-ink hover:bg-ink/3'
                }`}
              >
                DIY
              </button>
            </div>
          </div>

          {/* Shop Name */}
          <div>
            <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Shop</label>
            <input
              type="text"
              name="shopName"
              value={formData.shopName}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-sm focus:outline-none focus:border-accent"
            />
          </div>

          {/* Parts Used */}
          <div>
            <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Parts used</label>
            <input
              type="text"
              name="partsUsed"
              value={formData.partsUsed}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-sm focus:outline-none focus:border-accent"
            />
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

          {/* Next Due Callout */}
          {dueForActiveCategory && (
            <div className="bg-[oklch(0.56_0.19_258/10%)] border border-[oklch(0.56_0.19_258/30%)] rounded-lg p-4 mt-5">
              <p className="font-bold text-sm text-accent mb-1">
                {dueForActiveCategory.status === 'overdue' ? dueForActiveCategory.remainingLabel : `Next due in ${dueForActiveCategory.remainingLabel}`}
              </p>
              <p className="text-xs text-ink/60">
                From this vehicle's interval: {dueForActiveCategory.name.toLowerCase()} – {dueForActiveCategory.detailLabel}, whichever first
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
              disabled={selectedServices.length === 0 || saving}
              className="flex-1 py-2.5 bg-slate text-white font-semibold rounded-lg hover:bg-slate/90 transition-colors text-sm disabled:opacity-40 disabled:cursor-default"
            >
              {editingRecord ? 'Save changes' : 'Save service'}
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
