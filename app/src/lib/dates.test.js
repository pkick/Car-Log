import { afterEach, describe, expect, it, vi } from 'vitest'
import { addMonths, currentYear, daysBetween, isWithinDays, monthKey, parseISODate, todayISO } from './dates'

afterEach(() => {
  vi.useRealTimers()
})

it('runs under America/Los_Angeles (npm test sets TZ)', () => {
  expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(480)
  expect(new Date(2026, 6, 15).getTimezoneOffset()).toBe(420)
})

describe('todayISO', () => {
  it('returns the local date at 11 pm Pacific, when UTC is already the next day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-24T23:00:00-07:00'))
    expect(todayISO()).toBe('2026-09-24')
  })

  it('returns the local date just after local midnight', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:05:00-08:00'))
    expect(todayISO()).toBe('2026-01-01')
  })
})

describe('currentYear', () => {
  it('uses the local year on New Year’s Eve evening', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-31T22:00:00-08:00'))
    expect(currentYear()).toBe(2026)
  })
})

describe('parseISODate', () => {
  it('parses to local midnight, not UTC midnight', () => {
    const d = parseISODate('2026-09-01')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 8, 1, 0])
    expect(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()).toBe('SEP 1')
  })

  it('returns null for malformed or impossible dates', () => {
    for (const bad of ['', null, undefined, '2026-9-1', '2026-09-01T00:00:00Z', '2026-02-30', '2026-13-01', '2026-00-10']) {
      expect(parseISODate(bad)).toBeNull()
    }
  })

  it('accepts Feb 29 in a leap year', () => {
    expect(parseISODate('2028-02-29').getDate()).toBe(29)
  })
})

describe('addMonths', () => {
  it('adds calendar months', () => {
    expect(addMonths('2026-01-15', 1)).toBe('2026-02-15')
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15')
  })

  it('keeps day 31 across a 12-month interval', () => {
    expect(addMonths('2026-01-31', 12)).toBe('2027-01-31')
  })

  it('clamps to the end of shorter months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30')
  })

  it('subtracts months across a year boundary', () => {
    expect(addMonths('2026-01-10', -1)).toBe('2025-12-10')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
    expect(addMonths('2026-05-20', -17)).toBe('2024-12-20')
  })

  it('returns the same date for zero months', () => {
    expect(addMonths('2026-09-25', 0)).toBe('2026-09-25')
  })

  it('throws on malformed input', () => {
    expect(() => addMonths('09/25/2026', 1)).toThrow(RangeError)
  })
})

describe('daysBetween', () => {
  it('counts whole days, positive when b is later', () => {
    expect(daysBetween('2026-09-01', '2026-09-25')).toBe(24)
    expect(daysBetween('2026-09-25', '2026-09-01')).toBe(-24)
    expect(daysBetween('2026-09-25', '2026-09-25')).toBe(0)
  })

  it('is exact across DST changes', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
  })

  it('spans years and leap days', () => {
    expect(daysBetween('2027-12-31', '2028-03-01')).toBe(61)
    expect(daysBetween('2026-01-31', '2027-01-31')).toBe(365)
  })
})

describe('monthKey', () => {
  it('returns YYYY-MM', () => {
    expect(monthKey('2026-09-01')).toBe('2026-09')
    expect(monthKey('2026-12-31')).toBe('2026-12')
  })

  it('throws on malformed input', () => {
    expect(() => monthKey('2026-9-1')).toThrow(RangeError)
  })
})

describe('isWithinDays', () => {
  it('includes today and the date exactly n days back', () => {
    expect(isWithinDays('2026-09-25', 90, '2026-09-25')).toBe(true)
    expect(isWithinDays('2026-06-27', 90, '2026-09-25')).toBe(true)
  })

  it('excludes the day before the window and dates after today', () => {
    expect(isWithinDays('2026-06-26', 90, '2026-09-25')).toBe(false)
    expect(isWithinDays('2026-09-26', 90, '2026-09-25')).toBe(false)
  })

  it('treats Infinity as all past dates', () => {
    expect(isWithinDays('1999-01-01', Infinity, '2026-09-25')).toBe(true)
  })

  it('defaults today to the local date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-24T23:00:00-07:00'))
    expect(isWithinDays('2026-09-24', 0)).toBe(true)
    expect(isWithinDays('2026-09-25', 0)).toBe(false)
  })
})
