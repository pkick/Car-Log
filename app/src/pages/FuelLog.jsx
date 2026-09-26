import { useState } from 'react'
import { FuelIcon } from '../components/icons'
import { Badge, Button, Card, PageHeader } from '../components/ui'
import FillUpForm from '../components/FillUpForm'
import { useRecords } from '../context/RecordsContext'
import { computeFillMpg } from '../lib/vehicleStats'

export default function FuelLog({ vehicle, onLogFillup }) {
  const { getFillUpsForVehicle, deleteFillUp } = useRecords()
  const [editingFill, setEditingFill] = useState(null)
  // Bumped to remount the panel's form with empty fields.
  const [formKey, setFormKey] = useState(0)
  const [deletingId, setDeletingId] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  const fillsAsc = [...getFillUpsForVehicle(vehicle.id)].sort((a, b) => a.odometer - b.odometer)
  const fillsWithMpg = computeFillMpg(fillsAsc)
  const fillsDesc = [...fillsWithMpg].sort((a, b) => b.odometer - a.odometer)
  const editingFillId = editingFill?.id ?? null

  const resetForm = () => {
    setEditingFill(null)
    setFormKey((key) => key + 1)
  }

  const handleEdit = (fill) => {
    setEditingFill(fill)
    setFormKey((key) => key + 1)
  }

  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      await deleteFillUp(id)
      setDeleteError(null)
      if (editingFillId === id) resetForm()
    } catch (err) {
      setDeleteError(`Couldn't delete: ${err.message}`)
    }
    setDeletingId(null)
  }

  const handleSaved = () => {
    resetForm()
    setDeleteError(null)
  }

  return (
    <main className="px-10 py-8 max-w-[1180px] w-full">
      <PageHeader
        eyebrow="Fuel log"
        title={`${vehicle.nickname} — fill-ups`}
        action={<Button onClick={onLogFillup}>Log fill-up</Button>}
      />

      <div className="grid gap-5.5" style={{ gridTemplateColumns: '1fr 320px' }}>
        {/* Fuel Log Table */}
        <Card padding="none" className="overflow-hidden">
          {deleteError && <p className="px-6 py-3 text-xs text-red border-b border-ink/8">{deleteError}</p>}
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
                    className={`border-b border-ink/8 transition-colors ${editingFillId === fill.id ? 'bg-accent/5' : ''}`}
                  >
                    <td className="px-6 py-4 text-sm">{fill.date}</td>
                    <td className="px-6 py-4 text-sm font-mono">{fill.odometer.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm font-mono">{fill.gallons}</td>
                    <td className="px-6 py-4 text-sm font-mono">${fill.pricePerGal.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm font-mono">${fill.total.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm font-mono">
                      <div className="flex items-center gap-2">
                        <span className={fill.mpg ? 'text-green' : 'text-ink/45'}>{fill.mpg || '—'}</span>
                        {!fill.isFull && <Badge tone="amber">Partial</Badge>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono">
                      <Button variant="link" size="sm" onClick={() => handleEdit(fill)}>EDIT</Button>
                      <span className="mx-2 text-ink/20">·</span>
                      <Button variant="link-danger" size="sm" onClick={() => handleDelete(fill.id)} disabled={deletingId === fill.id}>DEL</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Side Panel */}
        <FillUpForm
          key={`${editingFillId ?? 'new'}-${formKey}`}
          vehicle={vehicle}
          editingFillUp={editingFill}
          onSaved={handleSaved}
          onCancel={resetForm}
          compact
        >
          {({ fields, actions }) => (
            <Card padding="lg" className="h-fit">
              <div className="flex items-center gap-3 mb-5.5">
                <div className="w-14 h-14 rounded-2 flex items-center justify-center flex-none bg-accent/12">
                  <FuelIcon size={32} className="text-accent" />
                </div>
                <h3 className="text-lg font-semibold">{editingFill ? 'Edit fill-up' : 'New fill-up'}</h3>
              </div>

              <div className="mb-4">
                <p className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 mb-2">Vehicle</p>
                <div className="p-3 bg-ink/3 rounded-lg text-sm">{vehicle.nickname}</div>
              </div>

              <div className="mb-6">{fields}</div>
              {actions}
            </Card>
          )}
        </FillUpForm>
      </div>
    </main>
  )
}
