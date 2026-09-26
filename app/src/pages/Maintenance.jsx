import { useContext, useId, useState } from 'react'
import { ProgressTrack } from '../components/charts'
import { Button, Card, Chip, EmptyState, Field, Input, NumberInput, PageHeader, Segmented, StatusChip } from '../components/ui'
import { WrenchIcon } from '../components/icons'
import LogServiceModal from '../components/LogServiceModal'
import { useRecords } from '../context/RecordsContext'
import { useToast } from '../context/toast'
import { VehicleContext } from '../context/VehicleContext'
import { currentYear, parseISODate, todayISO } from '../lib/dates'
import {
  countByStatus,
  filterServiceHistory,
  getHistoryCategoryIds,
  getRecordCategoryIds,
  getYearlyServiceSpend,
  parseBaseline,
} from '../lib/maintenance'
import { PACE_MONTHS, getDrivingPace, milesPerMonth, withProjectedDates } from '../lib/projections'
import {
  CATEGORY_BG_CLASS,
  CATEGORY_BY_ID,
  CATEGORY_ICON,
  CATEGORY_ID_BY_SERVICE,
  CATEGORY_TEXT_CLASS,
  CATEGORY_TILE_CLASS,
} from '../lib/serviceCategories'
import { getDueSoonItems, getServiceHistorySorted } from '../lib/vehicleStats'

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'overdue', label: 'Overdue', dot: 'bg-red', empty: 'Nothing is overdue.' },
  { value: 'coming-up', label: 'Coming up', dot: 'bg-amber', empty: 'Nothing is coming up.' },
  { value: 'ok', label: 'OK', dot: 'bg-green', empty: 'Nothing is on track yet.' },
]

const NO_SERVICES_HINT = 'Pick the services for this interval in Edit vehicle'
const NO_ODOMETER_HINT = 'Log an odometer reading first'

// The schedule's columns from xl up; below that the track gets its own line. The actions column has a fixed width
// so the header row, which has no buttons, lines up with the rows.
const SCHEDULE_COLUMNS = 'xl:grid-cols-[2rem_minmax(0,13rem)_minmax(0,1fr)_minmax(0,11rem)_10.5rem]'

const usd = (amount) => amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

/** `Jun 10`, or `Jun 10, 2025` outside the current year. */
function formatDay(iso) {
  const date = parseISODate(iso)
  if (!date) return iso || '—'
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return date.getFullYear() === currentYear() ? day : `${day}, ${date.getFullYear()}`
}

function formatServicesList(services) {
  if (services.length <= 2) return services.join(', ')
  return `${services.slice(0, 2).join(', ')} +${services.length - 2}`
}

function CategoryTile({ categoryId }) {
  const { color } = CATEGORY_BY_ID[categoryId] ?? CATEGORY_BY_ID.other
  const Icon = CATEGORY_ICON[categoryId] ?? CATEGORY_ICON.other
  return (
    <span
      aria-hidden="true"
      className={`w-8 h-8 rounded-md flex items-center justify-center flex-none ${CATEGORY_TILE_CLASS[color]} ${CATEGORY_TEXT_CLASS[color]}`}
    >
      <Icon size={16} />
    </span>
  )
}

/**
 * "When was it last done?" for an interval with no service on record. Saves the answer as the interval's baseline.
 */
function BaselineForm({ item, interval, vehicle, onSave, onCancel }) {
  const toast = useToast()
  const [form, setForm] = useState({
    date: interval.baselineDate ?? '',
    odometer: interval.baselineOdometer != null ? String(interval.baselineOdometer) : '',
  })
  const [errors, setErrors] = useState({})
  const [saveError, setSaveError] = useState(null)
  const [saving, setSaving] = useState(false)
  const needsOdometer = interval.miles != null
  const hasBaseline = item.measuredFrom === 'baseline'

  const update = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value })
    setErrors({ ...errors, [field]: null })
  }

  const save = async (baseline, message) => {
    setSaving(true)
    setSaveError(null)
    try {
      await onSave(baseline)
      toast.success(message, item.name)
    } catch (err) {
      setSaveError(err.message)
      setSaving(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const parsed = parseBaseline(form, { needsOdometer, currentOdometer: vehicle.odometer })
    if (parsed.error) {
      setErrors({ [parsed.field]: parsed.error })
      return
    }
    save(parsed, 'Last done saved')
  }

  return (
    <Card as="form" tone="muted" padding="sm" className="col-span-full" onSubmit={handleSubmit} noValidate>
      <p className="text-sm font-semibold">When was {item.name.toLowerCase()} last done?</p>
      <p className="text-xs text-ink/60 mt-0.5 mb-3">
        Until a service is logged, the schedule counts from this instead of the purchase.
      </p>
      <div className="flex flex-wrap items-start gap-3">
        <Field label="Date" error={errors.date} className="w-44">
          <Input type="date" max={todayISO()} value={form.date} onChange={update('date')} autoFocus />
        </Field>
        <Field label="Odometer" hint={needsOdometer ? undefined : 'Optional'} error={errors.odometer} className="w-44">
          <NumberInput inputMode="numeric" unit="mi" value={form.odometer} onChange={update('odometer')} />
        </Field>
        <div className="flex items-center gap-2 pt-6">
          <Button type="submit" loading={saving}>
            Save
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          {hasBaseline && (
            <Button
              variant="link-danger"
              size="sm"
              className="ml-2"
              disabled={saving}
              onClick={() => save({ baselineDate: null, baselineOdometer: null }, 'Last done cleared')}
            >
              Clear
            </Button>
          )}
        </div>
      </div>
      {saveError && <p className="text-xs text-red mt-2">{saveError}</p>}
    </Card>
  )
}

function ScheduleRow({ item, interval, vehicle, marking, baselineOpen, onMarkDone, onLogNow, onToggleBaseline, onSaveBaseline }) {
  const hintId = useId()
  const hasServices = interval.services?.length > 0
  const hasOdometer = vehicle.odometer > 0
  const blockedHint = !hasServices ? NO_SERVICES_HINT : !hasOdometer ? NO_ODOMETER_HINT : null
  const overdue = item.status === 'overdue'
  const statusLine = overdue ? item.remainingLabel : [item.remainingLabel, item.projectedLabel].filter(Boolean).join(' · ')

  return (
    <li className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] ${SCHEDULE_COLUMNS} items-center gap-x-5 gap-y-3 px-5 py-4`}>
      <CategoryTile categoryId={item.categoryId} />

      <div className="min-w-0">
        <p className="text-sm font-semibold truncate">{item.name}</p>
        <p className="text-xs font-mono text-ink/50 truncate">{item.detailLabel || 'No limits set'}</p>
        {item.measuredFrom !== 'record' && (
          <Button variant="link" size="sm" className="mt-1" aria-expanded={baselineOpen} onClick={onToggleBaseline}>
            Set last done
          </Button>
        )}
      </div>

      <ProgressTrack
        className="col-span-full order-last xl:col-span-1 xl:order-none"
        ariaLabel={item.name}
        progress={item.progress}
        status={item.status}
        lastLabel={item.lastLabel}
        dueLabel={item.dueLabel ?? undefined}
      />

      <div className="hidden xl:flex flex-col items-start gap-1 min-w-0">
        <StatusChip status={item.status} />
        <p className={`text-xs font-mono ${overdue ? 'text-red' : 'text-ink/60'}`} title={item.projectedLabel && !overdue ? 'Projected from your driving pace' : undefined}>
          {statusLine}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-3">
          <span className="xl:hidden">
            <StatusChip status={item.status} />
          </span>
          <Button
            variant={overdue ? 'secondary' : 'ghost'}
            size="sm"
            loading={marking}
            disabled={Boolean(blockedHint)}
            title={blockedHint ?? undefined}
            aria-describedby={blockedHint ? hintId : undefined}
            onClick={onMarkDone}
          >
            Mark done
          </Button>
          <Button variant="link" size="sm" onClick={onLogNow}>
            Log now
          </Button>
        </div>
        <p className={`xl:hidden text-xs font-mono ${overdue ? 'text-red' : 'text-ink/60'}`}>{statusLine}</p>
      </div>

      {blockedHint && (
        <p id={hintId} className="col-span-full order-last text-xs font-mono text-ink/50 xl:text-right">
          {blockedHint}.
        </p>
      )}

      {baselineOpen && (
        <div className="col-span-full order-last">
          <BaselineForm item={item} interval={interval} vehicle={vehicle} onSave={onSaveBaseline} onCancel={onToggleBaseline} />
        </div>
      )}
    </li>
  )
}

function YearlySpendCard({ records }) {
  const year = currentYear()
  const spend = getYearlyServiceSpend(records, year)
  return (
    <Card padding="lg" className="min-w-0 self-start">
      <h2 className="font-semibold text-sm mb-4">{year} service spend</h2>
      <p className="text-4xl font-bold tracking-tighter tabular-nums">{usd(spend.total)}</p>
      <p className="text-xs font-mono text-ink/45 mt-1.5 mb-5">
        {spend.count} {spend.count === 1 ? 'service' : 'services'} logged
      </p>
      {spend.categories.length === 0 ? (
        <p className="text-sm text-ink/45">No service logged in {year} yet.</p>
      ) : (
        <ul className="space-y-3.5">
          {spend.categories.map((c) => {
            const category = CATEGORY_BY_ID[c.categoryId] ?? CATEGORY_BY_ID.other
            return (
              <li key={c.categoryId} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-xs font-mono">
                  <span>{category.label}</span>
                  <span className="font-semibold tabular-nums">{usd(c.amount)}</span>
                </div>
                <div aria-hidden="true" className="h-1.5 rounded-full bg-ink/8 overflow-hidden">
                  <div className={`h-full rounded-full ${CATEGORY_BG_CLASS[category.color]}`} style={{ width: `${c.share * 100}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export default function Maintenance({ vehicle, onLogService }) {
  const { getFillUpsForVehicle, getServiceRecordsForVehicle, addServiceRecord, deleteServiceRecord, removeServiceRecord } = useRecords()
  const { updateVehicle } = useContext(VehicleContext)
  const toast = useToast()
  const [modalState, setModalState] = useState(null) // { editingRecord, defaultCategoryId } | null
  const [statusFilter, setStatusFilter] = useState('all')
  const [markingId, setMarkingId] = useState(null)
  const [baselineId, setBaselineId] = useState(null)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState(null)

  const records = getServiceRecordsForVehicle(vehicle.id)
  const intervals = vehicle.intervals ?? []
  const pace = getDrivingPace(getFillUpsForVehicle(vehicle.id), records)
  const perMonth = milesPerMonth(pace)
  const items = withProjectedDates(getDueSoonItems(vehicle, records, vehicle.odometer), pace)
  const counts = countByStatus(items)
  const shownItems = statusFilter === 'all' ? items : items.filter((item) => item.status === statusFilter)
  const activeFilter = STATUS_FILTERS.find((f) => f.value === statusFilter)

  const history = getServiceHistorySorted(records)
  const historyCategoryIds = getHistoryCategoryIds(history)
  const activeCategory = historyCategoryIds.includes(categoryFilter) ? categoryFilter : null
  const shownHistory = filterServiceHistory(history, { query, categoryId: activeCategory })
  const filtering = query.trim() !== '' || activeCategory != null

  const markDone = async (item, interval) => {
    const [service] = interval.services
    setMarkingId(item.intervalId)
    try {
      const id = await addServiceRecord({
        vehicleId: vehicle.id,
        date: todayISO(),
        odometer: vehicle.odometer,
        categoryId: CATEGORY_ID_BY_SERVICE[service] ?? interval.categoryId ?? 'other',
        services: [service],
        cost: 0,
        performedBy: 'diy',
        shopName: '',
        partsUsed: '',
        notes: '',
      })
      toast.undo(`Marked done: ${item.name}`, {
        onUndo: () => removeServiceRecord(id).catch((err) => toast.error(`Couldn't undo ${item.name}`, err.message)),
      })
    } catch (err) {
      toast.error(`Couldn't mark ${item.name} done`, err.message)
    } finally {
      setMarkingId(null)
    }
  }

  const saveBaseline = async (intervalId, baseline) => {
    await updateVehicle(vehicle.id, {
      intervals: intervals.map((interval) => (interval.id === intervalId ? { ...interval, ...baseline } : interval)),
    })
    setBaselineId(null)
  }

  const statusOptions = STATUS_FILTERS.map((f) => ({
    value: f.value,
    label: (
      <span className="inline-flex items-center gap-1.5">
        {f.dot && <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />}
        {f.label}
        <span className="tabular-nums">{counts[f.value]}</span>
      </span>
    ),
  }))

  const clearHistoryFilters = () => {
    setQuery('')
    setCategoryFilter(null)
  }

  return (
    <main className="px-10 py-8 max-w-[1180px] w-full">
      <PageHeader
        eyebrow="Maintenance"
        title={`${vehicle.nickname} — service`}
        subtitle={
          <>
            {vehicle.odometer.toLocaleString()} mi
            {perMonth != null && (
              <span title={`From your odometer readings over the last ${PACE_MONTHS} months`}>
                {' '}· driving ~{perMonth.toLocaleString()} mi/mo
              </span>
            )}
          </>
        }
        action={<Button onClick={onLogService}>Log service</Button>}
      />

      {/* Schedule */}
      <section aria-labelledby="schedule-heading" className="mb-5.5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 id="schedule-heading" className="text-2xl font-bold">
            Schedule
          </h2>
          {items.length > 0 && (
            <Segmented aria-label="Show intervals by status" options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
          )}
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={WrenchIcon}
            title="No service intervals"
            body={`Add intervals to ${vehicle.nickname} in Edit vehicle to see what's due and when.`}
          />
        ) : (
          <Card padding="none">
            <div
              aria-hidden="true"
              className={`hidden xl:grid ${SCHEDULE_COLUMNS} gap-x-5 px-5 pt-3.5 pb-2.5 border-b border-ink/8 text-xs font-mono font-semibold tracking-widest uppercase text-ink/45`}
            >
              <span />
              <span>Interval</span>
              <span>Progress</span>
              <span>Status</span>
              <span />
            </div>
            {shownItems.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-ink/45">{activeFilter.empty}</p>
            ) : (
              <ul className="divide-y divide-ink/8">
                {shownItems.map((item) => {
                  const interval = intervals.find((i) => i.id === item.intervalId)
                  return (
                    <ScheduleRow
                      key={item.intervalId}
                      item={item}
                      interval={interval}
                      vehicle={vehicle}
                      marking={markingId === item.intervalId}
                      baselineOpen={baselineId === item.intervalId}
                      onMarkDone={() => markDone(item, interval)}
                      onLogNow={() => setModalState({ defaultCategoryId: item.categoryId })}
                      onToggleBaseline={() => setBaselineId(baselineId === item.intervalId ? null : item.intervalId)}
                      onSaveBaseline={(baseline) => saveBaseline(item.intervalId, baseline)}
                    />
                  )
                })}
              </ul>
            )}
          </Card>
        )}
      </section>

      <div className="grid gap-5.5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* History */}
        <Card as="section" padding="none" aria-labelledby="history-heading" className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5.5 pt-5 pb-4">
            <h2 id="history-heading" className="text-2xl font-bold">
              History
            </h2>
            {history.length > 0 && (
              <Input
                type="search"
                aria-label="Search service history"
                placeholder="Search services, shops, parts, notes"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-72"
              />
            )}
          </div>

          {historyCategoryIds.length > 1 && (
            <div role="group" aria-label="Filter history by category" className="flex flex-wrap gap-2 px-5.5 pb-4">
              <Chip size="sm" selected={activeCategory == null} onClick={() => setCategoryFilter(null)}>
                All
              </Chip>
              {historyCategoryIds.map((id) => (
                <Chip key={id} size="sm" selected={activeCategory === id} onClick={() => setCategoryFilter(activeCategory === id ? null : id)}>
                  {CATEGORY_BY_ID[id].label}
                </Chip>
              ))}
            </div>
          )}

          <p className="sr-only" aria-live="polite">
            {filtering ? `${shownHistory.length} of ${history.length} services shown` : ''}
          </p>

          {history.length === 0 ? (
            <p className="px-5.5 pt-6 pb-10 text-center text-sm text-ink/45 border-t border-ink/8">
              No service history logged yet for {vehicle.nickname}.
            </p>
          ) : shownHistory.length === 0 ? (
            <div className="px-5.5 pt-6 pb-10 flex flex-col items-center gap-2 border-t border-ink/8">
              <p className="text-sm text-ink/45">{query.trim() ? `No services match “${query.trim()}”.` : 'No services in this category.'}</p>
              <Button variant="link" size="sm" onClick={clearHistoryFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <ul className="border-t border-ink/8 divide-y divide-ink/8">
              {shownHistory.map((service) => {
                const [firstCategory = 'other'] = getRecordCategoryIds(service)
                const performedBy = service.performedBy === 'diy' ? 'DIY' : service.shopName || 'Shop'
                return (
                  <li key={service.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto_auto_auto] items-center gap-x-4 px-5.5 py-3">
                    <CategoryTile categoryId={firstCategory} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" title={service.services.join(', ')}>
                        {formatServicesList(service.services)}
                      </p>
                      <p className="text-xs font-mono text-ink/50 truncate">
                        {performedBy} · {formatDay(service.date)}
                      </p>
                    </div>
                    <span className="text-xs font-mono text-ink/50 tabular-nums text-right">{service.odometer.toLocaleString()} mi</span>
                    <span className="text-sm font-semibold tabular-nums text-right w-20">{usd(service.cost)}</span>
                    <div className="flex justify-end gap-3">
                      <Button variant="link" size="sm" onClick={() => setModalState({ editingRecord: service })}>
                        EDIT
                      </Button>
                      <Button variant="link-danger" size="sm" onClick={() => deleteServiceRecord(service.id)}>
                        DEL
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <YearlySpendCard records={records} />
      </div>

      {modalState && (
        <LogServiceModal
          vehicle={vehicle}
          editingRecord={modalState.editingRecord}
          defaultCategoryId={modalState.defaultCategoryId}
          onClose={() => setModalState(null)}
        />
      )}
    </main>
  )
}
