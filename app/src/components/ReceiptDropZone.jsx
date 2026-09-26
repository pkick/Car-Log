import { useState } from 'react'
import { CloseIcon, PaperclipIcon, TrashIcon } from './icons'
import { Button, Card, DropZone, FieldGroup, FileThumb, IconButton } from './ui'
import InlineConfirm from './InlineConfirm'
import ReceiptViewer from './ReceiptViewer'
import { ReceiptThumb } from './ReceiptThumbs'
import { deleteReceipt } from '../hooks/useReceipts'
import { RECEIPT_ACCEPT, fileTypeLabel, formatFileSize, receiptTitle } from '../lib/receipts'

const TITLE = 'Drop a receipt, paste one, or click to attach'
const HINT = 'Stored on your server · JPG, PNG, HEIC, PDF up to 10 MB'

const ROW = 'flex items-center gap-3 px-3 py-2.5'

function ProgressBar({ progress, label }) {
  const percent = Math.round(progress * 100)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="mt-1.5 h-1 rounded-full bg-ink/8 overflow-hidden"
    >
      <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
    </div>
  )
}

function QueuedRow({ item, waitingNote, onRemove, onRetry }) {
  const bad = item.status === 'rejected' || item.status === 'failed'
  const meta = {
    queued: waitingNote,
    uploading: `Uploading ${Math.round(item.progress * 100)}%`,
    failed: item.error,
    rejected: item.error,
  }[item.status]

  return (
    <li className={ROW}>
      <FileThumb src={item.previewUrl ?? undefined} label={item.mimeType ? fileTypeLabel(item.mimeType) : '!'} tone={bad ? 'red' : 'neutral'} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate" title={item.name}>
          {item.name}
        </p>
        <p className={`text-xs font-mono ${bad ? 'text-red' : 'text-ink/50'}`}>
          {item.status === 'rejected' ? meta : `${formatFileSize(item.size)} · ${meta}`}
        </p>
        {item.status === 'uploading' && <ProgressBar progress={item.progress} label={`Uploading ${item.name}`} />}
      </div>
      {item.status === 'failed' && (
        <Button variant="link" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
      <IconButton size="sm" aria-label={`Remove ${item.name}`} onClick={onRemove}>
        <CloseIcon size={16} />
      </IconButton>
    </li>
  )
}

function AttachedRow({ receipt, onOpen }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      await deleteReceipt(receipt)
    } catch (err) {
      setError(err.message)
      setDeleting(false)
    }
  }

  if (confirming) {
    return (
      <li className={ROW}>
        <div className="flex-1 min-w-0">
          <InlineConfirm
            message={<>Delete <b className="font-semibold break-all">{receipt.filename}</b>?</>}
            onConfirm={handleDelete}
            onCancel={() => setConfirming(false)}
            busy={deleting}
            error={error}
          />
        </div>
      </li>
    )
  }

  return (
    <li className={ROW}>
      <ReceiptThumb receipt={receipt} onClick={onOpen} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate" title={receipt.filename}>
          {receiptTitle(receipt)}
        </p>
        <p className={`text-xs font-mono ${receipt.fileMissing ? 'text-red' : 'text-ink/50'}`}>
          {formatFileSize(receipt.size)} · {receipt.fileMissing ? 'File missing' : 'Attached'}
        </p>
      </div>
      <IconButton size="sm" variant="danger" aria-label={`Delete ${receipt.filename}`} onClick={() => setConfirming(true)}>
        <TrashIcon size={16} />
      </IconButton>
    </li>
  )
}

/**
 * The receipt drop zone for a form, with the files under it: those already attached to the record (open, delete) and
 * those queued or uploading (progress, retry, remove). Uploading is the queue's job (`useReceiptQueue`).
 *
 * @param {object} props
 * @param {import('../hooks/useReceiptQueue').ReceiptQueue} props.queue
 * @param {object[]} [props.attached] Receipts already on the record.
 * @param {import('react').ReactNode} [props.label='Receipts'] The group's label; `null` for none.
 * @param {string} [props.waitingNote='Uploads when you save'] What a queued file says while it waits for the record.
 * @param {string} [props.uploadLabel] A label to give the files added next (vehicle documents).
 * @param {() => void} [props.onAdd] Called after files are added, e.g. to clear `uploadLabel`.
 * @param {'sm' | 'md'} [props.size='md']
 */
export default function ReceiptDropZone({
  queue,
  attached = [],
  label = 'Receipts',
  waitingNote = 'Uploads when you save',
  uploadLabel,
  onAdd,
  size = 'md',
}) {
  const [openId, setOpenId] = useState(null)

  const handleFiles = (files) => {
    queue.add(files, { label: uploadLabel?.trim() || null })
    onAdd?.()
  }

  const zone = (
    <>
      <DropZone accept={RECEIPT_ACCEPT} onFiles={handleFiles} icon={PaperclipIcon} title={TITLE} hint={HINT} size={size} />
      {(attached.length > 0 || queue.items.length > 0) && (
        <Card as="ul" padding="none" className="mt-3 divide-y divide-ink/8" aria-label="Attached files">
          {attached.map((receipt) => (
            <AttachedRow key={`receipt-${receipt.id}`} receipt={receipt} onOpen={() => setOpenId(receipt.id)} />
          ))}
          {queue.items.map((item) => (
            <QueuedRow
              key={`queued-${item.key}`}
              item={item}
              waitingNote={waitingNote}
              onRemove={() => queue.remove(item.key)}
              onRetry={() => queue.retry(item.key)}
            />
          ))}
        </Card>
      )}
      {openId != null && <ReceiptViewer receipts={attached} initialId={openId} onClose={() => setOpenId(null)} />}
    </>
  )

  return label == null ? <div>{zone}</div> : <FieldGroup label={label}>{zone}</FieldGroup>
}
