import { useState, useContext, useLayoutEffect, useRef } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './pages/Dashboard'
import FuelLog from './pages/FuelLog'
import Maintenance from './pages/Maintenance'
import Documents from './pages/Documents'
import Trends from './pages/Trends'
import Garage from './pages/Garage'
import Settings from './pages/Settings'
import EditVehicleModal from './components/EditVehicleModal'
import AddVehicleModal from './components/AddVehicleModal'
import LogServiceModal from './components/LogServiceModal'
import LogFillupModal from './components/LogFillupModal'
import DeleteVehicleModal from './components/DeleteVehicleModal'
import { VehicleContext, VehicleProvider } from './context/VehicleContext'
import { UIPrefsProvider } from './context/UIPrefsContext'
import { RecordsProvider } from './context/RecordsContext'

function AppContent() {
  const [screen, setScreen] = useState('dashboard')
  const [editingVehicleId, setEditingVehicleId] = useState(null)
  const [deletingVehicleId, setDeletingVehicleId] = useState(null)
  const [showAddVehicle, setShowAddVehicle] = useState(false)
  const [showLogService, setShowLogService] = useState(false)
  const [showLogFillup, setShowLogFillup] = useState(false)

  const { vehicles, activeVehicleId, setActiveVehicleId, getActiveVehicle } = useContext(VehicleContext)
  const activeVehicle = getActiveVehicle()
  const scrollRef = useRef(null)

  const hiddenScreens = [
    ...(activeVehicle?.tracksFuel === false ? ['fuel-log', 'trends'] : []),
    ...(activeVehicle?.tracksService === false ? ['maintenance'] : []),
  ]
  if (hiddenScreens.includes(screen)) setScreen('dashboard')

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [screen])

  const renderPage = () => {
    switch (screen) {
      case 'dashboard':
        return (
          <Dashboard
            vehicle={activeVehicle}
            onViewTrends={() => setScreen('trends')}
            onLogService={() => setShowLogService(true)}
            onEditVehicle={() => setEditingVehicleId(activeVehicle.id)}
          />
        )
      case 'fuel-log':
        return <FuelLog vehicle={activeVehicle} />
      case 'maintenance':
        return <Maintenance vehicle={activeVehicle} />
      case 'documents':
        return <Documents vehicle={activeVehicle} />
      case 'trends':
        return <Trends vehicle={activeVehicle} />
      case 'garage':
        return (
          <Garage
            vehicles={vehicles}
            activeVehicleId={activeVehicleId}
            onSetActive={setActiveVehicleId}
            onEditVehicle={setEditingVehicleId}
            onDeleteVehicle={setDeletingVehicleId}
            onAddVehicle={() => setShowAddVehicle(true)}
          />
        )
      case 'settings':
        return <Settings />
      default:
        return (
          <Dashboard
            vehicle={activeVehicle}
            onViewTrends={() => setScreen('trends')}
            onLogService={() => setShowLogService(true)}
            onEditVehicle={() => setEditingVehicleId(activeVehicle.id)}
          />
        )
    }
  }

  return (
    <>
      <div className="flex h-screen bg-page">
        <Sidebar screen={screen} setScreen={setScreen} hiddenScreens={hiddenScreens} />
        <main className="flex-1 overflow-hidden flex flex-col">
          <Header
            vehicle={activeVehicle}
            vehicles={vehicles}
            activeVehicleId={activeVehicleId}
            onSelectVehicle={setActiveVehicleId}
            onEditVehicle={setEditingVehicleId}
            onAddVehicle={() => setShowAddVehicle(true)}
            onLogService={() => setShowLogService(true)}
            onLogFillup={() => setShowLogFillup(true)}
          />
          <div ref={scrollRef} className="flex-1 overflow-auto">
            {renderPage()}
          </div>
        </main>
      </div>

      {editingVehicleId && (
        <EditVehicleModal
          vehicleId={editingVehicleId}
          onClose={() => setEditingVehicleId(null)}
        />
      )}

      {deletingVehicleId && (
        <DeleteVehicleModal
          vehicleId={deletingVehicleId}
          onClose={() => setDeletingVehicleId(null)}
        />
      )}

      {showAddVehicle && (
        <AddVehicleModal onClose={() => setShowAddVehicle(false)} />
      )}

      {showLogService && (
        <LogServiceModal
          vehicle={activeVehicle}
          onClose={() => setShowLogService(false)}
        />
      )}

      {showLogFillup && (
        <LogFillupModal
          vehicle={activeVehicle}
          onClose={() => setShowLogFillup(false)}
        />
      )}
    </>
  )
}

function App() {
  return (
    <UIPrefsProvider>
      <VehicleProvider>
        <RecordsProvider>
          <AppContent />
        </RecordsProvider>
      </VehicleProvider>
    </UIPrefsProvider>
  )
}

export default App
