import { useState } from 'react'

/**
 * Which point or bar a chart is showing a tooltip for, with the keyboard model shared by every
 * chart: Left and Right step through the items (from nothing, Right starts at the first and Left at
 * the last), Home and End jump to the ends, and Esc clears.
 *
 * @param {number} count Number of items.
 * @returns {{
 *   active: number | null,
 *   setActive: (index: number | null) => void,
 *   clear: () => void,
 *   onKeyDown: (event: import('react').KeyboardEvent) => void,
 * }}
 */
export function useActiveIndex(count) {
  const [index, setActive] = useState(null)
  const active = index != null && index < count ? index : null

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      if (active == null) return
      // Stop here so the first Esc only closes the tooltip, not a dialog around the chart.
      event.preventDefault()
      event.stopPropagation()
      setActive(null)
      return
    }
    if (count === 0) return
    const next = {
      ArrowRight: active == null ? 0 : Math.min(count - 1, active + 1),
      ArrowLeft: active == null ? count - 1 : Math.max(0, active - 1),
      Home: 0,
      End: count - 1,
    }[event.key]
    if (next == null) return
    event.preventDefault()
    setActive(next)
  }

  return { active, setActive, clear: () => setActive(null), onKeyDown }
}
