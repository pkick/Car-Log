import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  computeFillMpg,
  getDrivingRate,
  getDueSoonItems,
  getFuelStats,
  getMonthlySpend,
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

describe('getFuelStats', () => {
  const fillUp = (date, odometer, total) => ({ date, odometer, gallons: 10, pricePerGal: total / 10, total, isFull: true })

  it('buckets months by the local date at 11 pm Pacific on the 1st, when UTC is already the 2nd', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 1, 23))
    const stats = getFuelStats([
      fillUp('2026-07-31', 1000, 100),
      fillUp('2026-08-31', 1300, 40),
      fillUp('2026-09-01', 1600, 60),
    ])
    expect(stats.spendThisMonth).toBe(60)
    expect(stats.spendDelta).toBe(50)
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
