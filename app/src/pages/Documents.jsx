import { useState } from 'react'
import { useRecords } from '../context/RecordsContext'
import LogPolicyModal from '../components/LogPolicyModal'
import { InsuranceIcon, RegistrationIcon } from '../components/icons'
import { Badge, Button, Card, PageHeader, Segmented } from '../components/ui'
import { daysBetween, todayISO } from '../lib/dates'

function getRenewalStatus(dateStr) {
  if (!dateStr) return { status: 'unknown', daysUntil: null }
  const daysUntil = daysBetween(todayISO(), dateStr)
  if (daysUntil < 0) return { status: 'overdue', daysUntil }
  if (daysUntil <= 30) return { status: 'coming-up', daysUntil }
  return { status: 'ok', daysUntil }
}

const STATUS_BADGE = {
  overdue: { tone: 'red', label: 'Overdue' },
  'coming-up': { tone: 'amber', label: 'Due soon' },
  ok: { tone: 'neutral', label: 'OK' },
}

const FILTERS = ['All', 'Insurance', 'Registration'].map((value) => ({ value, label: value }))

function SummaryCard({ label, icon: Icon, iconClass, renewalDate, onLogPayment }) {
  const { status, daysUntil } = getRenewalStatus(renewalDate)
  const badge = STATUS_BADGE[status]

  return (
    <Card tone={status === 'overdue' ? 'red' : 'light'}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Icon size={48} className={`flex-none ${iconClass}`} />
          {label}
        </h3>
        {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
      </div>

      {renewalDate ? (
        <>
          <p className="text-2xl font-bold tracking-tighter mb-1">{renewalDate}</p>
          <p className="text-xs font-mono text-ink/50 mb-4">
            {daysUntil < 0 ? `${Math.abs(daysUntil)} days ago` : `in ${daysUntil} days`}
          </p>
        </>
      ) : (
        <p className="text-sm text-ink/45 mb-4">No renewal date on file yet.</p>
      )}

      <Button variant="secondary" size="sm" className="w-full" onClick={onLogPayment}>
        Log payment
      </Button>
    </Card>
  )
}

export default function Documents({ vehicle }) {
  const { getPolicyRecordsForVehicle, deletePolicyRecord } = useRecords()
  const [modalState, setModalState] = useState(null) // { editingRecord, defaultType } | null
  const [filter, setFilter] = useState('All')
  const [deletingId, setDeletingId] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  const records = getPolicyRecordsForVehicle(vehicle.id)
  const history = [...records]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((r) => filter === 'All' || (filter === 'Insurance' ? r.type === 'insurance' : r.type === 'registration'))

  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      await deletePolicyRecord(id)
      setDeleteError(null)
    } catch (err) {
      setDeleteError(`Couldn't delete: ${err.message}`)
    }
    setDeletingId(null)
  }

  return (
    <main className="px-10 py-8 max-w-[1180px] w-full">
      <PageHeader
        eyebrow="Documents"
        title={`${vehicle.nickname} — insurance and registration`}
        action={<Button onClick={() => setModalState({})}>Log payment</Button>}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-[14px] mb-[22px]">
        <SummaryCard
          label="Insurance"
          icon={InsuranceIcon}
          iconClass="text-accent"
          renewalDate={vehicle.insuranceRenewal}
          onLogPayment={() => setModalState({ defaultType: 'insurance' })}
        />
        <SummaryCard
          label="Registration"
          icon={RegistrationIcon}
          iconClass="text-teal"
          renewalDate={vehicle.registrationRenewal}
          onLogPayment={() => setModalState({ defaultType: 'registration' })}
        />
      </div>

      {/* History */}
      <Card padding="none">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink/8">
          <h2 className="text-2xl font-bold">Payment history</h2>
          <Segmented aria-label="Payment type" options={FILTERS} value={filter} onChange={setFilter} />
        </div>

        {deleteError && <p className="px-6 py-3 text-xs text-red border-b border-ink/8">{deleteError}</p>}
        <div className="divide-y divide-ink/8">
          {history.length === 0 && (
            <div className="px-6 py-10 text-center text-sm text-ink/45">
              No {filter !== 'All' ? filter.toLowerCase() : ''} payments logged yet for {vehicle.nickname}.
            </div>
          )}
          {history.map((record) => (
            <div key={record.id} className="px-6 py-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-16 h-16 rounded-lg flex items-center justify-center flex-none ${
                      record.type === 'insurance' ? 'bg-accent/15 text-accent' : 'bg-teal/15 text-teal'
                    }`}
                  >
                    {record.type === 'insurance' ? <InsuranceIcon size={48} /> : <RegistrationIcon size={48} />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{record.type === 'insurance' ? 'Insurance payment' : 'Registration payment'}</h3>
                    <p className="text-xs font-mono text-ink/50">
                      {record.provider || '—'} · {record.date}
                      {record.renewalDate ? ` · renews ${record.renewalDate}` : ''}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold">${record.cost.toFixed(2)}</p>
              </div>
              <div className="flex justify-end gap-3 ml-12">
                <Button variant="link" size="sm" onClick={() => setModalState({ editingRecord: record })}>
                  EDIT
                </Button>
                <Button variant="link-danger" size="sm" onClick={() => handleDelete(record.id)} disabled={deletingId === record.id}>
                  DEL
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {modalState && (
        <LogPolicyModal
          vehicle={vehicle}
          editingRecord={modalState.editingRecord}
          defaultType={modalState.defaultType}
          onClose={() => setModalState(null)}
        />
      )}
    </main>
  )
}
