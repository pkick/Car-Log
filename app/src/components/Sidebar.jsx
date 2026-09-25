import { useContext } from 'react'
import { VehicleContext } from '../context/VehicleContext'
import { useRecords } from '../context/RecordsContext'
import { getDueSoonItems } from '../lib/vehicleStats'
import { TrendsIcon, SettingsIcon, GarageIcon, WrenchIcon, FuelIcon, RegistrationIcon, DashboardIcon } from './icons'

export default function Sidebar({ screen, setScreen, hiddenScreens = [] }) {
  const { vehicles, getActiveVehicle } = useContext(VehicleContext)
  const { fillUps, serviceRecords, policyRecords, getFillUpsForVehicle, getServiceRecordsForVehicle, getPolicyRecordsForVehicle } = useRecords()
  const activeVehicle = getActiveVehicle()

  const activeFillCount = activeVehicle ? getFillUpsForVehicle(activeVehicle.id).length : 0
  const activeDueSoonCount = activeVehicle
    ? getDueSoonItems(activeVehicle, getServiceRecordsForVehicle(activeVehicle.id), activeVehicle.odometer).filter(
        (i) => i.status !== 'ok'
      ).length
    : 0
  const activePolicyCount = activeVehicle ? getPolicyRecordsForVehicle(activeVehicle.id).length : 0
  const totalEntries = fillUps.length + serviceRecords.length + policyRecords.length

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
    { id: 'fuel-log', label: 'Fuel log', meta: activeFillCount, icon: FuelIcon },
    { id: 'maintenance', label: 'Maintenance', meta: activeDueSoonCount, icon: WrenchIcon },
    { id: 'documents', label: 'Documents', meta: activePolicyCount, icon: RegistrationIcon },
    { id: 'trends', label: 'Trends', icon: TrendsIcon },
    { id: 'garage', label: 'Garage', meta: vehicles.length, icon: GarageIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ].filter((item) => !hiddenScreens.includes(item.id))

  return (
    <aside className="w-[236px] bg-slate text-page p-[26px] flex flex-col gap-[30px] sticky top-0 h-screen">
      {/* Logo */}
      <div className="flex items-center gap-[10px]">
        <div className="w-[26px] h-[26px] rounded-[5px] bg-accent relative flex-none">
          <div className="absolute inset-[7px_7px_auto_7px] h-1 rounded-[5px] bg-slate" />
          <div className="absolute left-[7px] bottom-[6px] w-2 h-2 rounded-full bg-slate" />
        </div>
        <div className="font-semibold text-base tracking-tighter">Odometer</div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => !item.disabled && setScreen(item.id)}
            disabled={item.disabled}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              item.disabled
                ? 'text-page/35 cursor-default'
                : screen === item.id
                  ? 'bg-white/16 text-page'
                  : 'text-page/62 hover:bg-white/14'
            }`}
          >
            {item.icon ? (
              <item.icon size={19} className={`flex-none ${item.disabled ? 'text-blue-400/40' : 'text-blue-400'}`} />
            ) : (
              <span className={`w-1.5 h-1.5 rounded-full flex-none ${item.disabled ? 'bg-blue-400/40' : 'bg-blue-400'}`} />
            )}
            <span>{item.label}</span>
            {item.meta != null && item.meta !== 0 && (
              <span className="ml-auto text-xs opacity-55 font-mono">{item.meta}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Fleet Total */}
      <div className="mt-auto flex flex-col gap-2 pt-[18px] border-t border-white/12">
        <div className="text-sm font-semibold font-mono tracking-widest uppercase opacity-40">Fleet total</div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tracking-tighter">{totalEntries.toLocaleString()}</span>
          <span className="text-sm font-mono opacity-50">entries logged</span>
        </div>
      </div>
    </aside>
  )
}
