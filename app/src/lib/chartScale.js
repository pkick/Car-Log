// Scales and tick helpers for the hand-rolled SVG charts in components/charts (PLAN.md D11).
// Everything here is pure: numbers and strings in, numbers and strings out.

import { daysBetween, parseISODate } from './dates'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Relative tolerance for float noise, e.g. 0.1 * 3 landing on 0.30000000000000004. */
const EPSILON = 1e-9

/**
 * The next nice step up: 1 → 2 → 5 → 10 (times a power of ten).
 * @param {number} step A nice number.
 * @returns {number}
 */
const stepUp = (step) => niceNumber(step * 1.5, true)

/**
 * Rounds to the decimals `step` needs and turns -0 into 0.
 * @param {number} value
 * @param {number} step
 * @returns {number}
 */
const snap = (value, step) => Number(value.toFixed(tickDecimals(step))) || 0

/**
 * Heckbert's "nice number" (Graphics Gems, 1990): the closest of 1, 2, 5 or 10 times a power of ten.
 * @param {number} x Positive; `0`, negative or non-finite input returns `0`.
 * @param {boolean} round `true` picks the nearest nice number (for a tick step), `false` the smallest
 *   one that is at least `x` (for a range that must cover the data).
 * @returns {number}
 */
export function niceNumber(x, round) {
  if (!(x > 0) || !Number.isFinite(x)) return 0
  const exponent = Math.floor(Math.log10(x))
  // 0.3 / 0.1 is 2.9999999999999996; rounding to 12 digits puts it back on the 3 threshold.
  const fraction = Number((x / 10 ** exponent).toPrecision(12))
  let nice
  if (round) nice = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10
  else nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  // Dividing by an exact power of ten keeps 0.2 as 0.2 instead of 2 * 0.1.
  return exponent < 0 ? nice / 10 ** -exponent : nice * 10 ** exponent
}

/**
 * The number of decimals a tick step needs, so 0.2 → 1, 0.25 → 2 and 200 → 0.
 * @param {number} step
 * @returns {number} 0 to 10.
 */
export function tickDecimals(step) {
  const size = Math.abs(step)
  if (!Number.isFinite(size) || size === 0) return 0
  for (let decimals = 0; decimals < 10; decimals++) {
    const scaled = size * 10 ** decimals
    if (Math.abs(scaled - Math.round(scaled)) < EPSILON * Math.max(1, scaled)) return decimals
  }
  return 10
}

/**
 * @typedef {object} NiceScale
 * @property {number} min The first tick, at or below the data minimum.
 * @property {number} max The last tick, at or above the data maximum.
 * @property {number} step The distance between ticks: 1, 2 or 5 times a power of ten.
 * @property {number[]} ticks From `min` to `max` inclusive, `step` apart.
 */

/**
 * An axis that covers `[min, max]` with round tick values (Heckbert's loose labeling), stepping up
 * to a coarser step whenever that would exceed `maxTicks`. A flat series (`min === max`) is padded
 * around its value so the line sits inside the axis.
 *
 * @param {number} min Data minimum. Non-finite values fall back to `max`, then to 0.
 * @param {number} max Data maximum. The two may come in either order.
 * @param {number} [maxTicks=5] Upper bound on the number of ticks; at least 3, since an axis that
 *   crosses a multiple of its step always needs a tick on each side of it.
 * @param {object} [options]
 * @param {boolean} [options.includeZero=false] Stretch the axis to 0. Use it for amounts (spend
 *   bars grow from 0), not for rates like MPG, where 0 would flatten every difference.
 * @returns {NiceScale}
 */
export function niceScale(min, max, maxTicks = 5, { includeZero = false } = {}) {
  const tickLimit = Math.max(3, Math.floor(maxTicks) || 3)
  let lo = Number.isFinite(min) ? min : Number.isFinite(max) ? max : 0
  let hi = Number.isFinite(max) ? max : lo
  if (lo > hi) [lo, hi] = [hi, lo]

  if (includeZero) {
    lo = Math.min(lo, 0)
    hi = Math.max(hi, 0)
  }
  if (hi - lo <= EPSILON * Math.max(Math.abs(lo), Math.abs(hi))) {
    const value = (lo + hi) / 2
    if (value === 0) [lo, hi] = includeZero ? [0, 1] : [-1, 1]
    else {
      const pad = niceNumber(Math.abs(value) * 0.05, true)
      ;[lo, hi] = [value - pad, value + pad]
    }
  }

  let step = niceNumber(niceNumber(hi - lo, false) / (tickLimit - 1), true)
  // Past the float range (spans near Number.MAX_VALUE or below the smallest normal) there is no
  // usable step; the two ends are still a valid axis.
  if (!(step > 0) || !Number.isFinite(step)) return { min: lo, max: hi, step: hi - lo, ticks: [lo, hi] }
  let first
  let last
  for (;;) {
    first = Math.floor(lo / step + EPSILON)
    last = Math.ceil(hi / step - EPSILON)
    if (last - first + 1 <= tickLimit) break
    step = stepUp(step)
  }

  const ticks = []
  for (let i = first; i <= last; i++) ticks.push(snap(i * step, step))
  return { min: ticks[0], max: ticks[ticks.length - 1], step, ticks }
}

/**
 * @typedef {((value: number) => number) & {
 *   invert: (pixel: number) => number,
 *   domain: [number, number],
 *   range: [number, number],
 * }} LinearScale
 */

/**
 * Maps a data interval onto a pixel interval. A zero-width domain maps everything to the middle of
 * the range, so a single point or a flat series sits in the center.
 *
 * @param {[number, number]} domain Data values, e.g. `[scale.min, scale.max]` from {@link niceScale}.
 * @param {[number, number]} range Pixels. Reverse it (`[bottom, top]`) for a y axis.
 * @returns {LinearScale} `scale(value)` gives the pixel; `scale.invert(pixel)` gives the value back.
 */
export function linearScale(domain, range) {
  const [d0, d1] = domain
  const [r0, r1] = range
  const scale = (value) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((value - d0) / (d1 - d0)) * (r1 - r0))
  scale.invert = (pixel) => (r1 === r0 ? (d0 + d1) / 2 : d0 + ((pixel - r0) / (r1 - r0)) * (d1 - d0))
  scale.domain = [d0, d1]
  scale.range = [r0, r1]
  return scale
}

/**
 * @typedef {object} BandScale
 * @property {number} bandwidth Width of one band.
 * @property {number} step Distance from one band's start to the next.
 * @property {(i: number) => number} x Left edge of band `i`.
 * @property {(i: number) => number} center Middle of band `i`.
 * @property {(pixel: number) => number} indexAt The band whose slot (band plus half the gap each
 *   side) contains `pixel`, or -1 outside every slot.
 */

/**
 * Splits a pixel interval into `count` equal bands for bar charts, with `padding` as the share of
 * each step left empty between bands and half of it again at each end.
 *
 * @param {number} count Number of bands.
 * @param {[number, number]} range Pixels, left to right.
 * @param {number} [padding=0.2] 0 to 1.
 * @returns {BandScale}
 */
export function bandScale(count, range, padding = 0.2) {
  const [r0, r1] = range
  const n = Math.max(0, Math.floor(count))
  const gap = Math.min(Math.max(padding, 0), 1)
  const step = n > 0 ? (r1 - r0) / (n + gap) : 0
  const bandwidth = step * (1 - gap)
  const start = r0 + step * gap
  const x = (i) => start + step * i
  return {
    bandwidth,
    step,
    x,
    center: (i) => x(i) + bandwidth / 2,
    indexAt: (pixel) => {
      if (n === 0 || step <= 0) return -1
      const i = Math.floor((pixel - (start - (step * gap) / 2)) / step)
      return i >= 0 && i < n ? i : -1
    },
  }
}

/**
 * Formats an axis tick with the decimals its step needs and thousands separators.
 * @param {number} value
 * @param {number} step The scale's step, from {@link niceScale}.
 * @param {object} [options]
 * @param {string} [options.prefix=''] e.g. '$'; goes after the minus sign ("-$5").
 * @param {string} [options.suffix=''] e.g. '%'.
 * @param {number} [options.decimals] Overrides the decimals, e.g. 2 for "$3.40".
 * @returns {string}
 */
export function formatTick(value, step, { prefix = '', suffix = '', decimals = tickDecimals(step) } = {}) {
  const rounded = Number(value.toFixed(decimals)) || 0
  const digits = Math.abs(rounded).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${rounded < 0 ? '-' : ''}${prefix}${digits}${suffix}`
}

/**
 * Short uppercase date for an x-axis label, e.g. "AUG 28".
 * @param {string} iso `YYYY-MM-DD`
 * @returns {string} Empty for a malformed date.
 */
export function formatDateTick(iso) {
  const date = parseISODate(iso)
  return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() : ''
}

/**
 * Numeric x positions for chart points. Dates become days since the first one (so gaps between
 * fill-ups show as gaps), numbers pass through, and anything else falls back to the array index.
 * @param {Array<string | number | null | undefined>} xs All `YYYY-MM-DD` strings, or all numbers.
 * @returns {number[]}
 */
export function toXValues(xs) {
  if (xs.length > 0 && xs.every((x) => typeof x === 'string' && ISO_DATE.test(x))) {
    const days = xs.map((x) => daysBetween(xs[0], x))
    if (days.every(Number.isFinite)) return days
  }
  if (xs.length > 0 && xs.every((x) => typeof x === 'number' && Number.isFinite(x))) return [...xs]
  return xs.map((_, i) => i)
}

/**
 * Which of `count` evenly spaced labels to show when only `maxLabels` fit: every n-th one, counted
 * back from the last so the most recent label is always shown.
 * @param {number} count
 * @param {number} maxLabels At least 1.
 * @returns {number[]} Ascending indices.
 */
export function thinIndices(count, maxLabels) {
  const n = Math.max(0, Math.floor(count))
  const stride = Math.ceil(n / Math.max(1, Math.floor(maxLabels) || 1)) || 1
  const indices = []
  for (let i = (n - 1) % stride; i < n; i += stride) indices.push(i)
  return indices
}
