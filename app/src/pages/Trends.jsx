import { useState } from 'react'
import { CATEGORY_BY_ID, CATEGORY_ICON, CATEGORY_TILE_CLASS, CATEGORY_TEXT_CLASS } from '../lib/serviceCategories'
import { FuelIcon } from '../components/icons'
import { Card, PageHeader, Segmented, Select } from '../components/ui'
import { useRecords } from '../context/RecordsContext'
import {
  computeFillMpg,
  getDueSoonItems,
  getDrivingRate,
  getMonthlyFuelAverages,
  getMonthlySpend,
  getPriceHistory,
  getRecords,
} from '../lib/vehicleStats'
import { isWithinDays, parseISODate } from '../lib/dates'

const shortDate = (dateStr) => parseISODate(dateStr)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() ?? '—'

const WINDOW_DAYS = { '90-days': 90, '6-months': 182, '1-year': 365, 'all-time': Infinity }
const WINDOW_LABEL = { '90-days': 'ROLLING 90 DAYS', '6-months': 'ROLLING 6 MONTHS', '1-year': 'ROLLING 1 YEAR', 'all-time': 'ALL TIME' }

const RANGES = ['12 fills', '6 mo', '1 yr'].map((value) => ({ value, label: value }))

const PRICE_BAR_CLASS = { high: 'bg-red', normal: 'bg-accent', low: 'bg-green' }
// Half the price chart's height spans at least this change from the average, so a 1% wobble stays small.
const PRICE_CHART_MIN_CHANGE = 0.04

const formatChange = (change) => `${change > 0 ? '+' : ''}${(change * 100).toFixed(1)}%`

function filterByWindow(items, windowKey) {
  const days = WINDOW_DAYS[windowKey]
  if (!isFinite(days)) return items
  return items.filter((i) => isWithinDays(i.date, days))
}

function filterByTrendRange(fillsWithMpgAsc, range) {
  if (range === '12 fills') return fillsWithMpgAsc.slice(-12)
  const days = range === '6 mo' ? 182 : 365
  return fillsWithMpgAsc.filter((f) => isWithinDays(f.date, days))
}

export default function Trends({ vehicle }) {
  const { getFillUpsForVehicle, getServiceRecordsForVehicle } = useRecords()
  const [trendRange, setTrendRange] = useState('12 fills')
  const [cpmWindow, setCpmWindow] = useState('90-days')

  const fillsAsc = [...getFillUpsForVehicle(vehicle.id)].sort((a, b) => a.odometer - b.odometer)
  const records = getServiceRecordsForVehicle(vehicle.id)
  const withMpg = computeFillMpg(fillsAsc)

  const rangedFills = filterByTrendRange(withMpg, trendRange).filter((f) => f.mpg != null)
  const chartData = rangedFills.map((f, i) => ({ label: `F${i + 1}`, value: f.mpg }))
  const maxValue = chartData.length ? Math.max(...chartData.map((d) => d.value)) : 1
  const chartAvg = chartData.length ? Math.round((chartData.reduce((s, d) => s + d.value, 0) / chartData.length) * 10) / 10 : null

  // Cost per mile card
  const windowedFills = filterByWindow(fillsAsc, cpmWindow)
  const windowedRecords = filterByWindow(records, cpmWindow)
  const windowFuelSpend = windowedFills.reduce((s, f) => s + f.total, 0)
  const windowServiceSpend = windowedRecords.reduce((s, r) => s + r.cost, 0)
  const windowMiles = windowedFills.length >= 2
    ? Math.max(...windowedFills.map((f) => f.odometer)) - Math.min(...windowedFills.map((f) => f.odometer))
    : 0
  const windowTotalSpend = windowFuelSpend + windowServiceSpend
  const windowCostPerMile = windowMiles > 0 ? Math.round((windowTotalSpend / windowMiles) * 100) / 100 : null
  const fuelPct = windowTotalSpend > 0 ? Math.round((windowFuelSpend / windowTotalSpend) * 100) : 0
  const maintPct = windowTotalSpend > 0 ? 100 - fuelPct : 0
  const windowCaption = windowedFills.length
    ? `${WINDOW_LABEL[cpmWindow]} · ${shortDate(windowedFills[0].date)} – ${shortDate(windowedFills[windowedFills.length - 1].date)} · ${windowMiles.toLocaleString()} MI`
    : `${WINDOW_LABEL[cpmWindow]} · no fill-ups logged`

  // Records
  const records4 = getRecords(fillsAsc)

  // Monthly spend
  const monthlyData = getMonthlySpend(fillsAsc, records)

  // Price paid per gallon
  const priceHistory = getPriceHistory(fillsAsc)
  const priceHalfRange = Math.max(PRICE_CHART_MIN_CHANGE, ...priceHistory.points.map((p) => Math.abs(p.change)))
  const fuelAverages = getMonthlyFuelAverages(fillsAsc)
  const fuelAveragesHint = fuelAverages.months
    ? `Average of the last ${fuelAverages.months} calendar months, this one included`
    : undefined

  // Looking ahead
  const dueSoonItems = getDueSoonItems(vehicle, records, vehicle.odometer)
  const drivingRate = getDrivingRate(fillsAsc)
  const costPerMileOverall = records4.totalMiles > 0
    ? (fillsAsc.reduce((s, f) => s + f.total, 0) / records4.totalMiles)
    : null
  const fuelCostNext90 = costPerMileOverall != null
    ? Math.round(costPerMileOverall * (drivingRate.milesPerMonth * 3))
    : null

  return (
    <main className="px-10 py-8 max-w-[1180px] w-full space-y-[22px]">
      <PageHeader eyebrow="Trends" title={`${vehicle.nickname} — trends`} />

      {/* Fuel Economy Chart */}
      <Card padding="lg">
        <div className="flex items-center justify-between mb-5.5">
          <h2 className="text-2xl font-bold">Fuel economy over time</h2>
          <Segmented aria-label="Range" options={RANGES} value={trendRange} onChange={setTrendRange} />
        </div>

        {chartData.length === 0 ? (
          <div className="h-[230px] mb-8 flex items-center justify-center text-sm text-ink/45">
            No full-tank fill-ups in this range.
          </div>
        ) : (
        <div className="flex gap-2 h-[230px] px-1 mb-8">
          {chartData.map((item, idx) => (
            <div key={item.label} className="flex-1 flex flex-col justify-end items-center">
              <div
                className={`w-full rounded-[6px_6px_3px_3px] ${
                  idx === chartData.length - 1 ? 'bg-slate' : 'bg-accent'
                }`}
                style={{ height: `${(item.value / maxValue) * 100}%` }}
              />
              <span className="text-xs font-mono mt-2">{item.value}</span>
            </div>
          ))}
        </div>
        )}

        <div className="flex gap-2 pt-4 border-t border-ink/8">
          <div className="w-2 h-2 rounded-full bg-accent mt-1" />
          <span className="text-xs font-mono">Average: {chartAvg != null ? `${chartAvg} mpg` : '—'}</span>
        </div>
      </Card>

      {/* Three-card row */}
      <div className="grid gap-[22px]" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        {/* Cost Per Mile */}
        <Card tone="dark" padding="lg">
          <div className="flex items-center justify-between mb-5.5">
            <h3 className="font-semibold text-sm">Cost per mile</h3>
            <Select
              size="sm"
              tone="dark"
              aria-label="Cost per mile window"
              value={cpmWindow}
              onChange={(e) => setCpmWindow(e.target.value)}
            >
              <option value="90-days">Rolling 90 days</option>
              <option value="6-months">6 months</option>
              <option value="1-year">1 year</option>
              <option value="all-time">All time</option>
            </Select>
          </div>
          <div className="text-4xl font-bold tracking-tighter text-accent mb-3">
            {windowCostPerMile != null ? `$${windowCostPerMile.toFixed(2)}` : '—'}
          </div>
          <p className="text-xs font-mono text-page/60 mb-6">{windowCaption}</p>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono">Fuel</span>
              <span className="font-semibold">{fuelPct}%</span>
            </div>
            <div className="w-full h-2 bg-white/12 rounded-full overflow-hidden">
              <div className="h-full bg-accent" style={{ width: `${fuelPct}%` }} />
            </div>
          </div>

          <div className="space-y-2 mt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono">Maintenance</span>
              <span className="font-semibold">{maintPct}%</span>
            </div>
            <div className="w-full h-2 bg-white/12 rounded-full overflow-hidden">
              <div className="h-full bg-teal" style={{ width: `${maintPct}%` }} />
            </div>
          </div>
        </Card>

        {/* Records */}
        <Card padding="lg">
          <h3 className="font-semibold text-sm mb-4">Records</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-mono text-ink/45 mb-1">BEST FILL</p>
              <p className="text-lg font-bold">{records4.bestMpg != null ? `${records4.bestMpg} mpg` : '—'}</p>
            </div>
            <div>
              <p className="text-xs font-mono text-ink/45 mb-1">WORST FILL</p>
              <p className="text-lg font-bold">{records4.worstMpg != null ? `${records4.worstMpg} mpg` : '—'}</p>
            </div>
            <div>
              <p className="text-xs font-mono text-ink/45 mb-1">CHEAPEST GAL</p>
              <p className="text-lg font-bold">{records4.cheapestGal != null ? `$${records4.cheapestGal.toFixed(2)}` : '—'}</p>
            </div>
            <div>
              <p className="text-xs font-mono text-ink/45 mb-1">TOTAL LOGGED</p>
              <p className="text-lg font-bold">{records4.totalMiles.toLocaleString()} mi</p>
            </div>
          </div>
        </Card>

        {/* Monthly Spend */}
        <Card padding="lg">
          <h3 className="font-semibold text-sm mb-4">Monthly spend</h3>
          <div className="space-y-2 mb-4">
            {monthlyData.map((item) => {
              const total = item.fuel + item.service
              return (
              <div key={item.month}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-mono">{item.month}</span>
                  <span className="font-semibold">${total.toFixed(0)}</span>
                </div>
                <div className="flex h-2 gap-1 bg-ink/6 rounded-full overflow-hidden">
                  {total > 0 && (
                    <>
                      <div className="h-full bg-accent" style={{ width: `${(item.fuel / total) * 100}%` }} />
                      <div className="h-full bg-teal" style={{ width: `${(item.service / total) * 100}%` }} />
                    </>
                  )}
                </div>
              </div>
              )
            })}
          </div>
          <div className="flex gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded bg-accent" />
              <span className="font-mono">Fuel</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded bg-teal" />
              <span className="font-mono">Service</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-[22px]" style={{ gridTemplateColumns: '1.25fr 1fr' }}>
        {/* Price Paid Per Gallon */}
        <Card padding="lg">
          <div className="mb-5.5">
            <p className="text-xs font-mono text-ink/45 tracking-widest uppercase mb-2">
              Last {priceHistory.points.length} {priceHistory.points.length === 1 ? 'fill-up' : 'fill-ups'}
            </p>
            <h3 className="text-2xl font-bold">{priceHistory.average != null ? `$${priceHistory.average.toFixed(2)}` : '—'} <span className="text-sm font-mono text-ink/45">avg</span></h3>
            <p className="text-xs font-mono text-ink/45 mt-1">
              {priceHistory.low != null ? `low $${priceHistory.low.toFixed(2)} · high $${priceHistory.high.toFixed(2)}` : 'no fill-ups yet'}
            </p>
          </div>

          {priceHistory.points.length === 0 ? (
            <div className="h-24 mb-6 flex items-center justify-center text-sm text-ink/45">No data yet</div>
          ) : (
          <div className="mb-6">
            <div className="relative h-24">
              <div className="absolute inset-x-0 top-1/2 h-px bg-ink/20" />
              <div className="absolute inset-0 flex gap-1">
                {priceHistory.points.map((point) => (
                  <div
                    key={point.id}
                    className="flex-1 relative"
                    title={`${shortDate(point.date)} · $${point.pricePerGal.toFixed(2)}/gal · ${formatChange(point.change)} vs avg`}
                  >
                    <div
                      className={`absolute inset-x-0 mx-auto max-w-6 ${PRICE_BAR_CLASS[point.level]} ${
                        point.change >= 0 ? 'bottom-1/2 rounded-[4px_4px_0_0]' : 'top-1/2 rounded-[0_0_4px_4px]'
                      }`}
                      style={{ height: `max(2px, ${(Math.abs(point.change) / priceHalfRange) * 50}%)` }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-1 mt-2">
              {priceHistory.points.map((point) => (
                <span key={point.id} className="flex-1 text-center text-[10px] font-mono text-ink/45 whitespace-nowrap">
                  {shortDate(point.date)}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-px bg-ink/40" />
                <span className="font-mono">avg</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded bg-red" />
                <span className="font-mono">&gt;3% above</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded bg-accent" />
                <span className="font-mono">within 3%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded bg-green" />
                <span className="font-mono">&gt;3% below</span>
              </div>
            </div>
          </div>
          )}

          <div className="space-y-2 text-xs font-mono">
            <p className="text-ink/60" title={fuelAveragesHint}>Spend / month <span className="float-right font-semibold">{fuelAverages.spendPerMonth != null ? `$${fuelAverages.spendPerMonth}` : '—'}</span></p>
            <p className="text-ink/60" title={fuelAveragesHint}>Gal / month <span className="float-right font-semibold">{fuelAverages.gallonsPerMonth ?? '—'}</span></p>
            <p className="text-ink/60">Cheapest fill <span className="float-right font-semibold">{records4.cheapestGal != null ? `$${records4.cheapestGal.toFixed(2)}/gal` : '—'}</span></p>
          </div>
        </Card>

        {/* Looking Ahead */}
        <Card padding="lg">
          <h3 className="font-semibold text-sm mb-4">Looking ahead</h3>
          <div className="space-y-3">
            {dueSoonItems.length === 0 && (
              <p className="text-sm text-ink/45">No service intervals set up for {vehicle.nickname}.</p>
            )}
            {dueSoonItems.map((item) => {
              const { color } = CATEGORY_BY_ID[item.categoryId] ?? CATEGORY_BY_ID.other
              const Icon = CATEGORY_ICON[item.categoryId] ?? CATEGORY_ICON.other
              return (
                <div key={item.intervalId} className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded flex items-center justify-center flex-none ${CATEGORY_TILE_CLASS[color]} ${CATEGORY_TEXT_CLASS[color]}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className={`text-xs font-mono ${item.status === 'overdue' ? 'text-red' : 'text-ink/50'}`}>{item.remainingLabel}</p>
                  </div>
                </div>
              )
            })}
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded bg-accent/20 flex items-center justify-center text-accent flex-none">
                <FuelIcon size={14} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Fuel cost next 90 days</p>
                <p className="text-xs font-mono text-ink/50">{fuelCostNext90 != null ? `~$${fuelCostNext90}` : '—'}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-slate/10 rounded-lg border border-slate/20">
            <p className="text-xs font-mono text-ink/60">
              <strong>Driving rate</strong> — {drivingRate.milesPerMonth.toLocaleString()} mi/mo · {drivingRate.milesPerYear.toLocaleString()} mi/yr projected · {drivingRate.fillsPerYear} fill-ups/yr at this rate
            </p>
          </div>
        </Card>
      </div>
    </main>
  )
}
