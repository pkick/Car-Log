import { bandScale, formatTick, linearScale, niceScale, thinIndices } from '../../lib/chartScale'
import { cx } from '../ui/cx'
import { ChartEmpty, ChartFrame, ChartTooltip, LegendItem } from './ChartFrame'
import { barPath } from './paths'
import { AXIS_FONT, BG, FILL, formatNumber, textWidth } from './tones'
import { useActiveIndex } from './useActiveIndex'
import { useElementWidth } from './useElementWidth'

const PAD_TOP = 8
const VALUE_ROW = 16
const X_AXIS = 22
const MAX_BAR = 24
const GAP = 2
const RADIUS = 4

/**
 * @typedef {object} BarDatum
 * @property {string} key Stable id, e.g. "2026-08".
 * @property {string} label x label and tooltip title, e.g. "AUG".
 * @property {Record<string, number>} values Amount per series key; missing counts as 0.
 */

/**
 * @typedef {object} BarSeries
 * @property {string} key
 * @property {string} label e.g. "Fuel".
 * @property {import('./tones').ChartTone} tone
 */

/**
 * Bars on a y axis that starts at zero: one series, several side by side, or stacked. Bars are at
 * most 24px wide with 4px rounded data ends, and touching bars or segments keep a 2px gap. Hovering
 * a column, or Left / Right from keyboard focus, shows every series' value in a tooltip.
 *
 * @param {object} props
 * @param {BarDatum[]} props.data In x order.
 * @param {BarSeries[]} props.series Drawn and listed in this order (bottom to top when stacked).
 * @param {string} props.ariaLabel Accessible name, e.g. "Monthly spend, last 12 months".
 * @param {string} [props.summary] Visually hidden description.
 * @param {boolean} [props.stacked=false] Stack the series in one bar per column.
 * @param {number} [props.height=200] In px, x labels included.
 * @param {boolean} [props.showValues=false] Value above each bar (the total when stacked), where
 *   it fits.
 * @param {(value: number) => string} [props.formatValue] Tooltip and value labels.
 * @param {(value: number, step: number) => string} [props.formatYTick] Axis labels; defaults to
 *   formatTick from lib/chartScale.
 * @param {number} [props.maxTicks=5]
 * @param {boolean} [props.legend] Defaults to true for two or more series.
 * @param {import('react').ReactNode} [props.emptyLabel='No data yet'] Shown when no bar has a value.
 * @param {string} [props.className] Layout only.
 */
export function BarChart({
  data,
  series,
  ariaLabel,
  summary,
  stacked = false,
  height = 200,
  showValues = false,
  formatValue = formatNumber,
  formatYTick = formatTick,
  maxTicks = 5,
  legend = series.length > 1,
  emptyLabel = 'No data yet',
  className,
}) {
  const [measureRef, width] = useElementWidth()
  const nav = useActiveIndex(data.length)

  const valueOf = (datum, key) => (Number.isFinite(datum.values?.[key]) ? datum.values[key] : 0)
  const isEmpty = !data.some((datum) => series.some((s) => valueOf(datum, s.key) !== 0))
  if (isEmpty) return <ChartEmpty height={height} className={className}>{emptyLabel}</ChartEmpty>

  const totals = data.map((datum) => series.reduce((sum, s) => sum + valueOf(datum, s.key), 0))
  const extents = data.flatMap((datum) => {
    if (!stacked) return series.map((s) => valueOf(datum, s.key))
    const values = series.map((s) => valueOf(datum, s.key))
    return [values.filter((v) => v > 0).reduce((a, b) => a + b, 0), values.filter((v) => v < 0).reduce((a, b) => a + b, 0)]
  })
  const scale = niceScale(Math.min(...extents), Math.max(...extents), maxTicks, { includeZero: true })
  const tickLabels = scale.ticks.map((tick) => formatYTick(tick, scale.step))
  const left = Math.ceil(Math.max(...tickLabels.map(textWidth))) + 8
  const right = width - 4
  const top = PAD_TOP + (showValues ? VALUE_ROW : 0)
  const bottom = height - X_AXIS
  const y = linearScale([scale.min, scale.max], [bottom, top])
  const band = bandScale(data.length, [left, right], 0.3)
  const grouped = !stacked && series.length > 1
  const barWidth = Math.max(
    1,
    grouped ? Math.min(MAX_BAR, (band.bandwidth - GAP * (series.length - 1)) / series.length) : Math.min(MAX_BAR, band.bandwidth),
  )

  const columns = data.map((datum, i) => {
    const bars = []
    if (stacked) {
      const x = band.center(i) - barWidth / 2
      for (const sign of [1, -1]) {
        const segments = series.filter((s) => Math.sign(valueOf(datum, s.key)) === sign)
        let sum = 0
        segments.forEach((s, j) => {
          const value = valueOf(datum, s.key)
          const base = y(sum) - (j > 0 ? sign * GAP : 0)
          sum += value
          const end = y(sum)
          if ((base - end) * sign > 0.5) bars.push({ key: s.key, tone: s.tone, x, base, end, round: j === segments.length - 1 })
        })
      }
    } else {
      const groupWidth = series.length * barWidth + (series.length - 1) * GAP
      series.forEach((s, j) => {
        const value = valueOf(datum, s.key)
        if (value === 0) return
        const x = band.center(i) - groupWidth / 2 + j * (barWidth + GAP)
        bars.push({ key: s.key, tone: s.tone, x, base: y(0), end: y(value), round: true, value })
      })
    }
    const peak = Math.min(y(0), ...bars.map((bar) => Math.min(bar.base, bar.end)))
    return { datum, bars, peak, total: totals[i] }
  })

  const active = nav.active
  const activeColumn = active != null ? columns[active] : null
  const slotX = (i) => band.x(i) - (band.step - band.bandwidth) / 2

  const drawing = width > 0 && (
    <svg width={width} height={height} className="absolute inset-0 block" aria-hidden="true">
      {scale.ticks.map((tick, i) => (
        <g key={tick}>
          <line
            x1={left}
            x2={right}
            y1={y(tick)}
            y2={y(tick)}
            className={tick === 0 ? 'stroke-ink/25' : 'stroke-ink/10'}
            strokeWidth={1}
          />
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

      {activeColumn && <rect x={slotX(active)} y={top} width={band.step} height={bottom - top} rx={4} className="fill-ink/4" />}

      {columns.map(({ datum, bars }) =>
        bars.map((bar) => (
          <path
            key={`${datum.key}-${bar.key}`}
            d={barPath(bar.x, bar.base, bar.end, barWidth, bar.round ? RADIUS : 0)}
            className={FILL[bar.tone]}
          />
        )),
      )}

      {showValues && <ValueLabels columns={columns} stacked={stacked || series.length === 1} barWidth={barWidth} band={band} formatValue={formatValue} />}

      <XLabels data={data} band={band} y={height - 6} width={width} />
    </svg>
  )

  const legendItems =
    legend &&
    series.map((s) => (
      <LegendItem key={s.key} swatch={<span className={cx('w-2.5 h-2.5 rounded-2', BG[s.tone])} />}>
        {s.label}
      </LegendItem>
    ))

  const describe = (column) => {
    const parts = series.map((s) => `${s.label} ${formatValue(valueOf(column.datum, s.key))}`)
    if (stacked && series.length > 1) parts.push(`total ${formatValue(column.total)}`)
    return `${column.datum.label}: ${parts.join(', ')}.`
  }

  return (
    <ChartFrame
      measureRef={measureRef}
      height={height}
      ariaLabel={ariaLabel}
      summary={summary}
      legend={legendItems}
      announcement={activeColumn ? describe(activeColumn) : ''}
      onKeyDown={nav.onKeyDown}
      onPoint={(px) => {
        const i = band.indexAt(px)
        if (i === -1) nav.clear()
        else nav.setActive(i)
      }}
      onClear={nav.clear}
      className={className}
      tooltip={
        activeColumn &&
        width > 0 && (
          <ChartTooltip x={band.center(active)} y={activeColumn.peak} width={width} height={height} sideOffset={band.step / 2}>
            <p className="font-mono text-xs text-ink/50 mb-1">{activeColumn.datum.label}</p>
            <div className="grid grid-cols-[auto_auto_auto] items-center gap-x-2 gap-y-0.5">
              {series.map((s) => (
                <div key={s.key} className="contents">
                  <span className={cx('w-2.5 h-0.5 rounded-full', BG[s.tone])} />
                  <span className="font-mono text-sm font-semibold tabular-nums text-ink text-right">
                    {formatValue(valueOf(activeColumn.datum, s.key))}
                  </span>
                  <span className="font-mono text-xs text-ink/50">{s.label}</span>
                </div>
              ))}
              {stacked && series.length > 1 && (
                <div className="contents">
                  <span />
                  <span className="font-mono text-sm font-semibold tabular-nums text-ink text-right border-t border-ink/10 pt-0.5">
                    {formatValue(activeColumn.total)}
                  </span>
                  <span className="font-mono text-xs text-ink/50 border-t border-ink/10 pt-0.5">Total</span>
                </div>
              )}
            </div>
          </ChartTooltip>
        )
      }
    >
      {drawing}
    </ChartFrame>
  )
}

/**
 * Values at the bar tips (or the stack total), skipped where the text would be wider than its slot.
 * @param {object} props
 * @param {Array<{ bars: Array<{ x: number, end: number, value?: number }>, peak: number, total: number }>} props.columns
 * @param {boolean} props.stacked One label per column (stacked, or a single series).
 * @param {number} props.barWidth
 * @param {import('../../lib/chartScale').BandScale} props.band
 * @param {(value: number) => string} props.formatValue
 */
function ValueLabels({ columns, stacked, barWidth, band, formatValue }) {
  return columns.flatMap((column, i) => {
    if (stacked) {
      const text = formatValue(column.total)
      if (column.bars.length === 0 || textWidth(text) > band.step - 4) return []
      const below = column.total < 0
      return [
        <text
          key={i}
          x={band.center(i)}
          y={below ? Math.max(...column.bars.map((bar) => bar.end)) + 12 : column.peak - 4}
          textAnchor="middle"
          className="fill-ink/60 font-mono tabular-nums"
          style={{ fontSize: AXIS_FONT }}
        >
          {text}
        </text>,
      ]
    }
    return column.bars.flatMap((bar) => {
      const text = formatValue(bar.value)
      if (textWidth(text) > barWidth + GAP) return []
      return [
        <text
          key={`${i}-${bar.x}`}
          x={bar.x + barWidth / 2}
          y={bar.value < 0 ? bar.end + 12 : bar.end - 4}
          textAnchor="middle"
          className="fill-ink/60 font-mono tabular-nums"
          style={{ fontSize: AXIS_FONT }}
        >
          {text}
        </text>,
      ]
    })
  })
}

/**
 * Column labels, thinned to every n-th (always keeping the last) when they don't all fit.
 * @param {object} props
 * @param {BarDatum[]} props.data
 * @param {import('../../lib/chartScale').BandScale} props.band
 * @param {number} props.y Baseline of the labels.
 * @param {number} props.width Chart width, to keep the end labels inside it.
 */
function XLabels({ data, band, y, width }) {
  const widest = Math.max(...data.map((datum) => textWidth(datum.label)))
  const perLabel = Math.max(1, Math.ceil((widest + 8) / band.step))
  return thinIndices(data.length, Math.ceil(data.length / perLabel)).map((i) => {
    const half = textWidth(data[i].label) / 2
    return (
      <text
        key={data[i].key}
        x={Math.min(Math.max(band.center(i), half), width - half)}
        y={y}
        textAnchor="middle"
        className="fill-ink/45 font-mono"
        style={{ fontSize: AXIS_FONT }}
      >
        {data[i].label}
      </text>
    )
  })
}
