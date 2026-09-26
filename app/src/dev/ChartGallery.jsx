// Dev-only: the components/charts kit in every state, shown at the end of /dev/ui (UiGallery.jsx).
// Data is shaped like the seed: The Wagon at ~31 mpg, $3.28–3.46 a gallon, and a year of spend.
import { BarChart, LineChart, ProgressTrack, Sparkline } from '../components/charts'
import { Card, StatTile, StatusChip } from '../components/ui'
import { formatTick } from '../lib/chartScale'

const FILLS = [
  { x: '2026-04-24', mpg: 31.4, price: 3.28 },
  { x: '2026-05-06', mpg: 31.4, price: 3.31 },
  { x: '2026-05-18', mpg: 31.2, price: 3.35 },
  { x: '2026-05-30', mpg: 30.9, price: 3.3, partial: true },
  { x: '2026-06-11', mpg: 31.8, price: 3.42 },
  { x: '2026-06-23', mpg: 30.6, price: 3.39 },
  { x: '2026-07-05', mpg: 28.4, price: 3.44 },
  { x: '2026-07-17', mpg: 30.6, price: 3.46 },
  { x: '2026-07-29', mpg: 33.9, price: 3.41 },
  { x: '2026-08-10', mpg: 31.5, price: 3.38, partial: true },
  { x: '2026-08-28', mpg: 32.2, price: 3.46 },
]

const mean = (values) => Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 100) / 100

const MPG_POINTS = FILLS.map(({ x, mpg, partial }) => ({ x, y: mpg, hollow: partial }))
const MPG_AVERAGE = Math.round(mean(FILLS.map((f) => f.mpg)) * 10) / 10
const PRICE_POINTS = FILLS.map(({ x, price, partial }) => ({ x, y: price, hollow: partial }))
const PRICE_AVERAGE = mean(FILLS.map((f) => f.price))
const FLAT_POINTS = FILLS.slice(0, 8).map(({ x }) => ({ x, y: 31 }))

const MONTHS = [
  ['2025-10', 'OCT', 118, 0, 0, 0],
  ['2025-11', 'NOV', 126, 0, 612, 0],
  ['2025-12', 'DEC', 134, 0, 0, 0],
  ['2026-01', 'JAN', 109, 0, 0, 0],
  ['2026-02', 'FEB', 121, 0, 0, 0],
  ['2026-03', 'MAR', 138, 0, 0, 145],
  ['2026-04', 'APR', 112, 58, 0, 0],
  ['2026-05', 'MAY', 159, 28.5, 612, 0],
  ['2026-06', 'JUN', 173, 285, 0, 0],
  ['2026-07', 'JUL', 162, 0, 0, 0],
  ['2026-08', 'AUG', 136, 0, 0, 0],
  ['2026-09', 'SEP', 51, 545, 0, 0],
].map(([key, label, fuel, service, insurance, registration]) => ({
  key,
  label,
  values: { fuel, service, insurance, registration },
}))

// The spend colors used everywhere (Trends too): amber is a status color, so registration is the
// neutral gray.
const SPEND_SERIES = [
  { key: 'fuel', label: 'Fuel', tone: 'accent' },
  { key: 'service', label: 'Service', tone: 'teal' },
  { key: 'insurance', label: 'Insurance', tone: 'slate' },
  { key: 'registration', label: 'Registration', tone: 'neutral' },
]

const SPARKS = {
  mpg: FILLS.map((f) => f.mpg),
  costPerMile: [0.21, 0.2, 0.2, 0.19, 0.19, 0.18, 0.19, 0.18, 0.19],
  pace: [1010, 1042, 998, 1038, 1025, 1061, 1038],
  price: FILLS.map((f) => f.price),
  spend: MONTHS.map((m) => m.values.fuel + m.values.service),
  overdue: [0, 0, 1, 1, 2, 1, 1, 2],
}

const TONES = [
  ['accent', SPARKS.mpg],
  ['teal', SPARKS.costPerMile],
  ['amber', SPARKS.price],
  ['green', SPARKS.pace],
  ['red', SPARKS.overdue],
  ['ink', SPARKS.spend],
]

const INTERVALS = [
  {
    name: 'Cabin air filter',
    rule: 'every 24 mo',
    progress: 0.1,
    status: 'ok',
    lastLabel: 'Jul 12, 2026',
    dueLabel: 'due Jul 2028',
    nowLabel: 'now',
    valueText: '10% of interval, due in 22 months',
  },
  {
    name: 'Oil + filter',
    rule: 'every 5,000 mi or 12 mo',
    progress: 0.8,
    status: 'coming-up',
    lastLabel: 'Apr 22 · 79,630',
    dueLabel: 'due 84,630',
    nowLabel: 'now · 83,630',
    valueText: '80% of interval, due in 1,000 mi',
  },
  {
    name: 'Brake fluid',
    rule: 'every 30,000 mi or 36 mo',
    progress: 1,
    status: 'overdue',
    lastLabel: 'Sep 26, 2023',
    dueLabel: 'due today',
    nowLabel: 'now',
    valueText: '100% of interval, due today',
  },
  {
    name: 'Tire rotation',
    rule: 'every 5,000 mi',
    progress: 1.3,
    status: 'overdue',
    lastLabel: 'Feb 1 · 76,800',
    dueLabel: 'due 81,800',
    nowLabel: '1,500 mi over',
    valueText: '130% of interval, 1,500 mi overdue',
  },
  {
    name: 'Wiper blades',
    rule: 'every 12 mo',
    progress: null,
    status: 'ok',
    lastLabel: 'No record yet',
  },
]

const mpg = (v) => `${v.toFixed(1)} mpg`
const perGallon = (v) => `$${v.toFixed(2)}`
const priceTick = (v, step) => formatTick(v, step, { prefix: '$', decimals: 2 })
const dollars = (v) => `$${Math.round(v).toLocaleString('en-US')}`
const dollarTick = (v, step) => formatTick(v, step, { prefix: '$' })

function Section({ title, note, children }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
        {note && <p className="text-xs font-mono text-ink/50 mt-1.5">{note}</p>}
      </div>
      {children}
    </section>
  )
}

function Caption({ children, dark = false }) {
  return (
    <p className={`text-xs font-mono font-semibold tracking-widest uppercase ${dark ? 'text-page/45' : 'text-ink/45'}`}>
      {children}
    </p>
  )
}

function ChartCard({ title, children }) {
  return (
    <Card className="min-w-0">
      <div className="flex flex-col gap-4">
        <Caption>{title}</Caption>
        {children}
      </div>
    </Card>
  )
}

function Schedule({ tone }) {
  const dark = tone === 'dark'
  return (
    <Card tone={tone}>
      <div className="flex flex-col gap-5">
        <Caption dark={dark}>tone=&quot;{tone}&quot;</Caption>
        {INTERVALS.map((interval) => (
          <div key={interval.name} className="grid grid-cols-[120px_minmax(0,1fr)_88px] items-center gap-5">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{interval.name}</p>
              <p className={`text-xs font-mono ${dark ? 'text-page/60' : 'text-ink/50'}`}>{interval.rule}</p>
            </div>
            <ProgressTrack
              ariaLabel={interval.name}
              progress={interval.progress}
              status={interval.status}
              lastLabel={interval.lastLabel}
              dueLabel={interval.dueLabel}
              nowLabel={interval.nowLabel}
              valueText={interval.valueText}
              tone={tone}
            />
            <div className="justify-self-end">
              {interval.progress != null && <StatusChip status={interval.status} />}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** Every chart in components/charts in its states. Dev only, rendered inside UiGallery. */
export default function ChartGallery() {
  return (
    <>
      <Section title="Sparkline" note="Fills its container and redraws on resize; decorative unless ariaLabel is set">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <StatTile label="Avg MPG" value="31.4" unit="mpg" delta="+2.1%" deltaTone="good">
            <Sparkline values={SPARKS.mpg} ariaLabel="MPG over the last 11 fill-ups" />
          </StatTile>
          <StatTile label="Cost / mile" value="$0.19" unit="all-in">
            <Sparkline values={SPARKS.costPerMile} tone="teal" />
          </StatTile>
          <StatTile label="Spent in Sep" value="$596" delta="+9%" deltaTone="bad">
            <Sparkline values={SPARKS.spend} tone="ink" />
          </StatTile>
          <StatTile label="Driving" value="1,038" unit="mi / mo">
            <Sparkline values={SPARKS.pace} tone="green" />
          </StatTile>
        </div>
        <Card>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-5">
            {TONES.map(([tone, values]) => (
              <div key={tone} className="flex flex-col gap-2 min-w-0">
                <Caption>{tone}</Caption>
                <Sparkline values={values} tone={tone} />
              </div>
            ))}
            <div className="flex flex-col gap-2 min-w-0">
              <Caption>0 values</Caption>
              <Sparkline values={[]} />
            </div>
            <div className="flex flex-col gap-2 min-w-0">
              <Caption>1 value</Caption>
              <Sparkline values={[31.4]} />
            </div>
            <div className="flex flex-col gap-2 min-w-0">
              <Caption>2 values</Caption>
              <Sparkline values={[31.4, 32.2]} />
            </div>
            <div className="flex flex-col gap-2 min-w-0">
              <Caption>flat</Caption>
              <Sparkline values={[31, 31, 31, 31, 31]} />
            </div>
            <div className="flex flex-col gap-2 min-w-0">
              <Caption>showLast off, no area</Caption>
              <Sparkline values={SPARKS.mpg} showLast={false} area={false} />
            </div>
            <div className="flex flex-col gap-2 min-w-0">
              <Caption>width=120 height=36</Caption>
              <Sparkline values={SPARKS.price} width={120} height={36} tone="amber" />
            </div>
          </div>
        </Card>
      </Section>

      <Section title="LineChart" note="Hover a point, or focus the chart and use ← → (Home / End); Esc clears">
        <div className="grid lg:grid-cols-2 gap-3.5">
          <ChartCard title="Fuel economy · average and partial fills">
            <LineChart
              points={MPG_POINTS}
              average={MPG_AVERAGE}
              seriesLabel="mpg"
              formatValue={mpg}
              ariaLabel="Fuel economy, last 11 fill-ups"
              summary={`Between 28.4 and 33.9 mpg, averaging ${MPG_AVERAGE}. Latest 32.2 mpg on Aug 28.`}
            />
          </ChartCard>
          <ChartCard title="Price per gallon · area, $ ticks">
            <LineChart
              points={PRICE_POINTS}
              average={PRICE_AVERAGE}
              tone="teal"
              area
              formatValue={perGallon}
              formatYTick={priceTick}
              ariaLabel="Price per gallon, last 11 fill-ups"
            />
          </ChartCard>
        </div>
        <div className="grid lg:grid-cols-3 gap-3.5">
          <ChartCard title="Flat series">
            <LineChart points={FLAT_POINTS} height={150} formatValue={mpg} ariaLabel="Flat MPG series" />
          </ChartCard>
          <ChartCard title="Single point">
            <LineChart points={MPG_POINTS.slice(-1)} height={150} formatValue={mpg} ariaLabel="One fill-up" />
          </ChartCard>
          <ChartCard title="No points">
            <LineChart points={[]} height={150} ariaLabel="No fill-ups" emptyLabel="No full-tank fill-ups logged yet." />
          </ChartCard>
        </div>
      </Section>

      <Section title="BarChart" note="y axis from zero; hover a column, or focus and use ← →">
        <ChartCard title="Stacked · monthly spend, 12 months">
          <BarChart
            data={MONTHS}
            series={SPEND_SERIES}
            stacked
            showValues
            height={220}
            formatValue={dollars}
            formatYTick={dollarTick}
            ariaLabel="Monthly spend by category, Oct 2025 to Sep 2026"
            summary="Insurance in November and May ($612 each) and service in September ($545) are the biggest months."
          />
        </ChartCard>
        <div className="grid lg:grid-cols-2 gap-3.5">
          <ChartCard title="Grouped · fuel and service, 6 months">
            <BarChart
              data={MONTHS.slice(-6)}
              series={SPEND_SERIES.slice(0, 2)}
              formatValue={dollars}
              formatYTick={dollarTick}
              ariaLabel="Fuel and service spend, Apr to Sep 2026"
            />
          </ChartCard>
          <ChartCard title="Single series · value labels">
            <BarChart
              data={MONTHS}
              series={SPEND_SERIES.slice(0, 1)}
              showValues
              formatValue={dollars}
              formatYTick={dollarTick}
              ariaLabel="Fuel spend by month"
            />
          </ChartCard>
        </div>
        <ChartCard title="Empty">
          <BarChart data={[]} series={SPEND_SERIES} height={120} ariaLabel="Monthly spend" emptyLabel="No spend logged in this range." />
        </ChartCard>
      </Section>

      <Section title="ProgressTrack" note="Last done at the left end, due tick at 80%, now marker; overdue spills past the tick in red stripes">
        <div className="grid lg:grid-cols-2 gap-3.5">
          <Schedule tone="light" />
          <Schedule tone="dark" />
        </div>
      </Section>
    </>
  )
}
