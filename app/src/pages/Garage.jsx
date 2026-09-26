import { useContext, useRef, useState } from 'react'
import { useRecords } from '../context/RecordsContext'
import { VehicleContext } from '../context/VehicleContext'
import { getDueSoonItems, getFuelStats } from '../lib/vehicleStats'
import { vehiclePath } from '../lib/routes'
import { TrashIcon, AddVehicleIcon, PencilIcon, CarIcon, PaintbrushIcon, CloseIcon } from '../components/icons'
import { Badge, Button, Card, CardLink, IconButton, PageHeader } from '../components/ui'
import { VEHICLE_COLORS, VEHICLE_COLOR_TILE_CLASS, VEHICLE_COLOR_TEXT_CLASS, VEHICLE_COLOR_SWATCH_CLASS } from '../lib/vehicleColors'

export default function Garage({ vehicles, activeVehicleId, onSetActive, onEditVehicle, onDeleteVehicle, onAddVehicle }) {
  const { getFillUpsForVehicle, getServiceRecordsForVehicle } = useRecords()
  const { updateVehicle } = useContext(VehicleContext)
  const [colorPickerId, setColorPickerId] = useState(null)
  const [colorError, setColorError] = useState(null)
  const colorPickerTrigger = useRef(null)

  const openColorPicker = (vehicleId, event) => {
    colorPickerTrigger.current = event.currentTarget
    setColorPickerId(vehicleId)
  }

  const closeColorPicker = () => {
    setColorPickerId(null)
    colorPickerTrigger.current?.focus()
  }

  const handleColorChange = async (vehicleId, color) => {
    closeColorPicker()
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
          const tracksFuel = vehicle.tracksFuel !== false
          const tracksService = vehicle.tracksService !== false
          const fills = getFillUpsForVehicle(vehicle.id)
          const { avgMpg, costPerMile } = getFuelStats(fills)
          const dueCount = tracksService
            ? getDueSoonItems(vehicle, getServiceRecordsForVehicle(vehicle.id), vehicle.odometer).filter((item) => item.status !== 'ok').length
            : 0
          const color = vehicle.color || 'slate'
          const pickerOpen = colorPickerId === vehicle.id

          return (
          <Card key={vehicle.id} padding="none" className="relative overflow-hidden">
            {/* Vehicle Color Card */}
            <div className={`h-[180px] relative flex items-center justify-center ${VEHICLE_COLOR_TILE_CLASS[color]}`}>
              {pickerOpen ? (
                <div
                  role="group"
                  aria-label={`Color for ${vehicle.nickname}`}
                  onKeyDown={(event) => event.key === 'Escape' && closeColorPicker()}
                  className="absolute inset-0 z-10 flex items-center justify-center gap-2.5 bg-white/95"
                >
                  {VEHICLE_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => handleColorChange(vehicle.id, c)}
                      aria-label={c}
                      autoFocus={c === color}
                      className={`w-8 h-8 rounded-full flex-none hover:scale-110 transition-transform ${VEHICLE_COLOR_SWATCH_CLASS[c]} ${
                        c === color ? 'ring-2 ring-offset-2 ring-ink' : ''
                      }`}
                    />
                  ))}
                  <IconButton size="sm" aria-label="Cancel" onClick={closeColorPicker} className="ml-1">
                    <CloseIcon size={16} />
                  </IconButton>
                </div>
              ) : (
                <CarIcon size={72} className={VEHICLE_COLOR_TEXT_CLASS[color]} />
              )}
              {isActive && !pickerOpen && (
                <Badge tone="green" className="absolute top-3 right-3">Active</Badge>
              )}
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="text-2xl font-bold tracking-tight">
                  <CardLink to={vehiclePath(vehicle)}>{vehicle.nickname}</CardLink>
                </h3>
                {dueCount > 0 && <Badge variant="solid" tone="red">{dueCount} due</Badge>}
              </div>
              <p className="text-xs font-mono text-ink/50 mb-3">
                {vehicle.vin ? `${vehicle.vin} · ` : ''}{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.odometer.toLocaleString()} mi
              </p>
              {(tracksFuel || tracksService) && (
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {tracksFuel && <Badge tone="accent">Fuel</Badge>}
                  {tracksService && <Badge tone="teal">Maintenance</Badge>}
                </div>
              )}

              {/* Mini Stats */}
              {tracksFuel && (
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

              {/* Actions, above the card link */}
              <div className="relative z-10 flex items-center gap-2.5">
                <Button size="sm" className="flex-1" onClick={() => onSetActive?.(vehicle.id)} disabled={isActive}>
                  {isActive ? 'Active' : 'Set active'}
                </Button>
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => onEditVehicle(vehicle.id)}>
                  <PencilIcon size={16} className="flex-none" />
                  Edit vehicle
                </Button>
                <IconButton size="sm" aria-label="Change vehicle color" onClick={(event) => openColorPicker(vehicle.id, event)}>
                  <PaintbrushIcon size={16} />
                </IconButton>
                <IconButton variant="danger" size="sm" aria-label="Delete vehicle" onClick={() => onDeleteVehicle?.(vehicle.id)}>
                  <TrashIcon size={19} />
                </IconButton>
              </div>
            </div>
          </Card>
          )
        })}

        <Button variant="dashed" className="flex-col min-h-34" onClick={onAddVehicle}>
          <AddVehicleIcon size={36} className="mb-1.5 text-ink/40" />
          Add vehicle
        </Button>
      </div>
    </main>
  )
}
