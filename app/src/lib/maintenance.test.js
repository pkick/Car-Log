import { describe, expect, it } from 'vitest'
import {
  countByStatus,
  filterServiceHistory,
  getHistoryCategoryIds,
  getNextDueAfterService,
  getRecordCategoryIds,
  getYearlyServiceSpend,
  matchesServiceSearch,
  parseBaseline,
} from './maintenance'

const TODAY = '2026-09-26'

const record = (id, date, services, cost, shopName = '', partsUsed = '', notes = '') => ({
  id,
  date,
  odometer: 80000,
  services,
  cost,
  shopName,
  partsUsed,
  notes,
})

// The seeded Wagon's service history.
const wagonRecords = [
  record(1, '2026-02-01', ['Tire rotation'], 0, 'Costco'),
  record(2, '2026-04-22', ['Oil + filter change'], 58, 'Ridge Auto', 'Mobil 1 0W-20 · Volvo 31372212 filter'),
  record(3, '2026-05-01', ['Air filter'], 28.5, 'DIY'),
  record(4, '2026-06-10', ['Brake pads'], 285, 'Ridge Auto'),
]

const ids = (records) => records.map((r) => r.id)

const DEFAULT_INTERVALS = [
  { id: 1, categoryId: 'oil', name: 'Oil + filter', services: ['Oil + filter change'], miles: 5000, months: 12, warnMiles: 500, warnDays: 14 },
  { id: 2, categoryId: 'tires', name: 'Tire rotation', services: ['Tire rotation'], miles: 5000, months: null, warnMiles: 500, warnDays: 14 },
  { id: 3, categoryId: 'brakes', name: 'Brake fluid', services: ['Brake fluid'], miles: 30000, months: 36, warnMiles: 1000, warnDays: 30 },
  { id: 4, categoryId: 'filters', name: 'Cabin air filter', services: ['Cabin air filter'], miles: null, months: 24, warnMiles: 750, warnDays: 21 },
]

describe('countByStatus', () => {
  it('counts every item and each status', () => {
    const items = ['overdue', 'overdue', 'coming-up', 'ok'].map((status) => ({ status }))
    expect(countByStatus(items)).toEqual({ all: 4, overdue: 2, 'coming-up': 1, ok: 1 })
  })

  it('returns zeros for no items', () => {
    expect(countByStatus([])).toEqual({ all: 0, overdue: 0, 'coming-up': 0, ok: 0 })
  })
})

describe('getRecordCategoryIds', () => {
  it('lists the categories of the record\'s services once each, in the order they were picked', () => {
    expect(getRecordCategoryIds({ services: ['Brake pads', 'Tire rotation', 'Brake rotors'] })).toEqual(['brakes', 'tires'])
  })

  it('puts a service that isn\'t in any category in other', () => {
    expect(getRecordCategoryIds({ services: ['Detailing'] })).toEqual(['other'])
    expect(getRecordCategoryIds({ services: ['Detailing', 'Other service'] })).toEqual(['other'])
  })

  it('returns no categories for a record without services', () => {
    expect(getRecordCategoryIds({})).toEqual([])
  })
})

describe('getHistoryCategoryIds', () => {
  it('lists the categories in use, in the category order', () => {
    expect(getHistoryCategoryIds(wagonRecords)).toEqual(['oil', 'brakes', 'tires', 'filters'])
    expect(getHistoryCategoryIds([])).toEqual([])
  })
})

describe('matchesServiceSearch', () => {
  it('matches the shop name, ignoring case', () => {
    expect(matchesServiceSearch(wagonRecords[0], 'costco')).toBe(true)
    expect(matchesServiceSearch(wagonRecords[0], 'COSTCO')).toBe(true)
    expect(matchesServiceSearch(wagonRecords[1], 'costco')).toBe(false)
  })

  it('matches services, parts and notes', () => {
    expect(matchesServiceSearch(wagonRecords[3], 'brake')).toBe(true)
    expect(matchesServiceSearch(wagonRecords[1], 'mobil 1')).toBe(true)
    expect(matchesServiceSearch(record(5, TODAY, ['Battery'], 0, '', '', 'Warranty replacement'), 'warranty')).toBe(true)
  })

  it('needs every word to appear, in any field', () => {
    expect(matchesServiceSearch(wagonRecords[3], 'ridge brake')).toBe(true)
    expect(matchesServiceSearch(wagonRecords[1], 'ridge brake')).toBe(false)
  })

  it('matches everything for an empty or blank query', () => {
    expect(matchesServiceSearch(wagonRecords[0], '')).toBe(true)
    expect(matchesServiceSearch(wagonRecords[0], '   ')).toBe(true)
    expect(matchesServiceSearch(wagonRecords[0], undefined)).toBe(true)
  })

  it('handles missing shop, parts and notes', () => {
    expect(matchesServiceSearch({ services: ['Tire rotation'], shopName: null }, 'tire')).toBe(true)
    expect(matchesServiceSearch({ services: ['Tire rotation'], shopName: null }, 'null')).toBe(false)
  })
})

describe('filterServiceHistory', () => {
  it('filters by search, keeping the order', () => {
    expect(ids(filterServiceHistory(wagonRecords, { query: 'ridge' }))).toEqual([2, 4])
    expect(ids(filterServiceHistory(wagonRecords, { query: 'costco' }))).toEqual([1])
  })

  it('filters by the categories of a record\'s services', () => {
    const both = record(5, TODAY, ['Brake pads', 'Tire rotation'], 100)
    expect(ids(filterServiceHistory([...wagonRecords, both], { categoryId: 'tires' }))).toEqual([1, 5])
    expect(ids(filterServiceHistory([...wagonRecords, both], { categoryId: 'brakes' }))).toEqual([4, 5])
  })

  it('applies both filters together', () => {
    expect(ids(filterServiceHistory(wagonRecords, { query: 'ridge', categoryId: 'oil' }))).toEqual([2])
    expect(ids(filterServiceHistory(wagonRecords, { query: 'costco', categoryId: 'oil' }))).toEqual([])
  })

  it('keeps everything without filters', () => {
    expect(ids(filterServiceHistory(wagonRecords))).toEqual([1, 2, 3, 4])
  })
})

describe('getYearlyServiceSpend', () => {
  it('splits the seeded Wagon\'s 2026 spend by category, largest first, keeping $0 categories', () => {
    const spend = getYearlyServiceSpend(wagonRecords, 2026)
    expect(spend).toMatchObject({ year: 2026, total: 371.5, count: 4 })
    expect(spend.categories.map((c) => [c.categoryId, c.amount, c.count])).toEqual([
      ['brakes', 285, 1],
      ['oil', 58, 1],
      ['filters', 28.5, 1],
      ['tires', 0, 1],
    ])
    expect(spend.categories[0].share).toBeCloseTo(285 / 371.5)
    expect(spend.categories.reduce((sum, c) => sum + c.share, 0)).toBeCloseTo(1)
  })

  it('shares a record\'s cost equally between its categories', () => {
    const spend = getYearlyServiceSpend([record(1, TODAY, ['Brake pads', 'Tire rotation', 'Brake rotors'], 100)], 2026)
    expect(spend.categories).toEqual([
      { categoryId: 'brakes', amount: 50, share: 0.5, count: 1 },
      { categoryId: 'tires', amount: 50, share: 0.5, count: 1 },
    ])
  })

  it('rounds each category to the cent and keeps the total exact', () => {
    const spend = getYearlyServiceSpend([record(1, TODAY, ['Oil + filter change', 'Brake pads', 'Tire rotation'], 100)], 2026)
    expect(spend.total).toBe(100)
    expect(spend.categories.map((c) => c.amount)).toEqual([33.33, 33.33, 33.33])
  })

  it('leaves out other years and malformed dates, and counts a cost that isn\'t a number as $0', () => {
    const records = [
      record(1, '2025-12-31', ['Brake pads'], 400),
      record(2, '2027-01-01', ['Brake pads'], 400),
      record(3, '2026-13-01', ['Brake pads'], 400),
      record(4, '2026-01-01', ['Battery'], null),
      record(5, '2026-12-31', ['Battery'], 120),
    ]
    expect(getYearlyServiceSpend(records, 2026)).toEqual({
      year: 2026,
      total: 120,
      count: 2,
      categories: [{ categoryId: 'electrical', amount: 120, share: 1, count: 2 }],
    })
  })

  it('returns an empty year', () => {
    expect(getYearlyServiceSpend([], 2026)).toEqual({ year: 2026, total: 0, count: 0, categories: [] })
    expect(getYearlyServiceSpend([record(1, TODAY, ['Tire rotation'], 0)], 2026).categories).toEqual([
      { categoryId: 'tires', amount: 0, share: 0, count: 1 },
    ])
  })
})

describe('parseBaseline', () => {
  const context = { needsOdometer: true, currentOdometer: 84210, today: TODAY }

  it('returns the baseline date and reading', () => {
    expect(parseBaseline({ date: '2025-03-01', odometer: '40000' }, context)).toEqual({ baselineDate: '2025-03-01', baselineOdometer: 40000 })
    expect(parseBaseline({ date: TODAY, odometer: '84,210' }, context)).toEqual({ baselineDate: TODAY, baselineOdometer: 84210 })
  })

  it('allows a date and reading from before the purchase', () => {
    expect(parseBaseline({ date: '2019-06-01', odometer: '12000' }, context)).toEqual({ baselineDate: '2019-06-01', baselineOdometer: 12000 })
  })

  it('needs a real date that has already happened', () => {
    expect(parseBaseline({ date: '', odometer: '40000' }, context)).toEqual({ error: 'Enter the date it was last done.', field: 'date' })
    expect(parseBaseline({ date: '2025-02-30', odometer: '40000' }, context)).toEqual({ error: 'Enter a real date.', field: 'date' })
    expect(parseBaseline({ date: '2026-09-27', odometer: '40000' }, context)).toEqual({ error: "That date hasn't happened yet.", field: 'date' })
  })

  it('needs a whole-mile reading no higher than the current one when the interval has a miles limit', () => {
    expect(parseBaseline({ date: '2025-03-01', odometer: '' }, context)).toEqual({ error: 'Enter the odometer reading it was done at.', field: 'odometer' })
    expect(parseBaseline({ date: '2025-03-01', odometer: '40k' }, context)).toEqual({ error: 'Enter whole miles.', field: 'odometer' })
    expect(parseBaseline({ date: '2025-03-01', odometer: '-5' }, context)).toEqual({ error: 'Enter whole miles.', field: 'odometer' })
    expect(parseBaseline({ date: '2025-03-01', odometer: '90000' }, context)).toEqual({ error: "That's past the current 84,210 mi.", field: 'odometer' })
  })

  it('makes the reading optional for a months-only interval', () => {
    expect(parseBaseline({ date: '2025-03-01', odometer: ' ' }, { ...context, needsOdometer: false })).toEqual({ baselineDate: '2025-03-01', baselineOdometer: null })
  })

  it('skips the current-reading check when the vehicle has none', () => {
    expect(parseBaseline({ date: '2025-03-01', odometer: '90000' }, { ...context, currentOdometer: 0 })).toEqual({ baselineDate: '2025-03-01', baselineOdometer: 90000 })
  })
})

describe('getNextDueAfterService', () => {
  it('measures the next due point from the service being logged', () => {
    expect(getNextDueAfterService(DEFAULT_INTERVALS, { services: ['Oil + filter change'], date: TODAY, odometer: 84210 })).toEqual([
      {
        intervalId: 1,
        name: 'Oil + filter',
        rule: 'every 5,000 mi or 12 mo, whichever comes first',
        dueOdometer: 89210,
        dueDate: '2027-09-26',
        label: 'at 89,210 mi or on Sep 26, 2027',
      },
    ])
  })

  it('only includes the intervals the services reset (D10)', () => {
    const next = getNextDueAfterService(DEFAULT_INTERVALS, { services: ['Brake pads', 'Tire rotation'], date: TODAY, odometer: 84210 })
    expect(next.map((n) => [n.name, n.rule, n.label])).toEqual([['Tire rotation', 'every 5,000 mi', 'at 89,210 mi']])
  })

  it('counts miles from the service while there is no reading', () => {
    const [oil] = getNextDueAfterService(DEFAULT_INTERVALS, { services: ['Oil + filter change'], date: TODAY, odometer: null })
    expect(oil).toMatchObject({ dueOdometer: null, label: 'in 5,000 mi or on Sep 26, 2027' })
  })

  it('leaves out a months-only interval until there is a date', () => {
    const service = { services: ['Cabin air filter'], odometer: 84210 }
    expect(getNextDueAfterService(DEFAULT_INTERVALS, { ...service, date: '' })).toEqual([])
    expect(getNextDueAfterService(DEFAULT_INTERVALS, { ...service, date: TODAY })[0]).toMatchObject({
      dueDate: '2028-09-26',
      label: 'on Sep 26, 2028',
      rule: 'every 24 mo',
    })
  })

  it('returns nothing when no service is picked', () => {
    expect(getNextDueAfterService(DEFAULT_INTERVALS, { services: [], date: TODAY, odometer: 84210 })).toEqual([])
  })
})
