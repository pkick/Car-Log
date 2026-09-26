import { useCallback, useEffect, useReducer, useRef } from 'react'
import { canMakeThumbnail, queueEntry, receiptQueueReducer } from '../lib/receipts'
import { makeThumbnail, uploadReceipt } from './useReceipts'

let nextKey = 1

/**
 * @typedef {object} ReceiptQueue
 * @property {import('../lib/receipts').QueuedReceipt[]} items What the drop zone lists under itself.
 * @property {(files: File[], options?: { label?: string }) => void} add Queues files (a rejected one stays listed
 *   with its reason). Once the record has an id they upload straight away.
 * @property {(key: number) => void} remove Takes a file out, stopping its upload.
 * @property {(key: number) => void} retry Uploads a failed file again.
 * @property {(recordId: number) => Promise<number>} uploadAll For the save flow: uploads everything still queued or
 *   failed to the record, waits for uploads already running, and resolves to how many failed.
 */

/**
 * The files a form is about to attach to its record. A new record has no id until it's saved, so its files wait
 * here and `uploadAll` sends them from the save flow; an existing record's files upload as soon as they're added.
 *
 * @param {object} options
 * @param {'service' | 'policy' | 'vehicle'} options.recordType
 * @param {number | null} options.recordId `null` until the record exists.
 * @returns {ReceiptQueue}
 */
export function useReceiptQueue({ recordType, recordId }) {
  const [items, dispatch] = useReducer(receiptQueueReducer, [])
  // What the reducer's plain entries can't hold: the File, its thumbnail, and the running upload.
  const files = useRef(new Map())
  const recordIdRef = useRef(recordId)

  useEffect(() => {
    recordIdRef.current = recordId
  }, [recordId])

  useEffect(() => {
    const entries = files.current
    return () => {
      for (const entry of entries.values()) if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl)
      entries.clear()
    }
  }, [])

  const start = useCallback(
    (key, id) => {
      const entry = files.current.get(key)
      if (!entry) return Promise.resolve(true)
      if (entry.running) return entry.running
      dispatch({ type: 'start', key })
      entry.running = entry.thumb
        .then((thumb) => {
          if (!files.current.has(key)) return null
          const upload = uploadReceipt({
            recordType,
            recordId: id,
            file: entry.file,
            mimeType: entry.mimeType,
            thumb,
            label: entry.label,
            onProgress: (progress) => dispatch({ type: 'progress', key, progress }),
          })
          entry.abort = upload.abort
          return upload.promise
        })
        .then(
          () => {
            if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl)
            files.current.delete(key)
            dispatch({ type: 'done', key })
            return true
          },
          (err) => {
            entry.running = null
            entry.abort = null
            // Removed while it was uploading: nothing failed.
            if (!files.current.has(key)) return true
            dispatch({ type: 'fail', key, error: err.message })
            return false
          }
        )
      return entry.running
    },
    [recordType]
  )

  const add = useCallback(
    (picked, { label = null } = {}) => {
      const entries = picked.map((file) => queueEntry(nextKey++, file, label))
      dispatch({ type: 'add', items: entries })
      entries.forEach((item, i) => {
        if (item.status === 'rejected') return
        const file = picked[i]
        const entry = { file, mimeType: item.mimeType, label: item.label, previewUrl: null, running: null, abort: null }
        entry.thumb = canMakeThumbnail(item.mimeType)
          ? makeThumbnail(file).then((thumb) => {
              if (thumb && files.current.has(item.key)) {
                entry.previewUrl = URL.createObjectURL(thumb)
                dispatch({ type: 'preview', key: item.key, previewUrl: entry.previewUrl })
              }
              return thumb
            })
          : Promise.resolve(null)
        files.current.set(item.key, entry)
        if (recordIdRef.current != null) start(item.key, recordIdRef.current)
      })
    },
    [start]
  )

  const remove = useCallback((key) => {
    const entry = files.current.get(key)
    if (entry) {
      entry.abort?.()
      if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl)
      files.current.delete(key)
    }
    dispatch({ type: 'remove', key })
  }, [])

  const retry = useCallback((key) => {
    if (recordIdRef.current != null) start(key, recordIdRef.current)
  }, [start])

  // Every file still in `files` is queued, failed or uploading: done ones are dropped and rejected ones never join.
  const uploadAll = useCallback(
    async (id) => {
      recordIdRef.current = id
      const results = await Promise.all([...files.current.keys()].map((key) => start(key, id)))
      return results.filter((ok) => !ok).length
    },
    [start]
  )

  return { items, add, remove, retry, uploadAll }
}
