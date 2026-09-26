import { describe, expect, it } from 'vitest'
import {
  FALLBACK_MILES_PER_DAY,
  SNOOZE_DAYS,
  activeSnoozes,
  getAttentionItems,
  getDueDistance,
  isSnoozed,
  pickAttentionItem,
  rankDueItems,
  snoozeItem,
} from './attention'

const TODAY = '2026-09-26'

/** A `getDueSoonItems` item with only what the attention logic reads. */
const due = (intervalId, name, status, { milesRemaining = null, dueDate = null, detailLabel = 'every 5,000 mi', categoryId = 'tires' } = {}) => ({
  intervalId,
  name,
  status,
  milesRemaining,
  dueDate,
  detailLabel,
  categoryId,
})

const renewal = (type, daysUntil, status, renewalDate, lastPayment = null) => ({
  type,
  label: type === 'insurance' ? 'Insurance' : 'Registration',
  renewalDate,
  daysUntil,
  status,
  lastPayment,
})

describe('getDueDistance', () => {
  it('converts a mileage limit to days at the driving pace', () => {
    expect(getDueDistance(due(1, 'Tire rotation', 'overdue', { milesRemaining: -2410 }), 35, TODAY)).toEqual({ days: -69, limit: 'miles' })
  })

  it('counts a date limit in calendar days', () => {
    expect(getDueDistance(due(1, 'Cabin air filter', 'coming-up', { dueDate: '2026-10-06' }), 35, TODAY)).toEqual({ days: 10, limit: 'date' })
  })

  it('uses whichever limit comes first', () => {
    const both = { milesRemaining: 420, dueDate: '2026-11-25' }
    expect(getDueDistance(due(1, 'Oil + filter', 'coming-up', both), 30, TODAY)).toEqual({ days: 14, limit: 'miles' })
    expect(getDueDistance(due(1, 'Oil + filter', 'coming-up', both), 3, TODAY)).toEqual({ days: 60, limit: 'date' })
  })

  it('lets a date that has passed win over a few miles left that round to zero days', () => {
    const item = due(1, 'Oil + filter', 'overdue', { milesRemaining: 10, dueDate: TODAY })
    expect(getDueDistance(item, 33, TODAY)).toEqual({ days: 0, limit: 'date' })
  })

  it('falls back to about 1,000 miles a month without a pace', () => {
    const item = due(1, 'Tire rotation', 'coming-up', { milesRemaining: 1000 })
    expect(getDueDistance(item, null, TODAY)).toEqual({ days: Math.round(1000 / FALLBACK_MILES_PER_DAY), limit: 'miles' })
    expect(getDueDistance(item, 0, TODAY).days).toBe(30)
  })

  it('is infinitely far off without limits', () => {
    expect(getDueDistance(due(1, 'Wipers', 'ok'), 30, TODAY)).toEqual({ days: Infinity, limit: null })
  })
})

describe('rankDueItems', () => {
  it('orders by status, then by days until due, keeping ties in order', () => {
    const items = [
      due(1, 'Oil + filter', 'coming-up', { milesRemaining: 420 }),
      due(2, 'Cabin air filter', 'ok', { dueDate: '2027-06-01' }),
      due(3, 'Tire rotation', 'overdue', { milesRemaining: -100 }),
      due(4, 'Brake fluid', 'overdue', { dueDate: '2024-04-02' }),
      due(5, 'Coolant', 'ok', { dueDate: '2027-01-01' }),
      due(6, 'Air filter', 'coming-up', { milesRemaining: 420 }),
    ]
    expect(rankDueItems(items, 30, TODAY).map((i) => i.intervalId)).toEqual([4, 3, 1, 6, 5, 2])
  })

  it('does not change the array it is given', () => {
    const items = [due(1, 'A', 'ok'), due(2, 'B', 'overdue', { milesRemaining: -5 })]
    rankDueItems(items, 30, TODAY)
    expect(items.map((i) => i.intervalId)).toEqual([1, 2])
  })
})

describe('getAttentionItems', () => {
  it('describes an overdue service by its mileage and rule', () => {
    const [item] = getAttentionItems({ dueItems: [due(2, 'Tire rotation', 'overdue', { milesRemaining: -2410 })], milesPerDay: 35 }, TODAY)
    expect(item).toEqual({
      key: 'service:2',
      kind: 'service',
      status: 'overdue',
      days: -69,
      title: 'Tire rotation is overdue',
      detail: '2,410 mi past due · every 5,000 mi',
      categoryId: 'tires',
      intervalId: 2,
    })
  })

  it('describes services by whichever limit is closer', () => {
    const detail = (item, pace = 35) => getAttentionItems({ dueItems: [item], milesPerDay: pace }, TODAY)[0].detail
    const rule = { detailLabel: 'every 5,000 mi or 12 mo' }
    expect(detail(due(1, 'Oil', 'coming-up', { ...rule, milesRemaining: 420 }))).toBe('due in 420 mi · every 5,000 mi or 12 mo')
    expect(detail(due(1, 'Oil', 'overdue', { ...rule, milesRemaining: 0 }))).toBe('due now · every 5,000 mi or 12 mo')
    expect(detail(due(1, 'Oil', 'coming-up', { ...rule, dueDate: '2026-10-05' }))).toBe('due in 9 days · every 5,000 mi or 12 mo')
    expect(detail(due(1, 'Oil', 'coming-up', { ...rule, dueDate: '2026-09-27' }))).toBe('due tomorrow · every 5,000 mi or 12 mo')
    expect(detail(due(1, 'Oil', 'overdue', { ...rule, dueDate: TODAY }))).toBe('due today · every 5,000 mi or 12 mo')
    expect(detail(due(1, 'Oil', 'overdue', { ...rule, dueDate: '2026-09-25' }))).toBe('1 day past due · every 5,000 mi or 12 mo')
    expect(detail(due(1, 'Oil', 'overdue', { ...rule, dueDate: '2026-09-14' }))).toBe('12 days past due · every 5,000 mi or 12 mo')
    expect(detail(due(1, 'Brake fluid', 'overdue', { ...rule, dueDate: '2024-04-02' }))).toBe(
      'past due since Apr 2, 2024 · every 5,000 mi or 12 mo',
    )
  })

  it('titles a coming-up service as due soon', () => {
    const [item] = getAttentionItems({ dueItems: [due(1, 'Oil + filter', 'coming-up', { milesRemaining: 420 })] }, TODAY)
    expect(item.title).toBe('Oil + filter is due soon')
  })

  it('describes renewals with the countdown, date and last payment', () => {
    const paid = { date: '2026-05-14', cost: 612, provider: 'State Farm' }
    const items = getAttentionItems(
      {
        renewals: [
          renewal('insurance', 12, 'coming-up', '2026-10-08', paid),
          renewal('registration', -3, 'overdue', '2026-09-23'),
        ],
      },
      TODAY,
    )
    expect(items).toEqual([
      {
        key: 'renewal:registration',
        kind: 'renewal',
        status: 'overdue',
        days: -3,
        title: 'Registration renewal is overdue',
        detail: '3 days overdue · was due Sep 23, 2026',
        type: 'registration',
      },
      {
        key: 'renewal:insurance',
        kind: 'renewal',
        status: 'coming-up',
        days: 12,
        title: 'Insurance renews in 12 days',
        detail: 'Oct 8, 2026 · last paid $612.00 · State Farm',
        type: 'insurance',
      },
    ])
  })

  it('says a renewal renews today or tomorrow', () => {
    const titles = getAttentionItems(
      { renewals: [renewal('insurance', 0, 'coming-up', TODAY), renewal('registration', 1, 'coming-up', '2026-09-27')] },
      TODAY,
    ).map((i) => i.title)
    expect(titles).toEqual(['Insurance renews today', 'Registration renews tomorrow'])
  })

  it('ranks overdue before coming up, even when the coming-up item is sooner', () => {
    const items = getAttentionItems(
      {
        dueItems: [due(1, 'Oil', 'coming-up', { dueDate: '2026-09-27' })],
        renewals: [renewal('insurance', -40, 'overdue', '2026-08-17')],
      },
      TODAY,
    )
    expect(items.map((i) => i.key)).toEqual(['renewal:insurance', 'service:1'])
  })

  it('ranks the most overdue first across services and renewals', () => {
    const tires = due(2, 'Tire rotation', 'overdue', { milesRemaining: -2410 })
    const late = (days) => renewal('insurance', days, 'overdue', '2026-01-01')
    const keys = (renewals) => getAttentionItems({ dueItems: [tires], renewals, milesPerDay: 35 }, TODAY).map((i) => i.key)
    expect(keys([late(-3)])).toEqual(['service:2', 'renewal:insurance'])
    expect(keys([late(-100)])).toEqual(['renewal:insurance', 'service:2'])
  })

  it('puts services before renewals on a tie', () => {
    const items = getAttentionItems(
      {
        renewals: [renewal('insurance', 10, 'coming-up', '2026-10-06')],
        dueItems: [due(4, 'Cabin air filter', 'coming-up', { dueDate: '2026-10-06' })],
      },
      TODAY,
    )
    expect(items.map((i) => i.key)).toEqual(['service:4', 'renewal:insurance'])
  })

  it('ranks the soonest first among coming-up items', () => {
    const items = getAttentionItems(
      {
        dueItems: [due(1, 'Oil', 'coming-up', { milesRemaining: 420 })],
        renewals: [renewal('insurance', 5, 'coming-up', '2026-10-01')],
        milesPerDay: 30,
      },
      TODAY,
    )
    expect(items.map((i) => [i.key, i.days])).toEqual([
      ['renewal:insurance', 5],
      ['service:1', 14],
    ])
  })

  it('leaves out items that are on track', () => {
    const items = getAttentionItems(
      { dueItems: [due(1, 'Oil', 'ok', { milesRemaining: 3000 })], renewals: [renewal('insurance', 49, 'ok', '2026-11-14')] },
      TODAY,
    )
    expect(items).toEqual([])
  })
})

describe('snoozes', () => {
  it('hides an item for two weeks from the day it was snoozed', () => {
    expect(SNOOZE_DAYS).toBe(14)
    expect(isSnoozed({ 'service:2': TODAY }, 'service:2', TODAY)).toBe(true)
    expect(isSnoozed({ 'service:2': '2026-09-13' }, 'service:2', TODAY)).toBe(true)
    expect(isSnoozed({ 'service:2': '2026-09-12' }, 'service:2', TODAY)).toBe(false)
  })

  it('ignores missing, malformed and future snoozes', () => {
    expect(isSnoozed({}, 'service:2', TODAY)).toBe(false)
    expect(isSnoozed(null, 'service:2', TODAY)).toBe(false)
    expect(isSnoozed({ 'service:2': 'soon' }, 'service:2', TODAY)).toBe(false)
    expect(isSnoozed({ 'service:2': '2026-10-01' }, 'service:2', TODAY)).toBe(false)
  })

  it('snoozeItem adds today and drops snoozes that ran out', () => {
    const stored = { 'service:1': '2026-09-01', 'renewal:insurance': '2026-09-20', junk: 'x' }
    expect(snoozeItem(stored, 'service:2', TODAY)).toEqual({ 'renewal:insurance': '2026-09-20', 'service:2': TODAY })
    expect(stored).toEqual({ 'service:1': '2026-09-01', 'renewal:insurance': '2026-09-20', junk: 'x' })
    expect(activeSnoozes(undefined, TODAY)).toEqual({})
  })

  it('pickAttentionItem shows the most urgent item that is not snoozed', () => {
    const items = getAttentionItems(
      {
        dueItems: [due(2, 'Tire rotation', 'overdue', { milesRemaining: -2410 }), due(1, 'Oil', 'coming-up', { milesRemaining: 420 })],
        renewals: [renewal('insurance', 12, 'coming-up', '2026-10-08')],
        milesPerDay: 35,
      },
      TODAY,
    )
    expect(pickAttentionItem(items, {}, TODAY).key).toBe('service:2')
    expect(pickAttentionItem(items, { 'service:2': TODAY }, TODAY).key).toBe('service:1')
    expect(pickAttentionItem(items, { 'service:2': TODAY, 'service:1': TODAY }, TODAY).key).toBe('renewal:insurance')
    expect(pickAttentionItem(items, { 'service:2': TODAY, 'service:1': TODAY, 'renewal:insurance': TODAY }, TODAY)).toBeNull()
    expect(pickAttentionItem(items, { 'service:2': '2026-09-01' }, TODAY).key).toBe('service:2')
    expect(pickAttentionItem([], {}, TODAY)).toBeNull()
  })
})
