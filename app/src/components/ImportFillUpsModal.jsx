import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { FuelIcon } from './icons'
import { Badge, Card, Field, Input, Modal, Segmented, Select } from './ui'
import FormActions from './FormActions'
import { VehicleContext } from '../context/VehicleContext'
import { useRecords } from '../context/RecordsContext'
import { useToast } from '../context/toast'
import {
  DATE_FORMATS,
  IMPORT_FIELDS,
  MAX_IMPORT_ROWS,
  checkRows,
  countStatuses,
  detectDateFormat,
  detectPreset,
  importPayload,
  importSummary,
  listSourceVehicles,
  mappingProblems,
  parseRows,
  previewMpg,
  selectRows,
} from '../lib/csvImport'

const UNREACHABLE = "Can't reach the server. Check that it's running and try again."
const GATEWAY_STATUSES = [502, 503, 504]
const NEW_VEHICLE = 'new'
const IGNORE = ''
// Enough rows to spot a pattern; the counts above the table cover the rest.
const LIST_LIMIT = 100

const SECTION = 'text-xs font-mono font-semibold tracking-widest uppercase text-ink/45'
const TH = 'px-2 py-2 text-left text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 whitespace-nowrap'
const TD = 'px-2 py-2 text-xs font-mono whitespace-nowrap'

const STATUS = {
  new: { tone: 'green', label: 'New' },
  duplicate: { tone: 'neutral', label: 'Duplicate' },
  invalid: { tone: 'red', label: 'Invalid' },
}

/**
 * Sends JSON to the API. A failed request throws an Error with the server's message and its body.
 * @param {string} path
 * @param {object} [body] Sent as a POST when given.
 * @returns {Promise<any>}
 */
async function send(path, body) {
  let res
  try {
    res = await fetch(path, body === undefined ? undefined : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    throw new Error(UNREACHABLE, { cause: err })
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = data.error || (GATEWAY_STATUSES.includes(res.status) ? UNREACHABLE : `Request failed: ${res.status}`)
    throw Object.assign(new Error(message), { body: data })
  }
  return data
}

const plural = (n, noun) => `${n.toLocaleString('en-US')} ${noun}${n === 1 ? '' : 's'}`
const money = (value) => (value == null ? '—' : `$${value.toFixed(2)}`)

/**
 * The mapping and preview step of the CSV import (P4-E2 to E4): pick the vehicle (or create one), map columns, check
 * the date format, and see every row as it will be saved before importing the new ones. Without any vehicle it only
 * offers to create one, which is how the first-run screen imports.
 *
 * Creating a vehicle adds it to the app straight away, and on the first-run screen that navigates to it and unmounts
 * this modal; the import carries on regardless and reports through a toast.
 *
 * @param {object} props
 * @param {{ name: string, table: import('../lib/csvImport').CsvTable }} props.source The file from `useCsvFile`.
 * @param {() => void} props.onClose
 */
export default function ImportFillUpsModal({ source, onClose }) {
  const { vehicles, lastVehicleId, addVehicle, mergeVehicle } = useContext(VehicleContext)
  const { fillUps, reload } = useRecords()
  const toast = useToast()
  const { table } = source

  const preset = useMemo(() => detectPreset(table.headers), [table])
  const sourceVehicles = useMemo(
    () => listSourceVehicles(table.rows, preset.vehicleColumn, preset.rowFilter),
    [table, preset]
  )
  const [sourceVehicle, setSourceVehicle] = useState(() => {
    if (sourceVehicles.length < 2) return null
    const named = sourceVehicles.find((s) => vehicles.some((v) => v.nickname.toLowerCase() === s.name.toLowerCase()))
    return (named ?? sourceVehicles[0]).name
  })
  const fileVehicleName = sourceVehicle ?? (sourceVehicles.length === 1 ? sourceVehicles[0].name : '')

  const [targetId, setTargetId] = useState(() => {
    if (vehicles.length === 0) return NEW_VEHICLE
    const named = vehicles.find((v) => v.nickname.toLowerCase() === fileVehicleName.toLowerCase())
    return (named ?? vehicles.find((v) => v.id === lastVehicleId) ?? vehicles[0]).id
  })
  const [newVehicle, setNewVehicle] = useState({ nickname: null, make: '', model: '' })
  const [nicknameError, setNicknameError] = useState(null)
  const nickname = newVehicle.nickname ?? fileVehicleName

  const [mapping, setMapping] = useState(preset.mapping)
  const [dateChoice, setDateChoice] = useState(null)
  const [view, setView] = useState('first')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const creating = targetId === NEW_VEHICLE
  const typeRows = useMemo(() => selectRows(table.rows, { rowFilter: preset.rowFilter }), [table, preset])
  const rows = useMemo(
    () => selectRows(typeRows, { vehicleColumn: preset.vehicleColumn, vehicle: sourceVehicle }),
    [typeRows, preset, sourceVehicle]
  )
  const detected = useMemo(
    () => detectDateFormat(mapping.date == null ? [] : rows.map((r) => r.cells[mapping.date])),
    [rows, mapping.date]
  )
  const dateFormat = dateChoice ?? detected.format ?? 'ymd'
  const existing = useMemo(() => (creating ? [] : fillUps.filter((f) => f.vehicleId === targetId)), [creating, fillUps, targetId])
  const problems = useMemo(() => mappingProblems(mapping), [mapping])
  const checked = useMemo(
    () => (problems.length > 0 ? [] : checkRows(parseRows(rows, mapping, { dateFormat }), existing)),
    [problems, rows, mapping, dateFormat, existing]
  )
  const counts = countStatuses(checked)
  const mpg = useMemo(() => previewMpg(checked, existing), [checked, existing])
  const cellsByRow = useMemo(() => new Map(rows.map((r) => [r.row, r.cells])), [rows])

  const shown = view === 'first' ? checked.slice(0, 10) : checked.filter((c) => c.status === view).slice(0, LIST_LIMIT)
  const hiddenCount = view === 'first' ? 0 : counts[view] - shown.length
  const tooMany = counts.new > MAX_IMPORT_ROWS
  const leftOut = [
    table.rows.length > typeRows.length && `${plural(table.rows.length - typeRows.length, 'service row')}`,
    typeRows.length > rows.length && `${plural(typeRows.length - rows.length, 'row')} for other vehicles`,
  ].filter(Boolean)

  const columnField = (index) => Object.keys(mapping).find((field) => mapping[field] === index) ?? IGNORE
  const mapColumn = (index, field) => {
    setMapping((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([key, column]) => column !== index && key !== field))
      if (field !== IGNORE) next[field] = index
      return next
    })
  }
  const sample = (index) => rows.find((r) => r.cells[index])?.cells[index] ?? ''

  const handleImport = async () => {
    if (saving) return
    if (creating && !nickname.trim()) {
      setNicknameError('Enter a nickname.')
      return
    }
    const newRows = checked.filter((c) => c.status === 'new')
    const payload = importPayload(checked)
    setSaving(true)
    setSaveError(null)
    try {
      let vehicleId = targetId
      if (creating) {
        const created = await addVehicle({ nickname: nickname.trim(), make: newVehicle.make.trim() || null, model: newVehicle.model.trim() || null })
        vehicleId = created.id
        if (mounted.current) setTargetId(created.id)
      }
      const result = await send('/api/import/fill-ups', { vehicleId, rows: payload })
      mergeVehicle(result.vehicle)
      await reload().catch(() => {})
      const { message, detail } = importSummary(result.inserted, counts.duplicate + result.skipped.length)
      toast.success(message, detail)
      onClose()
    } catch (err) {
      const rowErrors = err.body?.errors ?? []
      const first = rowErrors[0] && `Row ${newRows[rowErrors[0].index]?.row ?? rowErrors[0].index + 1}: ${rowErrors[0].error}`
      const message = [err.message, first].filter(Boolean).join(' ')
      if (mounted.current) {
        setSaveError(message)
        setSaving(false)
      } else {
        toast.error("Couldn't import the fill-ups", message)
      }
    }
  }

  const submitLabel = counts.new === 0
    ? 'Nothing new to import'
    : `${creating ? 'Create vehicle and import' : 'Import'} ${plural(counts.new, 'fill-up')}`

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={<><FuelIcon size={20} className="text-accent" />Import fill-ups</>}
      subtitle={`${source.name} · ${plural(table.rows.length, 'row')}`}
      footer={
        <FormActions
          submitLabel={submitLabel}
          onSubmit={handleImport}
          onCancel={onClose}
          saving={saving}
          submitDisabled={counts.new === 0 || problems.length > 0 || tooMany}
          error={saveError}
        />
      }
    >
      <div className="flex flex-col gap-7">
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className={SECTION}>1 · Vehicle</h3>
            {preset.label && <Badge tone="accent">{preset.label}</Badge>}
          </div>

          {vehicles.length > 0 && (
            <div className={sourceVehicles.length > 1 ? 'grid grid-cols-2 gap-4' : ''}>
              {sourceVehicles.length > 1 && (
                <Field label="Rows for" hint="This file holds more than one vehicle.">
                  <Select value={sourceVehicle} onChange={(e) => setSourceVehicle(e.target.value)}>
                    {sourceVehicles.map((s) => <option key={s.name} value={s.name}>{s.name} ({plural(s.count, 'row')})</option>)}
                  </Select>
                </Field>
              )}
              <Field label="Import into">
                <Select value={String(targetId)} onChange={(e) => setTargetId(e.target.value === NEW_VEHICLE ? NEW_VEHICLE : Number(e.target.value))}>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.nickname}</option>)}
                  <option value={NEW_VEHICLE}>New vehicle…</option>
                </Select>
              </Field>
            </div>
          )}

          {vehicles.length === 0 && sourceVehicles.length > 1 && (
            <Field label="Rows for" hint="This file holds more than one vehicle.">
              <Select value={sourceVehicle} onChange={(e) => setSourceVehicle(e.target.value)}>
                {sourceVehicles.map((s) => <option key={s.name} value={s.name}>{s.name} ({plural(s.count, 'row')})</option>)}
              </Select>
            </Field>
          )}

          {creating && (
            <Card tone="accent" padding="sm">
              <p className="text-sm font-semibold">Create vehicle</p>
              <p className="text-xs font-mono text-ink/60 mt-1 mb-4">
                The fill-ups need a vehicle. It's added when you import; fill in the rest of its details later.
              </p>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Nickname *" error={nicknameError}>
                  <Input
                    value={nickname}
                    onChange={(e) => {
                      setNewVehicle({ ...newVehicle, nickname: e.target.value })
                      setNicknameError(null)
                    }}
                    placeholder="e.g. The Wagon"
                  />
                </Field>
                <Field label="Make">
                  <Input value={newVehicle.make} onChange={(e) => setNewVehicle({ ...newVehicle, make: e.target.value })} placeholder="e.g. Honda" />
                </Field>
                <Field label="Model">
                  <Input value={newVehicle.model} onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })} placeholder="e.g. Civic" />
                </Field>
              </div>
            </Card>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <h3 className={SECTION}>2 · Columns</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            {table.headers.map((header, index) => (
              <div key={index} className="flex items-center justify-between gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{header || `Column ${index + 1}`}</p>
                  <p className="text-xs font-mono text-ink/50 truncate">{sample(index) || 'empty'}</p>
                </div>
                <Select
                  size="sm"
                  className="w-44 flex-none"
                  aria-label={`Map column ${header || index + 1} to`}
                  value={columnField(index)}
                  onChange={(e) => mapColumn(index, e.target.value)}
                >
                  <option value={IGNORE}>Ignore</option>
                  {IMPORT_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </Select>
              </div>
            ))}
          </div>

          <Field
            label="Date format"
            className="w-64"
            hint={
              mapping.date == null ? null
                : detected.format == null ? "None of these formats reads the dates; check the date column."
                  : detected.ambiguous ? "Every day is 12 or less, so this can't tell MM/DD from DD/MM. Check the preview."
                    : 'Detected from the dates in the file.'
            }
          >
            <Select value={dateFormat} onChange={(e) => setDateChoice(e.target.value)}>
              {DATE_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}{f.value === detected.format ? ' (detected)' : ''}</option>
              ))}
            </Select>
          </Field>

          {problems.length > 0 && (
            <Card tone="red" padding="sm">
              {problems.map((problem) => <p key={problem} className="text-xs text-red">{problem}</p>)}
            </Card>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className={SECTION}>3 · Preview</h3>
            <div className="flex items-center gap-2">
              <Badge variant="pill" tone="green">{counts.new.toLocaleString('en-US')} new</Badge>
              <Badge variant="pill">{plural(counts.duplicate, 'duplicate')} skipped</Badge>
              <Badge variant="pill" tone={counts.invalid ? 'red' : 'neutral'}>{counts.invalid.toLocaleString('en-US')} invalid</Badge>
            </div>
          </div>
          {leftOut.length > 0 && (
            <p className="text-xs font-mono text-ink/50">Left out of this import: {leftOut.join(' and ')}.</p>
          )}
          {tooMany && (
            <p className="text-xs text-red">
              That's {plural(counts.new, 'new fill-up')}; import at most {MAX_IMPORT_ROWS.toLocaleString('en-US')} at a time.
            </p>
          )}

          <Segmented
            aria-label="Rows to show"
            value={view}
            onChange={setView}
            options={[
              { value: 'first', label: 'First 10 rows' },
              { value: 'invalid', label: `Invalid · ${counts.invalid}`, disabled: counts.invalid === 0 },
              { value: 'duplicate', label: `Skipped · ${counts.duplicate}`, disabled: counts.duplicate === 0 },
            ]}
            className="self-start"
          />

          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-ink/2.5 border-b border-ink/8">
                    <th className={TH}>Row</th>
                    <th className={TH}>Date</th>
                    <th className={TH}>Odometer</th>
                    <th className={TH}>Gal</th>
                    <th className={TH}>$/gal</th>
                    <th className={TH}>Total</th>
                    <th className={TH}>Tank</th>
                    <th className={TH}>MPG</th>
                    <th className={TH}>Station</th>
                    <th className={TH}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-sm text-ink/45">
                        {problems.length > 0 ? 'Map the columns above to see the rows.' : 'No rows to show.'}
                      </td>
                    </tr>
                  )}
                  {shown.map((item) => <PreviewRow key={item.row} item={item} mpg={mpg.get(item.row)} cells={cellsByRow.get(item.row)} mapping={mapping} />)}
                </tbody>
              </table>
            </div>
          </Card>
          {hiddenCount > 0 && <p className="text-xs font-mono text-ink/50">Showing the first {shown.length} of {counts[view]}.</p>}
        </section>
      </div>
    </Modal>
  )
}

/**
 * One row of the preview table, plus a line for its notes and, when it's skipped or invalid, the reason.
 * A row that couldn't be read shows the file's cells instead.
 */
function PreviewRow({ item, mpg, cells, mapping }) {
  const { tone, label } = STATUS[item.status]
  const raw = (field) => (mapping[field] == null ? '' : cells?.[mapping[field]] ?? '')
  const unread = Boolean(item.error)
  const muted = item.status === 'new' ? '' : 'text-ink/50'
  const hasDetail = Boolean(item.notes || item.reason)

  return (
    <>
      <tr className={hasDetail ? '' : 'border-b border-ink/8'}>
        <td className={`${TD} text-ink/45`}>{item.row}</td>
        <td className={`${TD} ${muted}`}>{unread ? raw('date') : item.date}</td>
        <td className={`${TD} ${muted}`}>{unread ? raw('odometer') : item.odometer.toLocaleString('en-US')}</td>
        <td className={`${TD} ${muted}`}>{unread ? raw('gallons') : item.gallons}</td>
        <td className={`${TD} ${muted}`}>{unread ? raw('pricePerGal') : `$${item.pricePerGal}`}</td>
        <td className={`${TD} ${muted}`}>{unread ? raw('total') : money(item.total)}</td>
        <td className={`${TD} ${muted}`}>{unread ? '' : item.isFull ? 'Full' : <Badge tone="amber">Partial</Badge>}</td>
        <td className={`${TD} ${mpg != null ? 'text-green' : 'text-ink/45'}`}>{mpg ?? '—'}</td>
        <td className={`${TD} ${muted} max-w-[110px] truncate`}>{unread ? raw('station') : item.station ?? ''}</td>
        <td className={TD}><Badge tone={tone}>{label}</Badge></td>
      </tr>
      {hasDetail && (
        <tr className="border-b border-ink/8">
          <td />
          <td colSpan={9} className="px-2 pb-2 text-xs">
            {item.notes && <p className="text-ink/60 break-words">Notes: {item.notes}</p>}
            {item.reason && <p className={item.status === 'invalid' ? 'text-red' : 'text-ink/50'}>{item.reason}</p>}
          </td>
        </tr>
      )}
    </>
  )
}
