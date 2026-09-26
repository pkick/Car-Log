import { describe, expect, it } from 'vitest'
import { EMPTY_RECORDS, recordsReducer, visibleRecords } from './recordsState'

const fill = (id, vehicleId = 1) => ({ id, vehicleId, odometer: 1000 * id })
const service = (id, vehicleId = 1) => ({ id, vehicleId, services: ['Oil change'] })
const payment = (id, vehicleId = 1) => ({ id, vehicleId, type: 'insurance' })

const loaded = recordsReducer(EMPTY_RECORDS, {
  type: 'load',
  records: {
    fillUps: [fill(1), fill(2), fill(3, 2)],
    serviceRecords: [service(10), service(11, 2)],
    policyRecords: [payment(20)],
  },
})

const run = (state, ...actions) => actions.reduce(recordsReducer, state)
const ids = (records) => records.map((r) => r.id)

describe('recordsReducer: load and save', () => {
  it('loads every list with nothing pending', () => {
    expect(ids(loaded.fillUps)).toEqual([1, 2, 3])
    expect(ids(loaded.serviceRecords)).toEqual([10, 11])
    expect(ids(loaded.policyRecords)).toEqual([20])
    expect(loaded.pending).toEqual({ fillUps: [], serviceRecords: [], policyRecords: [] })
  })

  it('clears pending deletes on a reload', () => {
    const hidden = run(loaded, { type: 'hide', kind: 'fillUps', id: 1 })
    const reloaded = recordsReducer(hidden, { type: 'load', records: { fillUps: [fill(1)], serviceRecords: [], policyRecords: [] } })
    expect(visibleRecords(reloaded, 'fillUps')).toEqual([fill(1)])
  })

  it('appends a new record', () => {
    const state = run(loaded, { type: 'save', kind: 'policyRecords', record: payment(21) })
    expect(ids(state.policyRecords)).toEqual([20, 21])
  })

  it('replaces an edited record in place', () => {
    const edited = { ...fill(2), odometer: 2500 }
    const state = run(loaded, { type: 'save', kind: 'fillUps', record: edited })
    expect(state.fillUps).toEqual([fill(1), edited, fill(3, 2)])
  })

  it('leaves the other kinds alone', () => {
    const state = run(loaded, { type: 'save', kind: 'fillUps', record: fill(4) })
    expect(state.serviceRecords).toBe(loaded.serviceRecords)
    expect(state.policyRecords).toBe(loaded.policyRecords)
  })
})

describe('recordsReducer: pending deletes', () => {
  it('hide keeps the record but hides it from visibleRecords', () => {
    const state = run(loaded, { type: 'hide', kind: 'fillUps', id: 2 })
    expect(ids(state.fillUps)).toEqual([1, 2, 3])
    expect(ids(visibleRecords(state, 'fillUps'))).toEqual([1, 3])
  })

  it('hide only affects its own kind', () => {
    const state = run(loaded, { type: 'hide', kind: 'serviceRecords', id: 10 })
    expect(ids(visibleRecords(state, 'serviceRecords'))).toEqual([11])
    expect(visibleRecords(state, 'fillUps')).toBe(loaded.fillUps)
  })

  it('hide ignores a record that is already pending or does not exist', () => {
    const once = run(loaded, { type: 'hide', kind: 'fillUps', id: 2 })
    expect(recordsReducer(once, { type: 'hide', kind: 'fillUps', id: 2 })).toBe(once)
    expect(recordsReducer(loaded, { type: 'hide', kind: 'fillUps', id: 99 })).toBe(loaded)
  })

  it('restore shows the record again, unchanged and in its place', () => {
    const state = run(loaded, { type: 'hide', kind: 'fillUps', id: 2 }, { type: 'restore', kind: 'fillUps', id: 2 })
    expect(visibleRecords(state, 'fillUps')).toEqual(loaded.fillUps)
    expect(state.pending.fillUps).toEqual([])
  })

  it('restore of a record that is not pending changes nothing', () => {
    expect(recordsReducer(loaded, { type: 'restore', kind: 'fillUps', id: 2 })).toBe(loaded)
  })

  it('commit drops the record and its pending delete', () => {
    const state = run(loaded, { type: 'hide', kind: 'policyRecords', id: 20 }, { type: 'commit', kind: 'policyRecords', id: 20 })
    expect(state.policyRecords).toEqual([])
    expect(state.pending.policyRecords).toEqual([])
  })

  it('commit of a record that is already gone is harmless', () => {
    const state = run(loaded, { type: 'commit', kind: 'fillUps', id: 99 })
    expect(state.fillUps).toEqual(loaded.fillUps)
  })

  it('tracks several pending deletes independently', () => {
    const state = run(
      loaded,
      { type: 'hide', kind: 'fillUps', id: 1 },
      { type: 'hide', kind: 'fillUps', id: 2 },
      { type: 'restore', kind: 'fillUps', id: 1 },
    )
    expect(ids(visibleRecords(state, 'fillUps'))).toEqual([1, 3])
    const committed = run(state, { type: 'commit', kind: 'fillUps', id: 2 })
    expect(ids(visibleRecords(committed, 'fillUps'))).toEqual([1, 3])
    expect(ids(committed.fillUps)).toEqual([1, 3])
  })

  it('does not mutate the previous state', () => {
    const before = JSON.stringify(loaded)
    run(loaded, { type: 'hide', kind: 'fillUps', id: 1 }, { type: 'commit', kind: 'fillUps', id: 1 })
    expect(JSON.stringify(loaded)).toBe(before)
  })
})

describe('recordsReducer: removeVehicle', () => {
  it("drops the vehicle's records of every kind", () => {
    const state = run(loaded, { type: 'removeVehicle', vehicleId: 2 })
    expect(ids(state.fillUps)).toEqual([1, 2])
    expect(ids(state.serviceRecords)).toEqual([10])
    expect(ids(state.policyRecords)).toEqual([20])
  })

  it("drops the vehicle's pending deletes and keeps the others", () => {
    const state = run(
      loaded,
      { type: 'hide', kind: 'fillUps', id: 1 },
      { type: 'hide', kind: 'fillUps', id: 3 },
      { type: 'removeVehicle', vehicleId: 2 },
    )
    expect(state.pending.fillUps).toEqual([1])
    expect(ids(visibleRecords(state, 'fillUps'))).toEqual([2])
  })
})

describe('recordsReducer: unknown actions', () => {
  it('returns the state unchanged', () => {
    expect(recordsReducer(loaded, { type: 'nope' })).toBe(loaded)
  })
})
