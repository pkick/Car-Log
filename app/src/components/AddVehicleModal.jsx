import { useState, useContext } from 'react'
import { VehicleContext, DEFAULT_INTERVALS } from '../context/VehicleContext'

export default function AddVehicleModal({ onClose }) {
  const { addVehicle } = useContext(VehicleContext)

  const [formData, setFormData] = useState({
    nickname: '',
    year: new Date().getFullYear(),
    make: '',
    model: '',
    trim: '',
    vin: '',
    plate: '',
    purchaseDate: '',
    purchaseOdometer: 0,
    registrationRenewal: '',
    insuranceRenewal: '',
    tankSize: 15,
  })

  const [trackMode, setTrackMode] = useState({
    fuel: true,
    service: true,
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleSave = () => {
    if (!formData.nickname || !formData.make || !formData.model) {
      alert('Please fill in nickname, make, and model')
      return
    }

    const purchaseOdometer = parseInt(formData.purchaseOdometer, 10) || 0
    addVehicle({
      ...formData,
      year: parseInt(formData.year, 10),
      purchaseOdometer,
      tankSize: parseFloat(formData.tankSize),
      tracksFuel: trackMode.fuel,
      tracksService: trackMode.service,
      odometer: purchaseOdometer,
      intervals: DEFAULT_INTERVALS.map((i) => ({ ...i })),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-ink/42 flex items-center justify-center z-50 modal-rise">
      <div className="bg-page rounded-2xl shadow-modal w-[604px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-slate text-page px-6 py-5 flex items-center justify-between border-b border-ink/10">
          <h2 className="text-xl font-bold">Add vehicle</h2>
          <button onClick={onClose} className="text-2xl font-light hover:opacity-70">×</button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Nickname & Year */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Nickname *</label>
              <input
                type="text"
                name="nickname"
                value={formData.nickname}
                onChange={handleChange}
                placeholder="e.g., The Wagon"
                className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Year *</label>
              <input
                type="number"
                name="year"
                value={formData.year}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Make, Model, Trim */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Make *</label>
              <input
                type="text"
                name="make"
                value={formData.make}
                onChange={handleChange}
                placeholder="e.g., Volvo"
                className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Model *</label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                placeholder="e.g., V60"
                className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Trim</label>
              <input
                type="text"
                name="trim"
                value={formData.trim}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* VIN & Plate */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">VIN</label>
              <input
                type="text"
                name="vin"
                value={formData.vin}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Plate</label>
              <input
                type="text"
                name="plate"
                value={formData.plate}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Purchase Date & Odometer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Purchase Date</label>
              <input
                type="date"
                name="purchaseDate"
                value={formData.purchaseDate}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Odometer at Purchase</label>
              <input
                type="number"
                name="purchaseOdometer"
                value={formData.purchaseOdometer}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Registration & Insurance Renewal */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Registration Renewal</label>
              <input
                type="date"
                name="registrationRenewal"
                value={formData.registrationRenewal}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Insurance Renewal</label>
              <input
                type="date"
                name="insuranceRenewal"
                value={formData.insuranceRenewal}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Tank Size */}
          <div>
            <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Tank Size (gallons)</label>
            <input
              type="number"
              step="0.1"
              name="tankSize"
              value={formData.tankSize}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-sm focus:outline-none focus:border-accent"
            />
          </div>

          {/* What to Track */}
          <div>
            <h3 className="text-sm font-semibold mb-4">What to track on this vehicle</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trackMode.fuel}
                  onChange={(e) => setTrackMode({ ...trackMode, fuel: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
                <span className="text-sm">Fuel & mileage</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trackMode.service}
                  onChange={(e) => setTrackMode({ ...trackMode, service: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
                <span className="text-sm">Maintenance</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-ink/8 px-6 py-4 flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 py-3 bg-slate text-white font-semibold rounded-lg hover:bg-slate/90 transition-colors"
          >
            Add vehicle
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-ink/12 text-ink font-semibold rounded-lg hover:bg-ink/3 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
