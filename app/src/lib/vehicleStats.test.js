import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  computeFillMpg,
  getDrivingRate,
  getDueSoonItems,
  getFuelStats,
  formatLastReading,
  getLastReading,
  getMonthlyFuelAverages,
  getMonthlySpend,
  getMonthToDateSpend,
  getPriceHistory,
  getServiceHistorySorted,
} from './vehicleStats'

afterEach(() => {
  vi.useRealTimers()
})

const fill = (odometer, gallons, isFull = true) => ({ odometer, gallons, isFull })

describe('computeFillMpg', () => {
  it('gives the first full fill no MPG, since there is no earlier full tank to measure from', () => {
    const [first] = computeFillMpg([fill(1000, 10), fill(1300, 10)])
    expect(first.mpg).toBeNull()
  })

  it('computes MPG between consecutive full fills', () => {
    const result = computeFillMpg([fill(1000, 10), fill(1300, 10)])
    expect(result.map((f) => f.mpg)).toEqual([null, 30])
  })

  it('gives partial fills no MPG', () => {
    const result = computeFillMpg([fill(1000, 10), fill(1150, 4, false), fill(1300, 6)])
    expect(result[1].mpg).toBeNull()
  })

  it('accumulates partial-fill gallons into the next full fill', () => {
    const result = computeFillMpg([fill(1000, 10), fill(1150, 4, false), fill(1300, 6)])
    expect(result[2].mpg).toBe(30)
  })

  it('rounds MPG to one decimal place', () => {
    const result = computeFillMpg([fill(1000, 10), fill(1100, 3)])
    expect(result[1].mpg).toBe(33.3)
  })

  it('keeps the original fill fields', () => {
    const result = computeFillMpg([{ id: 7, date: '2026-09-01', ...fill(1000, 10) }])
    expect(result[0]).toEqual({ id: 7, date: '2026-09-01', odometer: 1000, gallons: 10, isFull: true, mpg: null })
  })
})

describe('getDueSoonItems', () => {
  const interval = { id: 1, categoryId: 'x', name: 'Test', miles: null, months: 12, warnMiles: 0, warnDays: 0 }
  const vehicle = { intervals: [interval] }
  const records = [{ categoryId: 'x', date: '2026-01-31', odometer: 1000, services: [] }]

  it('is not overdue the day before the calendar due date (12 months after 2026-01-31)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2027, 0, 30, 12))
    const [item] = getDueSoonItems(vehicle, records, 1000)
    expect(item.status).not.toBe('overdue')
  })

  it('is overdue on the calendar due date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2027, 0, 31, 12))
    const [item] = getDueSoonItems(vehicle, records, 1000)
    expect(item.status).toBe('overdue')
  })
})

describe('getMonthToDateSpend', () => {
  const spend = (date, total) => ({ date, total })

  it('compares the 1st through today with the 1st through the same day last month', () => {
    const fills = [spend('2026-08-01', 30), spend('2026-08-03', 20), spend('2026-08-04', 500), spend('2026-09-02', 60)]
    expect(getMonthToDateSpend(fills, '2026-09-03')).toEqual({ current: 60, previous: 50, delta: 20 })
  })

  it('compares Mar 31 with all of February', () => {
    const fills = [spend('2026-01-31', 999), spend('2026-02-01', 40), spend('2026-02-28', 40), spend('2026-03-31', 100)]
    expect(getMonthToDateSpend(fills, '2026-03-31')).toEqual({ current: 100, previous: 80, delta: 25 })
  })

  it('includes Feb 29 when comparing Mar 31 of a leap year', () => {
    const fills = [spend('2028-02-29', 50), spend('2028-03-01', 50)]
    expect(getMonthToDateSpend(fills, '2028-03-31')).toEqual({ current: 50, previous: 50, delta: 0 })
  })

  it('compares January with the same days of December across the year boundary', () => {
    const fills = [spend('2025-12-10', 40), spend('2025-12-11', 999), spend('2026-01-05', 30)]
    expect(getMonthToDateSpend(fills, '2026-01-10')).toEqual({ current: 30, previous: 40, delta: -25 })
  })

  it('returns a null delta when nothing was spent in last month\'s window', () => {
    const fills = [spend('2026-08-20', 100), spend('2026-09-02', 60)]
    expect(getMonthToDateSpend(fills, '2026-09-03')).toEqual({ current: 60, previous: 0, delta: null })
    expect(getMonthToDateSpend([], '2026-09-03').delta).toBeNull()
  })

  it('reports a real drop when this month has no spend yet', () => {
    expect(getMonthToDateSpend([spend('2026-08-01', 40)], '2026-09-03').delta).toBe(-100)
  })

  it('ignores fills after today and fills with a malformed date', () => {
    const fills = [spend('2026-09-04', 999), spend('', 999), spend('2026-9-1', 999), spend('2026-09-01', 25)]
    expect(getMonthToDateSpend(fills, '2026-09-03').current).toBe(25)
  })
})

describe('getFuelStats', () => {
  const fillUp = (date, odometer, total) => ({ date, odometer, gallons: 10, pricePerGal: total / 10, total, isFull: true })

  it('uses the local date at 11 pm Pacific on the 1st, when UTC is already the 2nd', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 1, 23))
    const stats = getFuelStats([
      fillUp('2026-07-31', 1000, 100),
      fillUp('2026-08-01', 1300, 40),
      fillUp('2026-08-02', 1500, 999),
      fillUp('2026-09-01', 1600, 60),
    ])
    expect(stats.spendThisMonth).toBe(60)
    expect(stats.spendDelta).toBe(50)
  })

  it('on the 3rd with one fill-up this month, compares with only the 1st to 3rd of last month', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 3, 12))
    const stats = getFuelStats([
      fillUp('2026-08-02', 1000, 40),
      fillUp('2026-08-15', 1300, 60),
      fillUp('2026-08-28', 1600, 60),
      fillUp('2026-09-03', 1900, 50),
    ])
    expect(stats.spendThisMonth).toBe(50)
    expect(stats.spendDelta).toBe(25)
  })

  it('on Mar 31, compares with all of February', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 31, 12))
    const stats = getFuelStats([
      fillUp('2026-02-01', 1000, 40),
      fillUp('2026-02-28', 1300, 40),
      fillUp('2026-03-31', 1600, 60),
    ])
    expect(stats.spendDelta).toBe(-25)
  })

  it('returns a null delta, not -100%, when last month\'s window is empty', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 3, 12))
    const stats = getFuelStats([fillUp('2026-08-20', 1000, 60)])
    expect(stats.spendThisMonth).toBe(0)
    expect(stats.spendDelta).toBeNull()
  })
})

describe('getPriceHistory', () => {
  const priced = (id, date, pricePerGal, odometer = id * 100) => ({
    id, date, odometer, gallons: 10, pricePerGal, total: pricePerGal * 10, isFull: true,
  })

  it('returns the last 12 fill-ups in date order, oldest first', () => {
    const fills = Array.from({ length: 14 }, (_, i) => priced(i + 1, `2026-01-${String(i + 10).padStart(2, '0')}`, 3))
    const { points } = getPriceHistory([...fills].reverse())
    expect(points.map((p) => p.id)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
  })

  it('orders by date even when the odometer order disagrees, and by odometer within a day', () => {
    const fills = [
      priced(1, '2026-03-01', 3, 5000),
      priced(2, '2026-02-01', 3, 9000),
      priced(3, '2026-03-01', 3, 4000),
    ]
    expect(getPriceHistory(fills).points.map((p) => p.id)).toEqual([2, 3, 1])
  })

  it('marks prices more than 3% above or below the average as high or low', () => {
    const fills = [
      priced(1, '2026-01-01', 4.0),
      priced(2, '2026-01-02', 4.4),
      priced(3, '2026-01-03', 4.1),
      priced(4, '2026-01-04', 3.9),
      priced(5, '2026-01-05', 3.6),
    ]
    const history = getPriceHistory(fills)
    expect(history.average).toBeCloseTo(4.0)
    expect(history.low).toBe(3.6)
    expect(history.high).toBe(4.4)
    expect(history.points.map((p) => p.level)).toEqual(['normal', 'high', 'normal', 'normal', 'low'])
    expect(history.points[1]).toMatchObject({ id: 2, date: '2026-01-02', pricePerGal: 4.4, level: 'high' })
    expect(history.points[1].change).toBeCloseTo(0.1)
    expect(history.points[4].change).toBeCloseTo(-0.1)
  })

  it('depends only on the vehicle\'s own average, not on fixed price thresholds', () => {
    const expensive = [priced(1, '2026-01-01', 5.2), priced(2, '2026-01-02', 5.25), priced(3, '2026-01-03', 5.3)]
    const cheap = [priced(1, '2026-01-01', 2.9), priced(2, '2026-01-02', 3.2), priced(3, '2026-01-03', 3.5)]
    expect(getPriceHistory(expensive).points.map((p) => p.level)).toEqual(['normal', 'normal', 'normal'])
    expect(getPriceHistory(cheap).points.map((p) => p.level)).toEqual(['low', 'normal', 'high'])
  })

  it('averages only the fills it returns', () => {
    const fills = [
      priced(1, '2026-01-01', 9.99),
      ...Array.from({ length: 12 }, (_, i) => priced(i + 2, `2026-02-${String(i + 1).padStart(2, '0')}`, 3)),
    ]
    const history = getPriceHistory(fills)
    expect(history.average).toBeCloseTo(3)
    expect(history.points.every((p) => p.level === 'normal')).toBe(true)
  })

  it('takes a custom count', () => {
    const fills = [priced(1, '2026-01-01', 3), priced(2, '2026-01-02', 3), priced(3, '2026-01-03', 3)]
    expect(getPriceHistory(fills, 2).points.map((p) => p.id)).toEqual([2, 3])
  })

  it('leaves out fills without a valid date and handles an empty log', () => {
    expect(getPriceHistory([priced(1, '', 3), priced(2, '2026-01-02', 3)]).points.map((p) => p.id)).toEqual([2])
    expect(getPriceHistory([])).toEqual({ average: null, low: null, high: null, points: [] })
  })
})

describe('getMonthlyFuelAverages', () => {
  const bought = (date, gallons, total) => ({ date, gallons, total })

  it('averages spend and real gallons over the last 6 calendar months, including this one', () => {
    const fills = [
      bought('2026-03-31', 99, 999),
      bought('2026-04-01', 10, 40),
      bought('2026-06-15', 12, 50),
      bought('2026-06-20', 8, 30),
      bought('2026-09-25', 15, 60),
    ]
    expect(getMonthlyFuelAverages(fills, 6, '2026-09-25')).toEqual({ spendPerMonth: 30, gallonsPerMonth: 7.5, months: 6 })
  })

  it('counts months with no fill-ups as zero once the log has started', () => {
    const fills = [bought('2026-01-10', 12, 60)]
    expect(getMonthlyFuelAverages(fills, 6, '2026-09-25')).toEqual({ spendPerMonth: 0, gallonsPerMonth: 0, months: 6 })
  })

  it('leaves out months before the first logged fill-up', () => {
    const fills = [bought('2026-08-05', 10, 40), bought('2026-09-05', 20, 80)]
    expect(getMonthlyFuelAverages(fills, 6, '2026-09-25')).toEqual({ spendPerMonth: 60, gallonsPerMonth: 15, months: 2 })
  })

  it('crosses the year boundary', () => {
    const fills = [bought('2025-08-31', 10, 999), bought('2025-09-01', 10, 30), bought('2026-01-01', 20, 60)]
    expect(getMonthlyFuelAverages(fills, 6, '2026-02-28')).toEqual({ spendPerMonth: 15, gallonsPerMonth: 5, months: 6 })
  })

  it('returns nulls when nothing is logged', () => {
    expect(getMonthlyFuelAverages([], 6, '2026-09-25')).toEqual({ spendPerMonth: null, gallonsPerMonth: null, months: 0 })
    expect(getMonthlyFuelAverages([bought('', 10, 40)], 6, '2026-09-25').months).toBe(0)
  })

  it('uses the local date by default', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 30, 23))
    const fills = [bought('2026-04-30', 60, 240), bought('2026-10-01', 99, 999)]
    expect(getMonthlyFuelAverages(fills)).toEqual({ spendPerMonth: 40, gallonsPerMonth: 10, months: 6 })
  })
})

describe('getMonthlySpend', () => {
  it('returns the three months ending in the current month, on the 31st', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 31, 12))
    const fills = [
      { date: '2025-12-31', total: 999 },
      { date: '2026-01-01', total: 40 },
      { date: '2026-03-31', total: 55 },
    ]
    const records = [{ date: '2026-02-01', cost: 200 }]
    expect(getMonthlySpend(fills, records)).toEqual([
      { month: 'Jan', fuel: 40, service: 0 },
      { month: 'Feb', fuel: 0, service: 200 },
      { month: 'Mar', fuel: 55, service: 0 },
    ])
  })

  it('crosses the year boundary', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 15, 12))
    expect(getMonthlySpend([], []).map((m) => m.month)).toEqual(['Nov', 'Dec', 'Jan'])
  })
})

describe('getServiceHistorySorted', () => {
  it('sorts newest first without mutating the input', () => {
    const records = [{ date: '2026-01-05' }, { date: '2026-03-01' }, { date: '2025-12-31' }]
    expect(getServiceHistorySorted(records).map((r) => r.date)).toEqual(['2026-03-01', '2026-01-05', '2025-12-31'])
    expect(records[0].date).toBe('2026-01-05')
  })
})

describe('getLastReading', () => {
  const fills = [
    { id: 1, date: '2026-08-01', odometer: 84000 },
    { id: 2, date: '2026-08-28', odometer: 84210 },
  ]
  const records = [
    { id: 1, date: '2026-07-15', odometer: 83500 },
    { id: 2, date: '2026-09-10', odometer: 84400 },
  ]

  it('returns the highest reading across fill-ups and service records', () => {
    expect(getLastReading(fills, records)).toEqual({ odometer: 84400, date: '2026-09-10' })
    expect(getLastReading(fills, records.slice(0, 1))).toEqual({ odometer: 84210, date: '2026-08-28' })
  })

  it('skips only the fill-up being edited, even when a service record shares its id', () => {
    expect(getLastReading(fills, [], { type: 'fill', id: 2 })).toEqual({ odometer: 84000, date: '2026-08-01' })
    expect(getLastReading(fills, records, { type: 'fill', id: 2 })).toEqual({ odometer: 84400, date: '2026-09-10' })
  })

  it('skips only the service record being edited, even when a fill-up shares its id', () => {
    expect(getLastReading(fills, records, { type: 'service', id: 2 })).toEqual({ odometer: 84210, date: '2026-08-28' })
  })

  it('returns null when there are no readings', () => {
    expect(getLastReading([], [])).toBeNull()
    expect(getLastReading(fills.slice(0, 1), [], { type: 'fill', id: 1 })).toBeNull()
  })

  it('ignores missing and zero readings', () => {
    expect(getLastReading([{ id: 1, date: '2026-09-01', odometer: 0 }], [{ id: 1, date: '2026-09-02', odometer: null }])).toBeNull()
  })
})

describe('getDrivingRate', () => {
  it('counts whole calendar days across the spring-forward DST change', () => {
    const fills = [
      { date: '2026-03-31', odometer: 11000 },
      { date: '2026-03-01', odometer: 10000 },
    ]
    expect(getDrivingRate(fills)).toEqual({ milesPerMonth: 1000, milesPerYear: 12000, fillsPerYear: 24 })
  })
})

describe('records with a blank date', () => {
  it('are skipped by the stats instead of throwing', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 15, 12))
    const fills = [
      { date: '', odometer: 1000, gallons: 10, pricePerGal: 4, total: 40, isFull: true },
      { date: '2026-09-10', odometer: 1300, gallons: 10, pricePerGal: 4, total: 40, isFull: true },
    ]
    const records = [{ categoryId: 'x', date: '', odometer: 900, cost: 50, services: [] }]
    const vehicle = { intervals: [{ id: 1, categoryId: 'x', name: 'Test', miles: 5000, months: 6, warnMiles: 500, warnDays: 30 }] }

    expect(getFuelStats(fills).spendThisMonth).toBe(40)
    expect(getMonthlySpend(fills, records).at(-1)).toEqual({ month: 'Sep', fuel: 40, service: 0 })
    expect(getDueSoonItems(vehicle, records, 1300)[0].milesRemaining).toBe(4600)
    expect(getServiceHistorySorted([...records, { date: '2026-09-01' }])[0].date).toBe('2026-09-01')
  })
})

describe('formatLastReading', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the reading and its date, with the year only when it is not this year', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 25, 12))
    expect(formatLastReading({ odometer: 84210, date: '2026-08-28' }, 41880)).toBe('Last: 84,210 on Aug 28')
    expect(formatLastReading({ odometer: 84210, date: '2025-12-30' }, 41880)).toBe('Last: 84,210 on Dec 30, 2025')
  })

  it('falls back to the purchase reading, then to nothing', () => {
    expect(formatLastReading(null, 41880)).toBe('Last: 41,880 at purchase')
    expect(formatLastReading(null, 0)).toBeNull()
    expect(formatLastReading(null, null)).toBeNull()
  })

  it('omits a malformed date', () => {
    expect(formatLastReading({ odometer: 84210, date: '' }, 41880)).toBe('Last: 84,210')
  })
})
