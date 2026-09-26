import { Fragment, useState, useContext, useRef } from 'react'
import { VehicleContext } from '../context/VehicleContext'
import { useToast } from '../context/toast'
import { FuelIcon, CheckIcon, WrenchIcon, TrashIcon } from './icons'
import { Button, Card, Chip, Field, IconButton, Input, Modal, NumberInput, Select, Switch } from './ui'
import FormActions from './FormActions'
import VinField from './VinField'
import { VEHICLE_COLORS, VEHICLE_COLOR_SWATCH_CLASS } from '../lib/vehicleColors'
import { useReminderDefaults } from '../hooks/useReminderDefaults'
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

// Fields with an error line under their input. Errors for any other field show above the buttons.
const FORM_FIELDS = ['nickname', 'year', 'purchaseDate', 'purchaseOdometer', 'registrationRenewal', 'insuranceRenewal']

export default function EditVehicleModal({ vehicleId, onClose }) {
  const { vehicles, updateVehicle, getDefaultIntervals } = useContext(VehicleContext)
  const toast = useToast()
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
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saveError, setSaveError] = useState(null)
  const focusIntervalId = useRef(null)
  const { defaults: warnDefaults } = useReminderDefaults()

  if (!vehicle) return null

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
    setFieldErrors({ ...fieldErrors, [name]: null })
  }

  const handleFill = (fields) => {
    setFormData((prev) => ({ ...prev, ...fields }))
    setFieldErrors((prev) => ({ ...prev, ...Object.fromEntries(Object.keys(fields).map((name) => [name, null])) }))
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
      { id, categoryId: 'other', name: '', services: [], trackBy: 'miles', miles: 5000, months: null, warnMiles: warnDefaults.warnMiles, warnDays: warnDefaults.warnDays },
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

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    setFieldErrors({})
    setSaveError(null)
    try {
      await updateVehicle(vehicleId, {
        ...formData,
        year: toNumberOrNull(formData.year),
        purchaseOdometer: toNumberOrNull(formData.purchaseOdometer),
        tracksFuel: trackMode.fuel,
        tracksService: trackMode.service,
        intervals,
      })
      toast.success('Vehicle updated')
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
      size="lg"
      title="Edit vehicle"
      footer={
        <FormActions submitLabel="Save vehicle" onSubmit={handleSave} onCancel={onClose} saving={saving} error={saveError} />
      }
    >
      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-6">
          <Field label="Nickname" error={fieldErrors.nickname}>
            <Input name="nickname" value={formData.nickname || ''} onChange={handleChange} />
          </Field>
          <Field label="Year" error={fieldErrors.year}>
            <NumberInput inputMode="numeric" name="year" value={formData.year || ''} onChange={handleChange} />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <Field label="Make">
            <Input name="make" value={formData.make || ''} onChange={handleChange} />
          </Field>
          <Field label="Model">
            <Input name="model" value={formData.model || ''} onChange={handleChange} />
          </Field>
          <Field label="Trim">
            <Input name="trim" value={formData.trim || ''} onChange={handleChange} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <VinField value={formData.vin || ''} onChange={handleChange} vehicle={formData} onFill={handleFill} />
          <Field label="Plate">
            <Input name="plate" value={formData.plate || ''} onChange={handleChange} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Field label="Purchase Date" error={fieldErrors.purchaseDate}>
            <Input type="date" name="purchaseDate" value={formData.purchaseDate || ''} onChange={handleChange} />
          </Field>
          <Field label="Odometer at Purchase" error={fieldErrors.purchaseOdometer}>
            <NumberInput inputMode="numeric" name="purchaseOdometer" value={formData.purchaseOdometer || ''} onChange={handleChange} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Field label="Registration Renewal" error={fieldErrors.registrationRenewal}>
            <Input type="date" name="registrationRenewal" value={formData.registrationRenewal || ''} onChange={handleChange} />
          </Field>
          <Field label="Insurance Renewal" error={fieldErrors.insuranceRenewal}>
            <Input type="date" name="insuranceRenewal" value={formData.insuranceRenewal || ''} onChange={handleChange} />
          </Field>
        </div>

        {/* What to Track */}
        <div>
          <h3 className="text-base font-semibold mb-4">What to track on this vehicle</h3>
          <div className="space-y-3">
            <Card padding="sm" className="flex items-center gap-3">
              <FuelIcon size={24} className="flex-none" />
              <Switch
                className="flex-1"
                label="Fuel & mileage"
                description="Fill-ups, MPG, cost per mile"
                checked={trackMode.fuel}
                onChange={(fuel) => setTrackMode({ ...trackMode, fuel })}
              />
            </Card>
            <Card padding="sm" className="flex items-center gap-3">
              <WrenchIcon size={24} className="flex-none" />
              <Switch
                className="flex-1"
                label="Maintenance"
                description="Service history and due reminders"
                checked={trackMode.service}
                onChange={(service) => setTrackMode({ ...trackMode, service })}
              />
            </Card>
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
            <Card padding="lg" className="text-sm text-ink/45">
              No service intervals for {vehicle.nickname}.{' '}
              <Button variant="link" onClick={addDefaultIntervals}>
                Add the default intervals
              </Button>
              {defaultsError && <p className="text-xs text-red mt-2">{defaultsError}</p>}
            </Card>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/12">
                  <th className="text-left py-3 px-2 font-semibold text-ink">Item</th>
                  <th className="text-left py-3 px-2 font-semibold text-ink">Track by</th>
                  <th className="text-left py-3 px-2 font-semibold text-ink">Miles</th>
                  <th className="text-left py-3 px-2 font-semibold text-ink">Months</th>
                  <th className="text-left py-3 px-2 font-semibold text-ink">Warn at</th>
                  <th className="py-3 pl-2" />
                </tr>
              </thead>
              <tbody>
                {intervals.map((interval) => {
                  const cat = CATEGORY_BY_ID[interval.categoryId] ?? CATEGORY_BY_ID.other
                  const Icon = CATEGORY_ICON[cat.id]
                  const expanded = expandedIntervalId === interval.id
                  const label = interval.name || 'this interval'
                  return (
                  <Fragment key={interval.id}>
                  <tr className="border-b border-ink/8">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-md flex items-center justify-center flex-none ${CATEGORY_TILE_CLASS[cat.color]} ${CATEGORY_TEXT_CLASS[cat.color]}`}>
                          <Icon size={16} className="flex-none" />
                        </span>
                        <Input
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
                          className="min-w-[120px]"
                        />
                      </div>
                      <Button
                        variant={interval.services.length ? 'link-muted' : 'link'}
                        size="sm"
                        onClick={() => setExpandedIntervalId(expanded ? null : interval.id)}
                        aria-expanded={expanded}
                        className="mt-1.5 ml-9"
                      >
                        {formatServicesSummary(interval.services)} {expanded ? '▴' : '▾'}
                      </Button>
                    </td>
                    <td className="py-3 px-2">
                      <Select
                        value={interval.trackBy}
                        onChange={(e) => updateInterval(interval.id, 'trackBy', e.target.value)}
                        aria-label={`Track ${label} by`}
                        className="w-auto"
                      >
                        <option value="miles">Miles</option>
                        <option value="months">Months</option>
                        <option value="both">Both</option>
                      </Select>
                    </td>
                    <td className="py-3 px-2">
                      <NumberInput
                        inputMode="numeric"
                        value={interval.miles ?? ''}
                        onChange={(e) => updateInterval(interval.id, 'miles', e.target.value === '' ? null : parseInt(e.target.value, 10))}
                        aria-label={`Miles between ${label} services`}
                        className="w-20"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <NumberInput
                        inputMode="numeric"
                        value={interval.months ?? ''}
                        onChange={(e) => updateInterval(interval.id, 'months', e.target.value === '' ? null : parseInt(e.target.value, 10))}
                        aria-label={`Months between ${label} services`}
                        className="w-16"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-1.5">
                        <NumberInput
                          inputMode="numeric"
                          value={interval.warnMiles ?? ''}
                          onChange={(e) => updateInterval(interval.id, 'warnMiles', e.target.value === '' ? null : parseInt(e.target.value, 10))}
                          aria-label={`Warn this many miles before ${label} is due`}
                          className="w-16"
                        />
                        <span className="text-xs text-ink/40 whitespace-nowrap">mi /</span>
                        <NumberInput
                          inputMode="numeric"
                          value={interval.warnDays ?? ''}
                          onChange={(e) => updateInterval(interval.id, 'warnDays', e.target.value === '' ? null : parseInt(e.target.value, 10))}
                          aria-label={`Warn this many days before ${label} is due`}
                          className="w-14"
                        />
                        <span className="text-xs text-ink/40">d</span>
                      </div>
                    </td>
                    <td className="py-3 pl-2">
                      <IconButton
                        variant="danger"
                        onClick={() => removeInterval(interval.id)}
                        aria-label={`Delete ${interval.name || 'this'} interval`}
                      >
                        <TrashIcon size={16} />
                      </IconButton>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-ink/8">
                      <td colSpan={6} className="px-2 pb-4 pt-1">
                        <Card tone="muted" padding="sm">
                          <p className="text-xs font-mono text-ink/45 mb-3 uppercase tracking-wider">
                            Services that reset {label}
                          </p>
                          <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                            {SERVICE_CATEGORIES.map((category) => (
                              <div key={category.id}>
                                <p className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 mb-2">{category.label}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {SUBCATEGORIES[category.id].map((service) => (
                                    <Chip
                                      key={service}
                                      size="sm"
                                      selected={interval.services.includes(service)}
                                      onClick={() => toggleIntervalService(interval.id, service)}
                                    >
                                      {service}
                                    </Chip>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>
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
          <Button variant="dashed" size="sm" onClick={addInterval} className="mt-4">
            + Add interval
          </Button>
        </div>
      </div>
    </Modal>
  )
}
