import { useContext, useState } from 'react'
import { useRecords } from '../context/RecordsContext'
import { VehicleContext } from '../context/VehicleContext'
import { getFuelStats } from '../lib/vehicleStats'
import { TrashIcon, AddVehicleIcon, PencilIcon, CarIcon, PaintbrushIcon } from '../components/icons'
import { VEHICLE_COLORS, VEHICLE_COLOR_TILE_CLASS, VEHICLE_COLOR_TEXT_CLASS, VEHICLE_COLOR_SWATCH_CLASS } from '../lib/vehicleColors'

export default function Garage({ vehicles, activeVehicleId, onSetActive, onEditVehicle, onDeleteVehicle, onAddVehicle }) {
  const { getFillUpsForVehicle } = useRecords()
  const { updateVehicle } = useContext(VehicleContext)
  const [colorPickerId, setColorPickerId] = useState(null)

  return (
    <main className="px-10 py-8 max-w-[1180px] w-full">
      <div className="grid grid-cols-2 gap-[22px]">
        {vehicles.map((vehicle) => {
          const isActive = vehicle.id === activeVehicleId
          const fills = getFillUpsForVehicle(vehicle.id)
          const { avgMpg, costPerMile } = getFuelStats(fills)
          const color = vehicle.color || 'slate'
          const pickerOpen = colorPickerId === vehicle.id

          return (
          <div key={vehicle.id} className="bg-white rounded-2.5 border border-ink/10 overflow-hidden hover:shadow-md transition-shadow">
            {/* Vehicle Color Card */}
            <div className={`h-[180px] relative flex items-center justify-center group ${VEHICLE_COLOR_TILE_CLASS[color]}`}>
              {pickerOpen ? (
                <div className="absolute inset-0 flex items-center justify-center gap-2.5 bg-white/95">
                  {VEHICLE_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        updateVehicle(vehicle.id, { color: c })
                        setColorPickerId(null)
                      }}
                      aria-label={c}
                      className={`w-8 h-8 rounded-full flex-none hover:scale-110 transition-transform ${VEHICLE_COLOR_SWATCH_CLASS[c]} ${
                        c === color ? 'ring-2 ring-offset-2 ring-ink' : ''
                      }`}
                    />
                  ))}
                  <button
                    onClick={() => setColorPickerId(null)}
                    aria-label="Cancel"
                    className="ml-1 w-8 h-8 rounded-full border border-ink/12 flex items-center justify-center text-ink/45 text-lg leading-none hover:bg-ink/5 flex-none"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <>
                  <button onClick={() => setColorPickerId(vehicle.id)} aria-label="Change vehicle color">
                    <CarIcon size={72} className={VEHICLE_COLOR_TEXT_CLASS[color]} />
                  </button>
                  <button
                    onClick={() => setColorPickerId(vehicle.id)}
                    aria-label="Change vehicle color"
                    className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white shadow-btn flex items-center justify-center text-ink/55 opacity-0 group-hover:opacity-100 transition-opacity hover:text-ink"
                  >
                    <PaintbrushIcon size={16} />
                  </button>
                </>
              )}
              {isActive && !pickerOpen && (
                <div className="absolute top-3 right-3 bg-[oklch(0.5_0.14_150/20%)] text-green text-xs font-mono font-semibold px-2 py-1 rounded-lg">
                  ACTIVE
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-6">
              <h3 className="text-2xl font-bold tracking-tighter mb-2">{vehicle.nickname}</h3>
              <p className="text-xs font-mono text-ink/50 mb-4">
                {vehicle.vin ? `${vehicle.vin} · ` : ''}{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.odometer.toLocaleString()} mi
              </p>

              {/* Mini Stats */}
              <div className="space-y-2 mb-6 pb-6 border-b border-ink/8">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono text-ink/45">Avg MPG</span>
                  <span className="font-semibold">{avgMpg ?? '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono text-ink/45">$ / mi</span>
                  <span className="font-semibold">{costPerMile != null ? `$${costPerMile.toFixed(2)}` : '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono text-ink/45">Fills</span>
                  <span className="font-semibold">{fills.length}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2.5">
                <button
                  onClick={() => onSetActive?.(vehicle.id)}
                  disabled={isActive}
                  className="flex-1 py-2.5 px-3 bg-slate text-white text-xs font-semibold rounded-lg hover:bg-slate/90 transition-colors disabled:opacity-40 disabled:cursor-default"
                >
                  {isActive ? 'Active' : 'Set active'}
                </button>
                <button
                  onClick={() => onEditVehicle(vehicle.id)}
                  className="flex-1 py-2.5 px-3 border border-ink/12 text-ink text-xs font-semibold rounded-lg hover:bg-[oklch(0.56_0.19_258/10%)] hover:text-accent hover:border-[oklch(0.56_0.19_258/30%)] transition-colors flex items-center justify-center gap-1.5"
                >
                  <PencilIcon size={16} className="flex-none" />
                  Edit vehicle
                </button>
                <button
                  onClick={() => onDeleteVehicle?.(vehicle.id)}
                  aria-label="Delete vehicle"
                  className="flex-none w-9 flex items-center justify-center border border-ink/12 text-ink/50 rounded-lg hover:bg-[oklch(0.55_0.17_28/10%)] hover:text-red hover:border-[oklch(0.55_0.17_28/30%)] transition-colors"
                >
                  <TrashIcon size={19} />
                </button>
              </div>
            </div>
          </div>
          )
        })}

        {/* Add Vehicle Card */}
        <div
          onClick={onAddVehicle}
          className="group bg-white rounded-2.5 border border-dashed border-ink/20 flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-[oklch(0.56_0.19_258/6%)] hover:border-[oklch(0.56_0.19_258/40%)] transition-colors"
        >
          <AddVehicleIcon size={36} className="mb-3 text-ink/40 group-hover:text-accent transition-colors" />
          <p className="font-semibold text-sm group-hover:text-accent transition-colors">Add vehicle</p>
        </div>
      </div>
    </main>
  )
}
