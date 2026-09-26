import { useEffect, useSyncExternalStore } from 'react'
import { fitWithin } from '../lib/receipts'

const UNREACHABLE = "Can't reach the server. Check that it's running and try again."
// A proxy in front of the API (Vite in dev, or one on the NAS) answers these when the API is down.
const GATEWAY_STATUSES = [502, 503, 504]

/** @param {number} id @returns {string} The receipt's file, shown inline. */
export const receiptFileUrl = (id) => `/api/receipts/${id}/file`
/** @param {number} id @returns {string} The receipt's file, sent as a download. */
export const receiptDownloadUrl = (id) => `/api/receipts/${id}/file?download=1`
/** @param {number} id @returns {string} The receipt's thumbnail. */
export const receiptThumbUrl = (id) => `/api/receipts/${id}/thumb`

/**
 * @param {number} status
 * @param {{ error?: string }} body The response's JSON, or `{}`.
 * @returns {Error & { field?: string, status: number }}
 */
function responseError(status, body) {
  const fallback = status === 413 ? 'That file is larger than the server accepts.' : `Request failed: ${status}`
  const message = body.error || (GATEWAY_STATUSES.includes(status) ? UNREACHABLE : fallback)
  return Object.assign(new Error(message), { field: body.field, status })
}

async function request(path, options) {
  let res
  try {
    res = await fetch(path, options)
  } catch (err) {
    throw new Error(UNREACHABLE, { cause: err })
  }
  if (!res.ok) throw responseError(res.status, await res.json().catch(() => ({})))
  return res.status === 204 ? null : res.json()
}

// Receipts by vehicle id, loaded once per page load and then kept up to date by the uploads and deletes below. The
// map is replaced on every change so useSyncExternalStore sees a new snapshot.
let byVehicle = new Map()
const listeners = new Set()
const LOADING = { status: 'loading', receipts: [], error: null }

function setEntry(vehicleId, entry) {
  byVehicle = new Map(byVehicle).set(vehicleId, entry)
  for (const listener of listeners) listener()
}

function updateReceipts(vehicleId, update) {
  const entry = byVehicle.get(vehicleId)
  if (entry?.status === 'ready') setEntry(vehicleId, { ...entry, receipts: update(entry.receipts) })
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function loadVehicleReceipts(vehicleId) {
  const entry = byVehicle.get(vehicleId)
  if (entry && entry.status !== 'failed') return
  setEntry(vehicleId, LOADING)
  request(`/api/receipts?vehicleId=${vehicleId}`).then(
    (receipts) => setEntry(vehicleId, { status: 'ready', receipts, error: null }),
    (err) => setEntry(vehicleId, { status: 'failed', receipts: [], error: err.message })
  )
}

/**
 * Every receipt of one vehicle (on its services, its payments and the vehicle itself), shared by every component
 * that asks. A failed load is tried again by the next component that mounts.
 * @param {number} vehicleId
 * @returns {{ status: 'loading' | 'ready' | 'failed', receipts: object[], error: string | null }}
 */
export function useVehicleReceipts(vehicleId) {
  const entry = useSyncExternalStore(subscribe, () => byVehicle.get(vehicleId) ?? LOADING)
  useEffect(() => {
    if (vehicleId != null) loadVehicleReceipts(vehicleId)
  }, [vehicleId])
  return entry
}

/**
 * Uploads one file with `POST /api/receipts`, reporting progress. The new receipt joins its vehicle's list.
 * @param {object} upload
 * @param {'service' | 'policy' | 'vehicle'} upload.recordType
 * @param {number} upload.recordId For a vehicle document, the vehicle's id.
 * @param {File} upload.file
 * @param {string} upload.mimeType From `checkReceiptFile`; sent in case the browser didn't know the type.
 * @param {Blob | null} [upload.thumb] A JPEG from `makeThumbnail`.
 * @param {string | null} [upload.label]
 * @param {(fraction: number) => void} [upload.onProgress]
 * @returns {{ promise: Promise<object>, abort: () => void }} The promise resolves to the receipt, and rejects with the
 *   server's message or once `abort` stops the upload.
 */
export function uploadReceipt({ recordType, recordId, file, mimeType, thumb, label, onProgress }) {
  const xhr = new XMLHttpRequest()
  const promise = new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('recordType', recordType)
    form.append('recordId', String(recordId))
    if (label) form.append('label', label)
    form.append('file', file.type === mimeType ? file : new Blob([file], { type: mimeType }), file.name)
    if (thumb) form.append('thumb', thumb, 'thumb.jpg')

    xhr.open('POST', '/api/receipts')
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total)
    }
    xhr.onload = () => {
      let body = {}
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        // A proxy's HTML error page.
      }
      if (xhr.status === 201) {
        updateReceipts(body.vehicleId, (receipts) => [...receipts, body])
        resolve(body)
      } else {
        reject(responseError(xhr.status, body))
      }
    }
    xhr.onerror = () => reject(new Error(UNREACHABLE))
    xhr.onabort = () => reject(new Error('Upload cancelled.'))
    xhr.send(form)
  })
  return { promise, abort: () => xhr.abort() }
}

/**
 * Deletes a receipt and its files. One that's already gone counts as deleted.
 * @param {{ id: number, vehicleId: number }} receipt
 * @returns {Promise<void>}
 * @throws {Error} With the server's message.
 */
export async function deleteReceipt(receipt) {
  try {
    await request(`/api/receipts/${receipt.id}`, { method: 'DELETE' })
  } catch (err) {
    if (err.status !== 404) throw err
  }
  updateReceipts(receipt.vehicleId, (receipts) => receipts.filter((r) => r.id !== receipt.id))
}

/**
 * Draws an image on a canvas, at most 320px on its longest side, and encodes it as a JPEG (D17). Transparent
 * areas become white.
 * @param {Blob} file A JPEG, PNG or WebP.
 * @returns {Promise<Blob | null>} The thumbnail, or `null` when the browser can't decode the image.
 */
export async function makeThumbnail(file) {
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return null
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.fillStyle = 'white'
  context.fillRect(0, 0, width, height)
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
}

/**
 * Starts a download of a receipt's file under its own name.
 * @param {{ id: number, filename: string }} receipt
 * @returns {void}
 */
export function downloadReceipt(receipt) {
  const link = document.createElement('a')
  link.href = receiptDownloadUrl(receipt.id)
  link.download = receipt.filename
  document.body.append(link)
  link.click()
  link.remove()
}
