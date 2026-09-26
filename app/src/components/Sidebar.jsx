import { useContext } from 'react'
import { NavLink } from 'react-router'
import { VehicleContext } from '../context/VehicleContext'
import { useRecords } from '../context/RecordsContext'
import { getDueSoonItems } from '../lib/vehicleStats'
import { tracksSection, vehiclePath } from '../lib/routes'
import { TrendsIcon, SettingsIcon, GarageIcon, WrenchIcon, FuelIcon, RegistrationIcon, DashboardIcon } from './icons'

export default function Sidebar({ activeVehicle }) {
  const { vehicles } = useContext(VehicleContext)
  const { fillUps, serviceRecords, policyRecords, getFillUpsForVehicle, getServiceRecordsForVehicle, getPolicyRecordsForVehicle } = useRecords()

  const activeFillCount = activeVehicle ? getFillUpsForVehicle(activeVehicle.id).length : 0
  const activeDueSoonCount = activeVehicle
    ? getDueSoonItems(activeVehicle, getServiceRecordsForVehicle(activeVehicle.id), activeVehicle.odometer).filter(
        (i) => i.status !== 'ok'
      ).length
    : 0
  const activePolicyCount = activeVehicle ? getPolicyRecordsForVehicle(activeVehicle.id).length : 0
  const totalEntries = fillUps.length + serviceRecords.length + policyRecords.length

  // With no vehicles, Dashboard is `/` and its first-vehicle panel.
  const vehicleItems = activeVehicle
    ? [
        { section: 'overview', label: 'Dashboard', icon: DashboardIcon },
        { section: 'fuel', label: 'Fuel log', meta: activeFillCount, icon: FuelIcon },
        { section: 'maintenance', label: 'Maintenance', meta: activeDueSoonCount, icon: WrenchIcon },
        { section: 'documents', label: 'Documents', meta: activePolicyCount, icon: RegistrationIcon },
        { section: 'trends', label: 'Trends', icon: TrendsIcon },
      ]
        .filter((item) => tracksSection(activeVehicle, item.section))
        .map((item) => ({ ...item, to: vehiclePath(activeVehicle, item.section) }))
    : [{ to: '/', label: 'Dashboard', icon: DashboardIcon }]

  const navItems = [
    ...vehicleItems,
    { to: '/garage', label: 'Garage', meta: vehicles.length, icon: GarageIcon },
    { to: '/settings', label: 'Settings', icon: SettingsIcon },
  ]

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
          <NavLink
            key={item.label}
            to={item.to}
            end
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-white/16 text-page' : 'text-page/62 hover:bg-white/14'
              }`
            }
          >
            <item.icon size={19} className="flex-none text-accent-on-dark" />
            <span>{item.label}</span>
            {item.meta != null && item.meta !== 0 && (
              <span className="ml-auto text-xs opacity-55 font-mono">{item.meta}</span>
            )}
          </NavLink>
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
