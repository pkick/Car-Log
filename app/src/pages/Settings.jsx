import { useContext, useRef, useState } from 'react'
import { useUIPrefs, DEFAULT_TEXT_SCALE, MIN_TEXT_SCALE, MAX_TEXT_SCALE } from '../context/UIPrefsContext'
import { VehicleContext } from '../context/VehicleContext'
import { useRecords } from '../context/RecordsContext'
import NotificationSettings from '../components/NotificationSettings'
import ReminderDefaults from '../components/ReminderDefaults'
import { buildCsv, downloadBlob, downloadCsv } from '../lib/exportCsv'
import { filenameFromDisposition, restoreWarning, summarizeBackup } from '../lib/backup'
import { todayISO } from '../lib/dates'
import { ExportIcon, TextSizeIcon, ServerIcon } from '../components/icons'
import CsvImportPanel from '../components/CsvImportPanel'

const UNREACHABLE = "Can't reach the server. Check that it's running and try again."
const GATEWAY_STATUSES = [502, 503, 504]
const BUTTON_CLASS = 'px-4 py-2 border border-ink/12 rounded-lg text-xs font-semibold hover:bg-ink/3 transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-default'

/**
 * Calls the API and turns a failure into an Error carrying the server's message.
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<Response>} The response, when it's OK.
 */
async function send(path, options) {
  let res
  try {
    res = await fetch(path, options)
  } catch (err) {
    throw new Error(UNREACHABLE, { cause: err })
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || (GATEWAY_STATUSES.includes(res.status) ? UNREACHABLE : `Request failed: ${res.status}`))
  }
  return res
}

export default function Settings() {
  const { textScale, setTextScale } = useUIPrefs()
  const { vehicles } = useContext(VehicleContext)
  const { fillUps, serviceRecords } = useRecords()
  const backupInput = useRef(null)
  const [backupAction, setBackupAction] = useState(null)
  const backupBusy = backupAction !== null
  const [backupError, setBackupError] = useState(null)
  const [pendingRestore, setPendingRestore] = useState(null)

  const handleExport = () => {
    const csv = buildCsv(vehicles, fillUps, serviceRecords)
    const today = todayISO()
    downloadCsv(csv, `odometer-export-${today}.csv`)
  }

  const handleExportBackup = async () => {
    setBackupError(null)
    setBackupAction('export')
    try {
      const res = await send('/api/export')
      const filename = filenameFromDisposition(res.headers.get('Content-Disposition')) ?? `odometer-backup-${todayISO()}.json`
      downloadBlob(await res.blob(), filename)
    } catch (err) {
      setBackupError(err.message)
    } finally {
      setBackupAction(null)
    }
  }

  const handleBackupFile = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setBackupError(null)
    setPendingRestore(null)

    const text = await file.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      setBackupError(`${file.name} isn't a JSON file.`)
      return
    }
    const summary = summarizeBackup(data)
    if (summary.error) setBackupError(summary.error)
    else setPendingRestore({ name: file.name, text, summary })
  }

  const handleRestore = async () => {
    setBackupError(null)
    setBackupAction('restore')
    try {
      await send('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: pendingRestore.text })
      window.location.reload()
    } catch (err) {
      setBackupError(err.message)
      setBackupAction(null)
    }
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
            <p className="text-xs font-mono text-ink/50">Distance, volume and fuel economy</p>
          </div>
          <span className="text-xs font-mono text-ink/70">US · miles, gallons</span>
        </div>

        {/* Currency */}
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Currency</p>
            <p className="text-xs font-mono text-ink/50">Used for every cost and price</p>
          </div>
          <span className="text-xs font-mono text-ink/70">USD $</span>
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

        {/* Export and backup */}
        <div className="px-6 py-4 hover:bg-ink/3 transition-colors">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm">Export</p>
              <p className="text-xs font-mono text-ink/50">CSV, or a full JSON backup</p>
            </div>
            <div className="flex items-center gap-2 flex-none">
              <button onClick={handleExport} className={BUTTON_CLASS}>
                <ExportIcon size={14} className="flex-none" />
                Export CSV
              </button>
              <button onClick={handleExportBackup} disabled={backupBusy} className={BUTTON_CLASS}>
                <ExportIcon size={14} className="flex-none" />
                Export backup (JSON)
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 mt-4">
            <div>
              <p className="font-semibold text-sm">Restore</p>
              <p className="text-xs font-mono text-ink/50">Replace all data with a JSON backup</p>
            </div>
            <input
              ref={backupInput}
              type="file"
              accept="application/json,.json"
              onChange={handleBackupFile}
              className="hidden"
            />
            <button
              onClick={() => backupInput.current.click()}
              disabled={backupBusy}
              className={`${BUTTON_CLASS} flex-none`}
            >
              Restore from backup
            </button>
          </div>

          {pendingRestore && (
            <div className="mt-4 border border-ink/12 rounded-lg px-4 py-3">
              <p className="font-semibold text-sm">Restore {pendingRestore.name}?</p>
              <p className="text-xs font-mono text-ink/50 mt-1">{restoreWarning(pendingRestore.summary)}</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleRestore}
                  disabled={backupBusy}
                  className="px-4 py-2 bg-red text-white rounded-lg text-xs font-semibold hover:bg-[oklch(0.55_0.17_28/90%)] transition-colors disabled:opacity-40 disabled:cursor-default"
                >
                  {backupAction === 'restore' ? 'Restoring…' : 'Restore'}
                </button>
                <button onClick={() => setPendingRestore(null)} disabled={backupBusy} className={BUTTON_CLASS}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {backupError && <p className="text-xs text-red mt-3">{backupError}</p>}
        </div>

        <div className="px-6 py-4">
          <CsvImportPanel />
        </div>
      </div>

      <NotificationSettings />
      <ReminderDefaults />
    </main>
  )
}
