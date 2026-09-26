import { useEffect, useState } from 'react'
import { FuelIcon, WrenchIcon } from './icons'
import { Button } from './ui'

const HEALTH_POLL_MS = 30000

function ConnectionStatus() {
  // The header only mounts after the vehicle list loaded from the API, so start as connected.
  const [connected, setConnected] = useState(true)

  useEffect(() => {
    let cancelled = false
    const ping = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' })
        if (!cancelled) setConnected(res.ok)
      } catch {
        if (!cancelled) setConnected(false)
      }
    }
    ping()
    const id = setInterval(ping, HEALTH_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return (
    <div role="status" className="flex items-center gap-2 px-3.5 py-2.25 border border-ink/14 rounded-2xl bg-white/55 whitespace-nowrap">
      <span className={`w-2 h-2 rounded-full flex-none ${connected ? 'bg-green' : 'bg-red'}`} />
      <span className="text-xs font-mono font-semibold tracking-wider uppercase text-ink/55">
        {connected ? 'Connected' : "Can't reach server"}
      </span>
    </div>
  )
}

/**
 * The bar above every page once a vehicle exists: connection status and the two log actions, right-aligned.
 * The vehicle switcher lives at the top of the sidebar.
 *
 * @param {object} props
 * @param {object | undefined} props.vehicle The active vehicle; its tracking decides which log buttons show.
 * @param {() => void} props.onLogService
 * @param {() => void} props.onLogFillup
 */
export default function Header({ vehicle, onLogService, onLogFillup }) {
  const tracksFuel = vehicle && vehicle.tracksFuel !== false
  const tracksService = vehicle && vehicle.tracksService !== false

  return (
    <header className="flex items-center gap-[14px] px-10 py-4 border-b border-ink/12 bg-page">
      {/* The left side is kept free for P3-E's search trigger. */}
      <div className="ml-auto flex items-center gap-2.5 flex-wrap justify-end">
        <ConnectionStatus />
        {tracksService && (
          <Button variant="ghost" onClick={onLogService}>
            <WrenchIcon size={24} className="flex-none" />
            Log service
          </Button>
        )}
        {tracksFuel && (
          <Button onClick={onLogFillup}>
            <FuelIcon size={24} className="flex-none" />
            Log fill-up
          </Button>
        )}
      </div>
    </header>
  )
}
