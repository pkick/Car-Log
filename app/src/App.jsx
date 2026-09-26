import { useState, useContext, useEffect, useRef } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useMatch, useNavigate, useParams } from 'react-router'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './pages/Dashboard'
import FuelLog from './pages/FuelLog'
import Maintenance from './pages/Maintenance'
import Documents from './pages/Documents'
import Trends from './pages/Trends'
import Garage from './pages/Garage'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'
import EditVehicleModal from './components/EditVehicleModal'
import AddVehicleModal from './components/AddVehicleModal'
import LogServiceModal from './components/LogServiceModal'
import LogFillupModal from './components/LogFillupModal'
import DeleteVehicleModal from './components/DeleteVehicleModal'
import FirstVehiclePanel from './components/FirstVehiclePanel'
import { VehicleContext, VehicleProvider } from './context/VehicleContext'
import { UIPrefsProvider } from './context/UIPrefsContext'
import { RecordsProvider } from './context/RecordsContext'
import { useScrollRestoration } from './hooks/useScrollRestoration'
import { findVehicle, tracksSection, vehiclePath } from './lib/routes'

/**
 * Resolves `:vehicleId` and renders `children(vehicle)`. An unknown vehicle redirects to `/`; a section the
 * vehicle doesn't track redirects to its overview.
 */
function VehicleRoute({ section, children }) {
  const { vehicleId } = useParams()
  const { vehicles } = useContext(VehicleContext)
  const vehicle = findVehicle(vehicles, vehicleId)
  if (!vehicle) return <Navigate to="/" replace />
  if (!tracksSection(vehicle, section)) return <Navigate to={vehiclePath(vehicle)} replace />
  return children(vehicle)
}

function AppContent() {
  const [editingVehicleId, setEditingVehicleId] = useState(null)
  const [deletingVehicleId, setDeletingVehicleId] = useState(null)
  const [showAddVehicle, setShowAddVehicle] = useState(false)
  const [showLogService, setShowLogService] = useState(false)
  const [showLogFillup, setShowLogFillup] = useState(false)

  const { vehicles, lastVehicleId, rememberVehicle } = useContext(VehicleContext)
  const navigate = useNavigate()
  const vehicleMatch = useMatch('/v/:vehicleId/*')
  const routeVehicle = findVehicle(vehicles, vehicleMatch?.params.vehicleId)
  const lastVehicle = vehicles.find((v) => v.id === lastVehicleId)
  // The URL's vehicle; on Garage, Settings and the 404 page, the last one shown.
  const activeVehicle = routeVehicle ?? lastVehicle
  const scrollRef = useRef(null)
  useScrollRestoration(scrollRef)

  const routeVehicleId = routeVehicle?.id
  useEffect(() => {
    if (routeVehicleId != null) rememberVehicle(routeVehicleId)
  }, [routeVehicleId, rememberVehicle])

  // On a vehicle's page, switching keeps the section (/v/1/trends to /v/2/trends). Elsewhere it only changes
  // the active vehicle, as Garage's "Set active" does.
  const selectVehicle = (id) => {
    if (id === activeVehicle?.id) return
    if (routeVehicle) navigate(vehiclePath(vehicles.find((v) => v.id === id), vehicleMatch.params['*'].split('/')[0]))
    else rememberVehicle(id)
  }

  // Deleting the active vehicle moves on to another one, or to the first-vehicle panel when none are left.
  const handleVehicleDeleted = (id) => {
    if (id !== activeVehicle?.id) return
    const next = vehicles.find((v) => v.id !== id)
    navigate(next ? vehiclePath(next) : '/')
  }

  const openAddVehicle = () => setShowAddVehicle(true)
  const openLogService = () => setShowLogService(true)
  const openLogFillup = () => setShowLogFillup(true)

  return (
    <>
      <div className="flex h-screen bg-page">
        <Sidebar activeVehicle={activeVehicle} />
        <main className="flex-1 overflow-hidden flex flex-col">
          <Header
            vehicle={activeVehicle}
            vehicles={vehicles}
            activeVehicleId={activeVehicle?.id}
            onSelectVehicle={selectVehicle}
            onEditVehicle={setEditingVehicleId}
            onAddVehicle={openAddVehicle}
            onLogService={openLogService}
            onLogFillup={openLogFillup}
          />
          <div ref={scrollRef} className="flex-1 overflow-auto">
            <Routes>
              <Route
                path="/"
                element={
                  lastVehicle ? <Navigate to={vehiclePath(lastVehicle)} replace /> : <FirstVehiclePanel onAddVehicle={openAddVehicle} />
                }
              />
              <Route path="/v/:vehicleId">
                <Route index element={<Navigate to="overview" replace />} />
                <Route
                  path="overview"
                  element={
                    <VehicleRoute section="overview">
                      {(vehicle) => (
                        <Dashboard
                          vehicle={vehicle}
                          onViewTrends={() => navigate(vehiclePath(vehicle, 'trends'))}
                          onLogService={openLogService}
                          onEditVehicle={() => setEditingVehicleId(vehicle.id)}
                        />
                      )}
                    </VehicleRoute>
                  }
                />
                <Route
                  path="fuel"
                  element={
                    <VehicleRoute section="fuel">
                      {(vehicle) => <FuelLog vehicle={vehicle} onLogFillup={openLogFillup} />}
                    </VehicleRoute>
                  }
                />
                <Route
                  path="maintenance"
                  element={
                    <VehicleRoute section="maintenance">
                      {(vehicle) => <Maintenance vehicle={vehicle} onLogService={openLogService} />}
                    </VehicleRoute>
                  }
                />
                <Route
                  path="documents"
                  element={<VehicleRoute section="documents">{(vehicle) => <Documents vehicle={vehicle} />}</VehicleRoute>}
                />
                <Route
                  path="trends"
                  element={<VehicleRoute section="trends">{(vehicle) => <Trends vehicle={vehicle} />}</VehicleRoute>}
                />
              </Route>
              <Route
                path="/garage"
                element={
                  <Garage
                    vehicles={vehicles}
                    activeVehicleId={activeVehicle?.id}
                    onSetActive={rememberVehicle}
                    onEditVehicle={setEditingVehicleId}
                    onDeleteVehicle={setDeletingVehicleId}
                    onAddVehicle={openAddVehicle}
                  />
                }
              />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
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
          onDeleted={handleVehicleDeleted}
        />
      )}

      {showAddVehicle && (
        <AddVehicleModal
          onClose={() => setShowAddVehicle(false)}
          // addVehicle remembers the new vehicle, so `/` opens its overview.
          onAdded={() => navigate('/')}
        />
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
    <BrowserRouter>
      <UIPrefsProvider>
        <VehicleProvider>
          <RecordsProvider>
            <AppContent />
          </RecordsProvider>
        </VehicleProvider>
      </UIPrefsProvider>
    </BrowserRouter>
  )
}

export default App
