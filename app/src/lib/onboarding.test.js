import { describe, expect, it } from 'vitest'
import {
  ONBOARDING_STEPS,
  getEmptyStatTiles,
  getOnboardingSteps,
  intervalsCustomized,
  isEmptyVehicle,
  needsDefaultIntervals,
} from './onboarding'

const DEFAULTS = [
  { id: 1, categoryId: 'oil', name: 'Oil + filter', services: ['Oil + filter change'], trackBy: 'both', miles: 5000, months: 12, warnMiles: 500, warnDays: 14 },
  { id: 2, categoryId: 'tires', name: 'Tire rotation', services: ['Tire rotation'], trackBy: 'miles', miles: 5000, months: null, warnMiles: 500, warnDays: 14 },
]

const copy = (intervals) => structuredClone(intervals)
const car = (fields = {}) => ({ id: 7, tracksFuel: true, tracksService: true, intervals: copy(DEFAULTS), ...fields })
const fill = { id: 1, date: '2026-09-01', odometer: 10500 }
const service = { id: 1, date: '2026-09-02', odometer: 10600, services: ['Tire rotation'] }

const summary = (steps) => steps.map(({ id, n, done }) => ({ id, n, done }))

describe('intervalsCustomized', () => {
  it('is false for the defaults, even reordered, renumbered or with numbers typed as text', () => {
    expect(intervalsCustomized(copy(DEFAULTS), DEFAULTS)).toBe(false)
    const shuffled = copy(DEFAULTS).reverse().map((iv, i) => ({ ...iv, id: i + 10, miles: String(iv.miles) }))
    expect(intervalsCustomized(shuffled, DEFAULTS)).toBe(false)
  })

  it('ignores the order of an interval’s services and spaces around its name', () => {
    const defaults = [{ ...DEFAULTS[0], services: ['Oil + filter change', 'Oil change'] }]
    const mine = [{ ...defaults[0], name: ' Oil + filter ', services: ['Oil change', 'Oil + filter change'] }]
    expect(intervalsCustomized(mine, defaults)).toBe(false)
  })

  it('is true once any setting changes, an interval is added or removed, or all are removed', () => {
    const changed = (fields) => intervalsCustomized([{ ...DEFAULTS[0], ...fields }, DEFAULTS[1]], DEFAULTS)
    expect(changed({ miles: 7500 })).toBe(true)
    expect(changed({ months: null })).toBe(true)
    expect(changed({ trackBy: 'miles' })).toBe(true)
    expect(changed({ warnDays: 30 })).toBe(true)
    expect(changed({ name: 'Oil' })).toBe(true)
    expect(changed({ services: ['Oil + filter change', 'Oil change'] })).toBe(true)
    expect(intervalsCustomized([...copy(DEFAULTS), { ...DEFAULTS[0], id: 3, name: 'Coolant' }], DEFAULTS)).toBe(true)
    expect(intervalsCustomized([DEFAULTS[0]], DEFAULTS)).toBe(true)
    expect(intervalsCustomized([], DEFAULTS)).toBe(true)
    expect(intervalsCustomized(undefined, DEFAULTS)).toBe(true)
  })

  it('is false while the defaults are unknown', () => {
    expect(intervalsCustomized([], null)).toBe(false)
    expect(intervalsCustomized([], undefined)).toBe(false)
  })
})

describe('getOnboardingSteps', () => {
  it('lists all three steps, none done, on the first-run screen', () => {
    const steps = getOnboardingSteps(null)
    expect(summary(steps)).toEqual([
      { id: 'vehicle', n: 1, done: false },
      { id: 'intervals', n: 2, done: false },
      { id: 'fillUp', n: 3, done: false },
    ])
    expect(steps.map((s) => s.title)).toEqual(['Add the vehicle', 'Set intervals', 'Log a fill-up'])
    expect(steps.map((s) => s.body)).toEqual(ONBOARDING_STEPS.map((s) => s.body))
  })

  it('ticks off the vehicle as soon as it exists', () => {
    expect(summary(getOnboardingSteps(car(), { defaultIntervals: DEFAULTS }))).toEqual([
      { id: 'vehicle', n: 1, done: true },
      { id: 'intervals', n: 2, done: false },
      { id: 'fillUp', n: 3, done: false },
    ])
  })

  it('ticks off intervals once they differ from the defaults', () => {
    const steps = getOnboardingSteps(car({ intervals: [{ ...DEFAULTS[0], miles: 7500 }, DEFAULTS[1]] }), { defaultIntervals: DEFAULTS })
    expect(steps.find((s) => s.id === 'intervals').done).toBe(true)
  })

  it('ticks off intervals once the vehicle has a service record, whatever its intervals', () => {
    const steps = getOnboardingSteps(car(), { serviceRecords: [service], defaultIntervals: null })
    expect(steps.find((s) => s.id === 'intervals').done).toBe(true)
  })

  it('leaves intervals to do while the defaults are unknown and nothing is logged', () => {
    const steps = getOnboardingSteps(car({ intervals: [] }))
    expect(steps.find((s) => s.id === 'intervals').done).toBe(false)
  })

  it('ticks off the fill-up once one is logged, and everything once all three are done', () => {
    const steps = getOnboardingSteps(car(), { fillUps: [fill], serviceRecords: [service], defaultIntervals: DEFAULTS })
    expect(steps.every((s) => s.done)).toBe(true)
  })

  it('skips steps for what the vehicle does not track, and renumbers the rest', () => {
    expect(summary(getOnboardingSteps(car({ tracksFuel: false }), { defaultIntervals: DEFAULTS }))).toEqual([
      { id: 'vehicle', n: 1, done: true },
      { id: 'intervals', n: 2, done: false },
    ])
    expect(summary(getOnboardingSteps(car({ tracksService: false }), { fillUps: [fill] }))).toEqual([
      { id: 'vehicle', n: 1, done: true },
      { id: 'fillUp', n: 2, done: true },
    ])
    expect(summary(getOnboardingSteps(car({ tracksFuel: false, tracksService: false })))).toEqual([
      { id: 'vehicle', n: 1, done: true },
    ])
  })

  it('treats a vehicle without tracking flags as tracking both', () => {
    const steps = getOnboardingSteps({ id: 1, intervals: [] }, { defaultIntervals: DEFAULTS })
    expect(steps.map((s) => s.id)).toEqual(['vehicle', 'intervals', 'fillUp'])
  })
})

describe('needsDefaultIntervals', () => {
  it('is true only when intervals decide the step: service tracked and nothing serviced yet', () => {
    expect(needsDefaultIntervals(car(), [])).toBe(true)
    expect(needsDefaultIntervals(car(), [service])).toBe(false)
    expect(needsDefaultIntervals(car({ tracksService: false }), [])).toBe(false)
  })
})

describe('isEmptyVehicle', () => {
  it('is true with no fill-ups and no service records', () => {
    expect(isEmptyVehicle(car(), [], [])).toBe(true)
    expect(isEmptyVehicle(car({ tracksFuel: false }), [], [])).toBe(true)
  })

  it('is false once anything is logged', () => {
    expect(isEmptyVehicle(car(), [fill], [])).toBe(false)
    expect(isEmptyVehicle(car(), [], [service])).toBe(false)
  })

  it('is false for a vehicle that tracks neither fuel nor service', () => {
    expect(isEmptyVehicle(car({ tracksFuel: false, tracksService: false }), [], [])).toBe(false)
  })
})

describe('getEmptyStatTiles', () => {
  const due = (status) => ({ status })

  it('shows em-dashes with hints, and "no intervals due" when nothing is due', () => {
    expect(getEmptyStatTiles(car(), [due('ok'), due('ok')])).toEqual([
      { label: 'Avg MPG', value: null, unit: null, hint: 'needs 2 fill-ups', delta: null, deltaTone: 'neutral' },
      { label: 'Cost / mile', value: null, unit: null, hint: 'needs 2 fill-ups', delta: null, deltaTone: 'neutral' },
      { label: 'Fuel spend', value: null, unit: null, hint: 'log a fill-up', delta: null, deltaTone: 'neutral' },
      { label: 'Services', value: null, unit: null, hint: 'no intervals due', delta: null, deltaTone: 'neutral' },
    ])
  })

  it('shows the real due count, and how many are overdue', () => {
    const services = getEmptyStatTiles(car(), [due('overdue'), due('coming-up'), due('ok')]).at(-1)
    expect(services).toEqual({ label: 'Services', value: '2', unit: 'due soon', hint: null, delta: '1 overdue', deltaTone: 'bad' })
    expect(getEmptyStatTiles(car(), [due('coming-up')]).at(-1).delta).toBeNull()
  })

  it('keeps only the tiles for what the vehicle tracks', () => {
    expect(getEmptyStatTiles(car({ tracksFuel: false }), []).map((t) => t.label)).toEqual(['Services'])
    expect(getEmptyStatTiles(car({ tracksService: false }), []).map((t) => t.label)).toEqual(['Avg MPG', 'Cost / mile', 'Fuel spend'])
  })
})
