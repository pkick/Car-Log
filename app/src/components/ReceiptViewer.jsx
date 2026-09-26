import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, FileIcon } from './icons'
import { Button, EmptyState, IconButton, Modal } from './ui'
import InlineConfirm from './InlineConfirm'
import { useToast } from '../context/toast'
import { deleteReceipt, downloadReceipt, receiptFileUrl } from '../hooks/useReceipts'
import { fileTypeLabel, formatAddedDate, formatFileSize, receiptPreview, stepIndex } from '../lib/receipts'

// Arrow keys in these belong to the control, not the viewer.
const KEEPS_ARROWS = 'input, textarea, select, [contenteditable="true"], [role="radiogroup"]'

function Preview({ receipt, missing, onBroken }) {
  if (missing) {
    return (
      <EmptyState
        icon={AlertIcon}
        title="File missing"
        body={`${receipt.filename} isn't in the server's receipts folder. Restore it from your appdata backup, or delete this entry.`}
      />
    )
  }
  const url = receiptFileUrl(receipt.id)
  switch (receiptPreview(receipt.mimeType)) {
    case 'image':
      return <img src={url} alt={receipt.label || receipt.filename} onError={onBroken} className="block max-w-full max-h-[62vh] mx-auto object-contain" />
    case 'pdf':
      return <iframe src={url} title={receipt.filename} className="block w-full h-[62vh] rounded-control border border-ink/10 bg-surface" />
    default:
      return (
        <EmptyState
          icon={FileIcon}
          title={`No preview for ${fileTypeLabel(receipt.mimeType)}`}
          body="This browser can't show this type of file. Download it to open it."
          action={
            <Button variant="secondary" size="sm" onClick={() => downloadReceipt(receipt)}>
              Download
            </Button>
          }
        />
      )
  }
}

/**
 * Shows a record's receipts one at a time: images fit to the dialog, PDFs embedded, anything else as a file tile.
 * Next and previous (also ← and →) wrap around; Download saves the original; Delete asks first, then removes the file
 * from the server. Closes itself when the last one is deleted.
 *
 * @param {object} props
 * @param {object[]} props.receipts The record's receipts, kept current by the caller.
 * @param {number} props.initialId The one to open on.
 * @param {() => void} props.onClose
 */
export default function ReceiptViewer({ receipts, initialId, onClose }) {
  const toast = useToast()
  const [currentId, setCurrentId] = useState(initialId)
  const [brokenId, setBrokenId] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  // Next when there's more than one, else Download: never the embedded PDF, which would swallow the arrow keys.
  const focusRef = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  const count = receipts.length
  const found = receipts.findIndex((r) => r.id === currentId)
  const index = found === -1 ? 0 : found
  const receipt = receipts[index]

  useEffect(() => {
    if (count === 0) onCloseRef.current()
  }, [count])

  const go = useCallback(
    (step) => {
      setCurrentId(receipts[stepIndex(index, step, receipts.length)].id)
      setConfirming(false)
      setDeleteError(null)
    },
    [receipts, index]
  )

  useEffect(() => {
    if (count < 2) return
    const handleKeyDown = (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if (event.target.closest?.(KEEPS_ARROWS)) return
      event.preventDefault()
      go(event.key === 'ArrowRight' ? 1 : -1)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [count, go])

  if (!receipt) return null

  const missing = receipt.fileMissing || brokenId === receipt.id

  const handleDelete = async () => {
    const neighbor = count > 1 ? receipts[stepIndex(index, 1, count)].id : null
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteReceipt(receipt)
      toast.success('File deleted', receipt.filename)
      setDeleting(false)
      setConfirming(false)
      if (neighbor == null) onClose()
      else setCurrentId(neighbor)
    } catch (err) {
      setDeleteError(err.message)
      setDeleting(false)
    }
  }

  const details = [receipt.label, fileTypeLabel(receipt.mimeType), formatFileSize(receipt.size), formatAddedDate(receipt.createdAt)]

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      initialFocus={focusRef}
      title={<span className="truncate min-w-0">{receipt.filename}</span>}
      subtitle={details.filter(Boolean).join(' · ')}
      footer={
        confirming ? (
          <InlineConfirm
            message={<>Delete <b className="font-semibold break-all">{receipt.filename}</b>? The file is removed from the server.</>}
            onConfirm={handleDelete}
            onCancel={() => setConfirming(false)}
            busy={deleting}
            error={deleteError}
          />
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {count > 1 && (
                <>
                  <IconButton size="sm" aria-label="Previous file" onClick={() => go(-1)}>
                    <ChevronLeftIcon size={18} />
                  </IconButton>
                  <span className="text-xs font-mono text-ink/50 tabular-nums" aria-live="polite">
                    {index + 1} of {count}
                  </span>
                  <IconButton ref={focusRef} size="sm" aria-label="Next file" onClick={() => go(1)}>
                    <ChevronRightIcon size={18} />
                  </IconButton>
                </>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Button variant="link-danger" size="sm" onClick={() => setConfirming(true)}>
                Delete
              </Button>
              <Button ref={count > 1 || missing ? undefined : focusRef} variant="ghost" size="sm" disabled={missing} onClick={() => downloadReceipt(receipt)}>
                <DownloadIcon size={16} className="flex-none" />
                Download
              </Button>
            </div>
          </div>
        )
      }
    >
      <Preview key={receipt.id} receipt={receipt} missing={missing} onBroken={() => setBrokenId(receipt.id)} />
    </Modal>
  )
}
