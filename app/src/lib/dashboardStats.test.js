import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_RANGES,
  DAYS_PER_MONTH,
  DEFAULT_RANGE,
  findDashboardRange,
  getCostPerMileTile,
  getReadingsPace,
  getFirstRecordDate,
  getMonthSpendTile,
  getMonthlyMiles,
  getMpgTile,
  getOdometerReadings,
  getPaceTile,
  getRangeMonths,
  getRecentMilesPerDay,
} from './dashboardStats'

const TODAY = '2026-09-26'
const reading = (date, odometer) => ({ date, odometer })
const fill = (id, date, odometer, gallons = 10, total = 35, isFull = true) => ({ id, date, odometer, gallons, pricePerGal: total / gallons, total, isFull })
const service = (id, date, odometer, cost) => ({ id, date, odometer, cost, services: ['Tire rotation'] })
const range = (value) => findDashboardRange(value)

const WEEKLY = ['2026-01-08', '2026-01-15', '2026-01-22', '2026-01-29', '2026-02-05', '2026-02-12', '2026-02-19', '2026-02-26', '2026-03-05', '2026-03-12']

/** A full fill on Jan 1, then one a week from Jan 8, 10 gal each, so each tank's MPG is its miles / 10. */
function fillsWithMpg(mpgs) {
  let odometer = 10000
  return [
    fill(1, '2026-01-01', odometer),
    ...mpgs.map((mpg, i) => {
      odometer += mpg * 10
      return fill(i + 2, WEEKLY[i], odometer)
    }),
  ]
}

describe('DASHBOARD_RANGES', () => {
  it('offers 90 days, 1 year and all time, defaulting to 90 days', () => {
    expect(DASHBOARD_RANGES.map((r) => [r.value, r.label, r.days])).toEqual([
      ['90d', '90 days', 90],
      ['1y', '1 year', 365],
      ['all', 'All time', Infinity],
    ])
    expect(DEFAULT_RANGE).toBe('90d')
  })

  it('findDashboardRange falls back to the default for anything unknown', () => {
    expect(findDashboardRange('1y').label).toBe('1 year')
    expect(findDashboardRange('forever').value).toBe('90d')
    expect(findDashboardRange(null).value).toBe('90d')
  })
})

describe('getOdometerReadings', () => {
  it('merges fill-ups and services by date, skipping readings without a date or a positive odometer', () => {
    const fills = [fill(1, '2026-03-01', 1200), fill(2, 'soon', 1300), fill(3, '2026-01-01', 1000)]
    const services = [service(1, '2026-02-01', 1100, 50), service(2, '2026-02-15', 0, 20)]
    expect(getOdometerReadings(fills, services)).toEqual([reading('2026-01-01', 1000), reading('2026-02-01', 1100), reading('2026-03-01', 1200)])
  })

  it('never lets the odometer go back', () => {
    const readings = getOdometerReadings([fill(1, '2026-01-01', 1000), fill(2, '2026-03-01', 1300)], [service(1, '2026-02-01', 900, 0)])
    expect(readings.map((r) => r.odometer)).toEqual([1000, 1000, 1300])
  })
})

describe('getReadingsPace', () => {
  const readings = [reading('2026-06-01', 10000), reading('2026-07-01', 11000), reading('2026-08-30', 13000)]

  it('divides the miles between the first and last reading by the days between them', () => {
    const pace = getReadingsPace(readings, Infinity, TODAY)
    expect(pace.miles).toBe(3000)
    expect(pace.days).toBe(90)
    expect(pace.milesPerDay).toBeCloseTo(33.333, 3)
    expect(pace.milesPerMonth).toBe(Math.round((3000 / 90) * DAYS_PER_MONTH))
    expect(pace.milesPerYear).toBe(12175)
  })

  it('only uses readings inside the window', () => {
    const pace = getReadingsPace(readings, 90, TODAY)
    expect(pace).toMatchObject({ miles: 2000, days: 60 })
  })

  it('needs two readings on different days', () => {
    expect(getReadingsPace([reading('2026-09-01', 1000)], Infinity, TODAY)).toBeNull()
    expect(getReadingsPace([reading('2026-09-01', 1000), reading('2026-09-01', 1200)], Infinity, TODAY)).toBeNull()
    expect(getReadingsPace(readings, 20, TODAY)).toBeNull()
  })
})

describe('getRecentMilesPerDay', () => {
  it('uses the last six months of readings', () => {
    const readings = [reading('2025-01-01', 1000), reading('2026-06-01', 20000), reading('2026-08-30', 22700)]
    expect(getRecentMilesPerDay(readings, TODAY)).toBeCloseTo(30, 5)
  })

  it('falls back to every reading when the last six months have too few', () => {
    const readings = [reading('2025-01-01', 1000), reading('2025-01-31', 1900)]
    expect(getRecentMilesPerDay(readings, TODAY)).toBeCloseTo(30, 5)
    expect(getRecentMilesPerDay([], TODAY)).toBeNull()
  })
})

describe('getMonthlyMiles', () => {
  it('interpolates the odometer at each month boundary', () => {
    // 20 mi a day from Jan 1 to Mar 1.
    const readings = [reading('2026-01-01', 10000), reading('2026-03-01', 11180)]
    expect(getMonthlyMiles(readings, ['2026-01', '2026-02', '2026-03'])).toEqual([
      { month: '2026-01', miles: 620, days: 31 },
      { month: '2026-02', miles: 560, days: 28 },
      { month: '2026-03', miles: null, days: 0 },
    ])
  })

  it('counts only the days the readings cover in a partly covered month', () => {
    const readings = [reading('2026-01-11', 10000), reading('2026-02-10', 10600)]
    expect(getMonthlyMiles(readings, ['2026-01', '2026-02'])).toEqual([
      { month: '2026-01', miles: 420, days: 21 },
      { month: '2026-02', miles: 180, days: 9 },
    ])
  })

  it('has no miles without readings', () => {
    expect(getMonthlyMiles([], ['2026-09'])).toEqual([{ month: '2026-09', miles: null, days: 0 }])
  })
})

describe('getRangeMonths and getFirstRecordDate', () => {
  it('covers 3 months for 90 days and 12 for a year, ending this month', () => {
    expect(getRangeMonths(range('90d'), '2020-01-01', TODAY)).toEqual(['2026-07', '2026-08', '2026-09'])
    expect(getRangeMonths(range('1y'), null, TODAY)).toHaveLength(12)
    expect(getRangeMonths(range('1y'), null, TODAY)[0]).toBe('2025-10')
  })

  it('starts all time at the first record, across a year boundary', () => {
    expect(getRangeMonths(range('all'), '2026-04-24', TODAY)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'])
    expect(getRangeMonths(range('all'), '2025-11-03', TODAY)).toHaveLength(11)
    expect(getRangeMonths(range('all'), '2026-09-02', TODAY)).toEqual(['2026-09'])
    expect(getRangeMonths(range('all'), null, TODAY)).toEqual(['2026-09'])
  })

  it('getFirstRecordDate finds the earliest valid date across lists', () => {
    expect(getFirstRecordDate([{ date: '2026-05-01' }, { date: 'n/a' }], [{ date: '2026-02-01' }], [])).toBe('2026-02-01')
    expect(getFirstRecordDate([], [])).toBeNull()
  })
})

describe('getMpgTile', () => {
  it('compares the latest five full tanks with the five before them', () => {
    const tile = getMpgTile(fillsWithMpg([30, 30, 30, 30, 30, 33, 33, 33, 33, 33]), Infinity, TODAY)
    expect(tile.delta).toBe(10)
    expect(tile.comparedWith).toBe(5)
    expect(tile.average).toBe(31.5)
    expect(tile.points.map((t) => t.mpg)).toEqual([30, 30, 30, 30, 30, 33, 33, 33, 33, 33])
  })

  it('compares with fewer earlier tanks when there are fewer', () => {
    const tile = getMpgTile(fillsWithMpg([30, 30, 30, 33, 33, 33, 33, 33]), Infinity, TODAY)
    expect(tile).toMatchObject({ delta: 10, comparedWith: 3 })
  })

  it('has no delta with five tanks or fewer', () => {
    expect(getMpgTile(fillsWithMpg([30, 31, 32, 33, 34]), Infinity, TODAY)).toMatchObject({ delta: null, comparedWith: 0 })
  })

  it('averages only the tanks in the range, while the delta ignores the range', () => {
    // Weekly tanks from Jan 8; with today Mar 1, the last 30 days hold the tanks of Feb 5 to Feb 26.
    const fills = fillsWithMpg([30, 30, 30, 30, 30, 33, 33, 33])
    const tile = getMpgTile(fills, 30, '2026-03-01')
    expect(tile.points.map((t) => t.date)).toEqual(['2026-02-05', '2026-02-12', '2026-02-19', '2026-02-26'])
    expect(tile.average).toBe(32.3)
    expect(tile.delta).toBe(6)
  })
})

describe('getCostPerMileTile', () => {
  const records = {
    fills: [fill(1, '2026-07-01', 1000, 10, 50), fill(2, '2026-08-01', 2000, 10, 60)],
    services: [service(1, '2026-07-15', 1500, 100)],
    policies: [{ id: 1, type: 'insurance', date: '2026-07-20', cost: 300 }],
  }
  const months = ['2026-07', '2026-08', '2026-09']

  it('is all-in over the range, split per mile, with a monthly trend', () => {
    const tile = getCostPerMileTile(records, 90, months, TODAY)
    expect(tile.costPerMile).toBe(0.51)
    expect(tile.perMile.fuel).toBeCloseTo(0.11)
    expect(tile.perMile.service).toBeCloseTo(0.1)
    expect(tile.perMile.policies).toBeCloseTo(0.3)
    // July: $450 over the 1,000 miles from Jul 1 to Aug 1. August and September have no miles yet.
    expect(tile.trend).toEqual([0.45])
  })

  it('is empty without two readings in the range', () => {
    expect(getCostPerMileTile(records, 30, months, TODAY)).toEqual({ costPerMile: null, perMile: null, trend: [0.45] })
    expect(getCostPerMileTile({ fills: [], services: [], policies: [] }, 90, months, TODAY)).toEqual({
      costPerMile: null,
      perMile: null,
      trend: [],
    })
  })
})

describe('getMonthSpendTile', () => {
  const records = {
    fills: [fill(1, '2026-09-03', 1000, 10, 40), fill(2, '2026-08-20', 900, 10, 50), fill(3, '2026-08-28', 950, 10, 30)],
    services: [service(1, '2026-09-10', 1000, 100), service(2, '2026-08-05', 850, 50)],
  }

  it('compares fuel and service so far this month with the same days last month', () => {
    expect(getMonthSpendTile(records, ['2026-07', '2026-08', '2026-09'], TODAY)).toEqual({
      current: 140,
      fuel: 40,
      service: 100,
      previous: 100,
      delta: 40,
      monthLabel: 'Sep',
      previousLabel: 'Aug 1–26',
      trend: [0, 130, 140],
    })
  })

  it('has no delta when nothing was spent in last month’s window', () => {
    const tile = getMonthSpendTile({ fills: [fill(1, '2026-09-03', 1000, 10, 40)], services: [] }, ['2026-09'], TODAY)
    expect(tile).toMatchObject({ current: 40, previous: 0, delta: null, trend: [40] })
  })

  it('labels a clamped or one-day comparison window', () => {
    expect(getMonthSpendTile({ fills: [], services: [] }, ['2026-03'], '2026-03-31').previousLabel).toBe('Feb 1–28')
    expect(getMonthSpendTile({ fills: [], services: [] }, ['2026-10'], '2026-10-01').previousLabel).toBe('Sep 1')
  })
})

describe('getPaceTile', () => {
  it('gives the pace over the range and a per-month pace for months covered at least a week', () => {
    // 20 mi a day from Jul 1 to Sep 4.
    const records = { fills: [fill(1, '2026-07-01', 10000), fill(2, '2026-09-04', 11300)], services: [] }
    const tile = getPaceTile(records, 90, ['2026-07', '2026-08', '2026-09'], TODAY)
    expect(tile.pace).toMatchObject({ miles: 1300, days: 65, milesPerMonth: Math.round(20 * DAYS_PER_MONTH) })
    // September is covered for only 3 days, so it is left out of the trend.
    expect(tile.trend).toHaveLength(2)
    tile.trend.forEach((value) => expect(value).toBeCloseTo(20 * DAYS_PER_MONTH, 6))
  })

  it('has no pace without readings', () => {
    expect(getPaceTile({ fills: [], services: [] }, 90, ['2026-09'], TODAY)).toEqual({ pace: null, trend: [] })
  })
})
