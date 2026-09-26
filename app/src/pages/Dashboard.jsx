import { useState } from 'react'
import { LineChart } from '../components/charts'
import { FuelIcon } from '../components/icons'
import { Button, Card, EmptyState, PageHeader, Segmented } from '../components/ui'
import ActivityTimeline from '../components/ActivityTimeline'
import AttentionBanner from '../components/AttentionBanner'
import DashboardTiles from '../components/DashboardTiles'
import EmptyVehicleDashboard from '../components/EmptyVehicleDashboard'
import LogFillupModal from '../components/LogFillupModal'
import LogPolicyModal from '../components/LogPolicyModal'
import LogServiceModal from '../components/LogServiceModal'
import SetupCard from '../components/SetupCard'
import UpNextCard from '../components/UpNextCard'
import { useRecords } from '../context/RecordsContext'
import { getActivityItems } from '../lib/activity'
import { rankDueItems } from '../lib/attention'
import {
  DASHBOARD_RANGES,
  DEFAULT_RANGE,
  findDashboardRange,
  getCostPerMileTile,
  getFirstRecordDate,
  getMonthSpendTile,
  getMpgTile,
  getOdometerReadings,
  getPaceTile,
  getRangeMonths,
  getRecentMilesPerDay,
} from '../lib/dashboardStats'
import { currentYear, parseISODate, todayISO } from '../lib/dates'
import { isEmptyVehicle } from '../lib/onboarding'
import { getRenewalItems } from '../lib/renewals'
import { getDueSoonItems } from '../lib/vehicleStats'
import { getDrivingPace, withProjectedDates } from '../lib/projections'

// The range is a viewing preference, remembered per browser for every vehicle.
const RANGE_KEY = 'odometer:dashboard-range'

function readRange() {
  try {
    return findDashboardRange(localStorage.getItem(RANGE_KEY)).value
  } catch {
    return DEFAULT_RANGE
  }
}

function writeRange(value) {
  try {
    localStorage.setItem(RANGE_KEY, value)
  } catch {
    // Storage is unavailable: the range resets on the next visit.
  }
}

/** `Aug 28`, or `Aug 28, 2025` outside the current year. */
function formatDay(iso) {
  const date = parseISODate(iso)
  if (!date) return '—'
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return date.getFullYear() === currentYear() ? day : `${day}, ${date.getFullYear()}`
}

const mpgValue = (value) => `${value.toFixed(1)} mpg`

export default function Dashboard({ vehicle, onViewTrends, onViewSchedule, onLogService, onLogFillup, onEditVehicle }) {
  const { getFillUpsForVehicle, getServiceRecordsForVehicle, getPolicyRecordsForVehicle, deleteFillUp, deleteServiceRecord, deletePolicyRecord } =
    useRecords()
  const [rangeValue, setRangeValue] = useState(readRange)
  // { kind: 'fuel' | 'service' | 'payment', editingRecord?, defaultCategoryId?, defaultType? } | null
  const [modal, setModal] = useState(null)
  const tracksFuel = vehicle.tracksFuel !== false
  const tracksService = vehicle.tracksService !== false
  const fills = getFillUpsForVehicle(vehicle.id)
  const records = getServiceRecordsForVehicle(vehicle.id)
  const payments = getPolicyRecordsForVehicle(vehicle.id)

  if (isEmptyVehicle(vehicle, fills, records)) {
    return (
      <EmptyVehicleDashboard vehicle={vehicle} onLogFillup={onLogFillup} onLogService={onLogService} onEditVehicle={onEditVehicle} />
    )
  }

  const today = todayISO()
  const range = findDashboardRange(rangeValue)
  // What the vehicle doesn't track stays out of every number, as it does out of the nav.
  const trackedFills = tracksFuel ? fills : []
  const trackedRecords = tracksService ? records : []
  const tracked = { fills: trackedFills, services: trackedRecords, policies: payments }
  const months = getRangeMonths(range, getFirstRecordDate(trackedFills, trackedRecords, payments), today)

  const mpg = getMpgTile(trackedFills, range.days, today)
  const milesPerDay = getRecentMilesPerDay(getOdometerReadings(trackedFills, trackedRecords), today)
  const dueItems = tracksService ? getDueSoonItems(vehicle, records, vehicle.odometer) : []
  const dueCount = dueItems.filter((item) => item.status !== 'ok').length
  const overdueCount = dueItems.filter((item) => item.status === 'overdue').length

  const mpgPoints = mpg.points.map((t) => ({ x: t.date, y: t.mpg, hollow: t.includesPartial, label: formatDay(t.date) }))
  const latestTank = mpg.points.at(-1)
  const mpgSummary = latestTank
    ? `${mpg.points.length} ${mpg.points.length === 1 ? 'tank' : 'tanks'} averaging ${mpgValue(mpg.average)}. Latest ${mpgValue(latestTank.mpg)} on ${formatDay(latestTank.date)}.`
    : undefined

  const changeRange = (value) => {
    setRangeValue(value)
    writeRange(value)
  }

  const deleteItem = (item) => ({ fuel: deleteFillUp, service: deleteServiceRecord, payment: deletePolicyRecord })[item.kind](item.id)
  const closeModal = () => setModal(null)

  return (
    <main className="px-10 py-8 max-w-[1180px] w-full">
      <PageHeader
        eyebrow="Dashboard"
        title={`${vehicle.nickname} — overview`}
        action={<Segmented aria-label="Dashboard range" options={DASHBOARD_RANGES} value={range.value} onChange={changeRange} />}
      />
      <SetupCard vehicle={vehicle} fillUps={fills} serviceRecords={records} onEditVehicle={onEditVehicle} onLogFillup={onLogFillup} />

      <AttentionBanner
        key={`attention-${vehicle.id}`}
        vehicleId={vehicle.id}
        dueItems={dueItems}
        renewals={getRenewalItems(vehicle, payments, today)}
        milesPerDay={milesPerDay}
        onLogService={(categoryId) => setModal({ kind: 'service', defaultCategoryId: categoryId })}
        onLogPayment={(type) => setModal({ kind: 'payment', defaultType: type })}
      />

      <DashboardTiles
        mpg={mpg}
        costPerMile={getCostPerMileTile(tracked, range.days, months, today)}
        spend={getMonthSpendTile(tracked, months, today)}
        pace={getPaceTile(tracked, range.days, months, today)}
        range={range}
        tracksFuel={tracksFuel}
        tracksService={tracksService}
      />

      <div className={`grid gap-5.5 mb-5.5 ${tracksService ? 'grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]' : 'grid-cols-1'}`}>
        {tracksFuel ? (
          <Card padding="lg" className="min-w-0 flex flex-col">
            <div className="flex items-baseline justify-between gap-3 mb-4">
              <h2 className="text-2xl font-bold">Fuel economy</h2>
              <span className="text-xs font-mono tracking-wider uppercase whitespace-nowrap text-ink/45">
                {range.caption} · {mpg.points.length} full {mpg.points.length === 1 ? 'tank' : 'tanks'}
              </span>
            </div>
            <LineChart
              points={mpgPoints}
              average={mpg.average}
              seriesLabel="MPG per full tank"
              hollowLabel="Includes partial fills"
              formatValue={mpgValue}
              height={220}
              ariaLabel={`Fuel economy, ${range.caption}`}
              summary={mpgSummary}
              emptyLabel="No full-tank fill-ups in this range."
            />
            <div className="mt-auto pt-5">
              <Button variant="ghost" className="w-full" onClick={onViewTrends}>
                All trends
              </Button>
            </div>
          </Card>
        ) : (
          <EmptyState
            icon={FuelIcon}
            title={`Fuel tracking is off for ${vehicle.nickname}`}
            body={<>{tracksService && 'This vehicle logs maintenance only. '}Turn fuel on to record fill-ups, MPG, and cost per mile.</>}
            action={<Button size="sm" onClick={onEditVehicle}>Enable fuel tracking</Button>}
          />
        )}

        {tracksService && (
          <UpNextCard
            items={withProjectedDates(rankDueItems(dueItems, milesPerDay, today), getDrivingPace(trackedFills, trackedRecords, today), today)}
            dueCount={dueCount}
            overdueCount={overdueCount}
            onViewSchedule={onViewSchedule}
          />
        )}
      </div>

      <ActivityTimeline
        key={`activity-${vehicle.id}`}
        items={getActivityItems({ fills: trackedFills, services: trackedRecords, payments })}
        tracksFuel={tracksFuel}
        tracksService={tracksService}
        onEdit={(item) => setModal({ kind: item.kind, editingRecord: item.record })}
        onDelete={deleteItem}
      />

      {modal?.kind === 'fuel' && <LogFillupModal vehicle={vehicle} editingFillUp={modal.editingRecord} onClose={closeModal} />}
      {modal?.kind === 'service' && (
        <LogServiceModal
          vehicle={vehicle}
          editingRecord={modal.editingRecord ?? null}
          defaultCategoryId={modal.defaultCategoryId}
          onClose={closeModal}
        />
      )}
      {modal?.kind === 'payment' && (
        <LogPolicyModal vehicle={vehicle} editingRecord={modal.editingRecord ?? null} defaultType={modal.defaultType} onClose={closeModal} />
      )}
    </main>
  )
}
