import { formatDateTick, formatTick, linearScale, niceScale, thinIndices, toXValues } from '../../lib/chartScale'
import { cx } from '../ui/cx'
import { ChartEmpty, ChartFrame, ChartTooltip, LegendItem } from './ChartFrame'
import { areaPath, linePath } from './paths'
import { AXIS_FONT, BG, BORDER, FILL, STROKE, WASH, formatNumber, textWidth } from './tones'
import { useActiveIndex } from './useActiveIndex'
import { useElementWidth } from './useElementWidth'

const PAD_TOP = 8
const X_AXIS = 22
const INSET = 10
const MARKER = 4
/** Below this spacing between points, only hollow, last and active markers are drawn. */
const MIN_MARKER_SPACING = 14

/**
 * @typedef {object} LinePoint
 * @property {string | number} [x] `YYYY-MM-DD` (placed by date, so gaps show) or a number. Omit
 *   on every point to space them evenly.
 * @property {number} y
 * @property {boolean} [hollow] Drawn as a ring, e.g. a partial fill-up.
 * @property {string} [label] Tooltip title, e.g. "Aug 28 · Costco". Defaults to the x label.
 */

const defaultFormatX = (point, index) =>
  typeof point.x === 'string' ? formatDateTick(point.x) : String(point.x ?? index + 1)

/**
 * A single series over time on a y axis with round ticks that doesn't start at zero, so 31.1 and
 * 31.6 mpg look different. Optional dashed average line, hollow markers for partial fills, and a
 * tooltip on hover or on Left / Right from keyboard focus (Esc clears).
 *
 * @param {object} props
 * @param {LinePoint[]} props.points In x order.
 * @param {string} props.ariaLabel Accessible name, e.g. "Fuel economy, last 10 full tanks".
 * @param {string} [props.summary] Visually hidden description of the trend.
 * @param {number} [props.height=180] In px, x labels included.
 * @param {import('./tones').ChartTone} [props.tone='accent']
 * @param {number} [props.average] Draws a dashed line with a label.
 * @param {string} [props.averageLabel] Defaults to "avg " plus the formatted average.
 * @param {import('../../lib/chartScale').NiceScale} [props.yScale] Fixed axis, e.g. to line up two
 *   charts. Defaults to niceScale over the points and the average.
 * @param {boolean} [props.includeZero=false] Stretch the computed axis to 0.
 * @param {number} [props.maxTicks=5]
 * @param {boolean} [props.xLabels=true] Date or index labels under the plot, thinned to fit.
 * @param {(point: LinePoint, index: number) => string} [props.formatX] x label; "AUG 28" for dates.
 * @param {(value: number) => string} [props.formatValue] Tooltip and average values, e.g.
 *   `(v) => `${v.toFixed(1)} mpg``.
 * @param {(value: number, step: number) => string} [props.formatYTick] Axis labels; defaults to
 *   formatTick from lib/chartScale.
 * @param {boolean} [props.area=false] A 10% wash under the line.
 * @param {string} [props.seriesLabel] Adds the line to the legend, e.g. "mpg".
 * @param {string} [props.hollowLabel='Partial fill'] Legend and tooltip text for hollow markers.
 * @param {boolean} [props.legend=true] Legend row above the chart keying `seriesLabel` and hollow
 *   markers, when there are any.
 * @param {import('react').ReactNode} [props.emptyLabel='No data yet']
 * @param {string} [props.className] Layout only.
 */
export function LineChart({
  points: rawPoints,
  ariaLabel,
  summary,
  height = 180,
  tone = 'accent',
  average,
  averageLabel,
  yScale,
  includeZero = false,
  maxTicks = 5,
  xLabels = true,
  formatX = defaultFormatX,
  formatValue = formatNumber,
  formatYTick = formatTick,
  area = false,
  seriesLabel,
  hollowLabel = 'Partial fill',
  legend = true,
  emptyLabel = 'No data yet',
  className,
}) {
  const points = rawPoints.filter((point) => Number.isFinite(point.y))
  const [measureRef, width] = useElementWidth()
  const nav = useActiveIndex(points.length)

  if (points.length === 0) return <ChartEmpty height={height} className={className}>{emptyLabel}</ChartEmpty>

  const hasAverage = Number.isFinite(average)
  const ys = points.map((point) => point.y).concat(hasAverage ? [average] : [])
  const scale = yScale ?? niceScale(Math.min(...ys), Math.max(...ys), maxTicks, { includeZero })
  const tickLabels = scale.ticks.map((tick) => formatYTick(tick, scale.step))
  const left = Math.ceil(Math.max(...tickLabels.map(textWidth))) + 8
  const right = width - 4
  const top = PAD_TOP
  const bottom = height - (xLabels ? X_AXIS : PAD_TOP)

  const xValues = toXValues(points.map((point) => point.x))
  const x = linearScale([Math.min(...xValues), Math.max(...xValues)], [left + INSET, right - INSET])
  const y = linearScale([scale.min, scale.max], [bottom, top])
  const coords = points.map((point, i) => [x(xValues[i]), y(point.y)])

  const active = nav.active
  const activePoint = active != null ? points[active] : null
  const titleOf = (i) => points[i].label ?? formatX(points[i], i)
  const hasHollow = points.some((point) => point.hollow)
  const showAllMarkers = (right - left - 2 * INSET) / Math.max(1, points.length - 1) >= MIN_MARKER_SPACING

  const nearest = (px) => {
    let best = 0
    coords.forEach(([pointX], i) => {
      if (Math.abs(pointX - px) < Math.abs(coords[best][0] - px)) best = i
    })
    return best
  }

  const drawing = width > 0 && (
    <svg width={width} height={height} className="absolute inset-0 block" aria-hidden="true">
      {scale.ticks.map((tick, i) => (
        <g key={tick}>
          <line x1={left} x2={right} y1={y(tick)} y2={y(tick)} className="stroke-ink/10" strokeWidth={1} />
          <text
            x={left - 8}
            y={y(tick)}
            dy="0.32em"
            textAnchor="end"
            className="fill-ink/45 font-mono tabular-nums"
            style={{ fontSize: AXIS_FONT }}
          >
            {tickLabels[i]}
          </text>
        </g>
      ))}

      {xLabels && <XLabels points={points} coords={coords} formatX={formatX} y={height - 6} width={width} />}

      {area && coords.length > 1 && <path d={areaPath(coords, bottom)} className={WASH[tone]} />}

      {hasAverage && <line x1={left} x2={right} y1={y(average)} y2={y(average)} className="stroke-ink/45" strokeWidth={1} strokeDasharray="4 3" />}

      {activePoint && (
        <line x1={coords[active][0]} x2={coords[active][0]} y1={top} y2={bottom} className="stroke-ink/20" strokeWidth={1} />
      )}

      {coords.length > 1 && (
        <path d={linePath(coords)} fill="none" className={STROKE[tone]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      )}

      {points.map((point, i) => {
        const isActive = i === active
        if (!showAllMarkers && !point.hollow && !isActive && i !== points.length - 1) return null
        const r = MARKER + (isActive ? 1.5 : 0)
        return (
          <circle
            key={i}
            cx={coords[i][0]}
            cy={coords[i][1]}
            r={point.hollow ? r - 0.5 : r}
            strokeWidth={2}
            className={point.hollow ? cx('fill-surface', STROKE[tone]) : cx(FILL[tone], 'stroke-surface')}
          />
        )
      })}

      {hasAverage && (
        <AverageLabel
          text={averageLabel ?? `avg ${formatValue(average)}`}
          y={y(average)}
          left={left}
          right={right}
          top={top}
          bottom={bottom}
          firstY={coords[0][1]}
          lastY={coords[coords.length - 1][1]}
        />
      )}
    </svg>
  )

  // The average is labeled on its line, so the legend only keys the series and hollow markers.
  const legendItems = legend && (seriesLabel || hasHollow) && (
    <>
      {seriesLabel && (
        <LegendItem swatch={<span className={cx('w-3.5 h-0.5 rounded-full', BG[tone])} />}>{seriesLabel}</LegendItem>
      )}
      {hasHollow && (
        <LegendItem swatch={<span className={cx('w-2.5 h-2.5 rounded-full border-2 bg-surface', BORDER[tone])} />}>
          {hollowLabel}
        </LegendItem>
      )}
    </>
  )

  return (
    <ChartFrame
      measureRef={measureRef}
      height={height}
      ariaLabel={ariaLabel}
      summary={summary}
      legend={legendItems}
      announcement={
        activePoint
          ? `${titleOf(active)}: ${formatValue(activePoint.y)}${activePoint.hollow ? `, ${hollowLabel}` : ''}. ${active + 1} of ${points.length}.`
          : ''
      }
      onKeyDown={nav.onKeyDown}
      onPoint={(px) => nav.setActive(nearest(px))}
      onClear={nav.clear}
      className={className}
      tooltip={
        activePoint &&
        width > 0 && (
          <ChartTooltip x={coords[active][0]} y={coords[active][1]} width={width} height={height}>
            <p className="font-mono text-sm font-semibold tabular-nums text-ink">{formatValue(activePoint.y)}</p>
            <p className="font-mono text-xs text-ink/50">
              {titleOf(active)}
              {activePoint.hollow && ` · ${hollowLabel}`}
            </p>
          </ChartTooltip>
        )
      }
    >
      {drawing}
    </ChartFrame>
  )
}

/**
 * Date or index labels along the bottom, thinned so they never overlap.
 * @param {object} props
 * @param {LinePoint[]} props.points
 * @param {Array<[number, number]>} props.coords
 * @param {(point: LinePoint, index: number) => string} props.formatX
 * @param {number} props.y Baseline of the labels.
 * @param {number} props.width Chart width, to keep the end labels inside it.
 */
function XLabels({ points, coords, formatX, y, width }) {
  const labels = points.map((point, i) => formatX(point, i))
  const widest = Math.max(...labels.map(textWidth))
  const plotWidth = coords[coords.length - 1][0] - coords[0][0]
  const candidates = thinIndices(points.length, Math.floor(plotWidth / (widest + 16)) + 1)

  // Dates can bunch up (two fill-ups in a week), so also drop any label that would touch the one
  // after it, keeping the most recent.
  const kept = []
  let limit = Infinity
  for (let k = candidates.length - 1; k >= 0; k--) {
    const i = candidates[k]
    const half = textWidth(labels[i]) / 2
    const center = Math.min(Math.max(coords[i][0], half), width - half)
    if (center + half + 8 > limit) continue
    kept.push({ i, center })
    limit = center - half
  }

  return kept.map(({ i, center }) => (
    <text key={i} x={center} y={y} textAnchor="middle" className="fill-ink/45 font-mono" style={{ fontSize: AXIS_FONT }}>
      {labels[i]}
    </text>
  ))
}

/**
 * The average line's label, at whichever end of the plot the line is farther from, on the side of
 * the line away from that end's point. A surface-colored halo keeps it readable over the data.
 * @param {object} props
 * @param {string} props.text
 * @param {number} props.y The average line's pixel y.
 * @param {number} props.left
 * @param {number} props.right
 * @param {number} props.top
 * @param {number} props.bottom
 * @param {number} props.firstY Pixel y of the first point.
 * @param {number} props.lastY Pixel y of the last point.
 */
function AverageLabel({ text, y, left, right, top, bottom, firstY, lastY }) {
  const atRight = Math.abs(lastY - y) >= Math.abs(firstY - y)
  const pointY = atRight ? lastY : firstY
  const above = pointY >= y
  const baseline = Math.min(Math.max(above ? y - 5 : y + 12, top + 9), bottom - 3)
  return (
    <text
      x={atRight ? right - 2 : left + 4}
      y={baseline}
      textAnchor={atRight ? 'end' : 'start'}
      paintOrder="stroke"
      strokeWidth={3}
      strokeLinejoin="round"
      className="fill-ink/60 stroke-surface font-mono"
      style={{ fontSize: AXIS_FONT }}
    >
      {text}
    </text>
  )
}
