import { afterEach, describe, expect, it, vi } from 'vitest'
import { RENEWAL_WARN_DAYS, formatFullDate, formatRenewalCountdown, getRenewalItems } from './renewals'

const TODAY = '2026-09-26'

const payment = (id, type, date, cost, renewalDate = null, provider = '') => ({ id, type, date, cost, renewalDate, provider })

const wagon = { insuranceRenewal: '2026-11-14', registrationRenewal: '2027-03-31' }
const wagonPayments = [
  payment(1, 'insurance', '2026-05-14', 612, '2026-11-14', 'State Farm'),
  payment(2, 'registration', '2026-03-15', 145, '2027-03-31', 'DMV'),
]

const insuranceOn = (renewalDate, payments = []) =>
  getRenewalItems({ insuranceRenewal: renewalDate }, payments, TODAY).find((item) => item.type === 'insurance')

describe('getRenewalItems', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns one item per renewal, with the days left and the last payment', () => {
    expect(getRenewalItems(wagon, wagonPayments, TODAY)).toEqual([
      {
        type: 'insurance',
        label: 'Insurance',
        renewalDate: '2026-11-14',
        daysUntil: 49,
        status: 'ok',
        lastPayment: { date: '2026-05-14', cost: 612, provider: 'State Farm' },
      },
      {
        type: 'registration',
        label: 'Registration',
        renewalDate: '2027-03-31',
        daysUntil: 186,
        status: 'ok',
        lastPayment: { date: '2026-03-15', cost: 145, provider: 'DMV' },
      },
    ])
  })

  it('is coming up from 30 days out through the day itself', () => {
    expect(RENEWAL_WARN_DAYS).toBe(30)
    expect(insuranceOn('2026-10-27').status).toBe('ok')
    expect(insuranceOn('2026-10-26')).toMatchObject({ daysUntil: 30, status: 'coming-up' })
    expect(insuranceOn('2026-10-06')).toMatchObject({ daysUntil: 10, status: 'coming-up' })
    expect(insuranceOn('2026-09-26')).toMatchObject({ daysUntil: 0, status: 'coming-up' })
  })

  it('takes the warn days as a setting', () => {
    const on = (renewalDate, warnDays) => getRenewalItems({ insuranceRenewal: renewalDate }, [], TODAY, warnDays)[0].status
    expect(on('2026-10-11', 14)).toBe('ok')
    expect(on('2026-10-10', 14)).toBe('coming-up')
    expect(on('2026-12-25', 90)).toBe('coming-up')
    expect(on('2026-09-26', 0)).toBe('coming-up')
    expect(on('2026-09-25', 60)).toBe('overdue')
  })

  it('is overdue once the date has passed', () => {
    expect(insuranceOn('2026-09-25')).toMatchObject({ daysUntil: -1, status: 'overdue' })
    expect(insuranceOn('2026-09-14')).toMatchObject({ daysUntil: -12, status: 'overdue' })
  })

  it('puts overdue renewals first, then the soonest', () => {
    const vehicle = { insuranceRenewal: '2027-02-01', registrationRenewal: '2026-09-20' }
    expect(getRenewalItems(vehicle, [], TODAY).map((item) => item.type)).toEqual(['registration', 'insurance'])

    const bothOverdue = { insuranceRenewal: '2026-09-01', registrationRenewal: '2026-09-20' }
    expect(getRenewalItems(bothOverdue, [], TODAY).map((item) => item.daysUntil)).toEqual([-25, -6])

    const bothComing = { insuranceRenewal: '2026-10-20', registrationRenewal: '2026-10-01' }
    expect(getRenewalItems(bothComing, [], TODAY).map((item) => item.type)).toEqual(['registration', 'insurance'])
  })

  it("prefers the vehicle's renewal date over the payments'", () => {
    const payments = [payment(1, 'insurance', '2026-05-14', 612, '2026-11-14')]
    expect(insuranceOn('2026-12-01', payments).renewalDate).toBe('2026-12-01')
  })

  it("falls back to the renewal date on the newest payment that has one", () => {
    const payments = [
      payment(1, 'insurance', '2025-05-14', 590, '2025-11-14'),
      payment(2, 'insurance', '2026-05-14', 612, '2026-11-14'),
      payment(3, 'insurance', '2026-08-01', 102),
      payment(4, 'registration', '2026-09-01', 145, '2027-09-01'),
    ]
    expect(insuranceOn(null, payments)).toMatchObject({
      renewalDate: '2026-11-14',
      lastPayment: { date: '2026-08-01', cost: 102, provider: null },
    })
    expect(insuranceOn(undefined, payments).renewalDate).toBe('2026-11-14')
    expect(insuranceOn('', payments).renewalDate).toBe('2026-11-14')
  })

  it("ignores a malformed vehicle date and falls back to the payments'", () => {
    const payments = [payment(1, 'insurance', '2026-05-14', 612, '2026-11-14')]
    expect(insuranceOn('next spring', payments).renewalDate).toBe('2026-11-14')
    expect(insuranceOn('2026-02-30', payments).renewalDate).toBe('2026-11-14')
  })

  it('skips a malformed renewal date on a payment', () => {
    const payments = [
      payment(1, 'insurance', '2026-05-14', 612, '2026-11-14'),
      payment(2, 'insurance', '2026-08-01', 612, 'soon'),
    ]
    expect(insuranceOn(null, payments).renewalDate).toBe('2026-11-14')
  })

  it('leaves out a renewal with no date anywhere', () => {
    const payments = [payment(1, 'insurance', '2026-05-14', 612)]
    expect(getRenewalItems({ insuranceRenewal: null, registrationRenewal: '2027-01-15' }, payments, TODAY)).toEqual([
      expect.objectContaining({ type: 'registration' }),
    ])
    expect(getRenewalItems({}, [], TODAY)).toEqual([])
  })

  it('has no last payment when none of that type is logged', () => {
    const payments = [payment(1, 'registration', '2026-03-15', 145, '2027-03-31', 'DMV')]
    expect(insuranceOn('2026-11-14', payments).lastPayment).toBeNull()
  })

  it('takes the later of two payments made on the same day', () => {
    const payments = [
      payment(7, 'insurance', '2026-05-14', 50, null, 'State Farm'),
      payment(3, 'insurance', '2026-05-14', 612, null, 'Progressive'),
    ]
    expect(insuranceOn('2026-11-14', payments).lastPayment).toEqual({ date: '2026-05-14', cost: 50, provider: 'State Farm' })
  })

  it("defaults to today's local date", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 26, 23, 30))
    expect(getRenewalItems({ insuranceRenewal: '2026-09-27' }, [])[0]).toMatchObject({ daysUntil: 1, status: 'coming-up' })
  })
})

describe('formatRenewalCountdown', () => {
  it('counts down to the renewal', () => {
    expect(formatRenewalCountdown(49)).toBe('Renews in 49 days')
    expect(formatRenewalCountdown(2)).toBe('Renews in 2 days')
    expect(formatRenewalCountdown(1)).toBe('Renews tomorrow')
    expect(formatRenewalCountdown(0)).toBe('Renews today')
  })

  it('counts days overdue after it', () => {
    expect(formatRenewalCountdown(-1)).toBe('1 day overdue')
    expect(formatRenewalCountdown(-12)).toBe('12 days overdue')
  })
})

describe('formatFullDate', () => {
  it('shows the short month, day and year', () => {
    expect(formatFullDate('2026-11-14')).toBe('Nov 14, 2026')
    expect(formatFullDate('2027-01-05')).toBe('Jan 5, 2027')
  })

  it('passes a malformed date through and marks a missing one', () => {
    expect(formatFullDate('soon')).toBe('soon')
    expect(formatFullDate('')).toBe('—')
    expect(formatFullDate(null)).toBe('—')
  })
})
