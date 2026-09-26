import { Fragment, useState } from 'react'
import { BarChart, LineChart, ProgressTrack } from '../components/charts'
import { FuelIcon, MapPinIcon } from '../components/icons'
import { Card, EmptyState, PageHeader, Segmented, Select, StatusChip } from '../components/ui'
import { useRecords } from '../context/RecordsContext'
import { formatTick } from '../lib/chartScale'
import { currentYear, parseISODate } from '../lib/dates'
import { CATEGORY_BY_ID, CATEGORY_ICON, CATEGORY_TEXT_CLASS, CATEGORY_TILE_CLASS } from '../lib/serviceCategories'
import {
  getAllInCostPerMile,
  getDrivingRate,
  getDueSoonItems,
  getMonthlyFuelAverages,
  getMonthlySpendByCategory,
  getMpgTrend,
  getPriceHistory,
  getRecords,
  getStationInsights,
} from '../lib/vehicleStats'

const MPG_RANGES = [
  { value: '12-fills', label: '12 fills', range: { tanks: 12 }, description: 'last 12 full tanks' },
  { value: '6-months', label: '6 mo', range: { days: 182 }, description: 'last 6 months' },
  { value: '1-year', label: '1 yr', range: { days: 365 }, description: 'last year' },
  { value: 'all', label: 'All', range: {}, description: 'all full tanks' },
]

const CPM_WINDOWS = [
  { value: '90-days', label: 'Rolling 90 days', caption: 'ROLLING 90 DAYS', days: 90 },
  { value: '6-months', label: '6 months', caption: 'ROLLING 6 MONTHS', days: 182 },
  { value: '1-year', label: '1 year', caption: 'ROLLING 1 YEAR', days: 365 },
  { value: 'all-time', label: 'All time', caption: 'ALL TIME', days: Infinity },
]

// Spend colors everywhere: fuel accent, service teal, insurance slate, registration the neutral gray.
const SPEND_SERIES = [
  { key: 'fuel', label: 'Fuel', tone: 'accent' },
  { key: 'service', label: 'Service', tone: 'teal' },
  { key: 'insurance', label: 'Insurance', tone: 'slate' },
  { key: 'registration', label: 'Registration', tone: 'neutral' },
]

// On the slate card, the insurance and registration share is drawn in page (slate on slate wouldn't show).
const CPM_PARTS = [
  { key: 'fuel', label: 'Fuel', bar: 'bg-accent' },
  { key: 'service', label: 'Service', bar: 'bg-teal' },
  { key: 'policies', label: 'Insurance & registration', bar: 'bg-page/60' },
]

const STATION_LIMIT = 5

/** `Aug 28`, or `Aug 28, 2025` outside the current year. */
function formatDay(iso) {
  const date = parseISODate(iso)
  if (!date) return '—'
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return date.getFullYear() === currentYear() ? day : `${day}, ${date.getFullYear()}`
}

const monthLabel = (key) => parseISODate(`${key}-01`)?.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() ?? key
const monthName = (key) => parseISODate(`${key}-01`)?.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) ?? key

const mpg = (value) => `${value.toFixed(1)} mpg`
const dollars = (value) => `$${Math.round(value).toLocaleString('en-US')}`
const dollarTick = (value, step) => formatTick(value, step, { prefix: '$' })
const perGallon = (value) => `$${value.toFixed(2)}`
const priceTick = (value, step) => formatTick(value, step, { prefix: '$', decimals: 2 })
const formatChange = (change) => `${change > 0 ? '+' : ''}${(change * 100).toFixed(1)}%`

function CardTitle({ title, caption }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-5">
      <h3 className="font-semibold text-sm">{title}</h3>
      {caption && <span className="text-xs font-mono tracking-wider uppercase whitespace-nowrap text-ink/45">{caption}</span>}
    </div>
  )
}

export default function Trends({ vehicle }) {
  const { getFillUpsForVehicle, getServiceRecordsForVehicle, getPolicyRecordsForVehicle } = useRecords()
  const [mpgRangeKey, setMpgRangeKey] = useState('12-fills')
  const [cpmWindowKey, setCpmWindowKey] = useState('90-days')

  const fills = getFillUpsForVehicle(vehicle.id)
  const services = getServiceRecordsForVehicle(vehicle.id)
  const policies = getPolicyRecordsForVehicle(vehicle.id)

  // Fuel economy
  const mpgRange = MPG_RANGES.find((r) => r.value === mpgRangeKey)
  const mpgTrend = getMpgTrend(fills, mpgRange.range)
  const mpgPoints = mpgTrend.points.map((t) => ({ x: t.date, y: t.mpg, hollow: t.includesPartial, label: formatDay(t.date) }))
  const latestTank = mpgTrend.points.at(-1)
  const mpgSummary = latestTank
    ? `${mpgTrend.points.length} ${mpgTrend.points.length === 1 ? 'tank' : 'tanks'} between ${mpg(Math.min(...mpgPoints.map((p) => p.y)))} and ${mpg(Math.max(...mpgPoints.map((p) => p.y)))}, averaging ${mpg(mpgTrend.average)}. Latest ${mpg(latestTank.mpg)} on ${formatDay(latestTank.date)}.`
    : undefined

  // Monthly spend
  const monthlySpend = getMonthlySpendByCategory(fills, services, policies)
  const yearTotal = monthlySpend.reduce((sum, m) => sum + m.total, 0)
  const spendBars = monthlySpend.map((m) => ({
    key: m.month,
    label: monthLabel(m.month),
    values: Object.fromEntries(SPEND_SERIES.map((s) => [s.key, m[s.key]])),
  }))
  const spendSummary = `${dollars(yearTotal)} over 12 months: ${SPEND_SERIES.map(
    (s) => `${s.label.toLowerCase()} ${dollars(monthlySpend.reduce((sum, m) => sum + m[s.key], 0))}`,
  ).join(', ')}.`

  // Cost per mile
  const cpmWindow = CPM_WINDOWS.find((w) => w.value === cpmWindowKey)
  const cpm = getAllInCostPerMile(fills, services, policies, cpmWindow.days)
  // A narrow card wraps the caption between segments, never inside one.
  const cpmCaption = (
    cpm
      ? [cpmWindow.caption, `${formatDay(cpm.firstDate)} – ${formatDay(cpm.lastDate)}`, `${cpm.miles.toLocaleString()} mi`]
      : [cpmWindow.caption, 'needs two odometer readings']
  ).map((segment) => segment.toUpperCase())
  const cpmSpend = cpm && { fuel: cpm.spend.fuel, service: cpm.spend.service, policies: cpm.spend.insurance + cpm.spend.registration }

  // Records
  const records = getRecords(fills)
  const recordRows = [
    ['Best tank', records.bestMpg ?? '—', records.bestMpg != null && 'mpg'],
    ['Worst tank', records.worstMpg ?? '—', records.worstMpg != null && 'mpg'],
    ['Cheapest gal', records.cheapestGal != null ? perGallon(records.cheapestGal) : '—'],
    ['Total logged', records.totalMiles.toLocaleString(), 'mi'],
  ]

  // Price per gallon
  const priceHistory = getPriceHistory(fills)
  const pricePoints = priceHistory.points.map((p) => ({
    x: p.date,
    y: p.pricePerGal,
    label: `${formatDay(p.date)} · ${formatChange(p.change)} vs avg`,
  }))
  const fuelAverages = getMonthlyFuelAverages(fills)
  const fuelAveragesHint = fuelAverages.months
    ? `Average of the last ${fuelAverages.months} calendar months, this one included`
    : undefined

  // Stations
  const stationInsights = getStationInsights(fills)

  // Looking ahead
  const dueSoonItems = getDueSoonItems(vehicle, services, vehicle.odometer)
  const drivingRate = getDrivingRate(fills)
  const fuelCostPerMile = records.totalMiles > 0 ? fills.reduce((sum, f) => sum + f.total, 0) / records.totalMiles : null
  const fuelCostNext90 = fuelCostPerMile != null ? Math.round(fuelCostPerMile * drivingRate.milesPerMonth * 3) : null

  return (
    <main className="px-10 py-8 max-w-[1180px] w-full">
      <PageHeader eyebrow="Trends" title={`${vehicle.nickname} — trends`} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5.5">
        {/* Fuel economy */}
        <Card padding="lg" className="min-w-0 md:col-span-2 xl:col-span-12">
          <div className="flex items-center justify-between gap-4 mb-5">
            <h2 className="text-2xl font-bold">Fuel economy over time</h2>
            <Segmented aria-label="Fuel economy range" options={MPG_RANGES} value={mpgRangeKey} onChange={setMpgRangeKey} />
          </div>
          <LineChart
            points={mpgPoints}
            average={mpgTrend.average}
            seriesLabel="MPG per full tank"
            hollowLabel="Includes partial fills"
            formatValue={mpg}
            height={240}
            ariaLabel={`Fuel economy, ${mpgRange.description}`}
            summary={mpgSummary}
            emptyLabel="No full-tank fill-ups in this range."
          />
        </Card>

        {/* Monthly spend */}
        <Card padding="lg" className="min-w-0 md:col-span-2 xl:col-span-7">
          <CardTitle title="Monthly spend" caption={`Last 12 months · ${dollars(yearTotal)}`} />
          <BarChart
            data={spendBars}
            series={SPEND_SERIES}
            stacked
            showValues
            height={230}
            formatValue={dollars}
            formatYTick={dollarTick}
            ariaLabel={`Monthly spend by category, ${monthName(monthlySpend[0].month)} to ${monthName(monthlySpend.at(-1).month)}`}
            summary={spendSummary}
            emptyLabel="Nothing spent in the last 12 months."
          />
        </Card>

        {/* Cost per mile */}
        <Card tone="dark" padding="lg" className="min-w-0 xl:col-span-5">
          <div className="flex items-center justify-between gap-3 mb-5">
            <h3 className="font-semibold text-sm">Cost per mile</h3>
            <Select
              size="sm"
              tone="dark"
              aria-label="Cost per mile window"
              value={cpmWindowKey}
              onChange={(e) => setCpmWindowKey(e.target.value)}
            >
              {CPM_WINDOWS.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl font-bold tracking-tighter text-accent">{cpm ? `$${cpm.costPerMile.toFixed(2)}` : '—'}</span>
            <span className="text-xs font-mono text-page/60">per mi · all-in</span>
          </div>
          <p className="text-xs font-mono text-page/60 mb-6">
            {cpmCaption.map((segment, i) => (
              <Fragment key={segment}>
                {i > 0 && ' · '}
                <span className="whitespace-nowrap">{segment}</span>
              </Fragment>
            ))}
          </p>

          <div className="space-y-3.5">
            {CPM_PARTS.map((part) => {
              const percent = cpm ? cpm.percent[part.key] : 0
              return (
                <div key={part.key} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-xs font-mono">
                    <span>{part.label}</span>
                    <span className="text-page/60 whitespace-nowrap">
                      {cpm ? dollars(cpmSpend[part.key]) : '—'} · <span className="font-semibold text-page">{percent}%</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-white/12 rounded-full overflow-hidden">
                    <div className={`h-full ${part.bar}`} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Records */}
        <Card padding="lg" className="min-w-0 xl:col-span-3">
          <CardTitle title="Records" />
          <dl className="grid grid-cols-2 xl:grid-cols-1 gap-x-4 gap-y-5">
            {recordRows.map(([label, value, unit]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 mb-1.5">{label}</dt>
                <dd className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold tracking-tight">{value}</span>
                  {unit && <span className="text-xs font-mono">{unit}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        {/* Price per gallon */}
        <Card padding="lg" className="min-w-0 xl:col-span-5">
          <CardTitle
            title="Price per gallon"
            caption={`Last ${priceHistory.points.length} ${priceHistory.points.length === 1 ? 'fill-up' : 'fill-ups'}`}
          />
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-4xl font-bold tracking-tighter">{priceHistory.average != null ? perGallon(priceHistory.average) : '—'}</span>
            <span className="text-xs font-mono text-ink/45">avg</span>
          </div>
          <p className="text-xs font-mono text-ink/45 mb-4">
            {priceHistory.low != null ? `low ${perGallon(priceHistory.low)} · high ${perGallon(priceHistory.high)}` : 'no fill-ups yet'}
          </p>
          <LineChart
            points={pricePoints}
            average={priceHistory.average}
            formatValue={perGallon}
            formatYTick={priceTick}
            height={150}
            ariaLabel={`Price per gallon, last ${priceHistory.points.length} fill-ups`}
            emptyLabel="No fill-ups yet."
          />
          <dl className="mt-4 pt-4 border-t border-ink/8 space-y-2 text-xs font-mono">
            <div className="flex justify-between gap-3" title={fuelAveragesHint}>
              <dt className="text-ink/60">Spend / month</dt>
              <dd className="font-semibold">{fuelAverages.spendPerMonth != null ? `$${fuelAverages.spendPerMonth}` : '—'}</dd>
            </div>
            <div className="flex justify-between gap-3" title={fuelAveragesHint}>
              <dt className="text-ink/60">Gal / month</dt>
              <dd className="font-semibold">{fuelAverages.gallonsPerMonth ?? '—'}</dd>
            </div>
          </dl>
        </Card>

        {/* Stations */}
        {stationInsights.cheapest ? (
          <Card padding="lg" className="min-w-0 xl:col-span-4">
            <CardTitle
              title="Stations"
              caption={`${stationInsights.stations.length} ${stationInsights.stations.length === 1 ? 'station' : 'stations'}`}
            />
            <Card tone="accent" padding="sm" className="mb-4">
              <p className="text-xs font-mono font-semibold tracking-widest uppercase text-accent mb-1">Cheapest</p>
              <p className="text-sm font-semibold truncate">{stationInsights.cheapest.station}</p>
              <p className="text-xs font-mono text-ink/60">
                {perGallon(stationInsights.cheapest.averagePrice)}/gal avg · {stationInsights.cheapest.fills}{' '}
                {stationInsights.cheapest.fills === 1 ? 'fill-up' : 'fill-ups'}
              </p>
            </Card>
            <ul className="divide-y divide-ink/8">
              {stationInsights.stations.slice(0, STATION_LIMIT).map((s) => (
                <li key={s.station} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{s.station}</p>
                    <p className="text-xs font-mono text-ink/45">
                      {s.fills} {s.fills === 1 ? 'fill-up' : 'fill-ups'}
                    </p>
                  </div>
                  <span className="text-sm font-mono font-semibold tabular-nums flex-none">{perGallon(s.averagePrice)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <EmptyState
            icon={MapPinIcon}
            title="No stations yet"
            body="Add the station when you log a fill-up to compare prices here."
            className="min-w-0 xl:col-span-4"
          />
        )}

        {/* Looking ahead */}
        <Card padding="lg" className="min-w-0 md:col-span-2 xl:col-span-12">
          <CardTitle title="Looking ahead" />
          {dueSoonItems.length === 0 ? (
            <p className="text-sm text-ink/45">No service intervals set up for {vehicle.nickname}.</p>
          ) : (
            <ul className="flex flex-col gap-5">
              {dueSoonItems.map((item) => {
                const { color } = CATEGORY_BY_ID[item.categoryId] ?? CATEGORY_BY_ID.other
                const Icon = CATEGORY_ICON[item.categoryId] ?? CATEGORY_ICON.other
                return (
                  <li
                    key={item.intervalId}
                    className="grid grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,12rem)] items-center gap-x-5 gap-y-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-md flex items-center justify-center flex-none ${CATEGORY_TILE_CLASS[color]} ${CATEGORY_TEXT_CLASS[color]}`}
                      >
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{item.name}</p>
                        <p className="text-xs font-mono text-ink/50 truncate">{item.detailLabel}</p>
                      </div>
                    </div>
                    <ProgressTrack
                      className="col-span-2 order-last xl:col-span-1 xl:order-none"
                      ariaLabel={item.name}
                      progress={item.progress}
                      status={item.status}
                      lastLabel={item.lastLabel}
                      dueLabel={item.dueLabel ?? undefined}
                    />
                    <div className="flex flex-col items-end gap-1 text-right">
                      <StatusChip status={item.status} />
                      <span className={`text-xs font-mono ${item.status === 'overdue' ? 'text-red' : 'text-ink/60'}`}>
                        {item.remainingLabel}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="grid md:grid-cols-2 items-center gap-4 mt-6 pt-5 border-t border-ink/8">
            <div className="flex items-center gap-3">
              <span
                className={`w-8 h-8 rounded-md flex items-center justify-center flex-none ${CATEGORY_TILE_CLASS.accent} ${CATEGORY_TEXT_CLASS.accent}`}
              >
                <FuelIcon size={16} />
              </span>
              <div>
                <p className="text-sm font-semibold">Fuel cost next 90 days</p>
                <p className="text-xs font-mono text-ink/50">{fuelCostNext90 != null ? `~$${fuelCostNext90.toLocaleString()}` : '—'}</p>
              </div>
            </div>
            <Card tone="muted" padding="sm">
              <p className="text-xs font-mono text-ink/60">
                <strong>Driving rate</strong> — {drivingRate.milesPerMonth.toLocaleString()} mi/mo ·{' '}
                {drivingRate.milesPerYear.toLocaleString()} mi/yr projected · {drivingRate.fillsPerYear} fill-ups/yr at this rate
              </p>
            </Card>
          </div>
        </Card>
      </div>
    </main>
  )
}
