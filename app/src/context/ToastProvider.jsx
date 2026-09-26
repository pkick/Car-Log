import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Toast, ToastRegion } from '../components/ui'
import { ToastContext } from './toast'

const MAX_TOASTS = 3
const SUCCESS_MS = 4000
const UNDO_MS = 5000

/**
 * Holds the toast stack and renders it. Mount it once, near the root; screens use `useToast()` from `./toast`.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  // The stack as of the last change, for callbacks that run between renders (timers, pagehide).
  const toastsRef = useRef([])
  const nextId = useRef(1)

  const setStack = useCallback((next) => {
    toastsRef.current = next
    setToasts(next)
  }, [])

  // Removes a toast, then runs its callback for how it ended. A removed toast is never settled again, so an
  // undo toast runs onUndo or onExpire, never both.
  const settle = useCallback(
    (id, outcome) => {
      const toast = toastsRef.current.find((t) => t.id === id)
      if (!toast) return
      setStack(toastsRef.current.filter((t) => t.id !== id))
      toast[outcome]?.()
    },
    [setStack]
  )

  const show = useCallback(
    (toast) => {
      const stack = [...toastsRef.current, { ...toast, id: nextId.current++ }]
      const dropped = stack.slice(0, -MAX_TOASTS)
      setStack(stack.slice(-MAX_TOASTS))
      // An undo toast pushed out of the stack can't be undone any more, so its action goes ahead now.
      dropped.forEach((t) => t.onExpire?.())
    },
    [setStack]
  )

  // Leaving the page ends every undo window. The deletes behind them use keepalive requests, so they finish
  // after the page is gone.
  useEffect(() => {
    const expireAll = () => {
      const undos = toastsRef.current.filter((t) => t.variant === 'undo')
      if (undos.length === 0) return
      setStack(toastsRef.current.filter((t) => t.variant !== 'undo'))
      undos.forEach((t) => t.onExpire?.())
    }
    window.addEventListener('pagehide', expireAll)
    return () => window.removeEventListener('pagehide', expireAll)
  }, [setStack])

  const api = useMemo(
    () => ({
      success: (message, detail) => show({ variant: 'success', message, detail, duration: SUCCESS_MS }),
      error: (message, detail) => show({ variant: 'error', message, detail }),
      undo: (message, { onUndo, onExpire, ms = UNDO_MS } = {}) =>
        show({ variant: 'undo', message, duration: ms, onUndo, onExpire }),
    }),
    [show]
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastRegion>
        {toasts.map((t) => (
          <Toast
            key={t.id}
            variant={t.variant}
            message={t.message}
            detail={t.detail}
            duration={t.duration}
            onTimeout={() => settle(t.id, 'onExpire')}
            onUndo={() => settle(t.id, 'onUndo')}
            onClose={() => settle(t.id, 'onExpire')}
          />
        ))}
      </ToastRegion>
    </ToastContext.Provider>
  )
}
