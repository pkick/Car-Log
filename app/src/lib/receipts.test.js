import { describe, expect, it } from 'vitest'
import {
  MAX_RECEIPT_BYTES,
  RECEIPT_ACCEPT,
  canMakeThumbnail,
  checkReceiptFile,
  failedUploadMessage,
  fileTypeLabel,
  fitWithin,
  formatAddedDate,
  formatFileSize,
  groupReceipts,
  queueEntry,
  receiptKey,
  receiptPreview,
  receiptQueueReducer,
  receiptTitle,
  splitThumbnails,
  stepIndex,
} from './receipts'

const file = (name, type, size = 1000) => ({ name, type, size })

describe('checkReceiptFile', () => {
  it('takes JPEG, PNG, WebP, HEIC and PDF by extension and reported type', () => {
    expect(checkReceiptFile(file('shop.JPG', 'image/jpeg'))).toEqual({ mimeType: 'image/jpeg' })
    expect(checkReceiptFile(file('shop.jpeg', 'image/jpeg'))).toEqual({ mimeType: 'image/jpeg' })
    expect(checkReceiptFile(file('shot.png', 'image/png'))).toEqual({ mimeType: 'image/png' })
    expect(checkReceiptFile(file('shot.webp', 'image/webp'))).toEqual({ mimeType: 'image/webp' })
    expect(checkReceiptFile(file('policy.pdf', 'application/pdf'))).toEqual({ mimeType: 'application/pdf' })
    expect(checkReceiptFile(file('card.heif', 'image/heif'))).toEqual({ mimeType: 'image/heif' })
  })

  it('goes by the extension when the browser does not know the type, as with HEIC outside Safari', () => {
    expect(checkReceiptFile(file('IMG_0001.HEIC', ''))).toEqual({ mimeType: 'image/heic' })
    expect(checkReceiptFile(file('IMG_0001.heic', 'application/octet-stream'))).toEqual({ mimeType: 'image/heic' })
  })

  it('refuses other types, and a known extension with a different reported type', () => {
    expect(checkReceiptFile(file('setup.exe', 'application/x-msdownload'))).toEqual({ error: "setup.exe isn't a JPG, PNG, WebP, HEIC or PDF." })
    expect(checkReceiptFile(file('logo.svg', 'image/svg+xml')).error).toMatch(/isn't a JPG/)
    expect(checkReceiptFile(file('page.png', 'text/html')).error).toMatch(/isn't a JPG/)
    expect(checkReceiptFile(file('README', '')).error).toMatch(/isn't a JPG/)
  })

  it('refuses files over 10 MB and empty ones', () => {
    expect(checkReceiptFile(file('scan.pdf', 'application/pdf', MAX_RECEIPT_BYTES))).toEqual({ mimeType: 'application/pdf' })
    expect(checkReceiptFile(file('scan.pdf', 'application/pdf', 12.4 * 1024 * 1024))).toEqual({
      error: 'scan.pdf is 12 MB; the limit is 10 MB.',
    })
    expect(checkReceiptFile(file('empty.png', 'image/png', 0))).toEqual({ error: 'empty.png is empty.' })
  })
})

describe('RECEIPT_ACCEPT', () => {
  it('lists every extension and MIME type', () => {
    expect(RECEIPT_ACCEPT.split(',')).toEqual(expect.arrayContaining(['.jpg', '.heic', '.pdf', 'image/webp', 'application/pdf']))
  })
})

describe('formatFileSize', () => {
  it('uses bytes, whole kilobytes, and megabytes to one decimal below 10', () => {
    expect(formatFileSize(820)).toBe('820 B')
    expect(formatFileSize(245_000)).toBe('239 KB')
    expect(formatFileSize(3.44 * 1024 * 1024)).toBe('3.4 MB')
    expect(formatFileSize(10 * 1024 * 1024)).toBe('10 MB')
    expect(formatFileSize(-1)).toBe('—')
  })
})

describe('receiptPreview, canMakeThumbnail and fileTypeLabel', () => {
  it('shows images, embeds PDFs and gives HEIC a file tile', () => {
    expect(receiptPreview('image/png')).toBe('image')
    expect(receiptPreview('application/pdf')).toBe('pdf')
    expect(receiptPreview('image/heic')).toBe('file')
    expect(receiptPreview('text/plain')).toBe('file')
  })

  it('makes thumbnails only for types a canvas can draw', () => {
    expect(['image/jpeg', 'image/png', 'image/webp'].map(canMakeThumbnail)).toEqual([true, true, true])
    expect(['image/heic', 'image/heif', 'application/pdf'].map(canMakeThumbnail)).toEqual([false, false, false])
  })

  it('labels tiles with the short type name', () => {
    expect(fileTypeLabel('application/pdf')).toBe('PDF')
    expect(fileTypeLabel('image/heic')).toBe('HEIC')
    expect(fileTypeLabel('image/jpeg')).toBe('JPG')
    expect(fileTypeLabel('application/zip')).toBe('FILE')
  })
})

describe('fitWithin', () => {
  it('scales the longest side down to the limit, keeping the shape', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 320, height: 240 })
    expect(fitWithin(1000, 3000, 320)).toEqual({ width: 107, height: 320 })
  })

  it('leaves small images alone and never goes below 1 pixel', () => {
    expect(fitWithin(200, 100)).toEqual({ width: 200, height: 100 })
    expect(fitWithin(10000, 1)).toEqual({ width: 320, height: 1 })
  })
})

describe('groupReceipts and splitThumbnails', () => {
  const receipts = [
    { id: 4, recordType: 'service', recordId: 7 },
    { id: 2, recordType: 'service', recordId: 7 },
    { id: 3, recordType: 'policy', recordId: 7 },
    { id: 5, recordType: 'vehicle', recordId: 1 },
  ]

  it('groups by record type and id, oldest first', () => {
    const groups = groupReceipts(receipts)
    expect(groups.get(receiptKey('service', 7)).map((r) => r.id)).toEqual([2, 4])
    expect(groups.get(receiptKey('policy', 7)).map((r) => r.id)).toEqual([3])
    expect(groups.get(receiptKey('service', 8))).toBeUndefined()
  })

  it('shows up to three and counts the rest', () => {
    const list = [1, 2, 3, 4, 5].map((id) => ({ id }))
    expect(splitThumbnails(list)).toEqual({ shown: list.slice(0, 3), more: 2 })
    expect(splitThumbnails(list.slice(0, 2))).toEqual({ shown: list.slice(0, 2), more: 0 })
    expect(splitThumbnails([])).toEqual({ shown: [], more: 0 })
  })
})

describe('stepIndex', () => {
  it('moves forward and back, wrapping at both ends', () => {
    expect(stepIndex(0, 1, 3)).toBe(1)
    expect(stepIndex(2, 1, 3)).toBe(0)
    expect(stepIndex(0, -1, 3)).toBe(2)
    expect(stepIndex(0, 1, 1)).toBe(0)
    expect(stepIndex(0, 1, 0)).toBe(0)
  })
})

describe('formatAddedDate', () => {
  it('shows the local day of a UTC timestamp', () => {
    expect(formatAddedDate('2026-09-26T16:04:11Z')).toBe('Sep 26, 2026')
    // 02:00 UTC is still the evening before in Los Angeles, where the tests run.
    expect(formatAddedDate('2026-09-27T02:00:00Z')).toBe('Sep 26, 2026')
  })

  it('is empty for anything else', () => {
    expect(formatAddedDate('2026-09-26')).toBe('')
    expect(formatAddedDate('not a date')).toBe('')
    expect(formatAddedDate(null)).toBe('')
  })
})

describe('receiptTitle', () => {
  it('prefers the label over the file name', () => {
    expect(receiptTitle({ label: 'Insurance card', filename: 'IMG_0001.jpg' })).toBe('Insurance card')
    expect(receiptTitle({ label: null, filename: 'IMG_0001.jpg' })).toBe('IMG_0001.jpg')
  })
})

describe('the upload queue', () => {
  const photo = queueEntry(1, file('photo.png', 'image/png', 2048))
  const tooBig = queueEntry(2, file('scan.pdf', 'application/pdf', MAX_RECEIPT_BYTES + 1), 'Title')

  it('queues a file that passes the checks and rejects one that does not', () => {
    expect(photo).toEqual({
      key: 1, name: 'photo.png', size: 2048, mimeType: 'image/png', status: 'queued', progress: 0, error: null, previewUrl: null, label: null,
    })
    expect(tooBig).toMatchObject({ key: 2, status: 'rejected', mimeType: null, label: 'Title' })
    expect(tooBig.error).toMatch(/limit is 10 MB/)
  })

  it('tracks an upload from start to done', () => {
    let items = receiptQueueReducer([], { type: 'add', items: [photo, tooBig] })
    items = receiptQueueReducer(items, { type: 'preview', key: 1, previewUrl: 'blob:thumb' })
    items = receiptQueueReducer(items, { type: 'start', key: 1 })
    items = receiptQueueReducer(items, { type: 'progress', key: 1, progress: 0.42 })
    expect(items[0]).toMatchObject({ status: 'uploading', progress: 0.42, previewUrl: 'blob:thumb' })
    expect(receiptQueueReducer(items, { type: 'progress', key: 1, progress: 1.3 })[0].progress).toBe(1)

    items = receiptQueueReducer(items, { type: 'done', key: 1 })
    expect(items.map((item) => item.key)).toEqual([2])
  })

  it('keeps a failed upload with its error until it is retried or removed', () => {
    let items = receiptQueueReducer([photo], { type: 'start', key: 1 })
    items = receiptQueueReducer(items, { type: 'fail', key: 1, error: "Can't reach the server." })
    expect(items[0]).toMatchObject({ status: 'failed', error: "Can't reach the server." })

    const retried = receiptQueueReducer(items, { type: 'start', key: 1 })
    expect(retried[0]).toMatchObject({ status: 'uploading', progress: 0, error: null })
    expect(receiptQueueReducer(items, { type: 'remove', key: 1 })).toEqual([])
    expect(receiptQueueReducer(items, { type: 'unknown' })).toBe(items)
  })

  it('explains a save whose files did not all upload', () => {
    expect(failedUploadMessage('Service', 1)).toBe("Service saved, but 1 file didn't upload. Retry it or remove it, then save again.")
    expect(failedUploadMessage('Payment', 2)).toBe("Payment saved, but 2 files didn't upload. Retry them or remove them, then save again.")
  })
})
