import { Fragment } from 'react'
import { Sparkline } from './charts'
import { StatTile } from './ui'
import { MPG_COMPARE_TANKS } from '../lib/dashboardStats'

const COLUMNS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }

const dollars = (n) => `$${Math.round(n).toLocaleString('en-US')}`
const perMile = (n) => `$${n.toFixed(2)}`
const signed = (delta) => (delta == null ? null : `${delta > 0 ? '+' : ''}${delta}%`)
/** Good news when it went the way `upIsGood` says. */
const toneOf = (delta, upIsGood) => (!delta ? 'neutral' : delta > 0 === upIsGood ? 'good' : 'bad')

/**
 * Mono lines under a tile's sparkline. Each line is a list of segments joined by " · ", and a narrow tile wraps
 * between segments, never inside one.
 * @param {object} props
 * @param {Array<Array<string | false | null>>} props.lines
 */
function Details({ lines }) {
  return (
    <div className="flex flex-col gap-0.5 text-xs font-mono text-ink/50">
      {lines.map((line, i) => (
        <p key={i}>
          {line.filter(Boolean).map((segment, j) => (
            <Fragment key={j}>
              {j > 0 && ' · '}
              <span className="whitespace-nowrap">{segment}</span>
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  )
}

/**
 * The Dashboard's stat rail: Avg MPG, all-in cost per mile, spend this month and driving pace, each with a
 * sparkline over the selected range. Fuel-only tiles need fuel tracking; the rest need fuel or service tracking.
 *
 * @param {object} props
 * @param {import('../lib/dashboardStats').MpgTile} props.mpg
 * @param {import('../lib/dashboardStats').CostPerMileTile} props.costPerMile
 * @param {import('../lib/dashboardStats').MonthSpendTile} props.spend
 * @param {import('../lib/dashboardStats').PaceTile} props.pace
 * @param {import('../lib/dashboardStats').DashboardRange} props.range
 * @param {boolean} props.tracksFuel
 * @param {boolean} props.tracksService
 */
export default function DashboardTiles({ mpg, costPerMile, spend, pace, range, tracksFuel, tracksService }) {
  const tanks = mpg.points.length
  const tiles = [
    tracksFuel && {
      key: 'mpg',
      label: 'Avg MPG',
      value: mpg.average != null ? mpg.average.toFixed(1) : '—',
      unit: 'mpg',
      delta: signed(mpg.delta),
      deltaTone: toneOf(mpg.delta, true),
      trend: mpg.points.map((t) => t.mpg),
      trendLabel: `MPG per full tank, ${range.caption}`,
      lines: [
        [
          mpg.delta != null
            ? `last ${MPG_COMPARE_TANKS} vs previous ${mpg.comparedWith} tanks`
            : tanks > 0
              ? `${tanks} full ${tanks === 1 ? 'tank' : 'tanks'} · ${range.caption}`
              : `no full tanks · ${range.caption}`,
        ],
      ],
    },
    (tracksFuel || tracksService) && {
      key: 'cpm',
      label: 'Cost / mile',
      value: costPerMile.costPerMile != null ? perMile(costPerMile.costPerMile) : '—',
      unit: 'all-in',
      trend: costPerMile.trend,
      trendLabel: `All-in cost per mile by month, ${range.caption}`,
      lines: [
        costPerMile.perMile
          ? [
              tracksFuel && `fuel ${perMile(costPerMile.perMile.fuel)}`,
              tracksService && `service ${perMile(costPerMile.perMile.service)}`,
              costPerMile.perMile.policies > 0 && `ins. & reg. ${perMile(costPerMile.perMile.policies)}`,
            ]
          : ['needs two odometer readings'],
      ],
    },
    (tracksFuel || tracksService) && {
      key: 'spend',
      label: `Spent in ${spend.monthLabel}`,
      value: dollars(spend.current),
      delta: signed(spend.delta),
      deltaTone: toneOf(spend.delta, false),
      trend: spend.trend,
      trendLabel: `Spend by month, ${range.caption}`,
      lines: [
        [tracksFuel && `fuel ${dollars(spend.fuel)}`, tracksService && `service ${dollars(spend.service)}`],
        [`vs ${dollars(spend.previous)} on ${spend.previousLabel}`],
      ],
    },
    (tracksFuel || tracksService) && {
      key: 'pace',
      label: 'Driving',
      value: pace.pace ? pace.pace.milesPerMonth.toLocaleString('en-US') : '—',
      unit: 'mi / mo',
      trend: pace.trend,
      trendLabel: `Miles driven per month, ${range.caption}`,
      lines: [[pace.pace ? `${pace.pace.milesPerYear.toLocaleString('en-US')} mi / yr pace` : 'needs two odometer readings']],
    },
  ].filter(Boolean)

  if (!tiles.length) return null
  return (
    <div className={`grid ${COLUMNS[tiles.length]} gap-3.5 mb-5.5`}>
      {tiles.map((tile) => (
        <StatTile key={tile.key} label={tile.label} value={tile.value} unit={tile.unit} delta={tile.delta} deltaTone={tile.deltaTone}>
          <Sparkline values={tile.trend} ariaLabel={tile.trendLabel} />
          <Details lines={tile.lines} />
        </StatTile>
      ))}
    </div>
  )
}
