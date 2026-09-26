import { useId, useState } from 'react'
import { Button, Card, Field, Input, Skeleton } from './ui'
import ReceiptDropZone from './ReceiptDropZone'
import ReceiptViewer from './ReceiptViewer'
import { ReceiptThumb } from './ReceiptThumbs'
import { useReceiptQueue } from '../hooks/useReceiptQueue'
import { useVehicleReceipts } from '../hooks/useReceipts'
import { fileTypeLabel, formatAddedDate, formatFileSize, receiptTitle } from '../lib/receipts'

/**
 * Documents kept with a vehicle rather than a payment: the insurance card, the registration, the title. They upload
 * as soon as they're dropped, with the label typed beside the drop zone, and open in the receipt viewer.
 *
 * @param {object} props
 * @param {{ id: number, nickname: string }} props.vehicle
 */
export default function VehicleDocumentsCard({ vehicle }) {
  const headingId = useId()
  const { status, receipts, error } = useVehicleReceipts(vehicle.id)
  const queue = useReceiptQueue({ recordType: 'vehicle', recordId: vehicle.id })
  const [label, setLabel] = useState('')
  const [openId, setOpenId] = useState(null)

  const documents = receipts.filter((r) => r.recordType === 'vehicle' && r.recordId === vehicle.id).sort((a, b) => a.id - b.id)

  return (
    <Card as="section" padding="none" aria-labelledby={headingId}>
      <div className="px-6 py-4 border-b border-ink/8">
        <h2 id={headingId} className="text-2xl font-bold">
          Vehicle documents
        </h2>
        <p className="text-xs font-mono text-ink/50 mt-1.5">Insurance card, registration, title: anything to keep with {vehicle.nickname}.</p>
      </div>

      <div className="grid gap-5 px-6 py-5 md:grid-cols-[14rem_minmax(0,1fr)] md:items-start">
        <Field label="Label" hint="Optional. Names the next file you add.">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Insurance card" maxLength={100} />
        </Field>
        <ReceiptDropZone queue={queue} label={null} size="sm" uploadLabel={label} onAdd={() => setLabel('')} />
      </div>

      {status === 'loading' ? (
        <div aria-busy="true" className="px-6 pb-5 space-y-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : status === 'failed' ? (
        <p className="px-6 pb-6 text-sm text-red">Couldn't load documents: {error}</p>
      ) : documents.length === 0 ? (
        <p className="px-6 pt-5 pb-6 text-center text-sm text-ink/45 border-t border-ink/8">No documents yet for {vehicle.nickname}.</p>
      ) : (
        <ul className="border-t border-ink/8 divide-y divide-ink/8">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-4 px-6 py-3">
              <ReceiptThumb receipt={doc} size="md" onClick={() => setOpenId(doc.id)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{receiptTitle(doc)}</p>
                <p className={`text-xs font-mono truncate ${doc.fileMissing ? 'text-red' : 'text-ink/50'}`}>
                  {[doc.label && doc.filename, fileTypeLabel(doc.mimeType), formatFileSize(doc.size), doc.fileMissing ? 'File missing' : formatAddedDate(doc.createdAt)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <Button variant="link" size="sm" onClick={() => setOpenId(doc.id)}>
                VIEW
              </Button>
            </li>
          ))}
        </ul>
      )}

      {openId != null && <ReceiptViewer receipts={documents} initialId={openId} onClose={() => setOpenId(null)} />}
    </Card>
  )
}
