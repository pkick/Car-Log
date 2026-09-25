import { useState } from 'react'
import { CATEGORY_BY_ID, CATEGORY_ICON, CATEGORY_TILE_CLASS, CATEGORY_TEXT_CLASS } from '../lib/serviceCategories'
import { FuelIcon } from '../components/icons'
import { useRecords } from '../context/RecordsContext'
import {
  computeFillMpg,
  getDueSoonItems,
  getDrivingRate,
  getMonthlySpend,
  getPricePaidBuckets,
  getRecords,
} from '../lib/vehicleStats'

const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

const shortDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()

const WINDOW_DAYS = { '90-days': 90, '6-months': 182, '1-year': 365, 'all-time': Infinity }
const WINDOW_LABEL = { '90-days': 'ROLLING 90 DAYS', '6-months': 'ROLLING 6 MONTHS', '1-year': 'ROLLING 1 YEAR', 'all-time': 'ALL TIME' }

function filterByWindow(items, windowKey) {
  const days = WINDOW_DAYS[windowKey]
  if (!isFinite(days)) return items
  const cutoff = daysAgo(days)
  return items.filter((i) => new Date(i.date) >= cutoff)
}

function filterByTrendRange(fillsWithMpgAsc, range) {
  if (range === '12 fills') return fillsWithMpgAsc.slice(-12)
  const days = range === '6 mo' ? 182 : 365
  const cutoff = daysAgo(days)
  return fillsWithMpgAsc.filter((f) => new Date(f.date) >= cutoff)
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
  const priceData = getPricePaidBuckets(fillsAsc)
  const maxPriceCount = priceData.length ? Math.max(...priceData.map((d) => d.count)) : 1
  const avgPrice = fillsAsc.length ? Math.round((fillsAsc.reduce((s, f) => s + f.pricePerGal, 0) / fillsAsc.length) * 100) / 100 : null
  const lowPrice = priceData.length ? priceData[0].price : null
  const highPrice = priceData.length ? priceData[priceData.length - 1].price : null

  // Looking ahead
  const dueSoonItems = getDueSoonItems(vehicle, records, vehicle.odometer)
  const oilDue = dueSoonItems.find((i) => i.categoryId === 'oil')
  const tiresDue = dueSoonItems.find((i) => i.categoryId === 'tires')
  const brakesDue = dueSoonItems.find((i) => i.categoryId === 'brakes')
  const OilIcon = CATEGORY_ICON.oil
  const TiresCategoryIcon = CATEGORY_ICON.tires
  const BrakesCategoryIcon = CATEGORY_ICON.brakes
  const drivingRate = getDrivingRate(fillsAsc)
  const costPerMileOverall = records4.totalMiles > 0
    ? (fillsAsc.reduce((s, f) => s + f.total, 0) / records4.totalMiles)
    : null
  const fuelCostNext90 = costPerMileOverall != null
    ? Math.round(costPerMileOverall * (drivingRate.milesPerMonth * 3))
    : null

  return (
    <main className="px-10 py-8 max-w-[1180px] w-full space-y-[22px]">
      {/* Fuel Economy Chart */}
      <div className="bg-white rounded-2.5 border border-ink/10 p-6">
        <div className="flex items-center justify-between mb-5.5">
          <h2 className="text-2xl font-bold">Fuel economy over time</h2>
          <div className="flex gap-2">
            {['12 fills', '6 mo', '1 yr'].map((range) => (
              <button
                key={range}
                onClick={() => setTrendRange(range)}
                className={`px-3 py-1.5 text-xs font-mono font-semibold rounded transition-colors ${
                  trendRange === range
                    ? 'bg-slate text-white'
                    : 'bg-ink/6 text-ink/45 hover:bg-ink/10'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
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
      </div>

      {/* Three-card row */}
      <div className="grid gap-[22px]" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        {/* Cost Per Mile */}
        <div className="bg-slate text-page rounded-2.5 border border-ink/10 p-6">
          <div className="flex items-center justify-between mb-5.5">
            <h3 className="font-semibold text-sm">Cost per mile</h3>
            <select
              value={cpmWindow}
              onChange={(e) => setCpmWindow(e.target.value)}
              className="bg-white/24 border border-white/24 rounded-lg text-xs font-mono text-page px-2 py-1.5"
            >
              <option value="90-days">Rolling 90 days</option>
              <option value="6-months">6 months</option>
              <option value="1-year">1 year</option>
              <option value="all-time">All time</option>
            </select>
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
        </div>

        {/* Records */}
        <div className="bg-white rounded-2.5 border border-ink/10 p-6">
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
        </div>

        {/* Monthly Spend */}
        <div className="bg-white rounded-2.5 border border-ink/10 p-6">
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
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-[22px]" style={{ gridTemplateColumns: '1.25fr 1fr' }}>
        {/* Price Paid Per Gallon */}
        <div className="bg-white rounded-2.5 border border-ink/10 p-6">
          <div className="mb-5.5">
            <p className="text-xs font-mono text-ink/45 tracking-widest uppercase mb-2">Last {fillsAsc.length} fill-ups</p>
            <h3 className="text-2xl font-bold">{avgPrice != null ? `$${avgPrice.toFixed(2)}` : '—'} <span className="text-sm font-mono text-ink/45">avg</span></h3>
            <p className="text-xs font-mono text-ink/45 mt-1">
              {lowPrice != null ? `low $${lowPrice.toFixed(2)} · high $${highPrice.toFixed(2)}` : 'no fill-ups yet'}
            </p>
          </div>

          {priceData.length === 0 ? (
            <div className="h-24 mb-6 flex items-center justify-center text-sm text-ink/45">No data yet</div>
          ) : (
          <div className="flex gap-1 h-24 mb-6">
            {priceData.map((item) => (
              <div key={item.price} className="flex-1 flex flex-col justify-end items-center">
                <div
                  className={`w-full rounded-[4px_4px_2px_2px] ${
                    item.price >= 3.55 ? 'bg-red' : item.price <= 3.32 ? 'bg-green' : 'bg-accent'
                  }`}
                  style={{ height: `${(item.count / maxPriceCount) * 100}%` }}
                />
              </div>
            ))}
          </div>
          )}

          <div className="space-y-2 text-xs font-mono">
            <p className="text-ink/60">Spend / month <span className="float-right font-semibold">${monthlyData.length ? monthlyData[monthlyData.length - 1].fuel : 0}</span></p>
            <p className="text-ink/60">Gal / month <span className="float-right font-semibold">{drivingRate.milesPerMonth && chartAvg ? Math.round((drivingRate.milesPerMonth / chartAvg) * 10) / 10 : '—'}</span></p>
            <p className="text-ink/60">Cheapest fill <span className="float-right font-semibold">{records4.cheapestGal != null ? `$${records4.cheapestGal.toFixed(2)}/gal` : '—'}</span></p>
          </div>
        </div>

        {/* Looking Ahead */}
        <div className="bg-white rounded-2.5 border border-ink/10 p-6">
          <h3 className="font-semibold text-sm mb-4">Looking ahead</h3>
          <div className="space-y-3">
            {oilDue && (
              <div className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded flex items-center justify-center flex-none ${CATEGORY_TILE_CLASS[CATEGORY_BY_ID.oil.color]} ${CATEGORY_TEXT_CLASS[CATEGORY_BY_ID.oil.color]}`}>
                  <OilIcon size={14} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Next oil change</p>
                  <p className={`text-xs font-mono ${oilDue.status === 'overdue' ? 'text-red' : 'text-ink/50'}`}>{oilDue.remainingLabel}</p>
                </div>
              </div>
            )}
            {tiresDue && (
              <div className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded flex items-center justify-center flex-none ${CATEGORY_TILE_CLASS[CATEGORY_BY_ID.tires.color]} ${CATEGORY_TEXT_CLASS[CATEGORY_BY_ID.tires.color]}`}>
                  <TiresCategoryIcon size={14} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Next tire rotation</p>
                  <p className={`text-xs font-mono ${tiresDue.status === 'overdue' ? 'text-red' : 'text-ink/50'}`}>{tiresDue.remainingLabel}</p>
                </div>
              </div>
            )}
            {brakesDue && (
              <div className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded flex items-center justify-center flex-none ${CATEGORY_TILE_CLASS[CATEGORY_BY_ID.brakes.color]} ${CATEGORY_TEXT_CLASS[CATEGORY_BY_ID.brakes.color]}`}>
                  <BrakesCategoryIcon size={14} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Brake fluid</p>
                  <p className={`text-xs font-mono ${brakesDue.status === 'overdue' ? 'text-red' : 'text-ink/50'}`}>{brakesDue.remainingLabel}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded bg-[oklch(0.56_0.19_258/20%)] flex items-center justify-center text-accent flex-none">
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
        </div>
      </div>
    </main>
  )
}
