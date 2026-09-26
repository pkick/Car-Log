import { useState, useContext } from 'react'
import { VehicleContext } from '../context/VehicleContext'
import { currentYear } from '../lib/dates'
import { Field, Input, Modal, NumberInput, Switch } from './ui'
import FormActions from './FormActions'
import VinField from './VinField'

// Fields with an error line under their input. Errors for any other field show above the buttons.
const FORM_FIELDS = [
  'nickname', 'year', 'make', 'model',
  'purchaseDate', 'purchaseOdometer', 'registrationRenewal', 'insuranceRenewal', 'tankSize',
]

export default function AddVehicleModal({ onClose, onAdded }) {
  const { addVehicle } = useContext(VehicleContext)

  const [formData, setFormData] = useState({
    nickname: '',
    year: currentYear(),
    make: '',
    model: '',
    trim: '',
    vin: '',
    plate: '',
    purchaseDate: '',
    purchaseOdometer: 0,
    registrationRenewal: '',
    insuranceRenewal: '',
    tankSize: 15,
  })

  const [trackMode, setTrackMode] = useState({
    fuel: true,
    service: true,
  })
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saveError, setSaveError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
    setFieldErrors({ ...fieldErrors, [name]: null })
  }

  const handleFill = (fields) => {
    setFormData((prev) => ({ ...prev, ...fields }))
    setFieldErrors((prev) => ({ ...prev, ...Object.fromEntries(Object.keys(fields).map((name) => [name, null])) }))
  }

  const handleSave = async () => {
    if (saving) return
    const missing = {
      nickname: !formData.nickname.trim() && 'Enter a nickname.',
      make: !formData.make.trim() && 'Enter the make.',
      model: !formData.model.trim() && 'Enter the model.',
    }
    if (missing.nickname || missing.make || missing.model) {
      setFieldErrors(missing)
      return
    }

    const purchaseOdometer = parseInt(formData.purchaseOdometer, 10) || 0
    setSaving(true)
    setFieldErrors({})
    setSaveError(null)
    try {
      await addVehicle({
        ...formData,
        year: parseInt(formData.year, 10),
        purchaseOdometer,
        tankSize: parseFloat(formData.tankSize),
        tracksFuel: trackMode.fuel,
        tracksService: trackMode.service,
        odometer: purchaseOdometer,
      })
      onAdded?.()
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
      title="Add vehicle"
      footer={
        <FormActions submitLabel="Add vehicle" onSubmit={handleSave} onCancel={onClose} saving={saving} error={saveError} />
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nickname *" error={fieldErrors.nickname}>
            <Input name="nickname" value={formData.nickname} onChange={handleChange} placeholder="e.g., The Wagon" />
          </Field>
          <Field label="Year *" error={fieldErrors.year}>
            <NumberInput inputMode="numeric" name="year" value={formData.year} onChange={handleChange} />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Make *" error={fieldErrors.make}>
            <Input name="make" value={formData.make} onChange={handleChange} placeholder="e.g., Volvo" />
          </Field>
          <Field label="Model *" error={fieldErrors.model}>
            <Input name="model" value={formData.model} onChange={handleChange} placeholder="e.g., V60" />
          </Field>
          <Field label="Trim">
            <Input name="trim" value={formData.trim} onChange={handleChange} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <VinField
            value={formData.vin}
            onChange={handleChange}
            vehicle={formData}
            onFill={handleFill}
            prefilled={{ year: formData.year }}
          />
          <Field label="Plate">
            <Input name="plate" value={formData.plate} onChange={handleChange} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Purchase Date" error={fieldErrors.purchaseDate}>
            <Input type="date" name="purchaseDate" value={formData.purchaseDate} onChange={handleChange} />
          </Field>
          <Field label="Odometer at Purchase" error={fieldErrors.purchaseOdometer}>
            <NumberInput inputMode="numeric" name="purchaseOdometer" value={formData.purchaseOdometer} onChange={handleChange} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Registration Renewal" error={fieldErrors.registrationRenewal}>
            <Input type="date" name="registrationRenewal" value={formData.registrationRenewal} onChange={handleChange} />
          </Field>
          <Field label="Insurance Renewal" error={fieldErrors.insuranceRenewal}>
            <Input type="date" name="insuranceRenewal" value={formData.insuranceRenewal} onChange={handleChange} />
          </Field>
        </div>

        <Field label="Tank Size (gallons)" error={fieldErrors.tankSize}>
          <NumberInput name="tankSize" value={formData.tankSize} onChange={handleChange} />
        </Field>

        <div>
          <h3 className="text-sm font-semibold mb-4">What to track on this vehicle</h3>
          <div className="space-y-3">
            <Switch
              label="Fuel & mileage"
              checked={trackMode.fuel}
              onChange={(fuel) => setTrackMode({ ...trackMode, fuel })}
            />
            <Switch
              label="Maintenance"
              checked={trackMode.service}
              onChange={(service) => setTrackMode({ ...trackMode, service })}
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}
