import { useId } from 'react'
import { cx } from './cx'

// The one place the text-control look is defined. P2-B's acceptance check greps for this string.
const CONTROL = 'px-3 py-2.5 border border-ink/12 rounded-lg text-sm focus:outline-none focus:border-accent'
const CONTROL_STATES = 'bg-surface text-ink placeholder:text-ink/35 aria-[invalid=true]:border-red disabled:bg-ink/4 disabled:text-ink/35 disabled:cursor-not-allowed'

// Controls fill their container unless className sets a width (w-24, w-auto). Tailwind emits w-full
// after the spacing widths, so both at once would always resolve to full width.
const fill = (className) => (/(^|\s)([\w-]+:)*w-/.test(className ?? '') ? null : 'w-full')

/**
 * Single-line text input (text, date, email, ...). For numbers use NumberInput.
 * Wrap it in a Field for a label, hint and error.
 *
 * @param {object} props
 * @param {string} [props.type='text']
 * @param {string} [props.className] Layout only. Full width unless this sets a width (w-24).
 * Other props (value, onChange, name, placeholder, ref, ...) go to the <input>.
 */
export function Input({ type = 'text', className, ...props }) {
  return <input type={type} className={cx(CONTROL, CONTROL_STATES, fill(className), className)} {...props} />
}

/**
 * Multi-line text input with the same look as Input.
 *
 * @param {object} props
 * @param {number} [props.rows=3]
 * @param {string} [props.className] Layout only.
 * Other props go to the <textarea>.
 */
export function Textarea({ rows = 3, className, ...props }) {
  return <textarea rows={rows} className={cx(CONTROL, CONTROL_STATES, fill(className), 'resize-none', className)} {...props} />
}

// A compact select that sits in a card's title row, sized to its content.
const SELECT_SM = 'px-2 py-1.5 border rounded-lg text-xs font-mono focus:outline-none focus:border-accent disabled:opacity-40 disabled:cursor-not-allowed'
const SELECT_SM_TONES = {
  light: 'bg-surface text-ink border-ink/12',
  dark: 'bg-slate text-page border-white/24 [color-scheme:dark]',
}

/**
 * Native select with the shared control look. Pass <option> elements as children.
 *
 * @param {object} props
 * @param {'sm' | 'md'} [props.size='md'] md is the full-width form control; sm is the compact mono
 *   select for a card's title row (Trends' cost-per-mile window).
 * @param {'light' | 'dark'} [props.tone='light'] For sm: use dark on slate cards.
 * @param {string} [props.className] Layout only.
 * @param {import('react').ReactNode} props.children
 * Other props (value, onChange, ...) go to the <select>.
 */
export function Select({ size = 'md', tone = 'light', className, children, ...props }) {
  const look = size === 'sm' ? cx(SELECT_SM, SELECT_SM_TONES[tone]) : cx(CONTROL, CONTROL_STATES, fill(className))
  return (
    <select className={cx(look, className)} {...props}>
      {children}
    </select>
  )
}

// IBM Plex Mono glyphs are 0.6em wide; the unit is text-xs (0.75rem), so each character is 0.45rem.
const unitPadding = (unit) => `${1.25 + unit.length * 0.45}rem`

/**
 * Numeric text field. It is `type="text"` so there are no spinner buttons to clip values, the
 * digits are tabular, and the value stays a string: parse it where you use it.
 *
 * @param {object} props
 * @param {string} props.value
 * @param {(event: import('react').ChangeEvent<HTMLInputElement>) => void} props.onChange
 * @param {string} [props.unit] Suffix shown inside the right edge, e.g. "gal" or "mi".
 * @param {'decimal' | 'numeric'} [props.inputMode='decimal'] numeric for whole numbers (odometer).
 * @param {string} [props.className] Layout only; applied to the outermost element.
 * Other props go to the <input>.
 */
export function NumberInput({ unit, inputMode = 'decimal', className, style, ...props }) {
  const unitId = useId()
  const describedBy = unit ? cx(props['aria-describedby'], unitId) : props['aria-describedby']
  const input = (
    <input
      type="text"
      inputMode={inputMode}
      autoComplete="off"
      className={cx(CONTROL, CONTROL_STATES, 'tabular-nums', unit ? 'w-full' : cx(fill(className), className))}
      style={unit ? { paddingRight: unitPadding(unit), ...style } : style}
      {...props}
      aria-describedby={describedBy}
    />
  )
  if (!unit) return input

  return (
    <div className={cx('relative', className)}>
      {input}
      <span id={unitId} className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-mono text-ink/45">
        {unit}
      </span>
    </div>
  )
}
