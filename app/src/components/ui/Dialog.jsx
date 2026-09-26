import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from '../icons'
import { IconButton } from './Button'
import { cx } from './cx'

const TABBABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(',')

const tabbables = (root) =>
  [...root.querySelectorAll(TABBABLE)].filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0)

// Open dialogs, innermost last. Only the innermost one reacts to Esc, Tab and stray focus.
const openStack = []

let scrollLocks = 0
let savedBodyStyle = null

function lockScroll() {
  if (scrollLocks++ > 0) return
  const { body, documentElement } = document
  savedBodyStyle = { overflow: body.style.overflow, paddingRight: body.style.paddingRight }
  const scrollbarWidth = window.innerWidth - documentElement.clientWidth
  body.style.overflow = 'hidden'
  if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`
}

function unlockScroll() {
  if (--scrollLocks > 0) return
  Object.assign(document.body.style, savedBodyStyle)
}

function DialogPanel({ onClose, title, subtitle, footer, children, initialFocus, layoutClassName, panelClassName }) {
  // Read during the first render, before anything inside the dialog can take focus.
  const [returnFocusTo] = useState(() => document.activeElement)
  const panelRef = useRef(null)
  const bodyRef = useRef(null)
  const pressedBackdrop = useRef(false)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  const subtitleId = useId()

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const token = {}
    const panel = panelRef.current
    openStack.push(token)
    lockScroll()

    const first = initialFocus?.current ?? tabbables(bodyRef.current)[0] ?? tabbables(panel)[0] ?? panel
    first.focus({ preventScroll: true })

    const isInnermost = () => openStack[openStack.length - 1] === token

    const handleKeyDown = (event) => {
      if (!isInnermost() || event.defaultPrevented) return
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = tabbables(panel)
      if (items.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }
      const active = document.activeElement
      const outside = !panel.contains(active) || active === panel
      if (event.shiftKey && (outside || active === items[0])) {
        event.preventDefault()
        items[items.length - 1].focus()
      } else if (!event.shiftKey && (outside || active === items[items.length - 1])) {
        event.preventDefault()
        items[0].focus()
      }
    }

    const handleFocusIn = (event) => {
      if (isInnermost() && !panel.contains(event.target)) (tabbables(panel)[0] ?? panel).focus()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', handleFocusIn)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', handleFocusIn)
      openStack.splice(openStack.indexOf(token), 1)
      unlockScroll()
      if (returnFocusTo?.isConnected) returnFocusTo.focus({ preventScroll: true })
    }
  }, [initialFocus, returnFocusTo])

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-ink/42 motion-safe:animate-fade-in"
        onMouseDown={(event) => {
          pressedBackdrop.current = event.target === event.currentTarget
        }}
        onClick={(event) => {
          // Only a press that started on the backdrop closes: a text selection dragged out of the
          // panel must not.
          if (pressedBackdrop.current && event.target === event.currentTarget) onClose()
          pressedBackdrop.current = false
        }}
      />
      <div className={cx('pointer-events-none relative flex h-full', layoutClassName)}>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={subtitle ? subtitleId : undefined}
          tabIndex={-1}
          onMouseDown={() => {
            pressedBackdrop.current = false
          }}
          className={cx('pointer-events-auto flex flex-col bg-page text-ink focus:outline-none', panelClassName)}
        >
          <header className="flex-none flex items-start justify-between gap-4 bg-slate text-page px-6 py-5">
            <div className="min-w-0">
              <h2 id={titleId} className="text-2xl font-bold flex items-center gap-2">{title}</h2>
              {subtitle && <p id={subtitleId} className="text-sm text-page/70 mt-1">{subtitle}</p>}
            </div>
            <IconButton aria-label="Close" size="sm" tone="dark" onClick={onClose}>
              <CloseIcon size={18} />
            </IconButton>
          </header>
          <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto p-6">
            {children}
          </div>
          {footer && <footer className="flex-none border-t border-ink/8 bg-page px-6 py-3">{footer}</footer>}
        </div>
      </div>
    </div>,
    document.body
  )
}

// The panel only mounts while open, so its focus and scroll handling runs once per opening.
function DialogBase({ open, ...props }) {
  return open ? <DialogPanel {...props} /> : null
}

const MODAL_WIDTHS = {
  sm: 'max-w-[440px]',
  md: 'max-w-[600px]',
  lg: 'max-w-[760px]',
}

/**
 * Centered dialog with the dark title bar. Esc, the close button and a click on the backdrop call
 * onClose; Tab stays inside; focus returns to whatever had it before. Header and footer stay put
 * while the body scrolls.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {import('react').ReactNode} props.title Also the dialog's accessible name.
 * @param {import('react').ReactNode} [props.subtitle] e.g. "The Wagon · 84,210 mi".
 * @param {'sm' | 'md' | 'lg'} [props.size='md'] 440, 600 or 760px wide.
 * @param {import('react').ReactNode} [props.footer] Actions, pinned to the bottom.
 * @param {import('react').RefObject<HTMLElement>} [props.initialFocus] Focused on open. Defaults
 *   to the first focusable element in the body, then the close button.
 * @param {import('react').ReactNode} props.children The body.
 */
export function Modal({ size = 'md', ...props }) {
  return (
    <DialogBase
      {...props}
      layoutClassName="items-center justify-center px-5 py-14"
      panelClassName={cx('w-full max-h-full rounded-modal shadow-modal overflow-hidden motion-safe:animate-dialog-in', MODAL_WIDTHS[size])}
    />
  )
}

const DRAWER_WIDTHS = {
  sm: 'max-w-[400px]',
  md: 'max-w-[480px]',
  lg: 'max-w-[640px]',
}

/**
 * Full-height panel that slides in from the right, over the page. Same behavior and API as Modal.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {import('react').ReactNode} props.title Also the dialog's accessible name.
 * @param {import('react').ReactNode} [props.subtitle]
 * @param {'sm' | 'md' | 'lg'} [props.size='md'] 400, 480 or 640px wide (never wider than the screen).
 *   md suits a form like the fill-up drawer; lg leaves room for a side-by-side preview.
 * @param {import('react').ReactNode} [props.footer] Actions, pinned to the bottom.
 * @param {import('react').RefObject<HTMLElement>} [props.initialFocus] Focused on open. Defaults
 *   to the first focusable element in the body, then the close button.
 * @param {import('react').ReactNode} props.children The body.
 */
export function Drawer({ size = 'md', ...props }) {
  return (
    <DialogBase
      {...props}
      layoutClassName="justify-end"
      panelClassName={cx('w-full h-full shadow-drawer motion-safe:animate-drawer-in', DRAWER_WIDTHS[size])}
    />
  )
}
