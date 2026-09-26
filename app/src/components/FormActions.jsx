import { Button } from './ui'

/**
 * A form's save and cancel buttons, with the save error (one not tied to a field) above them.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.submitLabel e.g. "Save fill-up".
 * @param {() => void} props.onSubmit
 * @param {() => void} props.onCancel
 * @param {boolean} [props.saving=false] Shows the spinner and disables the submit button.
 * @param {boolean} [props.submitDisabled=false]
 * @param {'primary' | 'danger'} [props.submitVariant='primary']
 * @param {string | null} [props.error]
 * @param {boolean} [props.stacked=false] Full-width buttons on top of each other, for a narrow panel.
 */
export default function FormActions({
  submitLabel,
  onSubmit,
  onCancel,
  saving = false,
  submitDisabled = false,
  submitVariant = 'primary',
  error,
  stacked = false,
}) {
  const width = stacked ? 'w-full' : 'flex-1'
  return (
    <div>
      {error && <p className="text-xs text-red mb-2">{error}</p>}
      <div className={stacked ? 'flex flex-col gap-3' : 'flex gap-3'}>
        <Button variant={submitVariant} className={width} onClick={onSubmit} disabled={submitDisabled} loading={saving}>
          {submitLabel}
        </Button>
        <Button variant="ghost" className={width} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
