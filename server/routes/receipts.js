import { Router } from 'express'
import multer from 'multer'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { db, DATA_DIR } from '../db.js'
import { StartupError } from '../errors.js'

/** Where uploaded receipts and their thumbnails live, under random names (D17). */
export const RECEIPTS_DIR = path.join(DATA_DIR, 'receipts')

const MB = 1024 * 1024
/** The largest receipt the server accepts. */
export const MAX_FILE_BYTES = 10 * MB
// The browser makes a 320px JPEG, which is tens of kilobytes.
const MAX_THUMB_BYTES = MB / 2
const MAX_LABEL_LENGTH = 100
const MAX_FILENAME_LENGTH = 200

/** What `recordId` points at for each `recordType`. A vehicle document's `recordId` is the vehicle's id. */
export const RECORD_TYPES = ['service', 'policy', 'vehicle']
const RECORD_TABLES = { service: 'service_records', policy: 'policy_records' }
const RECORD_NOUNS = { service: 'Service record', policy: 'Payment', vehicle: 'Vehicle' }

const startsWith = (bytes, ...values) => values.every((value, i) => bytes[i] === value)
const ascii = (bytes, start, end) => String.fromCharCode(...bytes.subarray(start, end))
// HEIF brands for still images: heic/heix (HEVC), hevc/hevx (sequences), heim/heis/hevm/hevs, and the generic mif1/msf1.
const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']

const isJpeg = (bytes) => startsWith(bytes, 0xff, 0xd8, 0xff)
const isPng = (bytes) => startsWith(bytes, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
const isWebp = (bytes) => ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP'
const isHeif = (bytes) => ascii(bytes, 4, 8) === 'ftyp' && HEIF_BRANDS.includes(ascii(bytes, 8, 12))
const isPdf = (bytes) => ascii(bytes, 0, 5) === '%PDF-'

/**
 * The file types a receipt can be. A file must have one of a type's extensions, be sent with one of its MIME types,
 * and start with its signature. SVG and anything else a browser could run as a page is never accepted.
 */
const FILE_TYPES = [
  { mimeType: 'image/jpeg', extensions: ['.jpg', '.jpeg'], mimeTypes: ['image/jpeg', 'image/jpg', 'image/pjpeg'], matches: isJpeg },
  { mimeType: 'image/png', extensions: ['.png'], mimeTypes: ['image/png'], matches: isPng },
  { mimeType: 'image/webp', extensions: ['.webp'], mimeTypes: ['image/webp'], matches: isWebp },
  { mimeType: 'image/heic', extensions: ['.heic'], mimeTypes: ['image/heic', 'image/heif'], matches: isHeif },
  { mimeType: 'image/heif', extensions: ['.heif'], mimeTypes: ['image/heif', 'image/heic'], matches: isHeif },
  { mimeType: 'application/pdf', extensions: ['.pdf'], mimeTypes: ['application/pdf'], matches: isPdf },
]
const JPEG = FILE_TYPES[0]

/** Every MIME type a stored receipt can have, which a backup's rows are checked against. */
export const RECEIPT_MIME_TYPES = FILE_TYPES.map((type) => type.mimeType)

// Names this server gives stored files: 32 hex characters plus the type's extension. Anything else in a row (say
// from an edited backup) is never joined to a path, so it can't reach outside the receipts folder.
const STORED_NAME = /^[0-9a-f]{32}\.[a-z]{3,4}$/

const TYPE_ERROR = 'Attach a JPG, PNG, WebP, HEIC or PDF file.'

/**
 * @param {unknown} name A stored file name from a row.
 * @returns {boolean} Whether it has the shape of a name this server generates.
 */
export const isStoredName = (name) => typeof name === 'string' && STORED_NAME.test(name)

try {
  fs.mkdirSync(RECEIPTS_DIR, { recursive: true })
  fs.accessSync(RECEIPTS_DIR, fs.constants.W_OK)
} catch (err) {
  throw new StartupError(`${RECEIPTS_DIR} isn't writable (${err.code}). Give the server's user write access to it.`, { cause: err })
}

/** A rejected upload, as a `400 { error, field }` body. */
class UploadError extends Error {
  constructor(message, field) {
    super(message)
    this.field = field
  }
}

/**
 * @param {string} filename The name the file was uploaded with.
 * @param {string} mimeType The part's Content-Type.
 * @returns {object | undefined} The receipt type whose extension and MIME type both match.
 */
function typeForUpload(filename, mimeType) {
  const extension = path.extname(filename ?? '').toLowerCase()
  return FILE_TYPES.find((type) => type.extensions.includes(extension) && type.mimeTypes.includes(mimeType))
}

const upload = multer({
  storage: multer.diskStorage({
    destination: RECEIPTS_DIR,
    filename: (req, file, cb) => cb(null, `${crypto.randomBytes(16).toString('hex')}${file.receiptType.extensions[0]}`),
  }),
  // Browsers send the file name as UTF-8.
  defParamCharset: 'utf8',
  limits: { fileSize: MAX_FILE_BYTES, files: 2, fields: 4, fieldSize: 1024, parts: 6 },
  fileFilter(req, file, cb) {
    const type = file.fieldname === 'thumb' ? (file.mimetype === 'image/jpeg' ? JPEG : null) : typeForUpload(file.originalname, file.mimetype)
    if (!type) return cb(new UploadError(file.fieldname === 'thumb' ? 'The thumbnail must be a JPEG.' : TYPE_ERROR, file.fieldname))
    file.receiptType = type
    cb(null, true)
  },
}).fields([{ name: 'file', maxCount: 1 }, { name: 'thumb', maxCount: 1 }])

/**
 * @param {Error} err What multer passed on.
 * @returns {{ status: number, body: { error: string, field: string } } | null} The reply, or `null` for an error that
 *   isn't about the upload.
 */
function uploadErrorReply(err) {
  if (err instanceof UploadError) return { status: 400, body: { error: err.message, field: err.field } }
  if (!(err instanceof multer.MulterError)) return null
  if (err.code === 'LIMIT_FILE_SIZE') {
    return err.field === 'thumb'
      ? { status: 400, body: { error: 'The thumbnail is too large.', field: 'thumb' } }
      : { status: 413, body: { error: 'That file is larger than 10 MB.', field: 'file' } }
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') return { status: 400, body: { error: 'Send one file, and at most one thumbnail.', field: 'file' } }
  return { status: 400, body: { error: "That upload isn't valid.", field: 'file' } }
}

/**
 * @param {string} name A stored file name.
 * @returns {string | null} Its path in the receipts folder, or `null` for a name this server didn't generate.
 */
function storedPath(name) {
  return isStoredName(name) ? path.join(RECEIPTS_DIR, name) : null
}

function storedFileExists(name) {
  const file = storedPath(name)
  return file != null && fs.existsSync(file)
}

function removeFile(file) {
  try {
    fs.unlinkSync(file)
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`Couldn't remove ${file}: ${err.message}`)
  }
}

/**
 * Removes receipts' files and thumbnails from disk. A file that's already gone is skipped. Call it after the rows'
 * delete has committed, so a failed delete never leaves rows without files.
 * @param {{ storedName: string, thumbName: string | null }[]} rows Rows from the `receipts` table.
 * @returns {void}
 */
export function removeReceiptFiles(rows) {
  for (const row of rows) {
    for (const name of [row.storedName, row.thumbName]) {
      const file = storedPath(name)
      if (file) removeFile(file)
    }
  }
}

/**
 * Deletes the receipt rows attached to one service record or payment. Call it in the same transaction as the record's
 * delete, then pass the rows to `removeReceiptFiles` once it commits.
 * @param {'service' | 'policy'} recordType
 * @param {number} recordId
 * @returns {object[]} The deleted rows.
 */
export function deleteRecordReceipts(recordType, recordId) {
  const rows = db.prepare('SELECT * FROM receipts WHERE recordType = ? AND recordId = ?').all(recordType, recordId)
  db.prepare('DELETE FROM receipts WHERE recordType = ? AND recordId = ?').run(recordType, recordId)
  return rows
}

/**
 * Every receipt row of a vehicle, including those on its records. Read them before deleting the vehicle (its rows go
 * with it through ON DELETE CASCADE), then pass them to `removeReceiptFiles`.
 * @param {number} vehicleId
 * @returns {object[]}
 */
export function vehicleReceipts(vehicleId) {
  return db.prepare('SELECT * FROM receipts WHERE vehicleId = ?').all(vehicleId)
}

/**
 * Maps a `receipts` row to the API shape: the stored names stay on the server, and the flags say which files are
 * actually on disk (a restored backup can have rows whose files never came back).
 * @param {object} row A row from the `receipts` table.
 * @returns {object}
 */
function rowToReceipt({ storedName, thumbName, ...row }) {
  return { ...row, hasThumb: thumbName != null && storedFileExists(thumbName), fileMissing: !storedFileExists(storedName) }
}

/**
 * @param {unknown} value A form field or query value.
 * @returns {number | null} A positive whole number, or `null`.
 */
function parseId(value) {
  return typeof value === 'string' && /^[1-9]\d{0,15}$/.test(value) ? Number(value) : null
}

/**
 * @param {'service' | 'policy' | 'vehicle'} recordType
 * @param {number} recordId
 * @returns {number | null} The vehicle the record belongs to, or `null` when there's no such record.
 */
function recordVehicleId(recordType, recordId) {
  if (recordType === 'vehicle') return db.prepare('SELECT id FROM vehicles WHERE id = ?').get(recordId)?.id ?? null
  return db.prepare(`SELECT vehicleId FROM ${RECORD_TABLES[recordType]} WHERE id = ?`).get(recordId)?.vehicleId ?? null
}

function readHead(file) {
  const bytes = Buffer.alloc(16)
  const fd = fs.openSync(file, 'r')
  try {
    return bytes.subarray(0, fs.readSync(fd, bytes, 0, bytes.length, 0))
  } finally {
    fs.closeSync(fd)
  }
}

/**
 * Cleans up the name a file was uploaded with for storing and for `Content-Disposition`: no folders, no control
 * characters, at most 200 characters with the extension kept.
 * @param {string} name
 * @param {object} type The receipt type it was accepted as.
 * @returns {string}
 */
function cleanFilename(name, type) {
  const base = String(name ?? '').split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f]/g, '').trim()
  if (!base || base.startsWith('.')) return `receipt${type.extensions[0]}`
  if (base.length <= MAX_FILENAME_LENGTH) return base
  const extension = path.extname(base)
  return base.slice(0, MAX_FILENAME_LENGTH - extension.length) + extension
}

/**
 * Checks a parsed upload and stores its row.
 * @param {Record<string, string>} body The text fields.
 * @param {Record<string, object[]>} files multer's files, by field.
 * @returns {object} The new row.
 * @throws {UploadError}
 */
function saveUpload(body, files) {
  const recordType = body.recordType
  if (!RECORD_TYPES.includes(recordType)) throw new UploadError('recordType must be service, policy or vehicle.', 'recordType')
  const recordId = parseId(body.recordId)
  if (recordId == null) throw new UploadError('recordId must be a record id.', 'recordId')
  const vehicleId = recordVehicleId(recordType, recordId)
  if (vehicleId == null) throw new UploadError(`${RECORD_NOUNS[recordType]} not found.`, 'recordId')

  const [file] = files.file ?? []
  if (!file) throw new UploadError('Choose a file to attach.', 'file')
  if (file.size === 0) throw new UploadError('That file is empty.', 'file')
  if (!file.receiptType.matches(readHead(file.path))) {
    throw new UploadError(`That file isn't really a ${file.receiptType.extensions[0].slice(1).toUpperCase()}. ${TYPE_ERROR}`, 'file')
  }

  const [thumb] = files.thumb ?? []
  if (thumb && (thumb.size > MAX_THUMB_BYTES || !isJpeg(readHead(thumb.path)))) {
    throw new UploadError('The thumbnail must be a JPEG under 512 KB.', 'thumb')
  }

  const label = typeof body.label === 'string' ? body.label.trim() : ''
  if (label.length > MAX_LABEL_LENGTH) throw new UploadError(`Keep the label under ${MAX_LABEL_LENGTH} characters.`, 'label')

  const info = db.prepare(`
    INSERT INTO receipts (recordType, recordId, vehicleId, storedName, thumbName, filename, mimeType, size, label, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  `).run(
    recordType, recordId, vehicleId, file.filename, thumb?.filename ?? null,
    cleanFilename(file.originalname, file.receiptType), file.receiptType.mimeType, file.size, label || null
  )
  return db.prepare('SELECT * FROM receipts WHERE id = ?').get(info.lastInsertRowid)
}

const router = Router()

router.get('/', (req, res) => {
  const { vehicleId, recordType, recordId } = req.query
  if (vehicleId !== undefined) {
    const id = parseId(vehicleId)
    if (id == null) return res.status(400).json({ error: 'vehicleId must be a vehicle id.', field: 'vehicleId' })
    return res.json(db.prepare('SELECT * FROM receipts WHERE vehicleId = ? ORDER BY id').all(id).map(rowToReceipt))
  }
  if (recordType !== undefined || recordId !== undefined) {
    if (!RECORD_TYPES.includes(recordType)) return res.status(400).json({ error: 'recordType must be service, policy or vehicle.', field: 'recordType' })
    const id = parseId(recordId)
    if (id == null) return res.status(400).json({ error: 'recordId must be a record id.', field: 'recordId' })
    const rows = db.prepare('SELECT * FROM receipts WHERE recordType = ? AND recordId = ? ORDER BY id').all(recordType, id)
    return res.json(rows.map(rowToReceipt))
  }
  res.json(db.prepare('SELECT * FROM receipts ORDER BY id').all().map(rowToReceipt))
})

router.post('/', (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      const reply = uploadErrorReply(err)
      return reply ? res.status(reply.status).json(reply.body) : next(err)
    }
    const stored = Object.values(req.files ?? {}).flat()
    try {
      res.status(201).json(rowToReceipt(saveUpload(req.body, req.files ?? {})))
    } catch (error) {
      for (const file of stored) removeFile(file.path)
      if (error instanceof UploadError) return res.status(400).json({ error: error.message, field: error.field })
      next(error)
    }
  })
})

/**
 * @param {string} type `inline` or `attachment`.
 * @param {string} filename
 * @returns {string} A Content-Disposition header with a plain-ASCII `filename` and the exact name in `filename*`.
 */
function contentDisposition(type, filename) {
  const fallback = filename.replace(/[^\x20-\x7e]|["\\%]/g, '_')
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

/**
 * Streams one stored file, or answers 404 JSON when the row or the file is gone.
 * @param {import('express').Response} res
 * @param {string | null} name The stored name.
 * @param {string} mimeType
 * @param {Record<string, string>} [headers]
 */
function sendStored(res, name, mimeType, headers = {}) {
  const file = storedPath(name)
  if (!file || !fs.existsSync(file)) return res.status(404).json({ error: 'File missing' })
  res.sendFile(file, {
    // Ids can be reused after the newest receipt is deleted, so the browser checks the ETag every time.
    cacheControl: false,
    headers: { 'Content-Type': mimeType, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-cache', ...headers },
  }, (err) => {
    if (!err || res.headersSent) return
    res.status(err.code === 'ENOENT' ? 404 : 500).json({ error: err.code === 'ENOENT' ? 'File missing' : "Couldn't read that file." })
  })
}

const findReceipt = (id) => {
  const receiptId = parseId(id)
  return receiptId == null ? null : db.prepare('SELECT * FROM receipts WHERE id = ?').get(receiptId)
}

router.get('/:id/file', (req, res) => {
  const row = findReceipt(req.params.id)
  if (!row) return res.status(404).json({ error: 'Receipt not found' })
  const disposition = req.query.download === '1' ? 'attachment' : 'inline'
  sendStored(res, row.storedName, RECEIPT_MIME_TYPES.includes(row.mimeType) ? row.mimeType : 'application/octet-stream', {
    'Content-Disposition': contentDisposition(disposition, row.filename),
  })
})

router.get('/:id/thumb', (req, res) => {
  const row = findReceipt(req.params.id)
  if (!row) return res.status(404).json({ error: 'Receipt not found' })
  if (!row.thumbName) return res.status(404).json({ error: 'No thumbnail' })
  sendStored(res, row.thumbName, 'image/jpeg')
})

router.delete('/:id', (req, res) => {
  const row = findReceipt(req.params.id)
  if (!row) return res.status(404).json({ error: 'Receipt not found' })
  db.prepare('DELETE FROM receipts WHERE id = ?').run(row.id)
  removeReceiptFiles([row])
  res.status(204).end()
})

export default router
