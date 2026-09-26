import { useState } from 'react'
import {
  SERVICE_CATEGORIES,
  CATEGORY_BY_ID,
  CATEGORY_TEXT_CLASS,
  CATEGORY_TILE_CLASS,
  CATEGORY_ICON,
  SUBCATEGORIES,
  CATEGORY_ID_BY_SERVICE,
} from '../lib/serviceCategories'
import { CalendarIcon } from './icons'
import { Badge, Card, Chip, Field, FieldGroup, Input, Modal, NumberInput, Segmented, Textarea } from './ui'
import FormActions from './FormActions'
import { useRecords } from '../context/RecordsContext'
import { useToast } from '../context/toast'
import { formatLastReading, getLastReading } from '../lib/vehicleStats'
import { getNextDueAfterService } from '../lib/maintenance'
import { todayISO } from '../lib/dates'
import { summarizeServices } from '../lib/toastDetails'

const PERFORMED_BY = [
  { value: 'shop', label: 'Shop' },
  { value: 'diy', label: 'DIY' },
]

export default function LogServiceModal({ vehicle, onClose, editingRecord = null, defaultCategoryId = 'oil' }) {
  const { getFillUpsForVehicle, getServiceRecordsForVehicle, addServiceRecord, updateServiceRecord } = useRecords()
  const toast = useToast()

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
    // Derived from what was selected, not whichever tab is open. It's for display and export only:
    // intervals match on `services` (D10).
    const derivedCategoryId = CATEGORY_ID_BY_SERVICE[selectedServices[0]] || activeCategory
    const payload = {
      vehicleId: vehicle.id,
      date: formData.date,
      odometer,
      categoryId: derivedCategoryId,
      services: selectedServices,
      cost: parseFloat(formData.cost) || 0,
      performedBy: formData.performedBy,
      shopName: formData.performedBy === 'shop' ? formData.shopName.trim() : '',
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
      toast.success('Service saved', summarizeServices(selectedServices))
      onClose()
    } catch (err) {
      if (err.field === 'odometer') setOdometerError(err.message)
      else setSaveError(err.message)
      setSaving(false)
    }
  }

  const nextDue = getNextDueAfterService(vehicle?.intervals ?? [], {
    services: selectedServices,
    date: formData.date,
    odometer: odometer || null,
  })
  const activeLabel = (CATEGORY_BY_ID[activeCategory] ?? CATEGORY_BY_ID.other).label

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
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={editingRecord ? 'Edit service' : selectedServices.length > 1 ? `Log ${selectedServices.length} services` : 'Log service'}
      subtitle={<>{vehicle?.nickname} · {vehicle?.odometer?.toLocaleString()} mi</>}
      footer={
        <FormActions
          submitLabel={editingRecord ? 'Save changes' : 'Save service'}
          onSubmit={handleSave}
          onCancel={onClose}
          saving={saving}
          submitDisabled={selectedServices.length === 0}
          error={saveError}
        />
      }
    >
      <div className="space-y-5">
        <FieldGroup
          label="Services performed"
          aside={
            selectedServices.length > 0 && (
              <Badge variant="solid" tone="accent">
                {selectedServices.length} selected
              </Badge>
            )
          }
        >
          {/* Category chips */}
          <div className="flex flex-wrap gap-2.5 mb-5">
            {SERVICE_CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICON[cat.id]
              const count = selectedServices.filter(s => SUBCATEGORIES[cat.id]?.includes(s)).length
              return (
                <Chip
                  key={cat.id}
                  selected={activeCategory === cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  icon={
                    <span className={`w-7 h-7 rounded-md flex items-center justify-center flex-none ${CATEGORY_TILE_CLASS[cat.color]} ${CATEGORY_TEXT_CLASS[cat.color]}`}>
                      <Icon size={16} className="flex-none" />
                    </span>
                  }
                >
                  {cat.label}
                  {count > 0 && (
                    <Badge variant="solid" tone="accent" className="ml-1">
                      {count}
                    </Badge>
                  )}
                </Chip>
              )
            })}
          </div>

          {/* Subcategory panel */}
          <Card tone="muted" padding="sm">
            <FieldGroup label={`${activeLabel} — pick what was done`}>
              <div className="flex flex-wrap gap-2.5">
                {SUBCATEGORIES[activeCategory]?.map((subcategory) => (
                  <Chip
                    key={subcategory}
                    selected={selectedServices.includes(subcategory)}
                    onClick={() => handleServiceToggle(subcategory)}
                  >
                    {subcategory}
                  </Chip>
                ))}
              </div>
            </FieldGroup>
          </Card>

          {/* Selected services */}
          {selectedServices.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {selectedServices.map((service) => (
                <Chip key={service} removable aria-label={`Remove ${service}`} onClick={() => removeService(service)}>
                  {service}
                </Chip>
              ))}
            </div>
          )}
        </FieldGroup>

        {/* Date, Odometer, Cost */}
        <div className="grid grid-cols-3 gap-4">
          <Field label={<><CalendarIcon size={14} className="flex-none" />Date</>}>
            <Input type="date" name="date" value={formData.date} onChange={handleChange} />
          </Field>
          <Field label="Odometer" hint={odometerHint} error={odometerError}>
            <NumberInput inputMode="numeric" name="odometer" value={formData.odometer} onChange={handleChange} />
          </Field>
          <Field label="Cost">
            <NumberInput name="cost" value={formData.cost} onChange={handleChange} placeholder="$0.00" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Performed by">
            <Segmented
              fullWidth
              options={PERFORMED_BY}
              value={formData.performedBy}
              onChange={(performedBy) => setFormData({ ...formData, performedBy })}
            />
          </Field>
          <Field label="Shop name">
            <Input
              name="shopName"
              value={formData.performedBy === 'shop' ? formData.shopName : ''}
              onChange={handleChange}
              disabled={formData.performedBy !== 'shop'}
              placeholder={formData.performedBy === 'shop' ? 'Where it was done' : 'Not needed for DIY'}
            />
          </Field>
        </div>

        <Field label="Parts used">
          <Input name="partsUsed" value={formData.partsUsed} onChange={handleChange} />
        </Field>

        <Field label="Notes">
          <Textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} />
        </Field>

        {/* Next due callout */}
        {nextDue.length > 0 && (
          <Card tone="accent" padding="sm">
            <p className="text-xs font-mono font-semibold tracking-widest uppercase text-accent mb-2">Next due</p>
            <ul className="space-y-2">
              {nextDue.map((next) => (
                <li key={next.intervalId}>
                  <p className="text-sm font-semibold">
                    {next.name} {next.label}
                  </p>
                  <p className="text-xs text-ink/60">From this vehicle's interval: {next.rule}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </Modal>
  )
}
