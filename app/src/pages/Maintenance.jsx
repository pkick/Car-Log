import { useState } from 'react'
import { useRecords } from '../context/RecordsContext'
import { getDueSoonItems, getServiceHistorySorted } from '../lib/vehicleStats'
import { CATEGORY_BY_ID, CATEGORY_ICON, CATEGORY_TEXT_CLASS, CATEGORY_TILE_CLASS, CATEGORY_ID_BY_SERVICE } from '../lib/serviceCategories'
import { MapPinIcon } from '../components/icons'
import { Badge, Button, Card, PageHeader } from '../components/ui'
import LogServiceModal from '../components/LogServiceModal'

function formatServicesList(services) {
  if (services.length <= 2) return services.join(', ')
  return `${services.slice(0, 2).join(', ')}, +${services.length - 2} more`
}

export default function Maintenance({ vehicle, onLogService }) {
  const { getServiceRecordsForVehicle, deleteServiceRecord } = useRecords()
  const [modalState, setModalState] = useState(null) // { editingRecord, defaultCategoryId } | null

  const records = getServiceRecordsForVehicle(vehicle.id)
  const dueSoon = getDueSoonItems(vehicle, records, vehicle.odometer).filter((item) => item.status !== 'ok')
  const serviceHistory = getServiceHistorySorted(records)

  return (
    <main className="px-10 py-8 max-w-[1180px] w-full">
      <PageHeader
        eyebrow="Maintenance"
        title={`${vehicle.nickname} — service`}
        action={<Button onClick={onLogService}>Log service</Button>}
      />

      {/* Due Cards */}
      <div className="mb-[22px]">
        <h2 className="text-2xl font-bold mb-4">Due soon</h2>
        {dueSoon.length === 0 ? (
          <Card padding="lg" className="text-sm text-ink/45">
            Nothing due soon for {vehicle.nickname} — you're all caught up.
          </Card>
        ) : (
          <div className="grid grid-cols-3 gap-[14px]">
            {dueSoon.map((item) => {
              const overdue = item.status === 'overdue'
              return (
                <Card key={item.intervalId} tone={overdue ? 'red' : 'muted'} padding="none" className="overflow-hidden flex">
                  <div className={`w-2 flex-none ${overdue ? 'bg-red' : 'bg-ink/30'}`} />
                  <div className="flex-1 p-4">
                    <h3 className="font-semibold text-sm mb-3">{item.name}</h3>

                    <Badge tone={overdue ? 'red' : 'neutral'} className="mb-3">
                      {overdue ? 'Overdue' : 'Coming up'}
                    </Badge>

                    <div className={`h-1 rounded-full mb-3 ${overdue ? 'bg-red/30' : 'bg-ink/9'}`} />

                    <p className="text-xs font-mono text-ink/50 mb-4">{item.remainingLabel} · {item.detailLabel}</p>

                    <Button variant="secondary" size="sm" className="w-full" onClick={() => setModalState({ defaultCategoryId: item.categoryId })}>
                      Log now
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Service History */}
      <Card padding="none">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink/8">
          <h2 className="text-2xl font-bold">Service history</h2>
        </div>

        <div className="p-4 space-y-2.5">
          {serviceHistory.length === 0 && (
            <div className="px-2 py-10 text-center text-sm text-ink/45">
              No service history logged yet for {vehicle.nickname}.
            </div>
          )}
          {serviceHistory.map((service) => {
            const categoryIds = [...new Set(service.services.map((s) => CATEGORY_ID_BY_SERVICE[s]).filter(Boolean))]
            return (
            <Card key={service.id} tone="muted" padding="sm">
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm">{formatServicesList(service.services)}</h3>
                    {categoryIds.slice(0, 4).map((catId) => {
                      const cat = CATEGORY_BY_ID[catId]
                      const Icon = CATEGORY_ICON[catId]
                      return (
                        <span
                          key={catId}
                          className={`w-6 h-6 rounded-md flex items-center justify-center flex-none ${CATEGORY_TILE_CLASS[cat.color]} ${CATEGORY_TEXT_CLASS[cat.color]}`}
                        >
                          <Icon size={13} />
                        </span>
                      )
                    })}
                    {categoryIds.length > 4 && (
                      <span className="w-6 h-6 rounded-md flex items-center justify-center flex-none bg-ink/6 text-ink/45 text-xs font-mono font-semibold">
                        +{categoryIds.length - 4}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-ink/50 flex items-center gap-1.5 mt-0.5">
                    <MapPinIcon size={12} className="flex-none text-ink/35" />
                    {service.shopName || 'DIY'} · {service.date}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">${service.cost.toFixed(2)}</p>
                  <p className="text-xs font-mono text-ink/50">{service.odometer.toLocaleString()} mi</p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="link" size="sm" onClick={() => setModalState({ editingRecord: service })}>EDIT</Button>
                <Button variant="link-danger" size="sm" onClick={() => deleteServiceRecord(service.id)}>DEL</Button>
              </div>
            </Card>
            )
          })}
        </div>
      </Card>

      {modalState && (
        <LogServiceModal
          vehicle={vehicle}
          editingRecord={modalState.editingRecord}
          defaultCategoryId={modalState.defaultCategoryId}
          onClose={() => setModalState(null)}
        />
      )}
    </main>
  )
}
