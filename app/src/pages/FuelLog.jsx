import { useState } from 'react'
import { FuelIcon } from '../components/icons'
import { useRecords } from '../context/RecordsContext'
import { computeFillMpg } from '../lib/vehicleStats'

const emptyForm = (vehicle) => ({
  date: new Date().toISOString().split('T')[0],
  odometer: String(vehicle?.odometer ?? ''),
  gallons: '',
  priceMode: 'perGallon',
  priceValue: '',
})

export default function FuelLog({ vehicle }) {
  const { getFillUpsForVehicle, addFillUp, updateFillUp, deleteFillUp } = useRecords()
  const [editingFillId, setEditingFillId] = useState(null)
  const [formData, setFormData] = useState(emptyForm(vehicle))

  const fillsAsc = [...getFillUpsForVehicle(vehicle.id)].sort((a, b) => a.odometer - b.odometer)
  const fillsWithMpg = computeFillMpg(fillsAsc)
  const fillsDesc = [...fillsWithMpg].sort((a, b) => b.odometer - a.odometer)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const gallons = parseFloat(formData.gallons) || 0
  const odometer = parseInt(formData.odometer, 10) || 0
  const priceValue = parseFloat(formData.priceValue) || 0
  const pricePerGal = formData.priceMode === 'total'
    ? (gallons > 0 ? Math.round((priceValue / gallons) * 100) / 100 : 0)
    : priceValue
  const totalCost = formData.priceMode === 'total' ? priceValue : gallons * pricePerGal

  const previewMpg = (() => {
    if (gallons <= 0 || odometer <= 0) return null
    const others = fillsAsc.filter((f) => f.id !== editingFillId)
    const candidate = { id: -1, odometer, gallons, isFull: true }
    const merged = [...others, candidate].sort((a, b) => a.odometer - b.odometer)
    return computeFillMpg(merged).find((f) => f.id === -1)?.mpg ?? null
  })()

  const resetForm = () => {
    setEditingFillId(null)
    setFormData(emptyForm(vehicle))
  }

  const handleEdit = (fill) => {
    setEditingFillId(fill.id)
    setFormData({
      date: fill.date,
      odometer: String(fill.odometer),
      gallons: String(fill.gallons),
      priceMode: 'perGallon',
      priceValue: String(fill.pricePerGal),
    })
  }

  const handleDelete = (id) => {
    deleteFillUp(id)
    if (editingFillId === id) resetForm()
  }

  const handleSave = () => {
    if (gallons <= 0 || pricePerGal <= 0) return
    const payload = { vehicleId: vehicle.id, date: formData.date, odometer, gallons, pricePerGal, isFull: true }
    if (editingFillId) {
      updateFillUp(editingFillId, payload)
    } else {
      addFillUp(payload)
    }
    resetForm()
  }

  return (
    <main className="px-10 py-8 max-w-[1180px] w-full">
      <div className="grid gap-5.5" style={{ gridTemplateColumns: '1fr 320px' }}>
        {/* Fuel Log Table */}
        <div className="bg-white rounded-2.5 border border-ink/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-ink/2.5 border-b border-ink/8">
                  <th className="px-6 py-4 text-left text-xs font-mono font-semibold text-ink/45 tracking-widest uppercase">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-mono font-semibold text-ink/45 tracking-widest uppercase">Odometer</th>
                  <th className="px-6 py-4 text-left text-xs font-mono font-semibold text-ink/45 tracking-widest uppercase">Gallons</th>
                  <th className="px-6 py-4 text-left text-xs font-mono font-semibold text-ink/45 tracking-widest uppercase">$/Gal</th>
                  <th className="px-6 py-4 text-left text-xs font-mono font-semibold text-ink/45 tracking-widest uppercase">Total</th>
                  <th className="px-6 py-4 text-left text-xs font-mono font-semibold text-ink/45 tracking-widest uppercase">MPG</th>
                  <th className="px-6 py-4 text-left text-xs font-mono font-semibold text-ink/45 tracking-widest uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fillsDesc.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-ink/45">
                      No fill-ups logged yet for {vehicle.nickname}.
                    </td>
                  </tr>
                )}
                {fillsDesc.map((fill) => (
                  <tr
                    key={fill.id}
                    className={`border-b border-ink/8 hover:bg-ink/3 transition-colors ${editingFillId === fill.id ? 'bg-[oklch(0.56_0.19_258/5%)]' : ''}`}
                  >
                    <td className="px-6 py-4 text-sm">{fill.date}</td>
                    <td className="px-6 py-4 text-sm font-mono">{fill.odometer.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm font-mono">{fill.gallons}</td>
                    <td className="px-6 py-4 text-sm font-mono">${fill.pricePerGal.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm font-mono">${fill.total.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm font-mono">
                      <div className="flex items-center gap-2">
                        <span className={fill.mpg ? 'text-green' : 'text-ink/45'}>{fill.mpg || '—'}</span>
                        {!fill.isFull && <span className="text-xs bg-[oklch(0.66_0.14_68/20%)] text-amber px-2 py-1 rounded">PARTIAL</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono">
                      <button onClick={() => handleEdit(fill)} className="text-xs font-semibold text-accent hover:text-[oklch(0.56_0.19_258/80%)]">EDIT</button>
                      <span className="mx-2 text-ink/20">·</span>
                      <button onClick={() => handleDelete(fill.id)} className="text-xs font-semibold text-red hover:text-[oklch(0.55_0.17_28/80%)]">DEL</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side Panel */}
        <div className="bg-white rounded-2.5 border border-ink/10 p-6 h-fit">
          <div className="flex items-center gap-3 mb-5.5">
            <div className="w-14 h-14 rounded-2 flex items-center justify-center flex-none bg-[oklch(0.56_0.19_258/12%)]">
              <FuelIcon size={32} className="text-accent" />
            </div>
            <h3 className="text-lg font-semibold">{editingFillId ? 'Edit fill-up' : 'New fill-up'}</h3>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Vehicle</label>
              <div className="p-3 bg-ink/3 rounded-lg text-sm">{vehicle.nickname}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Date</label>
                <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Odometer</label>
                <input type="number" name="odometer" value={formData.odometer} onChange={handleChange} className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 block mb-2">Gallons</label>
                <input type="number" step="0.1" name="gallons" value={formData.gallons} onChange={handleChange} className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-sm" placeholder="13.2" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45">
                    {formData.priceMode === 'total' ? 'Total paid' : '$/Gal'}
                  </label>
                  <div className="flex rounded-md border border-ink/12 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, priceMode: 'perGallon' })}
                      className={`px-1.5 py-0.5 text-[10px] font-mono font-semibold transition-colors ${
                        formData.priceMode === 'perGallon' ? 'bg-slate text-white' : 'bg-white text-ink/50 hover:bg-ink/3'
                      }`}
                    >
                      $/gal
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, priceMode: 'total' })}
                      className={`px-1.5 py-0.5 text-[10px] font-mono font-semibold transition-colors ${
                        formData.priceMode === 'total' ? 'bg-slate text-white' : 'bg-white text-ink/50 hover:bg-ink/3'
                      }`}
                    >
                      total
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  step="0.01"
                  name="priceValue"
                  value={formData.priceValue}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-ink/12 rounded-lg text-sm"
                  placeholder={formData.priceMode === 'total' ? '45.67' : '3.46'}
                />
              </div>
            </div>
          </div>

          <div className="bg-slate text-white rounded-lg p-4 mb-6">
            <div className="text-xs font-mono font-semibold tracking-widest uppercase text-white/60 mb-2">Calculated</div>
            <div className={`text-3xl font-bold tracking-tighter mb-1 ${previewMpg != null ? 'text-accent' : 'text-white/40'}`}>
              {previewMpg != null ? previewMpg : '—'} mpg
            </div>
            <div className="text-sm font-mono text-white/70">
              {formData.priceMode === 'total' ? `$${pricePerGal.toFixed(2)}/gal` : `$${totalCost.toFixed(2)} total`}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={gallons <= 0 || pricePerGal <= 0}
            className="w-full py-3 bg-slate text-white font-semibold rounded-lg hover:bg-slate/90 transition-colors mb-3 disabled:opacity-40 disabled:cursor-default"
          >
            {editingFillId ? 'Save changes' : 'Save fill-up'}
          </button>
          <button onClick={resetForm} className="w-full py-3 border border-ink/12 text-ink font-semibold rounded-lg hover:bg-ink/3 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </main>
  )
}
