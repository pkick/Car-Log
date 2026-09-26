import { useState } from 'react'
import { useRecords } from '../context/RecordsContext'
import LogPolicyModal from '../components/LogPolicyModal'
import ReceiptThumbs from '../components/ReceiptThumbs'
import VehicleDocumentsCard from '../components/VehicleDocumentsCard'
import { useVehicleReceipts } from '../hooks/useReceipts'
import { InsuranceIcon, RegistrationIcon } from '../components/icons'
import { Button, Card, EmptyState, PageHeader, Segmented, StatusChip } from '../components/ui'
import { groupReceipts, receiptKey } from '../lib/receipts'
import { RENEWAL_TYPES, formatFullDate, formatRenewalCountdown, getRenewalItems } from '../lib/renewals'

const RENEWAL_ICONS = {
  insurance: { icon: InsuranceIcon, iconClass: 'text-accent' },
  registration: { icon: RegistrationIcon, iconClass: 'text-teal' },
}

const FILTERS = ['All', 'Insurance', 'Registration'].map((value) => ({ value, label: value }))

function RenewalCard({ type, label, item, onLogPayment }) {
  const { icon: Icon, iconClass } = RENEWAL_ICONS[type]

  if (!item) {
    return (
      <EmptyState
        icon={Icon}
        title={label}
        body="No renewal date. Log a payment with its renewal date, or add it in Edit vehicle."
        action={
          <Button variant="secondary" size="sm" onClick={onLogPayment}>
            Log payment
          </Button>
        }
      />
    )
  }

  const { status, renewalDate, daysUntil, lastPayment } = item
  return (
    <Card tone={status === 'overdue' ? 'red' : 'light'} className="flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Icon size={48} className={`flex-none ${iconClass}`} />
          {label}
        </h3>
        <StatusChip status={status} />
      </div>

      <p className="text-4xl font-bold tracking-tighter mb-1.5">{formatRenewalCountdown(daysUntil)}</p>
      <p className="text-xs font-mono text-ink/50">{formatFullDate(renewalDate)}</p>

      <div className="flex items-center justify-between gap-3 mt-4 mb-4 pt-4 border-t border-ink/8 text-xs font-mono">
        <span className="text-ink/45">Last payment</span>
        <span className="font-semibold text-right">
          {lastPayment ? [`$${lastPayment.cost.toFixed(2)}`, lastPayment.provider].filter(Boolean).join(' · ') : 'None logged'}
        </span>
      </div>

      <Button variant="secondary" size="sm" className="w-full mt-auto" onClick={onLogPayment}>
        Log payment
      </Button>
    </Card>
  )
}

export default function Documents({ vehicle }) {
  const { getPolicyRecordsForVehicle, deletePolicyRecord } = useRecords()
  const [modalState, setModalState] = useState(null) // { editingRecord, defaultType } | null
  const [filter, setFilter] = useState('All')
  const receiptsByRecord = groupReceipts(useVehicleReceipts(vehicle.id).receipts)

  const records = getPolicyRecordsForVehicle(vehicle.id)
  const renewals = getRenewalItems(vehicle, records)
  const history = [...records]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((r) => filter === 'All' || (filter === 'Insurance' ? r.type === 'insurance' : r.type === 'registration'))

  return (
    <main className="px-10 py-8 max-w-[1180px] w-full">
      <PageHeader
        eyebrow="Documents"
        title={`${vehicle.nickname} — insurance and registration`}
        action={<Button onClick={() => setModalState({})}>Log payment</Button>}
      />

      {/* Renewals */}
      <div className="grid grid-cols-2 gap-[14px] mb-[22px]">
        {RENEWAL_TYPES.map(({ type, label }) => (
          <RenewalCard
            key={type}
            type={type}
            label={label}
            item={renewals.find((renewal) => renewal.type === type)}
            onLogPayment={() => setModalState({ defaultType: type })}
          />
        ))}
      </div>

      {/* History */}
      <Card padding="none">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink/8">
          <h2 className="text-2xl font-bold">Payment history</h2>
          <Segmented aria-label="Payment type" options={FILTERS} value={filter} onChange={setFilter} />
        </div>

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
                      {record.provider || '—'} · {formatFullDate(record.date)}
                      {record.renewalDate ? ` · renews ${formatFullDate(record.renewalDate)}` : ''}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold">${record.cost.toFixed(2)}</p>
              </div>
              <div className="flex items-center justify-between gap-3 ml-20">
                <ReceiptThumbs receipts={receiptsByRecord.get(receiptKey('policy', record.id)) ?? []} />
                <div className="flex gap-3">
                  <Button variant="link" size="sm" onClick={() => setModalState({ editingRecord: record })}>
                    EDIT
                  </Button>
                  <Button variant="link-danger" size="sm" onClick={() => deletePolicyRecord(record.id)}>
                    DEL
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-[22px]">
        <VehicleDocumentsCard key={vehicle.id} vehicle={vehicle} />
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
