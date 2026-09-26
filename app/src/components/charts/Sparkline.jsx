import { linearScale } from '../../lib/chartScale'
import { cx } from '../ui/cx'
import { areaPath, linePath } from './paths'
import { FILL, STROKE, WASH } from './tones'
import { useElementWidth } from './useElementWidth'

const DOT_RADIUS = 3

/**
 * A small trend line for a stat tile: no axes, scaled to its own min and max, with an optional dot
 * on the latest value. With no values it draws a faint baseline; with one, the baseline and a dot.
 *
 * Decorative (`aria-hidden`) unless `ariaLabel` is given, since the tile next to it usually carries
 * the number.
 *
 * @param {object} props
 * @param {number[]} props.values Oldest first.
 * @param {number} [props.width] In px. Omit to fill the container's width and follow its resizes.
 * @param {number} [props.height=28] In px.
 * @param {import('./tones').ChartTone} [props.tone='accent']
 * @param {boolean} [props.showLast=true] Dot on the last value.
 * @param {boolean} [props.area=true] A 10% wash of the tone under the line.
 * @param {string} [props.ariaLabel] Makes it `role="img"` with this name, e.g. "MPG, last 10 tanks,
 *   rising".
 * @param {string} [props.className] Layout only.
 */
export function Sparkline({ values = [], width, height = 28, tone = 'accent', showLast = true, area = true, ariaLabel, className }) {
  const [measureRef, measuredWidth] = useElementWidth()
  const w = width ?? measuredWidth
  const a11y = ariaLabel ? { role: 'img', 'aria-label': ariaLabel } : { 'aria-hidden': true }

  const data = values.filter(Number.isFinite)
  const pad = showLast ? DOT_RADIUS + 1.5 : 2
  const x = linearScale([0, Math.max(1, data.length - 1)], [pad, w - pad])
  const y = linearScale([Math.min(...data), Math.max(...data)], [height - pad, pad])
  const points = data.map((value, i) => [data.length === 1 ? w - pad : x(i), y(value)])
  const last = points[points.length - 1]

  const drawing = w > 0 && (
    <>
      {points.length < 2 && (
        <line x1={0} x2={w} y1={height / 2} y2={height / 2} className="stroke-ink/10" strokeWidth={1} />
      )}
      {points.length > 1 && area && <path d={areaPath(points, height)} className={WASH[tone]} />}
      {points.length > 1 && (
        <path d={linePath(points)} fill="none" className={STROKE[tone]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      )}
      {showLast && last && (
        <circle cx={last[0]} cy={last[1]} r={DOT_RADIUS} className={cx(FILL[tone], 'stroke-surface')} strokeWidth={1.5} />
      )}
    </>
  )

  if (width != null) {
    return (
      <svg width={w} height={height} className={cx('block overflow-visible', className)} {...a11y}>
        {drawing}
      </svg>
    )
  }
  return (
    <div ref={measureRef} className={cx('relative w-full', className)} style={{ height }} {...a11y}>
      {drawing && (
        <svg width={w} height={height} className="absolute inset-0 block overflow-visible">
          {drawing}
        </svg>
      )}
    </div>
  )
}
