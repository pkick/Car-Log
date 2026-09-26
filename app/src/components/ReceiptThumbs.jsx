import { useState } from 'react'
import { FileThumb } from './ui'
import ReceiptViewer from './ReceiptViewer'
import { receiptThumbUrl } from '../hooks/useReceipts'
import { ROW_THUMBNAILS, fileTypeLabel, receiptTitle, splitThumbnails } from '../lib/receipts'

/**
 * One receipt as a thumbnail, or a type tile when it has none. A missing file shows red.
 *
 * @param {object} props
 * @param {object} props.receipt
 * @param {'sm' | 'md' | 'lg'} [props.size='sm']
 * @param {() => void} [props.onClick] Opens it; without one the tile is decorative.
 */
export function ReceiptThumb({ receipt, size = 'sm', onClick }) {
  const title = receiptTitle(receipt)
  return (
    <FileThumb
      src={receipt.hasThumb && !receipt.fileMissing ? receiptThumbUrl(receipt.id) : undefined}
      label={fileTypeLabel(receipt.mimeType)}
      tone={receipt.fileMissing ? 'red' : 'neutral'}
      size={size}
      onClick={onClick}
      aria-label={onClick ? `Open ${title}${receipt.fileMissing ? ' (file missing)' : ''}` : undefined}
      title={onClick ? title : undefined}
    />
  )
}

/**
 * A history row's receipts: up to three thumbnails and a "+N" tile, each opening the viewer. Renders an empty cell
 * when there are none, so the row's grid keeps its columns.
 *
 * @param {object} props
 * @param {object[]} props.receipts The record's receipts, oldest first.
 */
export default function ReceiptThumbs({ receipts }) {
  const [openId, setOpenId] = useState(null)
  const { shown, more } = splitThumbnails(receipts)

  return (
    <div className="flex items-center gap-1">
      {shown.map((receipt) => (
        <ReceiptThumb key={receipt.id} receipt={receipt} onClick={() => setOpenId(receipt.id)} />
      ))}
      {more > 0 && (
        <FileThumb label={`+${more}`} onClick={() => setOpenId(receipts[ROW_THUMBNAILS].id)} aria-label={`${more} more ${more === 1 ? 'file' : 'files'}`} />
      )}
      {openId != null && <ReceiptViewer receipts={receipts} initialId={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}
