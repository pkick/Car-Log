import { useEffect } from 'react'
import { SpinnerIcon } from '../icons'
import { cx, FOCUS_RING } from './cx'

const BASE = 'inline-flex items-center justify-center gap-1.5 font-semibold transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-default'

// Every boxed variant has a border (transparent when unused) so they all share one height.
const BOX = 'border rounded-control'

const VARIANTS = {
  primary: 'bg-slate text-white border-transparent shadow-button enabled:hover:bg-slate/90',
  secondary: 'bg-accent/10 text-accent border-transparent enabled:hover:bg-accent/15',
  ghost: 'bg-transparent text-ink border-ink/12 enabled:hover:bg-ink/3',
  danger: 'bg-red text-white border-transparent enabled:hover:bg-red/90',
  dashed: 'bg-transparent text-ink border-dashed border-ink/20 enabled:hover:bg-ink/3',
}

// Borderless, unpadded text buttons: a row's EDIT / DEL, a link inside a sentence.
const TEXT_VARIANTS = {
  link: 'text-accent enabled:hover:text-accent/80',
  'link-danger': 'text-red enabled:hover:text-red/80',
  'link-muted': 'text-ink/50 enabled:hover:text-ink',
}

const DARK_GHOST = 'bg-transparent text-page border-white/20 enabled:hover:bg-white/8'

// On slate, accent and ink text are too dark to read.
const DARK_TEXT_VARIANTS = {
  link: 'text-accent-on-dark enabled:hover:text-accent-on-dark/80',
  'link-muted': 'text-page/62 enabled:hover:text-page',
}

const SIZES = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-4 py-2.5 text-sm',
}

const TEXT_SIZES = {
  sm: 'text-xs',
  md: 'text-sm',
}

/**
 * The app's button.
 *
 * @param {object} props
 * @param {'primary' | 'secondary' | 'ghost' | 'danger' | 'dashed' | 'link' | 'link-danger' | 'link-muted'} [props.variant='primary']
 *   primary is the slate call to action; secondary is an accent tint; ghost is transparent with a
 *   hairline border (Cancel, "All trends"); danger is red, for confirming a delete; dashed is ghost
 *   with a dashed border, for adding a row ("+ Add interval"). The link variants have no border or
 *   padding: link is accent (a row's EDIT, "Add the default intervals"), link-danger is red (DEL),
 *   link-muted is quiet ink until hovered.
 * @param {'sm' | 'md'} [props.size='md'] For the link variants this is only the text size.
 * @param {'light' | 'dark'} [props.tone='light'] Use dark on slate panels (a toast's Undo). Changes ghost,
 *   link and link-muted.
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
      className={cx(
        BASE,
        variant in TEXT_VARIANTS
          ? cx('rounded', TEXT_SIZES[size], (tone === 'dark' && DARK_TEXT_VARIANTS[variant]) || TEXT_VARIANTS[variant])
          : cx(BOX, SIZES[size], tone === 'dark' && variant === 'ghost' ? DARK_GHOST : VARIANTS[variant]),
        FOCUS_RING,
        className
      )}
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
