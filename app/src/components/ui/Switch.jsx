import { useId } from 'react'
import { cx, FOCUS_RING } from './cx'

/**
 * On / off toggle: the handoff's 38 × 22px pill, accent when on, with a 16px knob.
 * With a label it renders a row (text left, switch right) where the text toggles it too.
 *
 * @param {object} props
 * @param {boolean} props.checked
 * @param {(checked: boolean) => void} props.onChange
 * @param {import('react').ReactNode} [props.label] Without one, pass an aria-label.
 * @param {import('react').ReactNode} [props.description] Muted second line under the label.
 * @param {boolean} [props.disabled]
 * @param {string} [props.className] Layout only; on the row when there is a label.
 * Other props go to the switch <button>.
 */
export function Switch({ checked, onChange, label, description, disabled, className, ...props }) {
  const id = useId()
  const labelId = `${id}-label`
  const descriptionId = `${id}-description`

  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={label ? labelId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex flex-none w-[38px] h-[22px] rounded-full transition-colors disabled:opacity-40 disabled:cursor-default',
        checked ? 'bg-accent' : 'bg-ink/20',
        FOCUS_RING,
        !label && className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cx(
          'absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow-knob transition-transform motion-reduce:transition-none',
          checked && 'translate-x-4'
        )}
      />
    </button>
  )
  if (!label) return control

  return (
    <label className={cx('flex items-center justify-between gap-4', disabled ? 'cursor-default' : 'cursor-pointer', className)}>
      <span className="min-w-0">
        <span id={labelId} className="block text-sm font-semibold">{label}</span>
        {description && <span id={descriptionId} className="block text-sm text-ink/50">{description}</span>}
      </span>
      {control}
    </label>
  )
}
