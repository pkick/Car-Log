import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatProjectedDate, getDrivingPace, milesPerMonth, projectDueDate, withProjectedDates } from './projections'
import { getDueSoonItems } from './vehicleStats'

afterEach(() => {
  vi.useRealTimers()
})

const TODAY = '2026-09-26'

const reading = (date, odometer) => ({ date, odometer })

// The seeded Wagon's odometer readings.
const wagonFills = [
  reading('2026-04-24', 79710),
  reading('2026-05-06', 80210),
  reading('2026-05-18', 80710),
  reading('2026-05-30', 80960),
  reading('2026-06-11', 81460),
  reading('2026-06-23', 81960),
  reading('2026-07-05', 82460),
  reading('2026-07-17', 82960),
  reading('2026-07-29', 83460),
  reading('2026-08-10', 83710),
  reading('2026-08-28', 84210),
]
const wagonServices = [
  { ...reading('2026-02-01', 76800), services: ['Tire rotation'], categoryId: 'tires' },
  { ...reading('2026-04-22', 79630), services: ['Oil + filter change'], categoryId: 'oil' },
  { ...reading('2026-05-01', 80105), services: ['Air filter'], categoryId: 'filters' },
  { ...reading('2026-06-10', 81890), services: ['Brake pads'], categoryId: 'brakes' },
]

describe('getDrivingPace', () => {
  it('matches the seeded Wagon: 4,580 mi from the Apr 22 service to the Aug 28 fill-up, 128 days', () => {
    expect(getDrivingPace(wagonFills, wagonServices, TODAY)).toBeCloseTo(4580 / 128)
  })

  it('takes readings from service records as well as fill-ups', () => {
    expect(getDrivingPace([], [reading('2026-06-01', 1000), reading('2026-06-11', 1500)], TODAY)).toBe(50)
    expect(getDrivingPace([reading('2026-06-01', 1000)], [reading('2026-06-11', 1500)], TODAY)).toBe(50)
  })

  it('only counts readings from the last 6 months, today included', () => {
    const fills = [reading('2026-03-25', 500), reading('2026-03-26', 1000), reading('2026-09-26', 2830)]
    // Mar 26 to Sep 26 is 184 days; the Mar 25 reading is a day too old.
    expect(getDrivingPace(fills, [], TODAY)).toBeCloseTo(1830 / 184)
  })

  it('ignores readings after today, missing or zero readings and malformed dates', () => {
    const fills = [
      reading('2026-09-01', 1000),
      reading('2026-09-11', 1200),
      reading('2026-09-30', 5000),
      reading('2026-09-20', 0),
      { date: '2026-09-21' },
      reading('2026-9-22', 9000),
    ]
    expect(getDrivingPace(fills, [], TODAY)).toBe(20)
  })

  it('returns null with fewer than two readings, or when they span no days or no miles', () => {
    expect(getDrivingPace([], [], TODAY)).toBeNull()
    expect(getDrivingPace([reading('2026-09-01', 1000)], [], TODAY)).toBeNull()
    expect(getDrivingPace([reading('2026-09-01', 1000), reading('2026-09-01', 1300)], [], TODAY)).toBeNull()
    expect(getDrivingPace([reading('2026-09-01', 1000), reading('2026-09-11', 1000)], [], TODAY)).toBeNull()
    expect(getDrivingPace([reading('2026-09-01', 1000), reading('2026-09-11', 900)], [], TODAY)).toBeNull()
  })

  it('uses the local date by default', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 26, 23))
    expect(getDrivingPace([reading('2026-09-16', 1000), reading('2026-09-26', 1500)], [])).toBe(50)
  })
})

describe('projectDueDate', () => {
  it('projects a miles limit from the pace, counting from today', () => {
    // 3,850 mi at 35 mi/day is 110 days.
    expect(projectDueDate({ milesRemaining: 3850, dueDate: null }, 35, TODAY)).toBe('2027-01-14')
  })

  it('rounds up to the day the miles run out', () => {
    expect(projectDueDate({ milesRemaining: 10, dueDate: null }, 35, TODAY)).toBe('2026-09-27')
  })

  it('uses the due date of a months limit, with or without a pace', () => {
    expect(projectDueDate({ milesRemaining: null, dueDate: '2028-06-01' }, 35, TODAY)).toBe('2028-06-01')
    expect(projectDueDate({ milesRemaining: null, dueDate: '2028-06-01' }, null, TODAY)).toBe('2028-06-01')
  })

  it('takes whichever limit comes first when there are both', () => {
    // The Wagon's oil: 420 mi at 4,580 / 128 mi/day is 11.7 days, well before Apr 22.
    expect(projectDueDate({ milesRemaining: 420, dueDate: '2027-04-22' }, 4580 / 128, TODAY)).toBe('2026-10-08')
    expect(projectDueDate({ milesRemaining: 4000, dueDate: '2026-10-01' }, 10, TODAY)).toBe('2026-10-01')
  })

  it('falls back to the months limit when there is no pace', () => {
    expect(projectDueDate({ milesRemaining: 420, dueDate: '2027-04-22' }, null, TODAY)).toBe('2027-04-22')
  })

  it('returns today when the item is already due', () => {
    expect(projectDueDate({ status: 'overdue', milesRemaining: null, dueDate: null }, 35, TODAY)).toBe(TODAY)
    expect(projectDueDate({ milesRemaining: 0, dueDate: null }, null, TODAY)).toBe(TODAY)
    expect(projectDueDate({ milesRemaining: -2410, dueDate: '2027-01-01' }, 35, TODAY)).toBe(TODAY)
    expect(projectDueDate({ milesRemaining: 500, dueDate: '2025-09-10' }, 35, TODAY)).toBe(TODAY)
    expect(projectDueDate({ milesRemaining: null, dueDate: TODAY }, null, TODAY)).toBe(TODAY)
  })

  it('returns null when it cannot be projected', () => {
    expect(projectDueDate({ milesRemaining: 3850, dueDate: null }, null, TODAY)).toBeNull()
    expect(projectDueDate({ milesRemaining: 3850, dueDate: null }, 0, TODAY)).toBeNull()
    expect(projectDueDate({ milesRemaining: null, dueDate: null }, 35, TODAY)).toBeNull()
    expect(projectDueDate({ milesRemaining: null, dueDate: '2027-02-30' }, 35, TODAY)).toBeNull()
  })
})

describe('formatProjectedDate', () => {
  it('leaves the year out in today\'s year and puts it on other years', () => {
    expect(formatProjectedDate('2026-10-08', TODAY)).toBe('~Oct 8')
    expect(formatProjectedDate('2027-04-22', TODAY)).toBe('~Apr 22, 2027')
  })

  it('returns null for a missing or malformed date', () => {
    expect(formatProjectedDate(null, TODAY)).toBeNull()
    expect(formatProjectedDate('2026-13-01', TODAY)).toBeNull()
  })
})

describe('withProjectedDates', () => {
  it('projects each of the seeded Wagon\'s intervals, keeping the order', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 26, 12))
    const wagon = {
      purchaseDate: '2021-04-02',
      purchaseOdometer: 41880,
      intervals: [
        { id: 1, categoryId: 'oil', name: 'Oil + filter', services: ['Oil + filter change'], miles: 5000, months: 12, warnMiles: 500, warnDays: 14 },
        { id: 2, categoryId: 'tires', name: 'Tire rotation', services: ['Tire rotation'], miles: 5000, months: null, warnMiles: 500, warnDays: 14 },
      ],
    }
    const items = getDueSoonItems(wagon, wagonServices, 84210)
    const pace = getDrivingPace(wagonFills, wagonServices)
    const projected = withProjectedDates(items, pace)

    expect(projected.map((i) => [i.name, i.projectedDate, i.projectedLabel])).toEqual([
      ['Tire rotation', TODAY, '~Sep 26'],
      ['Oil + filter', '2026-10-08', '~Oct 8'],
    ])
    expect(projected[1]).toMatchObject({ milesRemaining: 420, status: 'coming-up' })
  })

  it('gives an item that cannot be projected null for both fields', () => {
    expect(withProjectedDates([{ milesRemaining: 100, dueDate: null }], null, TODAY)).toEqual([
      { milesRemaining: 100, dueDate: null, projectedDate: null, projectedLabel: null },
    ])
  })
})

describe('milesPerMonth', () => {
  it('converts miles per day to whole miles per average month', () => {
    expect(milesPerMonth(4580 / 128)).toBe(1089)
    expect(milesPerMonth(10)).toBe(304)
  })

  it('returns null without a pace', () => {
    expect(milesPerMonth(null)).toBeNull()
    expect(milesPerMonth(0)).toBeNull()
  })
})
