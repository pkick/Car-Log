import { useContext } from 'react'
import { useUIPrefs, DEFAULT_TEXT_SCALE, MIN_TEXT_SCALE, MAX_TEXT_SCALE } from '../context/UIPrefsContext'
import { VehicleContext } from '../context/VehicleContext'
import { useRecords } from '../context/RecordsContext'
import { buildCsv, downloadCsv } from '../lib/exportCsv'
import { todayISO } from '../lib/dates'
import { ExportIcon, TextSizeIcon, ServerIcon } from '../components/icons'

export default function Settings() {
  const { textScale, setTextScale } = useUIPrefs()
  const { vehicles } = useContext(VehicleContext)
  const { fillUps, serviceRecords } = useRecords()

  const handleExport = () => {
    const csv = buildCsv(vehicles, fillUps, serviceRecords)
    downloadCsv(csv, `odometer-export-${todayISO()}.csv`)
  }

  return (
    <main className="px-10 py-8 max-w-[640px]">
      <div className="bg-white rounded-2.5 border border-ink/10 divide-y divide-ink/8">
        {/* UI Text Size */}
        <div className="px-6 py-4 hover:bg-ink/3 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold text-sm flex items-center gap-1.5">
                <TextSizeIcon size={15} className="flex-none text-ink/45" />
                UI text size
              </p>
              <p className="text-xs font-mono text-ink/50">Scales text across the whole app</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-ink/50 w-9 text-right">{Math.round(textScale * 100)}%</span>
              <button
                onClick={() => setTextScale(DEFAULT_TEXT_SCALE)}
                className="text-xs font-semibold text-accent hover:text-[oklch(0.56_0.19_258/80%)]"
              >
                Reset
              </button>
            </div>
          </div>
          <input
            type="range"
            min={MIN_TEXT_SCALE}
            max={MAX_TEXT_SCALE}
            step={0.05}
            value={textScale}
            onChange={(e) => setTextScale(parseFloat(e.target.value))}
            className="w-full accent-accent"
          />
        </div>

        {/* Units */}
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Units</p>
            <p className="text-xs font-mono text-ink/50">MPG · gal · mi</p>
          </div>
        </div>

        {/* Currency */}
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Currency</p>
            <p className="text-xs font-mono text-ink/50">USD $</p>
          </div>
        </div>

        {/* Reminders */}
        <div className="px-6 py-4 flex items-center justify-between opacity-40">
          <div>
            <p className="font-semibold text-sm">Reminders</p>
            <p className="text-xs font-mono text-ink/50">Default warn-at overridable per interval</p>
          </div>
          <span className="text-xs font-mono font-semibold tracking-wider text-ink/50">SOON</span>
        </div>

        {/* Storage */}
        <div className="px-6 py-4 flex items-center justify-between hover:bg-ink/3 transition-colors">
          <div>
            <p className="font-semibold text-sm flex items-center gap-1.5">
              <ServerIcon size={15} className="flex-none text-ink/45" />
              Storage
            </p>
            <p className="text-xs font-mono text-ink/50">SQLite backend on your network</p>
          </div>
          <div className="text-xs font-mono text-green">Connected</div>
        </div>

        {/* Export */}
        <div className="px-6 py-4 flex items-center justify-between hover:bg-ink/3 transition-colors">
          <div>
            <p className="font-semibold text-sm">Export</p>
            <p className="text-xs font-mono text-ink/50">Download all data as CSV</p>
          </div>
          <button
            onClick={handleExport}
            className="px-4 py-2 border border-ink/12 rounded-lg text-xs font-semibold hover:bg-ink/3 transition-colors flex items-center gap-1.5"
          >
            <ExportIcon size={14} className="flex-none" />
            Export
          </button>
        </div>
      </div>
    </main>
  )
}
