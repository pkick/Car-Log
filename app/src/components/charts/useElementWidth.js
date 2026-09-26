import { useLayoutEffect, useState } from 'react'

/**
 * Measures an element's width and re-measures whenever it resizes, so a chart can draw at its
 * container's real size instead of stretching a viewBox (which would distort the text).
 *
 * Attach the returned callback ref to a block whose width comes from its container. Keep the SVG
 * out of the block's intrinsic size (absolutely positioned) so a wide old drawing can't hold the
 * container open when it shrinks.
 *
 * @returns {[(node: Element | null) => void, number]} The ref, and the width in whole pixels (0
 *   until measured).
 */
export function useElementWidth() {
  const [node, setNode] = useState(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    if (!node) return undefined
    const measure = (w) => setWidth(Math.max(0, Math.floor(w)))
    measure(node.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(([entry]) => measure(entry.contentRect.width))
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])

  return [setNode, width]
}
