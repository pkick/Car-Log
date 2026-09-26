import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  computeFillMpg,
  getAllInCostPerMile,
  getDrivingRate,
  getDueSoonItems,
  getFuelStats,
  formatIntervalRule,
  formatLastReading,
  getLastReading,
  getMonthlyFuelAverages,
  getMonthlySpendByCategory,
  getMonthToDateSpend,
  getMpgTrend,
  getPriceHistory,
  getServiceHistorySorted,
  getStationInsights,
  recordResetsInterval,
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

const DEFAULT_INTERVALS = [
  { id: 1, categoryId: 'oil', name: 'Oil + filter', services: ['Oil + filter change'], miles: 5000, months: 12, warnMiles: 500, warnDays: 14 },
  { id: 2, categoryId: 'tires', name: 'Tire rotation', services: ['Tire rotation'], miles: 5000, months: null, warnMiles: 500, warnDays: 14 },
  { id: 3, categoryId: 'brakes', name: 'Brake fluid', services: ['Brake fluid'], miles: 30000, months: 36, warnMiles: 1000, warnDays: 30 },
  { id: 4, categoryId: 'filters', name: 'Cabin air filter', services: ['Cabin air filter'], miles: null, months: 24, warnMiles: 750, warnDays: 21 },
]

const serviced = (date, odometer, services, categoryId = 'other') => ({ date, odometer, services, categoryId, cost: 0 })

// The seeded Wagon and Truck, on 2026-09-25.
const wagon = { intervals: DEFAULT_INTERVALS, purchaseDate: '2021-04-02', purchaseOdometer: 41880 }
const wagonRecords = [
  serviced('2026-02-01', 76800, ['Tire rotation'], 'tires'),
  serviced('2026-04-22', 79630, ['Oil + filter change'], 'oil'),
  serviced('2026-05-01', 80105, ['Air filter'], 'filters'),
  serviced('2026-06-10', 81890, ['Brake pads'], 'brakes'),
]
const truck = { intervals: DEFAULT_INTERVALS, purchaseDate: '2022-09-10', purchaseOdometer: 18500 }
const truckRecords = [
  serviced('2026-04-10', 43230, ['Oil + filter change'], 'oil'),
  serviced('2026-06-01', 45300, ['Cabin air filter'], 'filters'),
  serviced('2026-07-20', 46700, ['Tire rotation'], 'tires'),
]

const dueItem = (items, name) => items.find((item) => item.name === name)

describe('recordResetsInterval', () => {
  const brakeFluid = DEFAULT_INTERVALS[2]
  const tireRotation = DEFAULT_INTERVALS[1]
  const cabinFilter = DEFAULT_INTERVALS[3]

  it('matches when one of the record\'s services is in the interval\'s list', () => {
    expect(recordResetsInterval({ services: ['Brake fluid'] }, brakeFluid)).toBe(true)
    expect(recordResetsInterval({ services: ['Brake pads', 'Tire rotation'] }, tireRotation)).toBe(true)
  })

  it('does not let brake pads reset Brake fluid, or Air filter reset Cabin air filter', () => {
    expect(recordResetsInterval({ services: ['Brake pads'], categoryId: 'brakes' }, brakeFluid)).toBe(false)
    expect(recordResetsInterval({ services: ['Air filter'], categoryId: 'filters' }, cabinFilter)).toBe(false)
  })

  it('never reads the record\'s categoryId', () => {
    expect(recordResetsInterval({ services: ['Brake pads'], categoryId: 'tires' }, tireRotation)).toBe(false)
    expect(recordResetsInterval({ services: ['Tire repair'], categoryId: 'tires' }, { categoryId: 'tires', services: [] })).toBe(true)
    expect(recordResetsInterval({ services: ['Brake pads'], categoryId: 'tires' }, { categoryId: 'tires', services: [] })).toBe(false)
  })

  it('falls back to any service in the interval\'s category when its list is empty or missing', () => {
    expect(recordResetsInterval({ services: ['Tire replacement'] }, { categoryId: 'tires', services: [] })).toBe(true)
    expect(recordResetsInterval({ services: ['Oil only (top-off)'] }, { categoryId: 'oil' })).toBe(true)
    expect(recordResetsInterval({ services: ['Brake pads'] }, { categoryId: 'oil' })).toBe(false)
  })

  it('does not match a record without services', () => {
    expect(recordResetsInterval({ categoryId: 'tires' }, tireRotation)).toBe(false)
    expect(recordResetsInterval({ categoryId: 'tires' }, { categoryId: 'tires' })).toBe(false)
  })
})

describe('getDueSoonItems', () => {
  const interval = { id: 1, categoryId: 'filters', name: 'Test', services: ['Cabin air filter'], miles: null, months: 12, warnMiles: 0, warnDays: 0 }
  const vehicle = { intervals: [interval] }
  const records = [serviced('2026-01-31', 1000, ['Cabin air filter'], 'filters')]

  const onSep25 = () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 25, 12))
  }

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

  it('does not let a Brake pads record reset Brake fluid', () => {
    onSep25()
    const before = dueItem(getDueSoonItems(wagon, wagonRecords, 84210), 'Brake fluid')
    const after = dueItem(getDueSoonItems(wagon, [...wagonRecords, serviced('2026-09-25', 84210, ['Brake pads'], 'brakes')], 84210), 'Brake fluid')
    expect(before.lastServiceDate).toBeNull()
    expect(before.status).toBe('overdue')
    expect(after).toEqual(before)
  })

  it('resets Tire rotation from a record with Brake pads + Tire rotation', () => {
    onSep25()
    expect(dueItem(getDueSoonItems(wagon, wagonRecords, 84210), 'Tire rotation').status).toBe('overdue')

    const both = serviced('2026-09-25', 84210, ['Brake pads', 'Tire rotation'], 'brakes')
    const item = dueItem(getDueSoonItems(wagon, [...wagonRecords, both], 84210), 'Tire rotation')
    expect(item).toMatchObject({ status: 'ok', milesRemaining: 5000, progress: 0, lastServiceDate: '2026-09-25', remainingLabel: '5,000 mi' })
  })

  it('does not let an Air filter record reset Cabin air filter', () => {
    onSep25()
    const item = dueItem(getDueSoonItems(wagon, wagonRecords, 84210), 'Cabin air filter')
    expect(item.lastServiceDate).toBeNull()
    expect(item.dueDate).toBe('2023-04-02')
    expect(item.status).toBe('overdue')
  })

  it('falls back to the interval\'s category when its services list is empty or missing', () => {
    onSep25()
    const legacy = { id: 9, categoryId: 'tires', name: 'Tires', miles: 5000, months: null, warnMiles: 500, warnDays: 14 }
    const records = [serviced('2026-09-01', 84000, ['Tire replacement'], 'tires'), serviced('2026-09-20', 84100, ['Brake pads'], 'tires')]

    for (const interval of [legacy, { ...legacy, services: [] }]) {
      const [item] = getDueSoonItems({ intervals: [interval] }, records, 84210)
      expect(item).toMatchObject({ lastServiceOdometer: 84000, milesRemaining: 4790 })
    }
  })

  it('reports the due reading, due date and progress of a miles-and-months interval', () => {
    onSep25()
    const oil = dueItem(getDueSoonItems(wagon, wagonRecords, 84210), 'Oil + filter')
    expect(oil).toMatchObject({ dueOdometer: 84630, dueDate: '2027-04-22', milesRemaining: 420, status: 'coming-up' })
    // 4,580 of 5,000 mi beats 156 of 365 days.
    expect(oil.progress).toBeCloseTo(0.916)
    expect(oil.remainingLabel).toBe('420 mi')
  })

  it('reports a due date and day-based progress for a months-only interval', () => {
    onSep25()
    const filter = dueItem(getDueSoonItems(truck, truckRecords, 47850), 'Cabin air filter')
    expect(filter).toMatchObject({ dueOdometer: null, dueDate: '2028-06-01', milesRemaining: null, status: 'ok' })
    // 116 of 731 days (2028 is a leap year).
    expect(filter.progress).toBeCloseTo(116 / 731)
    expect(filter.remainingLabel).toBe('~88 wks')
  })

  it('reports no due date for a miles-only interval', () => {
    onSep25()
    const tires = dueItem(getDueSoonItems(truck, truckRecords, 47850), 'Tire rotation')
    expect(tires).toMatchObject({ dueOdometer: 51700, dueDate: null, milesRemaining: 3850 })
    expect(tires.progress).toBeCloseTo(0.23)
  })

  it('measures from the purchase when nothing has reset the interval', () => {
    onSep25()
    const fluid = dueItem(getDueSoonItems(truck, truckRecords, 47850), 'Brake fluid')
    expect(fluid).toMatchObject({ dueOdometer: 48500, dueDate: '2025-09-10', milesRemaining: 650, lastServiceOdometer: null })
    // 1,476 of 1,096 days since purchase beats 29,350 of 30,000 mi.
    expect(fluid.progress).toBeCloseTo(1476 / 1096)
  })

  it('labels an interval overdue by date with the day it came due, not its remaining miles', () => {
    onSep25()
    const fluid = dueItem(getDueSoonItems(truck, truckRecords, 47850), 'Brake fluid')
    expect(fluid.status).toBe('overdue')
    expect(fluid.remainingLabel).toBe('Overdue since Sep 10, 2025')
  })

  it('leaves the year out of an overdue date in the current year', () => {
    onSep25()
    const [item] = getDueSoonItems(vehicle, [serviced('2025-03-03', 1000, ['Cabin air filter'])], 1000)
    expect(item.remainingLabel).toBe('Overdue since Mar 3')
  })

  it('counts days under two weeks from a date limit, and weeks after that', () => {
    onSep25()
    const labelFrom = (date) => getDueSoonItems(vehicle, [serviced(date, 1000, ['Cabin air filter'])], 1000)[0].remainingLabel
    expect(labelFrom('2025-09-26')).toBe('1 day')
    expect(labelFrom('2025-10-08')).toBe('13 days')
    expect(labelFrom('2025-10-09')).toBe('~2 wks')
    expect(labelFrom('2025-11-20')).toBe('~8 wks')
  })

  it('labels by miles when the miles limit is further along', () => {
    onSep25()
    const tires = dueItem(getDueSoonItems(wagon, wagonRecords, 84210), 'Tire rotation')
    expect(tires.remainingLabel).toBe('Due 2,410 mi ago')
    expect(tires.progress).toBeCloseTo(7410 / 5000)
  })

  it('takes today as an argument, so it needs no clock', () => {
    const [before] = getDueSoonItems(vehicle, records, 1000, '2027-01-30')
    const [on] = getDueSoonItems(vehicle, records, 1000, '2027-01-31')
    expect(before.status).not.toBe('overdue')
    expect(on).toMatchObject({ status: 'overdue', remainingLabel: 'Overdue since Jan 31' })
    expect(getDueSoonItems(vehicle, records, 1000, '2028-02-01')[0].remainingLabel).toBe('Overdue since Jan 31, 2027')
  })

  it('says which limit the labels describe', () => {
    onSep25()
    const byName = Object.fromEntries(getDueSoonItems(wagon, wagonRecords, 84210).map((i) => [i.name, i.dueBy]))
    expect(byName).toEqual({ 'Oil + filter': 'miles', 'Tire rotation': 'miles', 'Brake fluid': 'date', 'Cabin air filter': 'date' })
    expect(getDueSoonItems({ intervals: [{ ...interval, months: null }] }, records, 1000)[0].dueBy).toBeNull()
  })

  it('sorts overdue items first, then by highest progress', () => {
    onSep25()
    const items = getDueSoonItems(wagon, wagonRecords, 84210)
    expect(items.map((i) => [i.name, i.status])).toEqual([
      ['Cabin air filter', 'overdue'],
      ['Brake fluid', 'overdue'],
      ['Tire rotation', 'overdue'],
      ['Oil + filter', 'coming-up'],
    ])
  })

  it('gives an interval with no limits zero progress and a placeholder label', () => {
    onSep25()
    const [item] = getDueSoonItems({ intervals: [{ ...interval, months: null }] }, records, 1000)
    expect(item).toMatchObject({ status: 'ok', progress: 0, dueDate: null, dueOdometer: null, remainingLabel: '—', dueLabel: null })
  })

  it('labels the last service and the due reading when the miles limit is closer', () => {
    onSep25()
    const oil = dueItem(getDueSoonItems(wagon, wagonRecords, 84210), 'Oil + filter')
    expect(oil).toMatchObject({ lastLabel: 'Apr 22 · 79,630', dueLabel: 'due 84,630' })
  })

  it('labels the due date, with the year outside this one, when the date limit is closer', () => {
    onSep25()
    const filter = dueItem(getDueSoonItems(truck, truckRecords, 47850), 'Cabin air filter')
    expect(filter).toMatchObject({ lastLabel: 'Jun 1 · 45,300', dueLabel: 'due Jun 1, 2028' })
  })

  it('labels an interval measured from the purchase', () => {
    onSep25()
    const fluid = dueItem(getDueSoonItems(truck, truckRecords, 47850), 'Brake fluid')
    expect(fluid).toMatchObject({ lastLabel: 'Since purchase', dueLabel: 'due Sep 10, 2025' })
  })

  it('puts the year on a last service from another year', () => {
    onSep25()
    const [item] = getDueSoonItems(vehicle, [serviced('2025-03-03', 1000, ['Cabin air filter'])], 1000)
    expect(item.lastLabel).toBe('Mar 3, 2025 · 1,000')
  })

  const withBaseline = (base, name, baseline) => ({
    ...base,
    intervals: base.intervals.map((i) => (i.name === name ? { ...i, ...baseline } : i)),
  })

  it('says what each interval is measured from', () => {
    onSep25()
    const items = getDueSoonItems(withBaseline(truck, 'Brake fluid', { baselineDate: '2025-03-01', baselineOdometer: 40000 }), truckRecords, 47850)
    expect(dueItem(items, 'Oil + filter').measuredFrom).toBe('record')
    expect(dueItem(items, 'Brake fluid').measuredFrom).toBe('baseline')
    expect(dueItem(getDueSoonItems(truck, truckRecords, 47850), 'Brake fluid').measuredFrom).toBe('purchase')
  })

  it('measures from the baseline date and reading in place of the purchase', () => {
    onSep25()
    const vehicle = withBaseline(truck, 'Brake fluid', { baselineDate: '2025-03-01', baselineOdometer: 40000 })
    const fluid = dueItem(getDueSoonItems(vehicle, truckRecords, 47850), 'Brake fluid')
    expect(fluid).toMatchObject({
      status: 'ok',
      dueOdometer: 70000,
      dueDate: '2028-03-01',
      milesRemaining: 22150,
      lastServiceDate: null,
      lastServiceOdometer: null,
    })
    // 573 of 1,096 days beats 7,850 of 30,000 mi.
    expect(fluid.progress).toBeCloseTo(573 / 1096)
  })

  it('labels the baseline as where the interval is measured from', () => {
    onSep25()
    const vehicle = withBaseline(truck, 'Brake fluid', { baselineDate: '2025-03-01', baselineOdometer: 40000 })
    const fluid = dueItem(getDueSoonItems(vehicle, truckRecords, 47850), 'Brake fluid')
    expect(fluid).toMatchObject({ lastLabel: 'Mar 1, 2025 · 40,000', dueLabel: 'due Mar 1, 2028' })

    const thisYear = withBaseline(truck, 'Brake fluid', { baselineDate: '2026-02-10', baselineOdometer: 41000 })
    expect(dueItem(getDueSoonItems(thisYear, truckRecords, 47850), 'Brake fluid').lastLabel).toBe('Feb 10 · 41,000')
  })

  it('ignores the baseline once a record resets the interval', () => {
    onSep25()
    const vehicle = withBaseline(wagon, 'Tire rotation', { baselineDate: '2026-09-01', baselineOdometer: 84000 })
    const tires = dueItem(getDueSoonItems(vehicle, wagonRecords, 84210), 'Tire rotation')
    expect(tires).toMatchObject({ measuredFrom: 'record', lastLabel: 'Feb 1 · 76,800', status: 'overdue', dueOdometer: 81800 })
  })

  it('falls back to the purchase for whichever half of the baseline is missing or malformed', () => {
    onSep25()
    const dateOnly = dueItem(getDueSoonItems(withBaseline(truck, 'Brake fluid', { baselineDate: '2025-03-01' }), truckRecords, 47850), 'Brake fluid')
    expect(dateOnly).toMatchObject({ measuredFrom: 'baseline', dueDate: '2028-03-01', dueOdometer: 48500, lastLabel: 'Mar 1, 2025' })

    const malformed = withBaseline(truck, 'Brake fluid', { baselineDate: '2025-02-30', baselineOdometer: -5 })
    expect(dueItem(getDueSoonItems(malformed, truckRecords, 47850), 'Brake fluid')).toMatchObject({
      measuredFrom: 'purchase',
      lastLabel: 'Since purchase',
      dueDate: '2025-09-10',
    })
  })
})

describe('formatIntervalRule', () => {
  it('names the miles and months limits, whichever the interval has', () => {
    expect(formatIntervalRule({ miles: 5000, months: 12 })).toBe('every 5,000 mi or 12 mo')
    expect(formatIntervalRule({ miles: 5000, months: null })).toBe('every 5,000 mi')
    expect(formatIntervalRule({ miles: null, months: 24 })).toBe('every 24 mo')
    expect(formatIntervalRule({ miles: null, months: null })).toBe('')
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

const tank = (id, date, odometer, gallons, isFull = true) => ({ id, date, odometer, gallons, pricePerGal: 3, total: gallons * 3, isFull })

// The seeded Wagon's fill-ups: partial fills on May 30 and Aug 10.
const wagonFills = [
  tank(1, '2026-04-24', 79710, 15.9),
  tank(2, '2026-05-06', 80210, 15.9),
  tank(3, '2026-05-18', 80710, 15.9),
  tank(4, '2026-05-30', 80960, 8.0, false),
  tank(5, '2026-06-11', 81460, 15.9),
  tank(6, '2026-06-23', 81960, 15.9),
  tank(7, '2026-07-05', 82460, 16.0),
  tank(8, '2026-07-17', 82960, 15.8),
  tank(9, '2026-07-29', 83460, 16.1),
  tank(10, '2026-08-10', 83710, 8.2, false),
  tank(11, '2026-08-28', 84210, 15.9),
]

describe('getMpgTrend', () => {
  it('marks the tank a partial fill was added into, and only that tank', () => {
    const fills = [tank(1, '2026-01-01', 1000, 10), tank(2, '2026-01-05', 1150, 4, false), tank(3, '2026-01-10', 1300, 6), tank(4, '2026-01-20', 1600, 10)]
    expect(getMpgTrend(fills).points).toEqual([
      { id: 3, date: '2026-01-10', mpg: 30, includesPartial: true },
      { id: 4, date: '2026-01-20', mpg: 30, includesPartial: false },
    ])
  })

  it('does not mark a tank for a partial fill before the first full fill', () => {
    const fills = [tank(1, '2026-01-01', 900, 5, false), tank(2, '2026-01-05', 1000, 10), tank(3, '2026-01-10', 1300, 10)]
    expect(getMpgTrend(fills).points).toEqual([{ id: 3, date: '2026-01-10', mpg: 30, includesPartial: false }])
  })

  it('marks the seeded Wagon\'s Jun 11 and Aug 28 tanks, and averages all of them', () => {
    const { points, average } = getMpgTrend([...wagonFills].reverse())
    expect(points.map((p) => p.date)).toEqual(['2026-05-06', '2026-05-18', '2026-06-11', '2026-06-23', '2026-07-05', '2026-07-17', '2026-07-29', '2026-08-28'])
    expect(points.filter((p) => p.includesPartial).map((p) => p.id)).toEqual([5, 11])
    expect(points.map((p) => p.mpg)).toEqual([31.4, 31.4, 31.4, 31.4, 31.3, 31.6, 31.1, 31.1])
    expect(average).toBe(31.3)
  })

  it('keeps only the latest tanks', () => {
    const fills = Array.from({ length: 15 }, (_, i) => tank(i + 1, `2026-01-${String(i + 10).padStart(2, '0')}`, 1000 + i * 300, 10))
    expect(getMpgTrend(fills, { tanks: 12 }).points.map((p) => p.id)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
    expect(getMpgTrend(fills.slice(0, 5), { tanks: 12 }).points).toHaveLength(4)
  })

  it('keeps tanks closed in the last N days, today included and later dates left out', () => {
    const fills = [
      tank(1, '2026-03-20', 1000, 10),
      tank(2, '2026-03-27', 1300, 10),
      tank(3, '2026-03-28', 1600, 10),
      tank(4, '2026-09-26', 1900, 10),
      tank(5, '2026-09-27', 2200, 10),
    ]
    expect(getMpgTrend(fills, { days: 182 }, '2026-09-26').points.map((p) => p.id)).toEqual([3, 4])
  })

  it('averages only the tanks it returns, to one decimal place', () => {
    const fills = [tank(1, '2026-01-01', 1000, 10), tank(2, '2026-01-10', 1500, 10), tank(3, '2026-01-20', 1800, 10), tank(4, '2026-01-30', 2110, 10), tank(5, '2026-02-09', 2443, 10)]
    // 50, 30, 31 and 33.3 mpg; the last three average 31.43.
    expect(getMpgTrend(fills, { tanks: 3 }).average).toBe(31.4)
  })

  it('orders tanks by date and leaves out one closed on a malformed date', () => {
    const fills = [tank(1, '2026-02-01', 1000, 10), tank(2, '', 1300, 10), tank(3, '2026-02-20', 1600, 10)]
    expect(getMpgTrend(fills).points.map((p) => p.id)).toEqual([3])
  })

  it('returns no points and a null average for an empty log or a single fill', () => {
    expect(getMpgTrend([])).toEqual({ points: [], average: null })
    expect(getMpgTrend([tank(1, '2026-01-01', 1000, 10)])).toEqual({ points: [], average: null })
  })
})

describe('getMonthlySpendByCategory', () => {
  const zero = { fuel: 0, service: 0, insurance: 0, registration: 0, total: 0 }

  it('returns the 12 calendar months ending in the current one, oldest first', () => {
    const months = getMonthlySpendByCategory([], [], [], 12, '2026-09-26')
    expect(months.map((m) => m.month)).toEqual([
      '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03',
      '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09',
    ])
    expect(months.every((m) => JSON.stringify({ ...m, month: undefined }) === JSON.stringify(zero))).toBe(true)
  })

  it('splits each month into fuel, service, insurance and registration', () => {
    const fills = [{ date: '2026-05-06', total: 52.63 }, { date: '2026-05-18', total: 53.27 }]
    const services = [{ date: '2026-05-01', cost: 28.5 }]
    const policies = [
      { type: 'insurance', date: '2026-05-14', cost: 612 },
      { type: 'registration', date: '2026-03-15', cost: 145 },
    ]
    const months = getMonthlySpendByCategory(fills, services, policies, 12, '2026-09-26')
    expect(months.find((m) => m.month === '2026-05')).toEqual({
      month: '2026-05', fuel: 105.9, service: 28.5, insurance: 612, registration: 0, total: 746.4,
    })
    expect(months.find((m) => m.month === '2026-03')).toMatchObject({ registration: 145, total: 145 })
  })

  it('counts a policy payment in the month of its date, not its renewal', () => {
    const policies = [{ type: 'insurance', date: '2026-08-01', cost: 780, renewalDate: '2027-02-01' }]
    const months = getMonthlySpendByCategory([], [], policies, 12, '2026-09-26')
    expect(months.filter((m) => m.total > 0)).toEqual([{ month: '2026-08', ...zero, insurance: 780, total: 780 }])
  })

  it('leaves out records outside the window or with a malformed date, and unknown policy types', () => {
    const fills = [{ date: '2025-09-30', total: 99 }, { date: '2026-10-01', total: 99 }, { date: '', total: 99 }, { date: '2026-09-02', total: 40 }]
    const policies = [{ type: 'roadside', date: '2026-09-01', cost: 99 }]
    const months = getMonthlySpendByCategory(fills, [], policies, 12, '2026-09-26')
    expect(months.reduce((sum, m) => sum + m.total, 0)).toBe(40)
  })

  it('crosses the year boundary from the 31st', () => {
    expect(getMonthlySpendByCategory([], [], [], 3, '2026-01-31').map((m) => m.month)).toEqual(['2025-11', '2025-12', '2026-01'])
    expect(getMonthlySpendByCategory([], [], [], 3, '2026-03-31').map((m) => m.month)).toEqual(['2026-01', '2026-02', '2026-03'])
  })

  it('rounds to the cent', () => {
    const fills = [{ date: '2026-09-01', total: 0.1 }, { date: '2026-09-02', total: 0.2 }]
    expect(getMonthlySpendByCategory(fills, [], [], 1, '2026-09-26')).toEqual([{ month: '2026-09', ...zero, fuel: 0.3, total: 0.3 }])
  })

  it('uses the local date by default', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 30, 23))
    expect(getMonthlySpendByCategory([], [], []).at(-1).month).toBe('2026-09')
  })
})

describe('getAllInCostPerMile', () => {
  const fuel = (date, odometer, total) => ({ date, odometer, total })
  const service = (date, odometer, cost) => ({ date, odometer, cost })
  const policy = (type, date, cost) => ({ type, date, cost })

  it('matches the seeded Wagon over the rolling 90 days: Jul 5 to Aug 28, 1,750 mi', () => {
    const fills = wagonFills.map((f, i) => ({ ...f, total: [52.15, 52.63, 53.27, 26.4, 54.38, 53.9, 55.04, 54.67, 54.9, 27.72, 55.01][i] }))
    const result = getAllInCostPerMile(fills, wagonRecords, [policy('insurance', '2026-05-14', 612)], 90, '2026-09-26')
    expect(result).toEqual({
      costPerMile: 0.14,
      miles: 1750,
      firstDate: '2026-07-05',
      lastDate: '2026-08-28',
      spend: { fuel: 247.34, service: 0, insurance: 0, registration: 0, total: 247.34 },
      percent: { fuel: 100, service: 0, policies: 0 },
    })
  })

  it('adds service, insurance and registration spend dated in the window', () => {
    const fills = [fuel('2026-07-01', 1000, 50), fuel('2026-08-01', 2000, 50)]
    const services = [service('2026-07-15', 1500, 100), service('2026-06-27', 900, 999)]
    const policies = [policy('insurance', '2026-08-10', 600), policy('registration', '2026-09-01', 200), policy('registration', '2026-06-01', 150)]
    const result = getAllInCostPerMile(fills, services, policies, 90, '2026-09-26')
    expect(result).toMatchObject({
      costPerMile: 1,
      miles: 1000,
      spend: { fuel: 100, service: 100, insurance: 600, registration: 200, total: 1000 },
      percent: { fuel: 10, service: 10, policies: 80 },
    })
  })

  it('takes miles from service readings as well as fill-ups', () => {
    const result = getAllInCostPerMile([fuel('2026-09-01', 5000, 60)], [service('2026-09-10', 5300, 0), service('2026-08-20', 4900, 30)], [], 90, '2026-09-26')
    expect(result).toMatchObject({ miles: 400, firstDate: '2026-08-20', lastDate: '2026-09-10', costPerMile: 0.23 })
  })

  it('returns null with fewer than two readings in the window, or no miles between them', () => {
    expect(getAllInCostPerMile([], [], [], 90, '2026-09-26')).toBeNull()
    expect(getAllInCostPerMile([fuel('2026-01-01', 1000, 40), fuel('2026-09-01', 2000, 40)], [], [], 90, '2026-09-26')).toBeNull()
    expect(getAllInCostPerMile([fuel('2026-09-01', 2000, 40), fuel('2026-09-02', 2000, 40)], [], [], 90, '2026-09-26')).toBeNull()
  })

  it('ignores missing and zero readings, but still counts their spend', () => {
    const fills = [fuel('2026-09-01', 2000, 40), fuel('2026-09-10', 2400, 40)]
    const services = [service('2026-09-05', 0, 120), service('2026-09-06', null, 40)]
    expect(getAllInCostPerMile(fills, services, [], 90, '2026-09-26')).toMatchObject({ miles: 400, costPerMile: 0.6 })
    expect(getAllInCostPerMile(fills.slice(0, 1), services, [], 90, '2026-09-26')).toBeNull()
  })

  it('covers all time up to today by default, leaving out later and malformed dates', () => {
    const fills = [fuel('2021-04-02', 1000, 50), fuel('2026-09-26', 3000, 50), fuel('2026-09-27', 9000, 999), fuel('', 9999, 999)]
    expect(getAllInCostPerMile(fills, [], [], undefined, '2026-09-26')).toMatchObject({ miles: 2000, costPerMile: 0.05, firstDate: '2021-04-02' })
  })

  it('splits the percentages so they add up to 100', () => {
    const fills = [fuel('2026-09-01', 1000, 1), fuel('2026-09-02', 1100, 0)]
    const result = getAllInCostPerMile(fills, [service('2026-09-03', 1050, 1)], [policy('insurance', '2026-09-04', 0.5), policy('registration', '2026-09-05', 0.5)], 90, '2026-09-26')
    expect(result.percent).toEqual({ fuel: 34, service: 33, policies: 33 })
  })
})

describe('getStationInsights', () => {
  const at = (station, date, gallons, pricePerGal) => ({ station, date, gallons, pricePerGal, total: gallons * pricePerGal, odometer: 0, isFull: true })

  const fills = [
    at('Costco · 3rd St', '2026-07-01', 10, 3.0),
    at('Shell', '2026-07-08', 10, 3.4),
    at('Costco · 3rd St', '2026-07-15', 5, 3.3),
    at('Chevron', '2026-07-22', 8, 3.2),
    at('Shell', '2026-07-29', 12, 3.5),
    at(null, '2026-08-05', 10, 2.5),
  ]

  it('averages the price per gallon at each station, cheapest first, with the fill count', () => {
    const { stations } = getStationInsights(fills)
    expect(stations.map((s) => [s.station, s.fills])).toEqual([['Costco · 3rd St', 2], ['Chevron', 1], ['Shell', 2]])
    expect(stations[0].averagePrice).toBeCloseTo(3.1)
    expect(stations[1].averagePrice).toBeCloseTo(3.2)
    expect(stations[2].averagePrice).toBeCloseTo(3.4545, 3)
  })

  it('weights the average by gallons, so a small fill counts less', () => {
    // (10 × $3.00 + 5 × $3.30) / 15 gal, not the $3.15 mean of the two prices.
    expect(getStationInsights(fills).stations[0].averagePrice).toBeCloseTo(3.1)
  })

  it('returns the cheapest station', () => {
    expect(getStationInsights(fills).cheapest).toMatchObject({ station: 'Costco · 3rd St', fills: 2 })
  })

  it('groups names ignoring case and surrounding spaces, showing the latest spelling', () => {
    const { stations } = getStationInsights([at('costco ', '2026-07-01', 10, 3), at(' Costco', '2026-07-15', 10, 3.2), at('COSTCO', '2026-07-08', 10, 3.1)])
    expect(stations).toHaveLength(1)
    expect(stations[0]).toMatchObject({ station: 'Costco', fills: 3 })
    expect(stations[0].averagePrice).toBeCloseTo(3.1)
  })

  it('leaves out fills without a station, gallons or price', () => {
    const { stations } = getStationInsights([
      at('', '2026-07-01', 10, 2),
      at('   ', '2026-07-01', 10, 2),
      { date: '2026-07-01', gallons: 10, pricePerGal: 2 },
      at('Arco', '2026-07-01', 0, 2),
      at('Arco', '2026-07-02', 10, null),
      at('Arco', '2026-07-03', 10, 3.6),
    ])
    expect(stations).toEqual([{ station: 'Arco', averagePrice: 3.6, fills: 1 }])
  })

  it('puts the station with more fill-ups first on a tie', () => {
    const { stations } = getStationInsights([at('B', '2026-07-01', 10, 3), at('A', '2026-07-02', 10, 3), at('B', '2026-07-03', 10, 3)])
    expect(stations.map((s) => s.station)).toEqual(['B', 'A'])
  })

  it('returns no stations and no cheapest when no fill-up has a station', () => {
    expect(getStationInsights(wagonFills)).toEqual({ stations: [], cheapest: null })
    expect(getStationInsights([])).toEqual({ stations: [], cheapest: null })
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
    const records = [{ categoryId: 'oil', date: '', odometer: 900, cost: 50, services: ['Oil + filter change'] }]
    const vehicle = {
      intervals: [{ id: 1, categoryId: 'oil', name: 'Test', services: ['Oil + filter change'], miles: 5000, months: 6, warnMiles: 500, warnDays: 30 }],
    }

    expect(getFuelStats(fills).spendThisMonth).toBe(40)
    expect(getMonthlySpendByCategory(fills, records, [{ type: 'insurance', date: '', cost: 500 }]).at(-1)).toEqual({
      month: '2026-09', fuel: 40, service: 0, insurance: 0, registration: 0, total: 40,
    })
    expect(getDueSoonItems(vehicle, records, 1300)[0]).toMatchObject({ milesRemaining: 4600, lastLabel: '900' })
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
