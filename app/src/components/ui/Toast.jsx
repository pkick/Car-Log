import { useEffect, useRef, useState } from 'react'
import { AlertIcon, CheckIcon, CloseIcon, UndoIcon } from '../icons'
import { Button, IconButton } from './Button'
import { cx } from './cx'

const STATUS = {
  success: { Icon: CheckIcon, tile: 'bg-green' },
  error: { Icon: AlertIcon, tile: 'bg-red' },
  undo: { Icon: UndoIcon, tile: 'bg-accent' },
}

/**
 * Calls `onTimeout` once `duration` ms have passed while not paused. Pausing keeps the time already spent.
 * @param {number | undefined} duration
 * @param {boolean} paused
 * @param {(() => void) | undefined} onTimeout
 */
function useTimeout(duration, paused, onTimeout) {
  const remaining = useRef(duration)
  const onTimeoutRef = useRef(onTimeout)

  useEffect(() => {
    onTimeoutRef.current = onTimeout
  })

  useEffect(() => {
    if (duration == null || paused) return
    const started = Date.now()
    const id = setTimeout(() => onTimeoutRef.current?.(), remaining.current)
    return () => {
      clearTimeout(id)
      remaining.current -= Date.now() - started
    }
  }, [duration, paused])
}

/**
 * One notification in the stack at the bottom right. Render it inside a ToastRegion; ToastProvider does both,
 * so screens call `useToast()` instead of rendering this.
 *
 * Its timer pauses while the pointer is over it or focus is inside it, so an Undo can't expire under the cursor.
 *
 * @param {object} props
 * @param {'success' | 'error' | 'undo'} [props.variant='success'] Sets the status icon: a green check, a red
 *   alert or an accent undo arrow. undo also shows the Undo button and a bar counting down `duration`.
 * @param {import('react').ReactNode} props.message e.g. "Fill-up saved".
 * @param {import('react').ReactNode} [props.detail] Mono line under the message, e.g. "32.2 mpg".
 * @param {number} [props.duration] Milliseconds until `onTimeout`. Leave it out for a toast that stays.
 * @param {() => void} [props.onTimeout]
 * @param {() => void} [props.onUndo] The Undo button (undo only).
 * @param {() => void} [props.onClose] The close button.
 * @param {string} [props.className] Layout only.
 */
export function Toast({ variant = 'success', message, detail, duration, onTimeout, onUndo, onClose, className }) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const paused = hovered || focused
  useTimeout(duration, paused, onTimeout)
  const { Icon, tile } = STATUS[variant] ?? STATUS.success
  const counting = variant === 'undo' && duration != null

  return (
    <div
      className={cx(
        'pointer-events-auto relative w-[340px] max-w-full flex items-center gap-3 overflow-hidden rounded-card border border-ink/10 bg-slate text-page shadow-dropdown pl-3.5 pr-2 py-2 motion-safe:animate-toast-in',
        className
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}
    >
      <span className={cx('w-5 h-5 rounded-full flex items-center justify-center flex-none text-white', tile)}>
        <Icon size={12} strokeWidth={3} />
      </span>
      <div className="flex-1 min-w-0 py-1">
        <p className="text-sm font-semibold">{message}</p>
        {detail && <p className="text-xs font-mono text-page/62 mt-0.5 break-words">{detail}</p>}
      </div>
      {variant === 'undo' && onUndo && (
        <Button variant="link" tone="dark" onClick={onUndo} className="px-1">
          Undo
        </Button>
      )}
      {onClose && (
        <IconButton aria-label="Dismiss" size="sm" tone="dark" onClick={onClose}>
          <CloseIcon size={16} />
        </IconButton>
      )}
      {counting && (
        <span aria-hidden="true" className="absolute left-2.5 right-2.5 bottom-1 h-0.5 rounded-full bg-white/14 overflow-hidden">
          <span
            className="block h-full origin-left bg-accent-on-dark animate-countdown motion-reduce:[animation-timing-function:steps(var(--toast-steps),end)]"
            style={{
              animationDuration: `${duration}ms`,
              animationPlayState: paused ? 'paused' : 'running',
              // With reduced motion the bar drops once a second instead of sliding.
              '--toast-steps': Math.max(1, Math.round(duration / 1000)),
            }}
          />
        </span>
      )}
    </div>
  )
}

/**
 * The fixed stack of toasts at the bottom right, newest at the bottom. It is a polite live region, so screen
 * readers announce each toast as it's added; keep it mounted even when empty so the first one is heard.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.children Toasts.
 */
export function ToastRegion({ children }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-4.5 right-4.5 z-toast flex flex-col items-end gap-2 max-w-[calc(100vw-36px)]"
    >
      {children}
    </div>
  )
}
