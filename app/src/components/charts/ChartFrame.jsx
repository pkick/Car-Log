import { useId, useLayoutEffect, useRef } from 'react'
import { cx, FOCUS_RING } from '../ui/cx'

const TOOLTIP_GAP = 10

/**
 * Small card that follows the active point, kept inside the chart: centered above the anchor when
 * it fits; otherwise beside it (right, then left), clear of `sideOffset`; otherwise below. Hidden
 * from assistive tech; the frame's live region reads the same values.
 *
 * @param {object} props
 * @param {number} props.x Anchor, in px from the chart's left edge.
 * @param {number} props.y Anchor, in px from the chart's top edge.
 * @param {number} props.width Chart width in px.
 * @param {number} props.height Chart height in px.
 * @param {number} [props.sideOffset=6] Half the width of the mark at the anchor, so a tooltip
 *   placed beside it doesn't cover it (half a column for bars).
 * @param {import('react').ReactNode} props.children
 */
export function ChartTooltip({ x, y, width, height, sideOffset = 6, children }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const tip = ref.current
    if (!tip) return
    const w = tip.offsetWidth
    const h = tip.offsetHeight
    const clampTop = (top) => Math.max(0, Math.min(top, height - h))
    let left = Math.max(0, Math.min(x - w / 2, width - w))
    let top = y - TOOLTIP_GAP - h
    if (top < 0) {
      const right = x + sideOffset + TOOLTIP_GAP
      const leftSide = x - sideOffset - TOOLTIP_GAP - w
      if (right + w <= width) [left, top] = [right, clampTop(y - h / 2)]
      else if (leftSide >= 0) [left, top] = [leftSide, clampTop(y - h / 2)]
      else top = clampTop(y + TOOLTIP_GAP)
    }
    tip.style.left = `${Math.round(left)}px`
    tip.style.top = `${Math.round(top)}px`
  })

  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-chart-tooltip=""
      className="pointer-events-none absolute left-0 top-0 z-10 rounded-control border border-ink/10 bg-surface px-2.5 py-1.5 shadow-dropdown whitespace-nowrap"
    >
      {children}
    </div>
  )
}

/**
 * The line shown in place of a chart with nothing to plot.
 *
 * @param {object} props
 * @param {number} props.height Same height the chart would have, so the card doesn't jump.
 * @param {import('react').ReactNode} props.children
 * @param {string} [props.className] Layout only.
 */
export function ChartEmpty({ height, className, children }) {
  return (
    <div className={cx('flex items-center justify-center text-sm text-ink/45', className)} style={{ height }}>
      {children}
    </div>
  )
}

/**
 * One legend entry: a key that mirrors the mark, then its label.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.swatch
 * @param {import('react').ReactNode} props.children
 */
export function LegendItem({ swatch, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono text-ink/60">
      {swatch}
      {children}
    </span>
  )
}

/**
 * Shared shell for LineChart and BarChart: legend row, a measured box of fixed height holding the
 * focusable `role="img"` drawing, the tooltip, an optional visually hidden summary and a live
 * region that reads the active point.
 *
 * @param {object} props
 * @param {(node: Element | null) => void} props.measureRef From useElementWidth.
 * @param {number} props.height
 * @param {string} props.ariaLabel
 * @param {string} [props.summary] Visually hidden description, linked with aria-describedby.
 * @param {string} [props.announcement] Read politely when it changes (the active point).
 * @param {import('react').ReactNode} [props.legend] Legend entries, shown above the chart.
 * @param {import('react').ReactNode} [props.tooltip]
 * @param {(event: import('react').KeyboardEvent) => void} props.onKeyDown
 * @param {(x: number, y: number) => void} props.onPoint Pointer moved or touched at chart px.
 * @param {() => void} props.onClear Pointer left or focus moved away.
 * @param {string} [props.className] Layout only.
 * @param {import('react').ReactNode} props.children The SVG.
 */
export function ChartFrame({
  measureRef,
  height,
  ariaLabel,
  summary,
  announcement,
  legend,
  tooltip,
  onKeyDown,
  onPoint,
  onClear,
  className,
  children,
}) {
  const summaryId = useId()

  const handlePointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    onPoint(event.clientX - rect.left, event.clientY - rect.top)
  }

  return (
    <div className={cx('flex flex-col gap-3 min-w-0', className)}>
      {legend && <div className="flex flex-wrap items-center gap-x-4 gap-y-1">{legend}</div>}
      <div ref={measureRef} className="relative w-full" style={{ height }}>
        <div
          role="img"
          aria-label={ariaLabel}
          aria-describedby={summary ? summaryId : undefined}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={onClear}
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={(event) => {
            // A touch lifts before it leaves; keep that tooltip until the next tap or blur.
            if (event.pointerType === 'mouse') onClear()
          }}
          className={cx('absolute inset-0 rounded-control touch-pan-y', FOCUS_RING)}
        >
          {children}
        </div>
        {tooltip}
      </div>
      {summary && (
        <p id={summaryId} className="sr-only">
          {summary}
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  )
}
