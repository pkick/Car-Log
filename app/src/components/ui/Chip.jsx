import { cx, FOCUS_RING } from './cx'

const SIZES = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
}

const WITH_ICON = 'pl-2 pr-3 py-2 text-sm'

const LOOKS = {
  on: 'bg-slate text-white border-slate',
  off: 'bg-surface text-ink border-ink/10 enabled:hover:bg-ink/3',
  removable: 'bg-accent/15 text-accent border-transparent enabled:hover:bg-accent/25',
}

/**
 * A toggle chip, for pickers with more options than a Segmented can hold: the services on a
 * service record or an interval (several at once), or the service categories (one at a time, each
 * with an icon). `selected` sets aria-pressed.
 *
 * With `removable` it is instead an accent-tinted chip ending in ×, for the summary of what's
 * picked; clicking removes it, so give it an aria-label like "Remove Brake pads".
 *
 * @param {object} props
 * @param {boolean} [props.selected=false]
 * @param {boolean} [props.removable=false]
 * @param {import('react').ReactNode} [props.icon] Leading icon tile; the chip grows to fit it.
 * @param {'sm' | 'md'} [props.size='md'] sm for dense grids (an interval's services), md otherwise.
 * @param {string} [props.className] Layout only.
 * @param {import('react').ReactNode} props.children The label, optionally followed by a count Badge.
 * Other props (onClick, aria-label, ...) go to the <button>.
 */
export function Chip({ selected = false, removable = false, icon, size = 'md', className, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={removable ? undefined : selected}
      className={cx(
        'inline-flex items-center border rounded-lg font-semibold transition-colors disabled:opacity-40 disabled:cursor-default',
        icon ? WITH_ICON : SIZES[size],
        removable ? 'gap-1.5' : 'gap-2',
        removable ? LOOKS.removable : selected ? LOOKS.on : LOOKS.off,
        FOCUS_RING,
        className
      )}
      {...props}
    >
      {icon}
      {children}
      {removable && (
        <span aria-hidden="true" className="font-bold">
          ×
        </span>
      )}
    </button>
  )
}
