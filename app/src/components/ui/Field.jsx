import { Children, cloneElement, useId } from 'react'
import { cx } from './cx'

const LABEL = 'flex items-center gap-1.5 text-xs font-mono font-semibold tracking-widest uppercase text-ink/45'
const HINT = 'text-xs font-mono text-ink/50 mt-1.5'
const ERROR = 'text-xs text-red mt-1.5'

/**
 * Label, control and one line of help. Pass exactly one control (Input, NumberInput, Select,
 * Textarea, Segmented) as the child: Field gives it an id, names it with the label (also for
 * controls a <label> can't name, like Segmented), points aria-describedby at the hint or error, and
 * sets aria-invalid while there is an error.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.label Mono uppercase label. May include an icon.
 * @param {import('react').ReactNode} [props.hint] Muted help under the control.
 * @param {import('react').ReactNode} [props.error] Red message; replaces the hint while present.
 * @param {import('react').ReactNode} [props.aside] Shown at the right end of the label row, e.g. a
 *   small Segmented that switches the field's unit.
 * @param {string} [props.className] Layout only.
 * @param {import('react').ReactElement} props.children The control.
 */
export function Field({ label, hint, error, aside, className, children }) {
  const id = useId()
  const control = Children.only(children)
  const controlId = control.props.id ?? `${id}-control`
  const labelId = `${id}-label`
  const messageId = `${id}-message`
  const message = error || hint
  const named = control.props['aria-label'] || control.props['aria-labelledby']

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <label id={labelId} htmlFor={controlId} className={LABEL}>
          {label}
        </label>
        {aside}
      </div>
      {cloneElement(control, {
        id: controlId,
        'aria-labelledby': named ? control.props['aria-labelledby'] : labelId,
        'aria-describedby': cx(control.props['aria-describedby'], message && messageId) || undefined,
        'aria-invalid': error ? true : control.props['aria-invalid'],
      })}
      {message && (
        <p id={messageId} className={error ? ERROR : HINT}>
          {message}
        </p>
      )}
    </div>
  )
}

/**
 * Field's label and help around a group of controls that no single <label> can name, such as a row of Chips. The
 * group gets role="group", named by the label and described by the hint or error.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.label Mono uppercase label, as on Field.
 * @param {import('react').ReactNode} [props.hint] Muted help under the controls.
 * @param {import('react').ReactNode} [props.error] Red message; replaces the hint while present.
 * @param {import('react').ReactNode} [props.aside] Shown at the right end of the label row, e.g. a count Badge.
 * @param {string} [props.className] Layout only.
 * @param {import('react').ReactNode} props.children The controls.
 */
export function FieldGroup({ label, hint, error, aside, className, children }) {
  const id = useId()
  const labelId = `${id}-label`
  const messageId = `${id}-message`
  const message = error || hint

  return (
    <div role="group" aria-labelledby={labelId} aria-describedby={message ? messageId : undefined} className={className}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p id={labelId} className={LABEL}>
          {label}
        </p>
        {aside}
      </div>
      {children}
      {message && (
        <p id={messageId} className={error ? ERROR : HINT}>
          {message}
        </p>
      )}
    </div>
  )
}
