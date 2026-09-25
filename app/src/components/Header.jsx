import { useEffect, useState } from 'react'
import { FuelIcon, WrenchIcon, AddVehicleIcon, CarIcon } from './icons'

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

export default function Header({ vehicle, vehicles = [], activeVehicleId, onSelectVehicle, onEditVehicle, onAddVehicle, onLogService, onLogFillup }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const tracksFuel = vehicle.tracksFuel ?? true
  const tracksService = vehicle.tracksService ?? true

  return (
    <header className="flex flex-col gap-[22px] px-10 py-[34px] border-b border-ink/12 bg-page">
      <div className="flex items-center gap-[14px]">
        {/* Vehicle Switcher */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-3 p-2.5 border border-ink/14 rounded-lg bg-white/55 hover:border-ink/30 transition-colors"
          >
            <div className="flex flex-col gap-0.5 items-start whitespace-nowrap">
              <span className="font-semibold text-sm tracking-tighter">{vehicle.nickname}</span>
              <span className="text-xs font-mono text-ink/50">{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.odometer.toLocaleString()} mi</span>
            </div>
            <span className="text-xs font-mono text-ink/40">▼</span>
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div className="absolute top-full mt-[9px] left-0 z-40 w-[328px] bg-white border border-ink/12 rounded-2xl shadow-dropdown p-2.5 flex flex-col gap-1.5 animate-rise">
              <div className="px-2 py-1 text-xs font-mono font-semibold tracking-widest uppercase text-ink/40">Your garage</div>
              {vehicles.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    onSelectVehicle?.(v.id)
                    setMenuOpen(false)
                  }}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    v.id === activeVehicleId ? 'bg-ink/6' : 'hover:bg-ink/4.5'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-ink/6 flex items-center justify-center flex-none">
                    <CarIcon size={22} className="text-ink/70" />
                  </div>
                  <div className="flex flex-col gap-0.75 items-end ml-auto">
                    <span className="font-semibold text-sm">{v.nickname}</span>
                    <span className="text-xs font-mono text-ink/52">{v.year} {v.make} {v.model}</span>
                    <span className="text-xs font-mono font-semibold text-ink/75">{v.odometer.toLocaleString()} mi</span>
                  </div>
                </button>
              ))}
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onAddVehicle?.()
                }}
                className="flex items-center gap-2.25 p-3 border border-dashed border-ink/20 rounded-lg bg-transparent hover:bg-ink/4 transition-colors text-xs font-mono font-semibold tracking-wider uppercase text-ink/50"
              >
                <AddVehicleIcon size={18} className="flex-none" />
                Add vehicle
              </button>
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="ml-auto flex items-center gap-2.5 flex-wrap justify-end">
          <ConnectionStatus />
          {tracksService && (
          <button
            onClick={onLogService}
            className="flex items-center gap-2 px-4.5 py-3 border border-ink/18 rounded-2xl bg-transparent text-ink font-semibold text-sm hover:bg-ink/5 transition-colors whitespace-nowrap"
          >
            <WrenchIcon size={24} className="flex-none" />
            Log service
          </button>
          )}
          {tracksFuel && (
          <button
            onClick={onLogFillup}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate text-page font-semibold text-sm hover:bg-slate/90 transition-colors shadow-btn whitespace-nowrap"
          >
            <FuelIcon size={24} className="flex-none" />
            Log fill-up
          </button>
          )}
        </div>
      </div>
    </header>
  )
}
