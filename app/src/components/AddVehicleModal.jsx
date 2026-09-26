import { useState, useContext, useEffect, useRef } from 'react'
import { VehicleContext } from '../context/VehicleContext'
import { currentYear } from '../lib/dates'
import { checkVin, decodedSummary, normalizeVin, planDecodedFill, replacePrompt } from '../lib/vin'
import { Button, Card, Field, Input, Modal, NumberInput, Switch } from './ui'
import FormActions from './FormActions'

const UNREACHABLE = "Can't reach the server. Check that it's running and try again."
// A proxy in front of the API (Vite in dev, or one on the NAS) answers these when the API is down.
const GATEWAY_STATUSES = [502, 503, 504]

// Fields with an error line under their input. Errors for any other field show above the buttons.
const FORM_FIELDS = [
  'nickname', 'year', 'make', 'model',
  'purchaseDate', 'purchaseOdometer', 'registrationRenewal', 'insuranceRenewal', 'tankSize',
]

/**
 * Asks the server to decode a VIN through NHTSA.
 * @param {string} vin A normalized VIN.
 * @returns {Promise<import('../lib/vin').DecodedVin>}
 * @throws {Error} With the server's sentence, e.g. "NHTSA couldn't decode this VIN."
 */
async function decodeVin(vin) {
  let res
  try {
    res = await fetch(`/api/vin/${encodeURIComponent(vin)}`)
  } catch (err) {
    throw new Error(UNREACHABLE, { cause: err })
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error || (GATEWAY_STATUSES.includes(res.status) ? UNREACHABLE : `Request failed: ${res.status}`))
  return body
}

// Field hands its id and aria props to this element, so they're passed on to the input.
function VinInput({ canDecode, decoding, onDecode, ...props }) {
  return (
    <div className="flex gap-2">
      <Input {...props} className="flex-1 min-w-0" autoCapitalize="characters" autoComplete="off" spellCheck={false} />
      <Button variant="secondary" size="sm" onClick={onDecode} disabled={!canDecode} loading={decoding}>
        Decode
      </Button>
    </div>
  )
}

/**
 * The VIN field with a Decode button that fills year, make, model and trim from NHTSA. Blank fields fill
 * without asking; before replacing values the user entered, a notice under the field asks. The VIN check and
 * any decode failure show under the field and never block saving.
 *
 * @param {object} props
 * @param {string} props.value The VIN as typed.
 * @param {(event: import('react').ChangeEvent<HTMLInputElement>) => void} props.onChange Gets the input's
 *   change events; the input is named `vin`.
 * @param {Record<string, unknown>} props.vehicle The form's current year, make, model and trim.
 * @param {(fields: Record<string, unknown>) => void} props.onFill Merges decoded fields, and the normalized
 *   `vin`, into the form.
 * @param {Record<string, unknown>} [props.prefilled] Values the form filled in itself, such as a default year.
 *   A decode replaces them without asking. Read on the first render only.
 * @param {string} [props.className] Layout only.
 */
export function VinField({ value, onChange, vehicle, onFill, prefilled, className }) {
  const [decoding, setDecoding] = useState(false)
  const [error, setError] = useState(null)
  const [decoded, setDecoded] = useState(null)
  const [conflicts, setConflicts] = useState([])
  const filled = useRef(prefilled ?? {})
  const latestRequest = useRef(0)
  const latestVehicle = useRef(vehicle)

  useEffect(() => {
    latestVehicle.current = vehicle
  })

  const vin = normalizeVin(value)
  const check = checkVin(vin)

  const reset = () => {
    latestRequest.current += 1
    setDecoding(false)
    setError(null)
    setDecoded(null)
    setConflicts([])
  }

  const handleChange = (e) => {
    reset()
    onChange(e)
  }

  const fill = (fields, extra) => {
    filled.current = { ...filled.current, ...fields }
    onFill({ ...extra, ...fields })
  }

  const handleDecode = async () => {
    reset()
    const request = latestRequest.current
    setDecoding(true)
    try {
      const result = await decodeVin(vin)
      if (request !== latestRequest.current) return
      const plan = planDecodedFill(latestVehicle.current, result, filled.current)
      fill(plan.fill, { vin: result.vin })
      setDecoded(result)
      setConflicts(plan.conflicts)
    } catch (err) {
      if (request === latestRequest.current) setError(err.message)
    } finally {
      if (request === latestRequest.current) setDecoding(false)
    }
  }

  const replace = () => {
    fill(Object.fromEntries(conflicts.map((field) => [field, decoded[field]])))
    setConflicts([])
  }

  const asking = decoded && conflicts.length > 0
  let hint = null
  if (decoded && !asking) hint = decodedSummary(decoded)
  else if (!decoded && vin && !check.ok) hint = check.reason

  return (
    <div className={className}>
      <Field label="VIN" hint={hint} error={error}>
        <VinInput
          name="vin"
          value={value ?? ''}
          onChange={handleChange}
          canDecode={vin.length === 17}
          decoding={decoding}
          onDecode={handleDecode}
        />
      </Field>
      {asking && (
        <Card tone="accent" padding="sm" role="status" className="mt-3">
          <p className="text-sm">{replacePrompt(decoded, conflicts)}</p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={replace}>
              Replace
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConflicts([])}>
              Keep mine
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}

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
