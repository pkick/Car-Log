/**
 * The records the app holds in memory (fill-ups, service records and policy payments) and the deletes that are
 * waiting out their undo window. A delete goes `hide` (DEL clicked: the record vanishes from every list), then
 * either `restore` (Undo, or the DELETE failed) or `commit` (the DELETE succeeded: the record is dropped).
 */

/** @typedef {'fillUps' | 'serviceRecords' | 'policyRecords'} RecordKind */

/**
 * @typedef {object} RecordsState
 * @property {Array<{ id: number, vehicleId: number }>} fillUps
 * @property {Array<{ id: number, vehicleId: number }>} serviceRecords
 * @property {Array<{ id: number, vehicleId: number }>} policyRecords
 * @property {Record<RecordKind, number[]>} pending ids hidden while their delete is pending, per kind
 */

/**
 * @typedef {{ type: 'load', records: { fillUps: object[], serviceRecords: object[], policyRecords: object[] } }
 *   | { type: 'save', kind: RecordKind, record: { id: number } }
 *   | { type: 'hide' | 'restore' | 'commit', kind: RecordKind, id: number }
 *   | { type: 'removeVehicle', vehicleId: number }} RecordsAction
 */

/** @type {RecordKind[]} */
export const RECORD_KINDS = ['fillUps', 'serviceRecords', 'policyRecords']

const NO_PENDING = { fillUps: [], serviceRecords: [], policyRecords: [] }

/** @type {RecordsState} */
export const EMPTY_RECORDS = { fillUps: [], serviceRecords: [], policyRecords: [], pending: NO_PENDING }

const withPending = (state, kind, ids) => ({ ...state, pending: { ...state.pending, [kind]: ids } })

/**
 * @param {RecordsState} state
 * @param {RecordsAction} action
 *   - `load` replaces every list and clears the pending deletes.
 *   - `save` replaces the record with the same id, or appends it.
 *   - `hide` marks a record's delete as pending, which hides it from {@link visibleRecords}.
 *   - `restore` ends a pending delete and shows the record again.
 *   - `commit` ends a pending delete and drops the record.
 *   - `removeVehicle` drops a deleted vehicle's records and their pending deletes.
 * @returns {RecordsState} `state` itself when nothing changed.
 */
export function recordsReducer(state, action) {
  switch (action.type) {
    case 'load':
      return { ...EMPTY_RECORDS, ...action.records }
    case 'save': {
      const { kind, record } = action
      const list = state[kind]
      const exists = list.some((r) => r.id === record.id)
      return { ...state, [kind]: exists ? list.map((r) => (r.id === record.id ? record : r)) : [...list, record] }
    }
    case 'hide': {
      const { kind, id } = action
      if (state.pending[kind].includes(id) || !state[kind].some((r) => r.id === id)) return state
      return withPending(state, kind, [...state.pending[kind], id])
    }
    case 'restore': {
      const { kind, id } = action
      if (!state.pending[kind].includes(id)) return state
      return withPending(state, kind, state.pending[kind].filter((p) => p !== id))
    }
    case 'commit': {
      const { kind, id } = action
      const next = { ...state, [kind]: state[kind].filter((r) => r.id !== id) }
      return withPending(next, kind, state.pending[kind].filter((p) => p !== id))
    }
    case 'removeVehicle': {
      const next = { ...state, pending: { ...state.pending } }
      for (const kind of RECORD_KINDS) {
        next[kind] = state[kind].filter((r) => r.vehicleId !== action.vehicleId)
        next.pending[kind] = state.pending[kind].filter((id) => next[kind].some((r) => r.id === id))
      }
      return next
    }
    default:
      return state
  }
}

/**
 * The records of one kind that aren't waiting to be deleted: what every page, stat and count should see.
 *
 * @param {RecordsState} state
 * @param {RecordKind} kind
 * @returns {object[]} The list itself when nothing of this kind is pending.
 */
export function visibleRecords(state, kind) {
  const pending = state.pending[kind]
  return pending.length === 0 ? state[kind] : state[kind].filter((r) => !pending.includes(r.id))
}
