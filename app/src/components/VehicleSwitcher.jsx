import { AddVehicleIcon, CarIcon, ChevronDownIcon } from './icons'
import { Menu, MenuItem, MenuLabel, MenuSeparator } from './ui'
import { cx, FOCUS_RING } from './ui/cx'
import { VEHICLE_COLOR_SWATCH_CLASS, VEHICLE_COLOR_TEXT_CLASS, VEHICLE_COLOR_TILE_CLASS } from '../lib/vehicleColors'

const describe = (vehicle) => [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')

/**
 * The vehicle switcher at the top of the sidebar, like a workspace switcher: the active vehicle's name and
 * year, make and model, opening a menu of every vehicle and "Add vehicle".
 *
 * @param {object} props
 * @param {object[]} props.vehicles
 * @param {object | undefined} props.activeVehicle
 * @param {(id: number) => void} props.onSelectVehicle
 * @param {() => void} props.onAddVehicle
 */
export default function VehicleSwitcher({ vehicles, activeVehicle, onSelectVehicle, onAddVehicle }) {
  const color = activeVehicle?.color || 'slate'
  return (
    <Menu
      className="w-full"
      menuClassName="w-[328px]"
      trigger={(props) => (
        <button
          type="button"
          aria-label={activeVehicle ? `${activeVehicle.nickname}, switch vehicle` : 'Choose a vehicle'}
          {...props}
          className={cx(
            'flex w-full items-center gap-2 p-1.5 rounded-card border border-white/12 bg-white/6 text-left transition-colors hover:bg-white/12',
            FOCUS_RING
          )}
        >
          <span
            className={cx(
              'w-7 h-7 rounded-control flex items-center justify-center flex-none ring-1 ring-inset ring-white/16',
              VEHICLE_COLOR_SWATCH_CLASS[color]
            )}
          >
            <CarIcon size={16} className="text-white" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold truncate">{activeVehicle?.nickname ?? 'Choose a vehicle'}</span>
            <span className="block text-xs font-mono text-page/55 truncate" title={activeVehicle && describe(activeVehicle)}>
              {activeVehicle ? describe(activeVehicle) : `${vehicles.length} in your garage`}
            </span>
          </span>
          <ChevronDownIcon size={14} className="flex-none text-page/55" />
        </button>
      )}
    >
      <MenuLabel>Your garage</MenuLabel>
      {vehicles.map((vehicle) => {
        const tone = vehicle.color || 'slate'
        return (
          <MenuItem key={vehicle.id} checked={vehicle.id === activeVehicle?.id} onSelect={() => onSelectVehicle(vehicle.id)}>
            <span
              className={cx(
                'w-8 h-8 rounded-control flex items-center justify-center flex-none',
                VEHICLE_COLOR_TILE_CLASS[tone],
                VEHICLE_COLOR_TEXT_CLASS[tone]
              )}
            >
              <CarIcon size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold truncate">{vehicle.nickname}</span>
              <span className="block text-xs font-mono text-ink/50 truncate">
                {describe(vehicle)} · {vehicle.odometer.toLocaleString()} mi
              </span>
            </span>
          </MenuItem>
        )
      })}
      <MenuSeparator />
      <MenuItem icon={AddVehicleIcon} onSelect={onAddVehicle}>
        Add vehicle
      </MenuItem>
    </Menu>
  )
}
