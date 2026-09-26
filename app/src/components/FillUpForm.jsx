import { useId, useState } from 'react'
import { CalendarIcon } from './icons'
import { Card, Field, Input, NumberInput, Segmented } from './ui'
import FormActions from './FormActions'
import { useRecords } from '../context/RecordsContext'
import { useToast } from '../context/toast'
import { computeFillMpg, formatLastReading, getLastReading } from '../lib/vehicleStats'
import { todayISO } from '../lib/dates'
import { fillUpSavedDetail } from '../lib/toastDetails'

const PRICE_MODES = [
  { value: 'perGallon', label: '$/gal' },
  { value: 'total', label: 'total' },
]

const TANK = [
  { value: true, label: 'full' },
  { value: false, label: 'partial' },
]

const initialForm = (fill) => ({
  date: fill?.date || todayISO(),
  odometer: fill ? String(fill.odometer) : '',
  gallons: fill ? String(fill.gallons) : '',
  priceMode: 'perGallon',
  priceValue: fill ? String(fill.pricePerGal) : '',
  isFull: fill?.isFull ?? true,
})

/**
 * The fill-up form, for logging a new fill-up or editing one: the fields, the live MPG preview, the
 * tank-size warning, and the save. It owns the form state; `children` decides where the pieces go,
 * so the same form fits a modal (actions in its footer) or a side panel (actions under the fields).
 * Mount it with a new `key` to start over.
 *
 * @param {object} props
 * @param {object} props.vehicle The vehicle the fill-up belongs to.
 * @param {object | null} [props.editingFillUp] The fill-up being edited; null logs a new one.
 * @param {() => void} props.onSaved Called once the save succeeded.
 * @param {() => void} props.onCancel
 * @param {boolean} [props.compact=false] For a narrow panel: gallons and price stack, and the
 *   buttons go full width.
 * @param {import('react').RefObject<HTMLInputElement>} [props.odometerRef] Attached to the odometer
 *   input, e.g. to focus it when a dialog opens.
 * @param {(parts: { fields: import('react').ReactNode, actions: import('react').ReactNode }) => import('react').ReactNode} props.children
 *   Lays out the fields and the save / cancel actions.
 */
export default function FillUpForm({ vehicle, editingFillUp = null, onSaved, onCancel, compact = false, odometerRef, children }) {
  const { getFillUpsForVehicle, getServiceRecordsForVehicle, addFillUp, updateFillUp } = useRecords()
  const toast = useToast()
  const [formData, setFormData] = useState(() => initialForm(editingFillUp))
  const [saving, setSaving] = useState(false)
  const [odometerError, setOdometerError] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const tankLabelId = useId()

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
      toast.success('Fill-up saved', fillUpSavedDetail({ isFull: formData.isFull, mpg }))
      onSaved()
    } catch (err) {
      if (err.field === 'odometer') setOdometerError(err.message)
      else setSaveError(err.message)
      setSaving(false)
    }
  }

  const gap = compact ? 'gap-3' : 'gap-4'

  const fields = (
    <div className={compact ? 'flex flex-col gap-4' : 'flex flex-col gap-5'}>
      <div className={`grid grid-cols-2 ${gap}`}>
        <Field label={<><CalendarIcon size={14} className="flex-none" />Date</>}>
          <Input type="date" name="date" value={formData.date} onChange={handleChange} />
        </Field>
        <Field label="Odometer" hint={odometerHint} error={odometerError}>
          <NumberInput ref={odometerRef} inputMode="numeric" name="odometer" value={formData.odometer} onChange={handleChange} />
        </Field>
      </div>

      <div className={compact ? `grid grid-cols-1 ${gap}` : `grid grid-cols-2 ${gap}`}>
        <Field label="Gallons">
          <NumberInput name="gallons" value={formData.gallons} onChange={handleChange} placeholder="13.2" />
        </Field>
        <Field
          label={formData.priceMode === 'total' ? 'Total paid' : '$/Gal'}
          aside={
            <Segmented
              size="sm"
              aria-label="Price mode"
              options={PRICE_MODES}
              value={formData.priceMode}
              onChange={(priceMode) => setFormData({ ...formData, priceMode })}
            />
          }
        >
          <NumberInput
            name="priceValue"
            value={formData.priceValue}
            onChange={handleChange}
            placeholder={formData.priceMode === 'total' ? '45.67' : '3.46'}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between">
        <span id={tankLabelId} className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45">Tank</span>
        <Segmented
          size="sm"
          aria-labelledby={tankLabelId}
          options={TANK}
          value={formData.isFull}
          onChange={(isFull) => setFormData({ ...formData, isFull })}
        />
      </div>

      {vehicle?.tankSize > 0 && gallons > vehicle.tankSize && (
        <Card tone="red" padding="sm">
          <p className="font-semibold text-red text-sm mb-1">Gallons exceed tank size</p>
          <p className="text-xs text-ink/60">
            {vehicle.nickname}'s tank holds {vehicle.tankSize} gal. Save anyway if the pump receipt says otherwise.
          </p>
        </Card>
      )}

      <Card tone="dark">
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
          <div className={`${compact ? 'text-sm' : 'text-lg'} font-mono text-page/80`}>
            {formData.priceMode === 'total' ? `$${pricePerGal.toFixed(2)}/gal` : `$${totalCost.toFixed(2)} total`}
          </div>
        </div>
      </Card>
    </div>
  )

  const actions = (
    <FormActions
      submitLabel={editingFillUp ? 'Save changes' : 'Save fill-up'}
      onSubmit={handleSave}
      onCancel={onCancel}
      saving={saving}
      submitDisabled={gallons <= 0 || pricePerGal <= 0}
      error={saveError}
      stacked={compact}
    />
  )

  return children({ fields, actions })
}
