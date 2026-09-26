import { useContext, useState } from 'react'
import { useRecords } from '../context/RecordsContext'
import { VehicleContext } from '../context/VehicleContext'
import { getFuelStats } from '../lib/vehicleStats'
import { TrashIcon, AddVehicleIcon, PencilIcon, CarIcon, PaintbrushIcon, CloseIcon } from '../components/icons'
import { Badge, Button, Card, IconButton, PageHeader } from '../components/ui'
import { VEHICLE_COLORS, VEHICLE_COLOR_TILE_CLASS, VEHICLE_COLOR_TEXT_CLASS, VEHICLE_COLOR_SWATCH_CLASS } from '../lib/vehicleColors'

export default function Garage({ vehicles, activeVehicleId, onSetActive, onEditVehicle, onDeleteVehicle, onAddVehicle }) {
  const { getFillUpsForVehicle } = useRecords()
  const { updateVehicle } = useContext(VehicleContext)
  const [colorPickerId, setColorPickerId] = useState(null)
  const [colorError, setColorError] = useState(null)

  const handleColorChange = async (vehicleId, color) => {
    setColorPickerId(null)
    try {
      await updateVehicle(vehicleId, { color })
      setColorError(null)
    } catch (err) {
      setColorError(`Couldn't change the color: ${err.message}`)
    }
  }

  return (
    <main className="px-10 py-8 max-w-[1180px] w-full">
      <PageHeader eyebrow="Garage" title="Your vehicles" action={<Button onClick={onAddVehicle}>Add vehicle</Button>} />

      {colorError && <p className="text-xs text-red mb-3">{colorError}</p>}
      <div className="grid grid-cols-2 gap-[22px]">
        {vehicles.map((vehicle) => {
          const isActive = vehicle.id === activeVehicleId
          const fills = getFillUpsForVehicle(vehicle.id)
          const { avgMpg, costPerMile } = getFuelStats(fills)
          const color = vehicle.color || 'slate'
          const pickerOpen = colorPickerId === vehicle.id

          return (
          <Card key={vehicle.id} padding="none" className="overflow-hidden">
            {/* Vehicle Color Card */}
            <div className={`h-[180px] relative flex items-center justify-center group ${VEHICLE_COLOR_TILE_CLASS[color]}`}>
              {pickerOpen ? (
                <div className="absolute inset-0 flex items-center justify-center gap-2.5 bg-white/95">
                  {VEHICLE_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => handleColorChange(vehicle.id, c)}
                      aria-label={c}
                      className={`w-8 h-8 rounded-full flex-none hover:scale-110 transition-transform ${VEHICLE_COLOR_SWATCH_CLASS[c]} ${
                        c === color ? 'ring-2 ring-offset-2 ring-ink' : ''
                      }`}
                    />
                  ))}
                  <IconButton size="sm" aria-label="Cancel" onClick={() => setColorPickerId(null)} className="ml-1">
                    <CloseIcon size={16} />
                  </IconButton>
                </div>
              ) : (
                <>
                  <button onClick={() => setColorPickerId(vehicle.id)} aria-label="Change vehicle color">
                    <CarIcon size={72} className={VEHICLE_COLOR_TEXT_CLASS[color]} />
                  </button>
                  <IconButton
                    size="sm"
                    aria-label="Change vehicle color"
                    onClick={() => setColorPickerId(vehicle.id)}
                    className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <PaintbrushIcon size={16} />
                  </IconButton>
                </>
              )}
              {isActive && !pickerOpen && (
                <Badge tone="green" className="absolute top-3 right-3">Active</Badge>
              )}
            </div>

            {/* Content */}
            <div className="p-6">
              <h3 className="text-2xl font-bold tracking-tight mb-2">{vehicle.nickname}</h3>
              <p className="text-xs font-mono text-ink/50 mb-4">
                {vehicle.vin ? `${vehicle.vin} · ` : ''}{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.odometer.toLocaleString()} mi
              </p>

              {/* Mini Stats */}
              {vehicle.tracksFuel !== false && (
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
              )}

              {/* Actions */}
              <div className="flex items-center gap-2.5">
                <Button size="sm" className="flex-1" onClick={() => onSetActive?.(vehicle.id)} disabled={isActive}>
                  {isActive ? 'Active' : 'Set active'}
                </Button>
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => onEditVehicle(vehicle.id)}>
                  <PencilIcon size={16} className="flex-none" />
                  Edit vehicle
                </Button>
                <IconButton variant="danger" size="sm" aria-label="Delete vehicle" onClick={() => onDeleteVehicle?.(vehicle.id)}>
                  <TrashIcon size={19} />
                </IconButton>
              </div>
            </div>
          </Card>
          )
        })}

        {/* Add Vehicle Card */}
        <div
          onClick={onAddVehicle}
          className="group bg-surface rounded-card border border-dashed border-ink/20 flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-accent/6 hover:border-accent/40 transition-colors"
        >
          <AddVehicleIcon size={36} className="mb-3 text-ink/40 group-hover:text-accent transition-colors" />
          <p className="font-semibold text-sm group-hover:text-accent transition-colors">Add vehicle</p>
        </div>
      </div>
    </main>
  )
}
