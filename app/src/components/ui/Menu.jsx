import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { CheckIcon } from '../icons'
import { cx } from './cx'

const MenuContext = createContext(null)

const ITEMS = '[role="menuitem"]:not(:disabled), [role="menuitemradio"]:not(:disabled)'

const ITEM_TONES = {
  default: 'text-ink hover:bg-ink/4.5 focus:bg-ink/6',
  danger: 'text-red hover:bg-red/10 focus:bg-red/10',
}

/**
 * A menu button: a trigger that opens a short list of actions (a row's More menu, the vehicle switcher).
 * Enter, Space, Down or a click opens it on the first item and Up on the last; Up, Down, Home and End move;
 * Enter or Space picks. Esc, Tab, a pick or a click outside closes it, and every close from the keyboard or a
 * pick puts focus back on the trigger.
 *
 * @param {object} props
 * @param {(triggerProps: object) => import('react').ReactNode} props.trigger Renders the button that opens the
 *   menu. Spread `triggerProps` (ref, id, ARIA state and handlers) onto it, after its own props:
 *   `(props) => <IconButton aria-label="More actions" {...props}><MoreIcon /></IconButton>`.
 * @param {'start' | 'end'} [props.align='start'] Which edge of the trigger the menu lines up with.
 * @param {string} [props['aria-label']] Names the menu; by default the trigger does.
 * @param {boolean} [props.defaultOpen=false] Start open without taking focus (for the gallery).
 * @param {string} [props.className] Layout of the wrapper around the trigger, e.g. `w-full`.
 * @param {string} [props.menuClassName] Layout of the menu panel, e.g. its width.
 * @param {import('react').ReactNode} props.children `MenuItem`s, with `MenuLabel` and `MenuSeparator` between them.
 */
export function Menu({ trigger, align = 'start', 'aria-label': ariaLabel, defaultOpen = false, className, menuClassName, children }) {
  const [open, setOpen] = useState(defaultOpen)
  const wrapperRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const focusOnOpen = useRef(null)
  const triggerId = useId()
  const menuId = useId()

  const items = () => [...(menuRef.current?.querySelectorAll(ITEMS) ?? [])]
  const focusEdge = (edge) => {
    const list = items()
    ;(edge === 'last' ? list[list.length - 1] : list[0])?.focus()
  }

  const openAt = (edge) => {
    if (open) return focusEdge(edge)
    focusOnOpen.current = edge
    setOpen(true)
  }

  const close = (returnFocus) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }

  useLayoutEffect(() => {
    if (!open || !focusOnOpen.current) return
    focusEdge(focusOnOpen.current)
    focusOnOpen.current = null
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const handleMenuKeyDown = (event) => {
    const list = items()
    const index = list.indexOf(document.activeElement)
    const move = {
      ArrowDown: () => list[(index + 1) % list.length],
      ArrowUp: () => list[index <= 0 ? list.length - 1 : index - 1],
      Home: () => list[0],
      End: () => list[list.length - 1],
    }[event.key]
    if (move) {
      event.preventDefault()
      move()?.focus()
    } else if (event.key === 'Escape') {
      // Handled here, so a dialog around the menu doesn't close too.
      event.preventDefault()
      event.stopPropagation()
      close(true)
    } else if (event.key === 'Tab') {
      // Focus goes back to the trigger first, so Tab carries on from there.
      close(true)
    }
  }

  const triggerProps = {
    ref: triggerRef,
    id: triggerId,
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
    onClick: () => (open ? close(false) : openAt('first')),
    onKeyDown: (event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      event.preventDefault()
      openAt(event.key === 'ArrowUp' ? 'last' : 'first')
    },
  }

  return (
    <div ref={wrapperRef} className={cx('relative inline-flex', className)}>
      {trigger(triggerProps)}
      {open && (
        <MenuContext.Provider value={close}>
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabel ? undefined : triggerId}
            onKeyDown={handleMenuKeyDown}
            className={cx(
              'absolute top-full z-40 mt-1.5 min-w-[180px] flex flex-col gap-0.5 p-1.5 bg-surface border border-ink/12 rounded-card shadow-dropdown motion-safe:animate-fade-in',
              align === 'end' ? 'right-0' : 'left-0',
              menuClassName
            )}
          >
            {children}
          </div>
        </MenuContext.Provider>
      )}
    </div>
  )
}

/**
 * One action in a Menu. Picking it closes the menu, returns focus to the trigger, then calls `onSelect`.
 *
 * @param {object} props
 * @param {() => void} [props.onSelect]
 * @param {import('react').ComponentType<{ size?: number, className?: string }>} [props.icon] An icon from
 *   icons.jsx, before the text.
 * @param {'default' | 'danger'} [props.tone='default'] danger is red, for Delete.
 * @param {boolean} [props.checked] Makes it a radio item (one of several, like the active vehicle), with a check
 *   when true.
 * @param {boolean} [props.disabled]
 * @param {import('react').ReactNode} props.children The label, or richer content such as a vehicle's name
 *   and details.
 */
export function MenuItem({ onSelect, icon: Icon, tone = 'default', checked, disabled, children }) {
  const close = useContext(MenuContext)
  const radio = checked != null
  return (
    <button
      type="button"
      role={radio ? 'menuitemradio' : 'menuitem'}
      aria-checked={radio ? checked : undefined}
      tabIndex={-1}
      disabled={disabled}
      onClick={() => {
        close(true)
        onSelect?.()
      }}
      className={cx(
        'flex w-full items-center gap-2.5 px-3 py-2 rounded-control text-left text-sm transition-colors focus:outline-none',
        'disabled:opacity-40 disabled:cursor-default aria-checked:bg-ink/6',
        ITEM_TONES[tone]
      )}
    >
      {Icon && <Icon size={16} className="flex-none" />}
      {children}
      {checked && <CheckIcon size={14} className="flex-none ml-auto text-accent" />}
    </button>
  )
}

/**
 * A small heading above a group of items, e.g. "Your garage". Not focusable.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 */
export function MenuLabel({ children }) {
  return (
    <div role="presentation" className="px-3 pt-1.5 pb-1 text-xs font-mono font-semibold tracking-widest uppercase text-ink/40">
      {children}
    </div>
  )
}

/** A hairline between groups of items. */
export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-ink/8" />
}
