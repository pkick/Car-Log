import { FuelIcon, WrenchIcon } from './icons'
import { Button, EmptyState, PageHeader, StatTile } from './ui'
import SetupCard from './SetupCard'
import { getEmptyStatTiles } from '../lib/onboarding'
import { getDueSoonItems } from '../lib/vehicleStats'

/**
 * The Dashboard of a vehicle with no fill-ups and no service records: the setup steps, a stat rail of em-dashes
 * with hints, and an invitation to log the first fill-up and the first service. Anything the vehicle doesn't
 * track is left out.
 *
 * @param {object} props
 * @param {object} props.vehicle
 * @param {() => void} props.onLogFillup
 * @param {() => void} props.onLogService
 * @param {() => void} props.onEditVehicle
 */
export default function EmptyVehicleDashboard({ vehicle, onLogFillup, onLogService, onEditVehicle }) {
  const tracksFuel = vehicle.tracksFuel !== false
  const tracksService = vehicle.tracksService !== false
  const tiles = getEmptyStatTiles(vehicle, getDueSoonItems(vehicle, [], vehicle.odometer))

  return (
    <main className="px-10 py-8 max-w-[1180px] w-full">
      <PageHeader eyebrow="Dashboard" title={`${vehicle.nickname} — overview`} />

      <SetupCard vehicle={vehicle} fillUps={[]} serviceRecords={[]} onEditVehicle={onEditVehicle} onLogFillup={onLogFillup} />

      <div className="grid grid-cols-4 gap-[14px] mb-[22px]">
        {tiles.map((tile) => (
          <StatTile
            key={tile.label}
            label={tile.label}
            value={tile.value ?? <span className="text-ink/20">—</span>}
            unit={tile.unit}
            delta={tile.delta}
            deltaTone={tile.deltaTone}
          >
            {tile.hint && <span className="text-xs font-mono text-ink/45">{tile.hint}</span>}
          </StatTile>
        ))}
      </div>

      <div className="grid gap-[22px]" style={{ gridTemplateColumns: tracksFuel && tracksService ? '1.5fr 1fr' : '1fr' }}>
        {tracksFuel && (
          <EmptyState
            icon={FuelIcon}
            title="No fill-ups yet"
            body="MPG needs two fill-ups with odometer readings. Log the first one now and the second next time you're at the pump."
            action={<Button onClick={onLogFillup}>Log fill-up</Button>}
          />
        )}
        {tracksService && (
          <EmptyState
            icon={WrenchIcon}
            title="No service history"
            body="Add a past service so reminders know where the clock starts."
            action={<Button variant="secondary" onClick={onLogService}>Log service</Button>}
          />
        )}
      </div>
    </main>
  )
}
