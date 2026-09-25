import { useState } from 'react'
import { useRecords } from '../context/RecordsContext'
import LogPolicyModal from '../components/LogPolicyModal'
import { InsuranceIcon, RegistrationIcon } from '../components/icons'

function getRenewalStatus(dateStr) {
  if (!dateStr) return { status: 'unknown', daysUntil: null }
  const today = new Date()
  const renewal = new Date(dateStr)
  const daysUntil = Math.round((renewal - today) / 86400000)
  if (daysUntil < 0) return { status: 'overdue', daysUntil }
  if (daysUntil <= 30) return { status: 'coming-up', daysUntil }
  return { status: 'ok', daysUntil }
}

function SummaryCard({ label, icon: Icon, iconClass, renewalDate, onLogPayment }) {
  const { status, daysUntil } = getRenewalStatus(renewalDate)

  return (
    <div
      className={`rounded-2.5 border p-5 ${
        status === 'overdue' ? 'bg-[oklch(0.55_0.17_28/12%)] border-[oklch(0.55_0.17_28/30%)]' : 'bg-white border-ink/10'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Icon size={48} className={`flex-none ${iconClass}`} />
          {label}
        </h3>
        {status !== 'unknown' && (
          <span
            className={`text-xs font-mono font-semibold px-2 py-1 rounded ${
              status === 'overdue' ? 'bg-[oklch(0.55_0.17_28/20%)] text-red' : status === 'coming-up' ? 'bg-[oklch(0.66_0.14_68/20%)] text-amber' : 'bg-ink/6 text-ink/45'
            }`}
          >
            {status === 'overdue' ? 'OVERDUE' : status === 'coming-up' ? 'DUE SOON' : 'OK'}
          </span>
        )}
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

      <button
        onClick={onLogPayment}
        className="w-full py-2 px-3 bg-[oklch(0.56_0.19_258/10%)] text-accent text-xs font-semibold rounded-lg hover:bg-[oklch(0.56_0.19_258/15%)] transition-colors"
      >
        Log payment
      </button>
    </div>
  )
}

export default function Documents({ vehicle }) {
  const { getPolicyRecordsForVehicle, deletePolicyRecord } = useRecords()
  const [modalState, setModalState] = useState(null) // { editingRecord, defaultType } | null
  const [filter, setFilter] = useState('All')

  const records = getPolicyRecordsForVehicle(vehicle.id)
  const history = [...records]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .filter((r) => filter === 'All' || (filter === 'Insurance' ? r.type === 'insurance' : r.type === 'registration'))

  return (
    <main className="px-10 py-8 max-w-[1180px] w-full">
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
      <div className="bg-white rounded-2.5 border border-ink/10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink/8">
          <h2 className="text-2xl font-bold">Payment history</h2>
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5 p-1 bg-ink/6 rounded-lg">
              {['All', 'Insurance', 'Registration'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-colors ${
                    f === filter ? 'bg-slate text-white' : 'text-ink/40 hover:text-ink/60'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              onClick={() => setModalState({})}
              className="px-4 py-2.5 bg-slate text-white text-sm font-semibold rounded-lg hover:bg-slate/90 transition-colors"
            >
              + Log payment
            </button>
          </div>
        </div>

        <div className="divide-y divide-ink/8">
          {history.length === 0 && (
            <div className="px-6 py-10 text-center text-sm text-ink/45">
              No {filter !== 'All' ? filter.toLowerCase() : ''} payments logged yet for {vehicle.nickname}.
            </div>
          )}
          {history.map((record) => (
            <div key={record.id} className="px-6 py-4 hover:bg-ink/3 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-16 h-16 rounded-lg flex items-center justify-center flex-none ${
                      record.type === 'insurance' ? 'bg-[oklch(0.56_0.19_258/15%)] text-accent' : 'bg-[oklch(0.56_0.13_195/15%)] text-teal'
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
                <button
                  onClick={() => setModalState({ editingRecord: record })}
                  className="text-xs font-semibold text-accent hover:text-[oklch(0.56_0.19_258/80%)]"
                >
                  EDIT
                </button>
                <button
                  onClick={() => deletePolicyRecord(record.id)}
                  className="text-xs font-semibold text-red hover:text-[oklch(0.55_0.17_28/80%)]"
                >
                  DEL
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

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
