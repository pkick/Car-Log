import { useEffect } from 'react'
import { SpinnerIcon } from '../icons'
import { cx, FOCUS_RING } from './cx'

// Every variant has a border (transparent when unused) so all variants share one height.
const BASE = 'inline-flex items-center justify-center gap-1.5 border font-semibold rounded-control transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-default'

const VARIANTS = {
  primary: 'bg-slate text-white border-transparent shadow-button enabled:hover:bg-slate/90',
  secondary: 'bg-accent/10 text-accent border-transparent enabled:hover:bg-accent/15',
  ghost: 'bg-transparent text-ink border-ink/12 enabled:hover:bg-ink/3',
  danger: 'bg-red text-white border-transparent enabled:hover:bg-red/90',
}

const DARK_GHOST = 'bg-transparent text-page border-white/20 enabled:hover:bg-white/8'

const SIZES = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-4 py-2.5 text-sm',
}

/**
 * The app's button.
 *
 * @param {object} props
 * @param {'primary' | 'secondary' | 'ghost' | 'danger'} [props.variant='primary'] primary is the
 *   slate call to action; secondary is an accent tint; ghost is transparent with a hairline border
 *   (Cancel, "All trends"); danger is red, for confirming a delete.
 * @param {'sm' | 'md'} [props.size='md']
 * @param {'light' | 'dark'} [props.tone='light'] Use dark on slate panels. Only changes ghost.
 * @param {boolean} [props.loading=false] Shows a spinner, disables the button and sets aria-busy.
 * @param {boolean} [props.disabled]
 * @param {'button' | 'submit' | 'reset'} [props.type='button']
 * @param {string} [props.className] Layout only (flex-1, margins); don't restyle.
 * @param {import('react').ReactNode} props.children
 */
export function Button({
  variant = 'primary',
  size = 'md',
  tone = 'light',
  loading = false,
  disabled,
  type = 'button',
  className,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(BASE, SIZES[size], tone === 'dark' && variant === 'ghost' ? DARK_GHOST : VARIANTS[variant], FOCUS_RING, className)}
      {...props}
    >
      {loading && <SpinnerIcon size={size === 'sm' ? 14 : 16} className="flex-none motion-safe:animate-spin" />}
      {children}
    </button>
  )
}

const ICON_VARIANTS = {
  ...VARIANTS,
  ghost: 'bg-transparent text-ink/50 border-ink/12 enabled:hover:bg-ink/3 enabled:hover:text-ink',
  // Row-level deletes shouldn't shout: neutral until hovered, then red.
  danger: 'bg-transparent text-ink/50 border-ink/12 enabled:hover:bg-red/10 enabled:hover:text-red enabled:hover:border-red/30',
}

const ICON_DARK_GHOST = 'bg-transparent text-page/70 border-white/20 enabled:hover:bg-white/8 enabled:hover:text-page'

const ICON_SIZES = {
  sm: 'w-8 h-8',
  md: 'w-9 h-9',
}

/**
 * A square button holding only an icon. Always give it an aria-label.
 *
 * @param {object} props
 * @param {string} props['aria-label'] Required: the button's accessible name.
 * @param {'primary' | 'secondary' | 'ghost' | 'danger'} [props.variant='ghost'] Same variants as
 *   Button, except danger stays neutral until hovered (today's row delete button).
 * @param {'sm' | 'md'} [props.size='md'] sm is 32px, md is 36px.
 * @param {'light' | 'dark'} [props.tone='light'] Use dark on slate panels. Only changes ghost.
 * @param {boolean} [props.disabled]
 * @param {'button' | 'submit' | 'reset'} [props.type='button']
 * @param {string} [props.className] Layout only.
 * @param {import('react').ReactNode} props.children The icon, e.g. `<TrashIcon size={16} />`.
 */
export function IconButton({ variant = 'ghost', size = 'md', tone = 'light', type = 'button', className, children, ...props }) {
  const label = props['aria-label']
  useEffect(() => {
    if (import.meta.env.DEV && !label) console.warn('IconButton: pass an aria-label so screen readers can name this button.')
  }, [label])

  return (
    <button
      type={type}
      className={cx(
        'inline-flex items-center justify-center flex-none border rounded-control transition-colors disabled:opacity-40 disabled:cursor-default',
        ICON_SIZES[size],
        tone === 'dark' && variant === 'ghost' ? ICON_DARK_GHOST : ICON_VARIANTS[variant],
        FOCUS_RING,
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
