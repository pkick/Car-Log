import { afterEach, describe, expect, it, vi } from 'vitest'
import { addDays, addMonths, daysBetween, monthKey, parseISODate, toISODate, todayISO } from './dates'

// The test script pins TZ=America/Los_Angeles, where UTC is already "tomorrow" every evening.

afterEach(() => {
  vi.useRealTimers()
})

describe('todayISO', () => {
  it('returns the local date late in the evening, not the UTC date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-24T23:30:00-07:00'))
    expect(todayISO()).toBe('2026-09-24')
  })

  it('returns the local date just after midnight', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-25T00:05:00-07:00'))
    expect(todayISO()).toBe('2026-09-25')
  })
})

describe('parseISODate', () => {
  it('parses as local midnight on the same calendar day', () => {
    const d = parseISODate('2026-09-01')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 8, 1, 0])
  })

  it('returns an invalid Date for malformed input', () => {
    expect(Number.isNaN(parseISODate('').getTime())).toBe(true)
    expect(Number.isNaN(parseISODate(null).getTime())).toBe(true)
    expect(Number.isNaN(parseISODate('9/1/2026').getTime())).toBe(true)
  })
})

describe('toISODate', () => {
  it('round-trips with parseISODate', () => {
    expect(toISODate(parseISODate('2026-03-08'))).toBe('2026-03-08')
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('is exact across DST changes', () => {
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09')
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02')
  })

  it('returns null for malformed input', () => {
    expect(addDays('', 1)).toBeNull()
  })
})

describe('addMonths', () => {
  it('keeps the day of month when it exists', () => {
    expect(addMonths('2026-01-31', 12)).toBe('2027-01-31')
    expect(addMonths('2026-03-15', -3)).toBe('2025-12-15')
  })

  it('clamps to the end of shorter months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
    expect(addMonths('2026-05-31', 1)).toBe('2026-06-30')
  })

  it('returns null for malformed input', () => {
    expect(addMonths(undefined, 1)).toBeNull()
  })
})

describe('daysBetween', () => {
  it('counts whole calendar days, signed', () => {
    expect(daysBetween('2026-09-01', '2026-09-24')).toBe(23)
    expect(daysBetween('2026-09-24', '2026-09-01')).toBe(-23)
    expect(daysBetween('2026-09-24', '2026-09-24')).toBe(0)
  })

  it('is exact across DST changes', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
    expect(daysBetween('2026-11-01', '2026-11-02')).toBe(1)
  })

  it('returns NaN for malformed input', () => {
    expect(daysBetween('2026-09-01', '')).toBeNaN()
  })
})

describe('monthKey', () => {
  it('groups by the local calendar month', () => {
    expect(monthKey('2026-09-01')).toBe('2026-09')
    expect(monthKey('2026-08-31')).toBe('2026-08')
  })

  it('returns null for malformed input', () => {
    expect(monthKey('Sep 2026')).toBeNull()
  })
})
