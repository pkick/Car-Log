import { Fragment, useState, useContext, useRef } from 'react'
import { VehicleContext } from '../context/VehicleContext'
import { FuelIcon, CheckIcon, WrenchIcon, TrashIcon } from './icons'
import { VEHICLE_COLORS, VEHICLE_COLOR_SWATCH_CLASS } from '../lib/vehicleColors'
import {
  SERVICE_CATEGORIES,
  SUBCATEGORIES,
  CATEGORY_BY_ID,
  CATEGORY_ICON,
  CATEGORY_ID_BY_SERVICE,
  CATEGORY_TILE_CLASS,
  CATEGORY_TEXT_CLASS,
} from '../lib/serviceCategories'

function formatServicesSummary(services) {
  if (services.length === 0) return 'Pick services'
  if (services.length <= 2) return services.join(', ')
  return `${services.slice(0, 2).join(', ')}, +${services.length - 2} more`
}

// Number inputs hold strings; the API only accepts JSON numbers (or null when cleared).
const toNumberOrNull = (value) => (value === '' || value == null ? null : Number(value))

export default function EditVehicleModal({ vehicleId, onClose }) {
  const { vehicles, updateVehicle, getDefaultIntervals } = useContext(VehicleContext)
  const vehicle = vehicles.find(v => v.id === vehicleId)

  const [formData, setFormData] = useState(vehicle || {})
  const [trackMode, setTrackMode] = useState({
    fuel: vehicle?.tracksFuel ?? true,
    service: vehicle?.tracksService ?? true,
  })

  const [intervals, setIntervals] = useState(
    (vehicle?.intervals ?? []).map((i) => ({ ...i, services: [...(i.services ?? [])] }))
  )
  const [expandedIntervalId, setExpandedIntervalId] = useState(null)
  const [defaultsError, setDefaultsError] = useState(null)
  const focusIntervalId = useRef(null)

  if (!vehicle) return null

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const updateInterval = (id, field, value) => {
    setIntervals(intervals.map((iv) => (iv.id === id ? { ...iv, [field]: value } : iv)))
  }

  const toggleIntervalService = (id, service) => {
    setIntervals(intervals.map((iv) => {
      if (iv.id !== id) return iv
      const services = iv.services.includes(service) ? iv.services.filter((s) => s !== service) : [...iv.services, service]
      return { ...iv, services, categoryId: CATEGORY_ID_BY_SERVICE[services[0]] ?? 'other' }
    }))
  }

  const removeInterval = (id) => {
    setIntervals(intervals.filter((iv) => iv.id !== id))
  }

  const addInterval = () => {
    const id = Math.max(0, ...intervals.map((i) => i.id)) + 1
    focusIntervalId.current = id
    setIntervals([
      ...intervals,
      { id, categoryId: 'other', name: '', services: [], trackBy: 'miles', miles: 5000, months: null, warnMiles: 500, warnDays: 14 },
    ])
  }

  const addDefaultIntervals = async () => {
    setDefaultsError(null)
    try {
      setIntervals(await getDefaultIntervals())
    } catch (err) {
      setDefaultsError(err.message)
    }
  }

  const handleSave = () => {
    updateVehicle(vehicleId, {
      ...formData,
      year: toNumberOrNull(formData.year),
      purchaseOdometer: toNumberOrNull(formData.purchaseOdometer),
      tracksFuel: trackMode.fuel,
      tracksService: trackMode.service,
      intervals,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-ink/42 flex items-center justify-center z-50 modal-rise">
      <div className="bg-page rounded-2xl shadow-modal w-[900px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-slate text-page px-6 py-5 flex items-center justify-between border-b border-ink/10 sticky top-0">
          <h2 className="text-2xl font-bold">Edit vehicle</h2>
          <button onClick={onClose} className="text-3xl font-light hover:opacity-70">×</button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Nickname & Year */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-3">Nickname</label>
              <input
                type="text"
                name="nickname"
                value={formData.nickname || ''}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-ink/12 rounded-lg text-base focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-3">Year</label>
              <input
                type="number"
                name="year"
                value={formData.year || ''}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-ink/12 rounded-lg text-base focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Make, Model, Trim */}
          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-3">Make</label>
              <input
                type="text"
                name="make"
                value={formData.make || ''}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-ink/12 rounded-lg text-base focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-3">Model</label>
              <input
                type="text"
                name="model"
                value={formData.model || ''}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-ink/12 rounded-lg text-base focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-3">Trim</label>
              <input
                type="text"
                name="trim"
                value={formData.trim || ''}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-ink/12 rounded-lg text-base focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* VIN & Plate */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-3">VIN</label>
              <input
                type="text"
                name="vin"
                value={formData.vin || ''}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-ink/12 rounded-lg text-base focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-3">Plate</label>
              <input
                type="text"
                name="plate"
                value={formData.plate || ''}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-ink/12 rounded-lg text-base focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Purchase Date & Odometer */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-3">Purchase Date</label>
              <input
                type="date"
                name="purchaseDate"
                value={formData.purchaseDate || ''}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-ink/12 rounded-lg text-base focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-3">Odometer at Purchase</label>
              <input
                type="number"
                name="purchaseOdometer"
                value={formData.purchaseOdometer || ''}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-ink/12 rounded-lg text-base focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Registration & Insurance Renewal */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-3">Registration Renewal</label>
              <input
                type="date"
                name="registrationRenewal"
                value={formData.registrationRenewal || ''}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-ink/12 rounded-lg text-base focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-3">Insurance Renewal</label>
              <input
                type="date"
                name="insuranceRenewal"
                value={formData.insuranceRenewal || ''}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-ink/12 rounded-lg text-base focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* What to Track with Toggles */}
          <div>
            <h3 className="text-base font-semibold mb-4">What to track on this vehicle</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 border border-ink/10 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-2xl"><FuelIcon size={24} /></div>
                  <div>
                    <p className="font-semibold text-base">Fuel & mileage</p>
                    <p className="text-sm text-ink/50">Fill-ups, MPG, cost per mile</p>
                  </div>
                </div>
                <button
                  onClick={() => setTrackMode({ ...trackMode, fuel: !trackMode.fuel })}
                  className={`relative w-14 h-8 rounded-full transition-colors ${trackMode.fuel ? 'bg-accent' : 'bg-ink/20'}`}
                >
                  <div className={`absolute w-6 h-6 bg-white rounded-full top-1 transition-transform ${trackMode.fuel ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 border border-ink/10 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-2xl"><WrenchIcon size={24} /></div>
                  <div>
                    <p className="font-semibold text-base">Maintenance</p>
                    <p className="text-sm text-ink/50">Service history and due reminders</p>
                  </div>
                </div>
                <button
                  onClick={() => setTrackMode({ ...trackMode, service: !trackMode.service })}
                  className={`relative w-14 h-8 rounded-full transition-colors ${trackMode.service ? 'bg-accent' : 'bg-ink/20'}`}
                >
                  <div className={`absolute w-6 h-6 bg-white rounded-full top-1 transition-transform ${trackMode.service ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Vehicle Color */}
          <div>
            <h3 className="text-base font-semibold mb-4">Vehicle color</h3>
            <div className="flex items-center gap-3">
              {VEHICLE_COLORS.map((color) => {
                const selected = (formData.color || 'slate') === color
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    aria-label={color}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-105 ${VEHICLE_COLOR_SWATCH_CLASS[color]} ${
                      selected ? 'ring-2 ring-offset-2 ring-ink' : ''
                    }`}
                  >
                    {selected && <CheckIcon size={16} className="text-white" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Service Intervals Table */}
          <div>
            <p className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 mb-4">Service intervals – Whichever comes first · warn-at is per interval</p>
            {intervals.length === 0 ? (
              <div className="bg-white border border-ink/10 rounded-2.5 p-6 text-sm text-ink/45">
                No service intervals for {vehicle.nickname}.{' '}
                <button type="button" onClick={addDefaultIntervals} className="font-semibold text-accent hover:underline">
                  Add the default intervals
                </button>
                {defaultsError && <p className="text-xs text-red mt-2">{defaultsError}</p>}
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/12">
                    <th className="text-left py-3 px-4 font-semibold text-ink">Item</th>
                    <th className="text-left py-3 px-4 font-semibold text-ink">Track by</th>
                    <th className="text-left py-3 px-4 font-semibold text-ink">Miles</th>
                    <th className="text-left py-3 px-4 font-semibold text-ink">Months</th>
                    <th className="text-left py-3 px-4 font-semibold text-ink">Warn at</th>
                    <th className="py-3 pl-2" />
                  </tr>
                </thead>
                <tbody>
                  {intervals.map((interval) => {
                    const cat = CATEGORY_BY_ID[interval.categoryId] ?? CATEGORY_BY_ID.other
                    const Icon = CATEGORY_ICON[cat.id]
                    const expanded = expandedIntervalId === interval.id
                    return (
                    <Fragment key={interval.id}>
                    <tr className="border-b border-ink/8 hover:bg-ink/3">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-7 h-7 rounded-md flex items-center justify-center flex-none ${CATEGORY_TILE_CLASS[cat.color]} ${CATEGORY_TEXT_CLASS[cat.color]}`}>
                            <Icon size={16} className="flex-none" />
                          </span>
                          <input
                            type="text"
                            ref={(el) => {
                              if (el && focusIntervalId.current === interval.id) {
                                el.focus()
                                focusIntervalId.current = null
                              }
                            }}
                            value={interval.name}
                            onChange={(e) => updateInterval(interval.id, 'name', e.target.value)}
                            placeholder="Interval name"
                            aria-label="Interval name"
                            className="w-full min-w-[140px] px-3 py-2 border border-ink/12 rounded text-sm font-medium"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setExpandedIntervalId(expanded ? null : interval.id)}
                          aria-expanded={expanded}
                          className={`mt-1.5 ml-9 text-xs font-mono text-left hover:text-ink ${interval.services.length ? 'text-ink/50' : 'text-accent'}`}
                        >
                          {formatServicesSummary(interval.services)} {expanded ? '▴' : '▾'}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={interval.trackBy}
                          onChange={(e) => updateInterval(interval.id, 'trackBy', e.target.value)}
                          className="px-3 py-2 border border-ink/12 rounded text-sm bg-white"
                        >
                          <option value="miles">Miles</option>
                          <option value="months">Months</option>
                          <option value="both">Both</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          value={interval.miles ?? ''}
                          onChange={(e) => updateInterval(interval.id, 'miles', e.target.value === '' ? null : parseInt(e.target.value, 10))}
                          className="w-24 px-3 py-2 border border-ink/12 rounded text-sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          value={interval.months ?? ''}
                          onChange={(e) => updateInterval(interval.id, 'months', e.target.value === '' ? null : parseInt(e.target.value, 10))}
                          className="w-20 px-3 py-2 border border-ink/12 rounded text-sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={interval.warnMiles ?? ''}
                            onChange={(e) => updateInterval(interval.id, 'warnMiles', e.target.value === '' ? null : parseInt(e.target.value, 10))}
                            className="w-20 px-2 py-2 border border-ink/12 rounded text-sm"
                          />
                          <span className="text-xs text-ink/40 whitespace-nowrap">mi /</span>
                          <input
                            type="number"
                            value={interval.warnDays ?? ''}
                            onChange={(e) => updateInterval(interval.id, 'warnDays', e.target.value === '' ? null : parseInt(e.target.value, 10))}
                            className="w-14 px-2 py-2 border border-ink/12 rounded text-sm"
                          />
                          <span className="text-xs text-ink/40">d</span>
                        </div>
                      </td>
                      <td className="py-3 pl-2">
                        <button
                          type="button"
                          onClick={() => removeInterval(interval.id)}
                          aria-label={`Delete ${interval.name || 'this'} interval`}
                          className="w-9 h-9 flex items-center justify-center border border-ink/12 text-ink/50 rounded-lg hover:bg-[oklch(0.55_0.17_28/10%)] hover:text-red hover:border-[oklch(0.55_0.17_28/30%)] transition-colors"
                        >
                          <TrashIcon size={16} />
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-ink/8">
                        <td colSpan={6} className="px-4 pb-4 pt-1">
                          <div className="bg-ink/3 border border-ink/10 rounded-lg p-4">
                            <p className="text-xs font-mono text-ink/45 mb-3 uppercase tracking-wider">
                              Services that reset {interval.name || 'this interval'}
                            </p>
                            <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                              {SERVICE_CATEGORIES.map((category) => (
                                <div key={category.id}>
                                  <p className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 mb-2">{category.label}</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {SUBCATEGORIES[category.id].map((service) => {
                                      const selected = interval.services.includes(service)
                                      return (
                                        <button
                                          key={service}
                                          type="button"
                                          onClick={() => toggleIntervalService(interval.id, service)}
                                          aria-pressed={selected}
                                          className={`px-2.5 py-1 rounded-lg font-semibold text-xs transition-colors ${
                                            selected
                                              ? 'bg-slate text-white'
                                              : 'bg-white border border-ink/10 text-ink hover:bg-white/80'
                                          }`}
                                        >
                                          {service}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            )}
            <button
              onClick={addInterval}
              className="mt-4 px-4 py-2 border border-dashed border-ink/20 rounded text-sm font-semibold text-ink hover:bg-ink/3 transition-colors"
            >
              + Add interval
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-ink/8 px-6 py-4 flex gap-3 sticky bottom-0 bg-page">
          <button
            onClick={handleSave}
            className="flex-1 py-3 bg-slate text-white font-semibold rounded-lg hover:bg-slate/90 transition-colors text-base"
          >
            Save vehicle
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-ink/12 text-ink font-semibold rounded-lg hover:bg-ink/3 transition-colors text-base"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
