import { describe, expect, it } from 'vitest'
import {
  bandScale,
  formatDateTick,
  formatTick,
  linearScale,
  niceNumber,
  niceScale,
  thinIndices,
  tickDecimals,
  toXValues,
} from './chartScale'

describe('niceNumber', () => {
  it('rounds to the nearest of 1, 2, 5 and 10 for a tick step', () => {
    expect([1.2, 1.6, 2.9, 3.1, 6.9, 7.2].map((x) => niceNumber(x, true))).toEqual([1, 2, 2, 5, 5, 10])
  })

  it('covers the value when not rounding, for a range', () => {
    expect([1, 1.1, 2, 2.1, 5, 5.5].map((x) => niceNumber(x, false))).toEqual([1, 2, 2, 5, 5, 10])
  })

  it('keeps the power of ten, without float noise below 1', () => {
    expect(niceNumber(612, false)).toBe(1000)
    expect(niceNumber(250, true)).toBe(200)
    expect(niceNumber(0.0125, true)).toBe(0.01)
    expect(niceNumber(0.3, true)).toBe(0.5)
    expect(niceNumber(0.17, true)).toBe(0.2)
  })

  it('returns 0 for zero, negative and non-finite input', () => {
    expect([0, -3, NaN, Infinity].map((x) => niceNumber(x, true))).toEqual([0, 0, 0, 0])
  })
})

describe('tickDecimals', () => {
  it('gives the decimals a step needs', () => {
    expect([200, 5, 1, 0.5, 0.2, 0.25, 0.02, 0.005].map(tickDecimals)).toEqual([0, 0, 0, 1, 1, 2, 2, 3])
  })

  it('treats 0 and non-finite steps as whole numbers', () => {
    expect([0, NaN, Infinity].map(tickDecimals)).toEqual([0, 0, 0])
  })
})

describe('niceScale', () => {
  it('fits a typical MPG range (28.4–33.9) without starting at zero', () => {
    expect(niceScale(28.4, 33.9)).toEqual({ min: 28, max: 34, step: 2, ticks: [28, 30, 32, 34] })
  })

  it('starts dollars (0–612) at zero in round hundreds', () => {
    expect(niceScale(0, 612, 5, { includeZero: true })).toEqual({
      min: 0,
      max: 800,
      step: 200,
      ticks: [0, 200, 400, 600, 800],
    })
  })

  it('stretches a positive-only series down to zero with includeZero', () => {
    const scale = niceScale(180, 612, 5, { includeZero: true })
    expect(scale.min).toBe(0)
    expect(scale.max).toBeGreaterThanOrEqual(612)
  })

  it('pads a flat series around its value so the line sits mid-axis', () => {
    expect(niceScale(31, 31)).toEqual({ min: 29, max: 33, step: 1, ticks: [29, 30, 31, 32, 33] })
  })

  it('pads a flat series of zeros to either side, or upward with includeZero', () => {
    expect(niceScale(0, 0).ticks).toEqual([-1, -0.5, 0, 0.5, 1])
    expect(niceScale(0, 0, 5, { includeZero: true }).ticks).toEqual([0, 0.5, 1])
  })

  it('gives a single point an axis around it', () => {
    const scale = niceScale(31.1, 31.1)
    expect(scale).toEqual({ min: 28, max: 34, step: 2, ticks: [28, 30, 32, 34] })
  })

  it('crosses zero for a negative-to-positive range, with 0 as a tick', () => {
    const scale = niceScale(-3.2, 4.7)
    expect(scale).toEqual({ min: -5, max: 5, step: 5, ticks: [-5, 0, 5] })
    expect(niceScale(-0.08, 0.12).ticks).toContain(0)
  })

  it('stretches an all-negative range up to zero with includeZero', () => {
    expect(niceScale(-45, -12, 5, { includeZero: true })).toEqual({
      min: -60,
      max: 0,
      step: 20,
      ticks: [-60, -40, -20, 0],
    })
  })

  it('handles a tiny range such as gas prices (3.41–3.46) without float noise', () => {
    expect(niceScale(3.41, 3.46)).toEqual({ min: 3.4, max: 3.46, step: 0.02, ticks: [3.4, 3.42, 3.44, 3.46] })
  })

  it('treats a range lost in float noise as flat', () => {
    expect(niceScale(31, 31 + 1e-12)).toEqual(niceScale(31, 31))
  })

  it('accepts min and max in either order', () => {
    expect(niceScale(33.9, 28.4)).toEqual(niceScale(28.4, 33.9))
  })

  it('never returns more than maxTicks ticks', () => {
    const ranges = [[0.5, 5.4], [0, 1], [28.4, 33.9], [0, 612], [-3.2, 4.7], [3.41, 3.46], [1, 999], [17.2, 17.9]]
    for (const maxTicks of [3, 4, 5, 6, 8]) {
      for (const [lo, hi] of ranges) {
        const { ticks, min, max } = niceScale(lo, hi, maxTicks)
        expect(ticks.length).toBeLessThanOrEqual(maxTicks)
        expect(min).toBeLessThanOrEqual(lo)
        expect(max).toBeGreaterThanOrEqual(hi)
      }
    }
  })

  it('falls back to the finite end, or to 0, when a bound is not finite', () => {
    expect(niceScale(Infinity, -Infinity, 5, { includeZero: true }).ticks).toEqual([0, 0.5, 1])
    expect(niceScale(NaN, 31)).toEqual(niceScale(31, 31))
  })
})

describe('linearScale', () => {
  it('maps the domain onto the range and inverts back', () => {
    const y = linearScale([28, 34], [150, 10])
    expect(y(28)).toBe(150)
    expect(y(34)).toBe(10)
    expect(y(31)).toBe(80)
    expect(y.invert(80)).toBe(31)
    expect(y.invert(150)).toBe(28)
  })

  it('extrapolates outside the domain', () => {
    const x = linearScale([0, 10], [0, 100])
    expect(x(12)).toBe(120)
    expect(x.invert(-10)).toBe(-1)
  })

  it('puts everything mid-range for a zero-width domain', () => {
    const x = linearScale([5, 5], [0, 300])
    expect(x(5)).toBe(150)
    expect(x(99)).toBe(150)
  })

  it('exposes its domain and range', () => {
    const x = linearScale([0, 1], [8, 92])
    expect(x.domain).toEqual([0, 1])
    expect(x.range).toEqual([8, 92])
  })
})

describe('bandScale', () => {
  it('splits the range into equal bands with padding between and at both ends', () => {
    const band = bandScale(4, [0, 420], 0.2)
    expect(band.step).toBe(100)
    expect(band.bandwidth).toBe(80)
    expect([0, 1, 2, 3].map(band.x)).toEqual([20, 120, 220, 320])
    expect(band.center(0)).toBe(60)
    expect(band.x(3) + band.bandwidth + 20).toBe(420)
  })

  it('finds the band under a pixel, counting half of each gap as its slot', () => {
    const band = bandScale(4, [0, 420], 0.2)
    expect(band.indexAt(60)).toBe(0)
    expect(band.indexAt(11)).toBe(0)
    expect(band.indexAt(109)).toBe(0)
    expect(band.indexAt(111)).toBe(1)
    expect(band.indexAt(409)).toBe(3)
    expect(band.indexAt(5)).toBe(-1)
    expect(band.indexAt(415)).toBe(-1)
  })

  it('starts at the range offset', () => {
    const band = bandScale(2, [40, 250], 0)
    expect(band.x(0)).toBe(40)
    expect(band.bandwidth).toBe(105)
  })

  it('has no bands for a count of zero', () => {
    const band = bandScale(0, [0, 300])
    expect(band.bandwidth).toBe(0)
    expect(band.indexAt(100)).toBe(-1)
  })
})

describe('formatTick', () => {
  it('uses the decimals of the step and thousands separators', () => {
    expect(formatTick(1000, 200)).toBe('1,000')
    expect(formatTick(3.4, 0.02)).toBe('3.40')
    expect(formatTick(30, 2)).toBe('30')
    expect(formatTick(0.30000000000000004, 0.1)).toBe('0.3')
  })

  it('adds a prefix after the minus sign, and a suffix', () => {
    expect(formatTick(600, 200, { prefix: '$' })).toBe('$600')
    expect(formatTick(-5, 5, { prefix: '$' })).toBe('-$5')
    expect(formatTick(2.5, 0.5, { suffix: '%' })).toBe('2.5%')
  })

  it('takes explicit decimals, e.g. cents on a price axis', () => {
    expect(formatTick(3.4, 0.2, { prefix: '$', decimals: 2 })).toBe('$3.40')
  })

  it('never prints a negative zero', () => {
    expect(formatTick(-0, 5)).toBe('0')
    expect(formatTick(-0.001, 0.5)).toBe('0.0')
  })
})

describe('formatDateTick', () => {
  it('formats a local date as a short uppercase label', () => {
    expect(formatDateTick('2026-08-28')).toBe('AUG 28')
    expect(formatDateTick('2026-09-01')).toBe('SEP 1')
  })

  it('returns an empty string for a malformed date', () => {
    expect(formatDateTick('2026-02-30')).toBe('')
    expect(formatDateTick(undefined)).toBe('')
  })
})

describe('toXValues', () => {
  it('turns dates into days since the first one, across month ends', () => {
    expect(toXValues(['2026-04-24', '2026-05-06', '2026-05-30', '2026-06-11'])).toEqual([0, 12, 36, 48])
  })

  it('passes numbers through', () => {
    expect(toXValues([0, 2, 5])).toEqual([0, 2, 5])
  })

  it('falls back to indices for missing, mixed or malformed x values', () => {
    expect(toXValues([undefined, undefined, undefined])).toEqual([0, 1, 2])
    expect(toXValues(['2026-04-24', 3])).toEqual([0, 1])
    expect(toXValues(['2026-04-24', '2026-13-01'])).toEqual([0, 1])
  })

  it('returns an empty array for no points', () => {
    expect(toXValues([])).toEqual([])
  })
})

describe('thinIndices', () => {
  it('keeps every label when they all fit', () => {
    expect(thinIndices(5, 5)).toEqual([0, 1, 2, 3, 4])
    expect(thinIndices(3, 10)).toEqual([0, 1, 2])
  })

  it('keeps every n-th label counted back from the last', () => {
    expect(thinIndices(12, 6)).toEqual([1, 3, 5, 7, 9, 11])
    expect(thinIndices(10, 3)).toEqual([1, 5, 9])
  })

  it('keeps only the last label when one fits', () => {
    expect(thinIndices(7, 1)).toEqual([6])
    expect(thinIndices(7, 0)).toEqual([6])
  })

  it('handles zero and one items', () => {
    expect(thinIndices(0, 4)).toEqual([])
    expect(thinIndices(1, 4)).toEqual([0])
  })
})
