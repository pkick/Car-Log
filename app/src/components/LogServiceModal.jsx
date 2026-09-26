import { useState } from 'react'
import { SERVICE_CATEGORIES, CATEGORY_TEXT_CLASS, CATEGORY_TILE_CLASS, CATEGORY_ICON, SUBCATEGORIES, CATEGORY_ID_BY_SERVICE } from '../lib/serviceCategories'
import { CalendarIcon } from './icons'
import { Badge, Card, Chip, Field, Input, Modal, NumberInput, Segmented, Textarea } from './ui'
import FormActions from './FormActions'
import { useRecords } from '../context/RecordsContext'
import { useToast } from '../context/toast'
import { getDueSoonItems, formatLastReading, getLastReading } from '../lib/vehicleStats'
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
      toast.success('Service saved', summarizeServices(selectedServices))
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
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={editingRecord ? 'Edit service' : 'Log service'}
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
        {/* Services Performed */}
        <div>
          <p className="text-xs font-mono text-ink/45 mb-3 tracking-wider">SERVICES PERFORMED {selectedServices.length > 0 && `${selectedServices.length} selected`}</p>

          {/* Category Tabs */}
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

          {/* Subcategory Panel */}
          <Card tone="muted" padding="sm" className="mb-5">
            <p className="text-xs font-mono text-ink/45 mb-3 uppercase tracking-wider">
              {activeCategory.toUpperCase()} – Pick what was done
            </p>
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
          </Card>

          {/* Selected Services */}
          {selectedServices.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {selectedServices.map((service) => (
                <Chip key={service} removable aria-label={`Remove ${service}`} onClick={() => removeService(service)}>
                  {service}
                </Chip>
              ))}
            </div>
          )}
        </div>

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

        <Field label="Performed by">
          <Segmented
            fullWidth
            options={PERFORMED_BY}
            value={formData.performedBy}
            onChange={(performedBy) => setFormData({ ...formData, performedBy })}
          />
        </Field>

        <Field label="Shop">
          <Input name="shopName" value={formData.shopName} onChange={handleChange} />
        </Field>

        <Field label="Parts used">
          <Input name="partsUsed" value={formData.partsUsed} onChange={handleChange} />
        </Field>

        <Field label="Notes">
          <Textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} />
        </Field>

        {/* Next Due Callout */}
        {dueForActiveCategory && (
          <Card tone="accent" padding="sm">
            <p className="font-bold text-sm text-accent mb-1">
              {dueForActiveCategory.status === 'overdue' ? dueForActiveCategory.remainingLabel : `Next due in ${dueForActiveCategory.remainingLabel}`}
            </p>
            <p className="text-xs text-ink/60">
              From this vehicle's interval: {dueForActiveCategory.name.toLowerCase()} – {dueForActiveCategory.detailLabel}, whichever first
            </p>
          </Card>
        )}
      </div>
    </Modal>
  )
}
