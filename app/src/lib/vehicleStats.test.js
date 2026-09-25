import { describe, expect, it } from 'vitest'
import { computeFillMpg, getDueSoonItems, getFuelStats, getMonthlySpend } from './vehicleStats'

const fill = (id, date, odometer, gallons, isFull = true) => ({
  id, date, odometer, gallons, isFull, pricePerGal: 3.5, total: Math.round(gallons * 3.5 * 100) / 100,
})

describe('computeFillMpg', () => {
  it('has no MPG for the first full fill', () => {
    const [first] = computeFillMpg([fill(1, '2026-01-01', 1000, 10)])
    expect(first.mpg).toBeNull()
  })

  it('computes MPG between consecutive full fills', () => {
    const result = computeFillMpg([fill(1, '2026-01-01', 1000, 10), fill(2, '2026-01-10', 1310, 10)])
    expect(result.map((f) => f.mpg)).toEqual([null, 31])
  })

  it('accumulates partial fills into the next full fill', () => {
    const result = computeFillMpg([
      fill(1, '2026-01-01', 1000, 10),
      fill(2, '2026-01-05', 1200, 5, false),
      fill(3, '2026-01-10', 1300, 5),
    ])
    expect(result.map((f) => f.mpg)).toEqual([null, null, 30])
  })
})

describe('getDueSoonItems time-based intervals', () => {
  const vehicle = {
    purchaseOdometer: 0,
    intervals: [
      { id: 1, categoryId: 'filters', name: 'Cabin air filter', trackBy: 'months', miles: null, months: 12, warnMiles: 750, warnDays: 21 },
    ],
  }
  const records = [{ categoryId: 'filters', date: '2026-01-31', odometer: 70000, services: ['Cabin air filter'] }]
  const statusOn = (today) => getDueSoonItems(vehicle, records, 80000, today)[0].status

  it('is due on the same calendar date a year later, not after 360 days', () => {
    expect(statusOn('2027-01-26')).toBe('coming-up')
    expect(statusOn('2027-01-30')).toBe('coming-up')
    expect(statusOn('2027-01-31')).toBe('overdue')
  })

  it('is on track well before the warn window', () => {
    expect(statusOn('2026-12-01')).toBe('ok')
  })
})

describe('month grouping', () => {
  it('counts a fill on the 1st in that month, not the previous one', () => {
    const fills = [fill(1, '2026-08-31', 1000, 4), fill(2, '2026-09-01', 1100, 10)]
    const months = getMonthlySpend(fills, [], '2026-09-24')
    expect(months.map((m) => m.month)).toEqual(['Jul', 'Aug', 'Sep'])
    expect(months.map((m) => m.fuel)).toEqual([0, 14, 35])
  })

  it('reports this month’s fuel spend by local date', () => {
    const fills = [fill(1, '2026-08-31', 1000, 4), fill(2, '2026-09-01', 1100, 10)]
    expect(getFuelStats(fills, '2026-09-24').spendThisMonth).toBe(35)
  })
})
