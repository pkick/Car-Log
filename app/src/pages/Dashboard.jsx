import { useState } from 'react'
import { FuelIcon, WrenchIcon } from '../components/icons'
import { useRecords } from '../context/RecordsContext'
import { getFuelStats, getDueSoonItems } from '../lib/vehicleStats'
import { CATEGORY_BY_ID, CATEGORY_ICON, CATEGORY_ID_BY_SERVICE, CATEGORY_TILE_CLASS, CATEGORY_TEXT_CLASS } from '../lib/serviceCategories'

function formatServicesList(services) {
  if (services.length <= 2) return services.join(', ')
  return `${services.slice(0, 2).join(', ')}, +${services.length - 2} more`
}

// Tuned for the dark "Coming up" card — same hues as CATEGORY_TILE_CLASS but with more alpha
// so the tint reads against bg-slate instead of white.
const DUE_TILE_CLASS = {
  amber: 'bg-[oklch(0.66_0.14_68/22%)]',
  red: 'bg-[oklch(0.55_0.17_28/22%)]',
  teal: 'bg-[oklch(0.56_0.13_195/22%)]',
  accent: 'bg-[oklch(0.56_0.19_258/22%)]',
  slate: 'bg-white/10',
}

export default function Dashboard({ vehicle, onViewTrends, onLogService }) {
  const { getFillUpsForVehicle, getServiceRecordsForVehicle } = useRecords()
  const [activityFilter, setActivityFilter] = useState('All')
  const fills = getFillUpsForVehicle(vehicle.id)
  const records = getServiceRecordsForVehicle(vehicle.id)

  const { avgMpg, costPerMile, spendThisMonth, spendDelta, withMpg } = getFuelStats(fills)
  const dueSoonItems = getDueSoonItems(vehicle, records, vehicle.odometer)
  const dueCount = dueSoonItems.filter((i) => i.status !== 'ok').length
  const overdueCount = dueSoonItems.filter((i) => i.status === 'overdue').length
  const comingUp = dueSoonItems.filter((i) => i.status !== 'ok').slice(0, 3)

  const stats = [
    { label: 'AVG MPG', value: avgMpg != null ? String(avgMpg) : '—', unit: 'mpg', delta: null },
    { label: 'COST / MILE', value: costPerMile != null ? `$${costPerMile.toFixed(2)}` : '—', unit: 'per mi', delta: null },
    {
      label: 'FUEL SPEND',
      value: `$${spendThisMonth}`,
      unit: 'this mo',
      delta: spendDelta != null ? `${spendDelta > 0 ? '+' : ''}${spendDelta}%` : null,
      deltaType: spendDelta > 0 ? 'negative' : 'positive',
    },
    {
      label: 'SERVICES',
      value: String(dueCount),
      unit: 'due soon',
      delta: overdueCount > 0 ? `${overdueCount} overdue` : null,
      deltaType: 'negative',
    },
  ]

  const recentMpgFills = withMpg.filter((f) => f.mpg != null).slice(-10)
  const chartData = recentMpgFills.map((f, i) => ({ label: `F${i + 1}`, value: f.mpg }))
  const maxValue = chartData.length ? Math.max(...chartData.map((d) => d.value)) : 1

  const half = Math.ceil(recentMpgFills.length / 2)
  const avgOf = (arr) => (arr.length ? Math.round((arr.reduce((s, f) => s + f.mpg, 0) / arr.length) * 10) / 10 : null)
  const recentAvg = avgOf(recentMpgFills.slice(-half))
  const priorAvg = avgOf(recentMpgFills.slice(0, recentMpgFills.length - half))
  const mpgTrendDelta = recentAvg != null && priorAvg != null && priorAvg > 0
    ? Math.round(((recentAvg - priorAvg) / priorAvg) * 1000) / 10
    : null

  const activity = [
    ...fills.map((f) => ({
      key: `fuel-${f.id}`,
      type: 'Fuel',
      date: f.date,
      odometer: f.odometer,
      title: f.isFull ? 'Fill-up' : 'Partial fill-up',
      detail: `${f.gallons} gal · ${f.odometer.toLocaleString()} mi`,
      amount: f.total,
    })),
    ...records.map((r) => ({
      key: `service-${r.id}`,
      type: 'Service',
      date: r.date,
      odometer: r.odometer,
      title: formatServicesList(r.services),
      detail: `${r.shopName || 'DIY'} · ${r.odometer.toLocaleString()} mi`,
      amount: r.cost,
      categoryId: r.categoryId,
      categoryIds: [...new Set(r.services.map((s) => CATEGORY_ID_BY_SERVICE[s]).filter(Boolean))],
    })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date) || b.odometer - a.odometer)
    .filter((item) => activityFilter === 'All' || item.type === activityFilter)

  return (
    <main className="px-10 py-8 max-w-[1180px] w-full">
      {/* Page Title */}
      <div className="mb-5.5">
        <p className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 mb-2">DASHBOARD</p>
        <h1 className="text-5xl font-bold tracking-tight mb-0">{vehicle.nickname} — overview</h1>
      </div>

      {/* Stat Rail */}
      <div className="grid grid-cols-4 gap-[14px] mb-[22px]">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white border border-ink/10 rounded-2.5 p-4.5 flex flex-col gap-3 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 whitespace-nowrap">{stat.label}</span>
              {stat.delta && (
                <span
                  className={`text-xs font-mono font-semibold whitespace-nowrap ${
                    stat.deltaType === 'positive' ? 'text-green' : 'text-red'
                  }`}
                >
                  {stat.delta}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-bold tracking-tighter">{stat.value}</span>
              <span className="text-xs font-mono whitespace-nowrap">{stat.unit}</span>
            </div>
            <div className="h-1 bg-ink/9 rounded-full overflow-hidden">
              <div className="h-full bg-accent w-[70%]" />
            </div>
          </div>
        ))}
      </div>

      {/* Chart + Coming Up Row */}
      <div className="grid gap-[22px] mb-[22px]" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
        {/* Fuel Economy Chart */}
        <div className="bg-white rounded-2.5 p-[22px] border border-ink/10">
          <div className="flex items-center justify-between mb-5.5">
            <h2 className="text-2xl font-bold">Fuel economy</h2>
            <span className="text-xs font-mono text-ink/40 tracking-wider">LAST 10 FILLS</span>
          </div>
          <div className="flex items-center gap-2.5 mb-5.5">
            <span className="text-5xl font-bold tracking-tighter">{avgMpg ?? '—'}</span>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-mono">mpg avg</span>
              {mpgTrendDelta != null && (
                <span
                  className={`inline-block text-xs font-mono font-semibold px-2.5 py-1.5 rounded-full w-fit ${
                    mpgTrendDelta >= 0 ? 'bg-[oklch(0.5_0.14_150/10%)] text-green' : 'bg-[oklch(0.55_0.17_28/10%)] text-red'
                  }`}
                >
                  {mpgTrendDelta > 0 ? '+' : ''}{mpgTrendDelta}% vs prior fills
                </span>
              )}
            </div>
          </div>

          {/* Chart */}
          {chartData.length === 0 ? (
            <div className="h-[150px] mb-6 flex items-center justify-center text-sm text-ink/45">
              No full-tank fill-ups logged yet.
            </div>
          ) : (
          <div className="flex gap-2 h-[150px] mb-6 px-1">
            {chartData.map((item, idx) => (
              <div
                key={item.label}
                className="flex-1 flex flex-col justify-end items-center gap-1"
              >
                <div
                  className={`w-full rounded-[6px_6px_3px_3px] ${
                    idx === chartData.length - 1 ? 'bg-slate' : 'bg-accent'
                  }`}
                  style={{ height: `${(item.value / maxValue) * 100}%` }}
                />
                <span className="text-xs font-mono">{item.value}</span>
                <span className="text-xs font-mono text-ink/40">{item.label}</span>
              </div>
            ))}
          </div>
          )}

          <button
            onClick={onViewTrends}
            className="w-full py-3 border border-ink/10 rounded-2 text-sm font-semibold hover:bg-ink/3 transition-colors"
          >
            All trends
          </button>
        </div>

        {/* Coming Up */}
        <div className="bg-slate text-page rounded-2.5 p-[22px] border border-ink/10">
          <div className="flex items-center justify-between mb-[22px]">
            <h2 className="text-2xl font-bold">Coming up</h2>
            <span className="bg-accent text-slate text-xs font-mono font-semibold px-2 py-1.5 rounded-lg">{dueCount} DUE</span>
          </div>

          {comingUp.length === 0 && (
            <p className="text-sm text-page/60">Nothing due soon — you're all caught up.</p>
          )}

          {comingUp.map((item) => {
            const cat = CATEGORY_BY_ID[item.categoryId]
            const Icon = CATEGORY_ICON[item.categoryId]
            return (
            <div key={item.intervalId} className="flex items-start gap-3.5 mb-4 pb-4 border-b border-white/12 last:border-b-0 last:mb-0 last:pb-0">
              <div className={`w-14 h-14 rounded-2 flex items-center justify-center flex-none ${DUE_TILE_CLASS[cat.color]}`}>
                <Icon size={30} className="text-page" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3 mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{item.name}</h3>
                  </div>
                  <span
                    className={`text-sm font-mono font-semibold ${
                      item.status === 'overdue'
                        ? 'text-red'
                        : 'text-teal'
                    }`}
                  >
                    {item.remainingLabel}
                  </span>
                </div>
                <div className={`h-1 rounded-full mb-2 ${
                  item.status === 'overdue'
                    ? 'bg-[oklch(0.55_0.17_28/40%)]'
                    : 'bg-[oklch(0.56_0.13_195/40%)]'
                }`} />
                <p className="text-xs font-mono text-page/60">{item.detailLabel}</p>
              </div>
            </div>
            )
          })}

          <button
            onClick={onLogService}
            className="w-full mt-[22px] py-3 border border-white/20 rounded-2 text-page font-semibold hover:bg-white/8 transition-colors"
          >
            Log service
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2.5 border border-ink/10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink/8">
          <h2 className="text-2xl font-bold">Recent activity</h2>
          <div className="flex gap-1.5 p-1 bg-ink/6 rounded-lg">
            {['All', 'Fuel', 'Service'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActivityFilter(filter)}
                className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-colors ${
                  filter === activityFilter
                    ? 'bg-slate text-white'
                    : 'text-ink/40 hover:text-ink/60'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[296px] overflow-y-auto p-6">
          {activity.length === 0 ? (
            <p className="text-sm text-ink/45">
              {activityFilter === 'All' ? 'No activity logged yet.' : `No ${activityFilter.toLowerCase()} activity logged yet.`}
            </p>
          ) : (
            <div className="divide-y divide-ink/6">
              {activity.map((item) => {
                return (
                  <div key={item.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3 min-w-0">
                      {item.type === 'Fuel' ? (
                        <div className="w-8 h-8 rounded-lg bg-[oklch(0.56_0.19_258/10%)] text-accent flex items-center justify-center flex-none">
                          <FuelIcon size={24} />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-ink/6 text-ink/45 flex items-center justify-center flex-none">
                          <WrenchIcon size={24} />
                        </div>
                      )}
                      <div className="min-w-0">
                        {item.type === 'Fuel' ? (
                          <p className="text-sm font-semibold truncate">{item.title}</p>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold">{item.title}</p>
                            {item.categoryIds.slice(0, 4).map((catId) => {
                              const cat = CATEGORY_BY_ID[catId]
                              const Icon = CATEGORY_ICON[catId]
                              return (
                                <span
                                  key={catId}
                                  className={`w-5 h-5 rounded flex items-center justify-center flex-none ${CATEGORY_TILE_CLASS[cat.color]} ${CATEGORY_TEXT_CLASS[cat.color]}`}
                                >
                                  <Icon size={11} />
                                </span>
                              )
                            })}
                            {item.categoryIds.length > 4 && (
                              <span className="w-5 h-5 rounded flex items-center justify-center flex-none bg-ink/6 text-ink/45 text-[10px] font-mono font-semibold">
                                +{item.categoryIds.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                        <p className="text-xs font-mono text-ink/50">{item.date} · {item.detail}</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold whitespace-nowrap">${item.amount.toFixed(2)}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
