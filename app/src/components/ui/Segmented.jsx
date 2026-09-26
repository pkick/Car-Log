import { useRef } from 'react'
import { cx, FOCUS_RING_INSET } from './cx'

// sm: a compact joined pill that sits in a label row (fill-up price mode, full / partial).
// md: options on a tinted track (Dashboard activity filter, Trends range, Documents filter).
const STYLES = {
  sm: {
    group: 'rounded-md border overflow-hidden',
    option: 'px-2 py-0.5 text-xs font-mono font-semibold',
    light: {
      group: 'border-ink/12',
      on: 'bg-slate text-white',
      off: 'bg-surface text-ink/50 enabled:hover:bg-ink/3',
    },
    dark: {
      group: 'border-white/20',
      on: 'bg-page text-slate',
      off: 'bg-transparent text-page/60 enabled:hover:bg-white/8',
    },
  },
  md: {
    group: 'gap-1.5 p-1 rounded-lg',
    option: 'px-3 py-1.5 rounded text-xs font-mono font-semibold',
    light: {
      group: 'bg-ink/6',
      on: 'bg-slate text-white',
      off: 'text-ink/40 enabled:hover:text-ink/60',
    },
    dark: {
      group: 'bg-white/8',
      on: 'bg-page text-slate',
      off: 'text-page/60 enabled:hover:text-page',
    },
  },
}

/**
 * Pick one of a few options. A radio group: arrow keys (and Home / End) move the selection, and
 * only the selected option is in the tab order.
 *
 * @template T
 * @param {object} props
 * @param {{ value: T, label: import('react').ReactNode, disabled?: boolean }[]} props.options
 * @param {T} props.value The selected option's value.
 * @param {(value: T) => void} props.onChange
 * @param {'sm' | 'md'} [props.size='md'] sm is the compact joined pill for label rows; md is the
 *   filter track.
 * @param {'light' | 'dark'} [props.tone='light'] Use dark on slate cards.
 * @param {boolean} [props.fullWidth=false] Stretch to the container and share the width equally.
 * @param {boolean} [props.disabled]
 * @param {string} [props['aria-label']] Name the group when it isn't inside a Field.
 * @param {string} [props.className] Layout only.
 */
export function Segmented({ options, value, onChange, size = 'md', tone = 'light', fullWidth = false, disabled = false, className, ...props }) {
  const optionRefs = useRef([])
  const style = STYLES[size]
  const colors = style[tone]
  const selectedIndex = options.findIndex((option) => option.value === value)
  const tabIndex = selectedIndex === -1 ? options.findIndex((option) => !option.disabled) : selectedIndex

  const select = (index) => {
    optionRefs.current[index]?.focus()
    if (options[index].value !== value) onChange(options[index].value)
  }

  const step = (from, delta) => {
    for (let i = 1; i <= options.length; i++) {
      const index = (from + delta * i + options.length * i) % options.length
      if (!options[index].disabled) return index
    }
    return from
  }

  const handleKeyDown = (event, index) => {
    const target = {
      ArrowRight: () => step(index, 1),
      ArrowDown: () => step(index, 1),
      ArrowLeft: () => step(index, -1),
      ArrowUp: () => step(index, -1),
      Home: () => step(-1, 1),
      End: () => step(options.length, -1),
    }[event.key]
    if (!target) return
    event.preventDefault()
    select(target())
  }

  return (
    <div
      role="radiogroup"
      aria-disabled={disabled || undefined}
      className={cx(fullWidth ? 'flex w-full' : 'inline-flex', style.group, colors.group, className)}
      {...props}
    >
      {options.map((option, index) => {
        const checked = index === selectedIndex
        return (
          <button
            key={String(option.value)}
            ref={(el) => {
              optionRefs.current[index] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={index === tabIndex ? 0 : -1}
            disabled={disabled || option.disabled}
            onClick={() => select(index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cx(
              style.option,
              checked ? colors.on : colors.off,
              fullWidth && 'flex-1',
              'whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-default',
              FOCUS_RING_INSET
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
