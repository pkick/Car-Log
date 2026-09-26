/**
 * Receipts and documents attached to a service, a payment or a vehicle (P4-C). The files live on the server under
 * DATA_DIR/receipts; this is the pure logic around them: which files the drop zone takes, how they're shown, and the
 * upload queue a form keeps until its record has an id.
 */

/** The largest file the server accepts: 10 MB, as in server/routes/receipts.js. */
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024

/** The longest side of a thumbnail the browser makes, in pixels (D17). */
export const THUMBNAIL_MAX_SIZE = 320

/** How many thumbnails a history row shows before "+N". */
export const ROW_THUMBNAILS = 3

const TYPES = [
  { mimeType: 'image/jpeg', extensions: ['jpg', 'jpeg'], mimeTypes: ['image/jpeg', 'image/jpg', 'image/pjpeg'], label: 'JPG', preview: 'image', thumbnail: true },
  { mimeType: 'image/png', extensions: ['png'], mimeTypes: ['image/png'], label: 'PNG', preview: 'image', thumbnail: true },
  { mimeType: 'image/webp', extensions: ['webp'], mimeTypes: ['image/webp'], label: 'WEBP', preview: 'image', thumbnail: true },
  { mimeType: 'image/heic', extensions: ['heic'], mimeTypes: ['image/heic', 'image/heif'], label: 'HEIC', preview: 'file', thumbnail: false },
  { mimeType: 'image/heif', extensions: ['heif'], mimeTypes: ['image/heif', 'image/heic'], label: 'HEIF', preview: 'file', thumbnail: false },
  { mimeType: 'application/pdf', extensions: ['pdf'], mimeTypes: ['application/pdf'], label: 'PDF', preview: 'pdf', thumbnail: false },
]

// Browsers that don't know a type (HEIC outside Safari) report it as one of these; the extension decides.
const UNKNOWN_MIME_TYPES = ['', 'application/octet-stream']

/** The file input's `accept`: every extension and MIME type the server takes. */
export const RECEIPT_ACCEPT = [
  ...TYPES.flatMap((type) => type.extensions.map((extension) => `.${extension}`)),
  ...TYPES.map((type) => type.mimeType),
].join(',')

const typeByMime = (mimeType) => TYPES.find((type) => type.mimeType === mimeType)

/**
 * @param {string} name A file name.
 * @returns {string} Its extension in lower case, without the dot, or `''`.
 */
function extensionOf(name) {
  const match = /\.([^./\\]+)$/.exec(name ?? '')
  return match ? match[1].toLowerCase() : ''
}

/**
 * Formats a byte count the way a file list shows it.
 * @param {number} bytes
 * @returns {string} `820 B`, `240 KB` or `3.4 MB`.
 */
export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  const mb = bytes / (1024 * 1024)
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
}

/**
 * Checks a picked, dropped or pasted file before it's queued, by extension, reported type and size. The server
 * checks again, including the file's first bytes.
 * @param {{ name: string, type?: string, size: number }} file A `File`.
 * @returns {{ mimeType: string } | { error: string }} The MIME type to upload it as, or why it can't be attached.
 */
export function checkReceiptFile(file) {
  const extension = extensionOf(file.name)
  const type = TYPES.find((t) => t.extensions.includes(extension))
  const reported = file.type ?? ''
  if (!type || !(type.mimeTypes.includes(reported) || UNKNOWN_MIME_TYPES.includes(reported))) {
    return { error: `${file.name} isn't a JPG, PNG, WebP, HEIC or PDF.` }
  }
  if (file.size > MAX_RECEIPT_BYTES) return { error: `${file.name} is ${formatFileSize(file.size)}; the limit is 10 MB.` }
  if (file.size === 0) return { error: `${file.name} is empty.` }
  return { mimeType: type.mimeType }
}

/**
 * @param {string} mimeType A receipt's MIME type.
 * @returns {'image' | 'pdf' | 'file'} How the viewer shows it: an image, an embedded PDF, or a file tile (HEIC,
 *   which only Safari can display).
 */
export function receiptPreview(mimeType) {
  return typeByMime(mimeType)?.preview ?? 'file'
}

/**
 * @param {string} mimeType
 * @returns {boolean} Whether the browser can draw it on a canvas to make a thumbnail (JPEG, PNG, WebP).
 */
export function canMakeThumbnail(mimeType) {
  return typeByMime(mimeType)?.thumbnail ?? false
}

/**
 * @param {string} mimeType
 * @returns {string} The short name on a file tile: `PDF`, `HEIC`, `JPG`.
 */
export function fileTypeLabel(mimeType) {
  return typeByMime(mimeType)?.label ?? 'FILE'
}

/**
 * Scales an image's size down to fit a square, keeping its shape. Smaller images keep their size.
 * @param {number} width
 * @param {number} height
 * @param {number} [max=THUMBNAIL_MAX_SIZE] The longest side allowed.
 * @returns {{ width: number, height: number }} Whole pixels, at least 1 each.
 */
export function fitWithin(width, height, max = THUMBNAIL_MAX_SIZE) {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/**
 * @param {'service' | 'policy' | 'vehicle'} recordType
 * @param {number} recordId
 * @returns {string} The key `groupReceipts` files a record's receipts under.
 */
export const receiptKey = (recordType, recordId) => `${recordType}:${recordId}`

/**
 * Groups a vehicle's receipts by the record they're attached to, oldest first.
 * @param {Array<{ id: number, recordType: string, recordId: number }>} receipts
 * @returns {Map<string, object[]>} Keyed by `receiptKey`.
 */
export function groupReceipts(receipts) {
  const groups = new Map()
  for (const receipt of [...receipts].sort((a, b) => a.id - b.id)) {
    const key = receiptKey(receipt.recordType, receipt.recordId)
    groups.set(key, [...(groups.get(key) ?? []), receipt])
  }
  return groups
}

/**
 * Splits a record's receipts into the thumbnails a row shows and how many more there are.
 * @param {object[]} receipts
 * @param {number} [max=ROW_THUMBNAILS]
 * @returns {{ shown: object[], more: number }}
 */
export function splitThumbnails(receipts, max = ROW_THUMBNAILS) {
  return { shown: receipts.slice(0, max), more: Math.max(0, receipts.length - max) }
}

/**
 * Moves through a list with wrap-around, for the viewer's next and previous.
 * @param {number} index The current position.
 * @param {number} step `1` for next, `-1` for previous.
 * @param {number} length How many there are.
 * @returns {number} The new position, or 0 for an empty list.
 */
export function stepIndex(index, step, length) {
  if (length <= 0) return 0
  return (((index + step) % length) + length) % length
}

/**
 * @param {string} createdAt A receipt's `createdAt`, a UTC timestamp such as `2026-09-26T16:04:11Z`.
 * @returns {string} The local day it was added, e.g. `Sep 26, 2026`, or `''` when it can't be read.
 */
export function formatAddedDate(createdAt) {
  const date = /^\d{4}-\d{2}-\d{2}T/.test(createdAt ?? '') ? new Date(createdAt) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * @param {{ label?: string | null, filename: string }} receipt
 * @returns {string} What a list calls it: its label, or its file name.
 */
export const receiptTitle = (receipt) => receipt.label || receipt.filename

/**
 * @typedef {object} QueuedReceipt A file in a form's upload queue.
 * @property {number} key
 * @property {string} name
 * @property {number} size
 * @property {string | null} mimeType What it uploads as; `null` when it was rejected.
 * @property {'queued' | 'uploading' | 'failed' | 'rejected'} status queued waits for the record's id (or its turn);
 *   rejected failed the checks in `checkReceiptFile` and never uploads.
 * @property {number} progress 0 to 1 while uploading.
 * @property {string | null} error Why it was rejected or failed.
 * @property {string | null} previewUrl An object URL of its thumbnail, once the browser has made one.
 * @property {string | null} label
 */

/**
 * The queue entry for a picked file.
 * @param {number} key
 * @param {{ name: string, type?: string, size: number }} file
 * @param {string | null} [label]
 * @returns {QueuedReceipt} Queued, or rejected with the reason from `checkReceiptFile`.
 */
export function queueEntry(key, file, label = null) {
  const check = checkReceiptFile(file)
  return {
    key,
    name: file.name,
    size: file.size,
    mimeType: check.mimeType ?? null,
    status: check.error ? 'rejected' : 'queued',
    progress: 0,
    error: check.error ?? null,
    previewUrl: null,
    label: label || null,
  }
}

const patch = (items, key, changes) => items.map((item) => (item.key === key ? { ...item, ...changes } : item))

/**
 * @param {QueuedReceipt[]} items
 * @param {{ type: 'add', items: QueuedReceipt[] }
 *   | { type: 'preview', key: number, previewUrl: string }
 *   | { type: 'start', key: number }
 *   | { type: 'progress', key: number, progress: number }
 *   | { type: 'fail', key: number, error: string }
 *   | { type: 'done' | 'remove', key: number }} action
 *   - `add` appends new entries.
 *   - `preview` sets an entry's thumbnail URL.
 *   - `start` marks it uploading from 0, clearing an earlier error.
 *   - `progress` records how much has been sent.
 *   - `fail` marks it failed with the error.
 *   - `done` (uploaded) and `remove` (taken out) drop it.
 * @returns {QueuedReceipt[]}
 */
export function receiptQueueReducer(items, action) {
  switch (action.type) {
    case 'add':
      return [...items, ...action.items]
    case 'preview':
      return patch(items, action.key, { previewUrl: action.previewUrl })
    case 'start':
      return patch(items, action.key, { status: 'uploading', progress: 0, error: null })
    case 'progress':
      return patch(items, action.key, { progress: Math.min(1, Math.max(0, action.progress)) })
    case 'fail':
      return patch(items, action.key, { status: 'failed', error: action.error })
    case 'done':
    case 'remove':
      return items.filter((item) => item.key !== action.key)
    default:
      return items
  }
}

/**
 * The line a form shows when its record saved but some files didn't upload.
 * @param {string} noun What was saved, e.g. `Service`.
 * @param {number} failed How many files failed.
 * @returns {string} e.g. `Service saved, but 1 file didn't upload. Retry it or remove it, then save again.`
 */
export function failedUploadMessage(noun, failed) {
  const files = failed === 1 ? '1 file' : `${failed} files`
  const them = failed === 1 ? 'it' : 'them'
  return `${noun} saved, but ${files} didn't upload. Retry ${them} or remove ${them}, then save again.`
}
