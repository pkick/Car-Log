import { useState } from 'react'
import { FuelIcon, WrenchIcon, AddVehicleIcon, CheckIcon, CarIcon } from './icons'

export default function Header({ vehicle, vehicles = [], activeVehicleId, onSelectVehicle, onEditVehicle, onAddVehicle, onLogService, onLogFillup }) {
  const [menuOpen, setMenuOpen] = useState(false)

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
              <span className="text-xs font-mono text-ink/50">{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.odometer} mi</span>
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
          <div className="flex items-center gap-2 px-3.5 py-2.25 border border-ink/14 rounded-2xl bg-white/55 whitespace-nowrap">
            <CheckIcon size={12} className="flex-none text-green" />
            <span className="text-xs font-mono font-semibold tracking-wider text-ink/55">SAVED LOCALLY</span>
          </div>
          <button
            onClick={onLogService}
            className="flex items-center gap-2 px-4.5 py-3 border border-ink/18 rounded-2xl bg-transparent text-ink font-semibold text-sm hover:bg-ink/5 transition-colors whitespace-nowrap"
          >
            <WrenchIcon size={24} className="flex-none" />
            Log service
          </button>
          <button
            onClick={onLogFillup}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate text-page font-semibold text-sm hover:bg-slate/90 transition-colors shadow-btn whitespace-nowrap"
          >
            <FuelIcon size={24} className="flex-none" />
            Log fill-up
          </button>
        </div>
      </div>
    </header>
  )
}
