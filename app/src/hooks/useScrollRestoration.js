import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router'

/**
 * Scroll restoration for a scroll container other than the window. A new navigation starts at the top; Back
 * and Forward return each history entry to where it was left.
 *
 * @param {import('react').RefObject<HTMLElement | null>} ref The scrolling element.
 */
export function useScrollRestoration(ref) {
  const { key } = useLocation()
  const navigationType = useNavigationType()
  const positions = useRef(new Map())

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.scrollTop = navigationType === 'POP' ? positions.current.get(key) ?? 0 : 0
    // Saved while scrolling: by the time the location changes, the next page is already in the DOM.
    const save = () => positions.current.set(key, el.scrollTop)
    el.addEventListener('scroll', save, { passive: true })
    return () => el.removeEventListener('scroll', save)
  }, [ref, key, navigationType])
}
