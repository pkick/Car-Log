import { describe, expect, it } from 'vitest'
import { ACTIVITY_FILTERS, filterActivity, formatServicesList, getActivityItems, groupActivityByMonth } from './activity'

const fill = (id, date, odometer, gallons, pricePerGal, isFull = true) => ({
  id,
  date,
  odometer,
  gallons,
  pricePerGal,
  total: Math.round(gallons * pricePerGal * 100) / 100,
  isFull,
})
const service = (id, date, odometer, services, cost, shopName = '', categoryId = 'tires') => ({ id, date, odometer, services, cost, shopName, categoryId })
const payment = (id, type, date, cost, renewalDate = null, provider = '') => ({ id, type, date, cost, renewalDate, provider })

const fills = [
  fill(1, '2026-07-29', 83460, 16.1, 3.41),
  fill(2, '2026-08-10', 83710, 8.2, 3.38, false),
  fill(3, '2026-08-28', 84210, 15.9, 3.46),
]
const services = [service(4, '2026-09-07', 84210, ['Brake pads', 'Brake rotors', 'Brake fluid'], 500, 'abc shop', 'brakes')]
const payments = [payment(1, 'insurance', '2026-08-28', 612, '2027-02-28', 'State Farm')]

describe('formatServicesList', () => {
  it('names up to two services and counts the rest', () => {
    expect(formatServicesList(['Tire rotation'])).toBe('Tire rotation')
    expect(formatServicesList(['Brake pads', 'Brake rotors'])).toBe('Brake pads, Brake rotors')
    expect(formatServicesList(['Brake pads', 'Brake rotors', 'Brake fluid', 'Brake lines'])).toBe('Brake pads, Brake rotors, +2 more')
  })
})

describe('getActivityItems', () => {
  const items = getActivityItems({ fills, services, payments })

  it('merges fill-ups, services and payments newest first', () => {
    expect(items.map((i) => i.key)).toEqual(['service-4', 'fuel-3', 'payment-1', 'fuel-2', 'fuel-1'])
  })

  it('titles fill-ups with the MPG of the tank they closed, and flags partial fills', () => {
    const byKey = Object.fromEntries(items.map((i) => [i.key, i]))
    expect(byKey['fuel-3']).toMatchObject({
      kind: 'fuel',
      title: 'Fill-up · 31.1 mpg',
      detail: '15.9 gal · $3.46/gal · 84,210 mi',
      amount: 55.01,
      partial: false,
    })
    expect(byKey['fuel-2']).toMatchObject({ title: 'Partial fill-up', partial: true })
    expect(byKey['fuel-1'].title).toBe('Fill-up')
    expect(byKey['fuel-3'].record).toBe(fills[2])
  })

  it('titles services by what was done, with the shop and reading', () => {
    expect(items[0]).toMatchObject({
      kind: 'service',
      id: 4,
      title: 'Brake pads, Brake rotors, +1 more',
      detail: 'abc shop · 84,210 mi',
      amount: 500,
      categoryId: 'brakes',
      record: services[0],
    })
    const [diy] = getActivityItems({ services: [service(9, '2026-09-01', 0, ['Oil + filter change'], 45)] })
    expect(diy.detail).toBe('DIY')
  })

  it('titles payments by type, with the provider and renewal', () => {
    expect(items.find((i) => i.kind === 'payment')).toMatchObject({
      title: 'Insurance payment',
      detail: 'State Farm · renews Feb 28, 2027',
      amount: 612,
      type: 'insurance',
    })
    const [bare] = getActivityItems({ payments: [payment(2, 'registration', '2026-03-15', 145)] })
    expect(bare).toMatchObject({ title: 'Registration payment', detail: '—' })
  })

  it('orders records on one day by the higher reading, then fill-ups, services and payments, then the later entry', () => {
    const sameDay = getActivityItems({
      fills: [fill(1, '2026-09-01', 1000, 10, 3), fill(2, '2026-09-01', 1200, 10, 3)],
      services: [service(1, '2026-09-01', 1000, ['Tire rotation'], 0), service(2, '2026-09-01', 1000, ['Tire rotation'], 0)],
      payments: [payment(5, 'insurance', '2026-09-01', 100)],
    })
    expect(sameDay.map((i) => i.key)).toEqual(['fuel-2', 'fuel-1', 'service-2', 'service-1', 'payment-5'])
  })
})

describe('filterActivity', () => {
  const items = getActivityItems({ fills, services, payments })

  it('shows one kind per filter, and everything for All', () => {
    expect(ACTIVITY_FILTERS.map((f) => f.label)).toEqual(['All', 'Fuel', 'Service', 'Documents'])
    expect(filterActivity(items, 'all')).toHaveLength(5)
    expect(filterActivity(items, 'fuel').map((i) => i.kind)).toEqual(['fuel', 'fuel', 'fuel'])
    expect(filterActivity(items, 'service').map((i) => i.key)).toEqual(['service-4'])
    expect(filterActivity(items, 'documents').map((i) => i.key)).toEqual(['payment-1'])
    expect(filterActivity(items, 'unknown')).toHaveLength(5)
  })
})

describe('groupActivityByMonth', () => {
  it('groups by month, newest month first, keeping the order within each', () => {
    const months = groupActivityByMonth(getActivityItems({ fills, services, payments }))
    expect(months.map((m) => [m.month, m.label, m.items.map((i) => i.key)])).toEqual([
      ['2026-09', 'September 2026', ['service-4']],
      ['2026-08', 'August 2026', ['fuel-3', 'payment-1', 'fuel-2']],
      ['2026-07', 'July 2026', ['fuel-1']],
    ])
  })

  it('puts records without a valid date in a last group', () => {
    const months = groupActivityByMonth(
      getActivityItems({ fills: [fill(1, '2026-09-01', 1000, 10, 3)], payments: [payment(2, 'insurance', 'someday', 50)] }),
    )
    expect(months.map((m) => [m.month, m.label])).toEqual([
      ['2026-09', 'September 2026'],
      ['undated', 'No date'],
    ])
  })

  it('is empty for no items', () => {
    expect(groupActivityByMonth([])).toEqual([])
  })
})
