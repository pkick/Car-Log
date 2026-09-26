import { createContext, useContext } from 'react'

/**
 * @typedef {object} ToastApi
 * @property {(message: string, detail?: string) => void} success Confirms a save; goes away after about 4 s.
 * @property {(message: string, detail?: string) => void} error Stays until dismissed. `detail` is usually the
 *   server's message.
 * @property {(message: string, options?: { onUndo?: () => void, onExpire?: () => void, ms?: number }) => void} undo
 *   Offers Undo for `ms` (default 5000). Exactly one of the callbacks runs: `onUndo` when Undo is clicked,
 *   `onExpire` when time runs out, the toast is closed or pushed out of the stack, or the page is left.
 */

/** @type {import('react').Context<ToastApi | null>} */
export const ToastContext = createContext(null)

/**
 * The toasts at the bottom right. Needs a ToastProvider above.
 * @returns {ToastApi}
 */
export function useToast() {
  const toast = useContext(ToastContext)
  if (!toast) throw new Error('useToast must be used within ToastProvider')
  return toast
}
