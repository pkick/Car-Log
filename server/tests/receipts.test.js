import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Uploads go to a throwaway data folder. Set it before the app loads, since the receipts folder is fixed at import.
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'odometer-receipts-'))
process.env.DATA_DIR = DATA_DIR
const RECEIPTS_DIR = path.join(DATA_DIR, 'receipts')
const { request, baseUrl, createVehicle, addServiceRecord, addPolicyRecord } = await import('./helpers.js')

after(() => fs.rmSync(DATA_DIR, { recursive: true, force: true }))

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('IHDR and the rest of a photo')])
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('a small thumbnail')])
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n')
const HEIC = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), Buffer.from('mif1heic and pixels')])

/**
 * Posts a multipart upload to `/api/receipts`.
 * @param {Record<string, string | number>} fields Text fields.
 * @param {{ field?: string, name: string, type: string, bytes: Buffer }[]} files Files, sent after the fields.
 * @returns {Promise<{ status: number, body: any }>}
 */
async function upload(fields, files = []) {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) form.append(name, String(value))
  for (const { field = 'file', name, type, bytes } of files) form.append(field, new Blob([bytes], { type }), name)
  const res = await fetch(`${baseUrl}/api/receipts`, { method: 'POST', body: form })
  return { status: res.status, body: await res.json() }
}

const png = (name = 'receipt.png') => ({ name, type: 'image/png', bytes: PNG })
const thumb = () => ({ field: 'thumb', name: 'thumb.jpg', type: 'image/jpeg', bytes: JPEG })
const pdf = (name = 'policy.pdf') => ({ name, type: 'application/pdf', bytes: PDF })

const storedFiles = () => fs.readdirSync(RECEIPTS_DIR).sort()

async function serviceWithReceipt(files = [png(), thumb()]) {
  const vehicle = await createVehicle()
  const { body: created } = await addServiceRecord(vehicle.id, '2026-09-01', 10500)
  const { status, body: receipt } = await upload({ recordType: 'service', recordId: created.serviceRecord.id }, files)
  assert.equal(status, 201)
  return { vehicle, record: created.serviceRecord, receipt }
}

async function fetchFile(id, kind = 'file', query = '') {
  const res = await fetch(`${baseUrl}/api/receipts/${id}/${kind}${query}`)
  return { res, bytes: Buffer.from(await res.arrayBuffer()) }
}

test('a photo uploads with its thumbnail under random names, and both stream back', async () => {
  const before = storedFiles()
  const vehicle = await createVehicle()
  const { body: created } = await addServiceRecord(vehicle.id, '2026-09-01', 10500)
  const recordId = created.serviceRecord.id

  const { status, body } = await upload({ recordType: 'service', recordId, label: '  Shop invoice ' }, [png('Brake job.png'), thumb()])

  assert.equal(status, 201)
  assert.deepEqual({ ...body, id: undefined, createdAt: undefined }, {
    id: undefined, recordType: 'service', recordId, vehicleId: vehicle.id, filename: 'Brake job.png', mimeType: 'image/png',
    size: PNG.length, label: 'Shop invoice', createdAt: undefined, hasThumb: true, fileMissing: false,
  })
  assert.match(body.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  const added = storedFiles().filter((name) => !before.includes(name))
  assert.equal(added.length, 2)
  for (const name of added) assert.match(name, /^[0-9a-f]{32}\.(png|jpg)$/)

  const file = await fetchFile(body.id)
  assert.equal(file.res.status, 200)
  assert.equal(file.res.headers.get('content-type'), 'image/png')
  assert.equal(file.res.headers.get('content-disposition'), `inline; filename="Brake job.png"; filename*=UTF-8''Brake%20job.png`)
  assert.equal(file.res.headers.get('x-content-type-options'), 'nosniff')
  assert.deepEqual(file.bytes, PNG)

  const download = await fetchFile(body.id, 'file', '?download=1')
  assert.match(download.res.headers.get('content-disposition'), /^attachment; filename="Brake job.png"/)

  const thumbnail = await fetchFile(body.id, 'thumb')
  assert.equal(thumbnail.res.status, 200)
  assert.equal(thumbnail.res.headers.get('content-type'), 'image/jpeg')
  assert.equal(thumbnail.res.headers.get('x-content-type-options'), 'nosniff')
  assert.deepEqual(thumbnail.bytes, JPEG)

  assert.deepEqual((await request('GET', `/api/receipts?recordType=service&recordId=${recordId}`)).body, [body])
  assert.deepEqual((await request('GET', `/api/receipts?vehicleId=${vehicle.id}`)).body, [body])
  assert.equal((await request('GET', '/api/receipts?recordType=fuel&recordId=1')).status, 400)
})

test('a PDF on a payment and a HEIC vehicle document are accepted; neither has a thumbnail', async () => {
  const vehicle = await createVehicle()
  const { body: payment } = await addPolicyRecord(vehicle.id)

  const onPayment = await upload({ recordType: 'policy', recordId: payment.id }, [pdf('Versicherung für Öl.pdf')])
  const onVehicle = await upload({ recordType: 'vehicle', recordId: vehicle.id, label: 'Insurance card' }, [
    { name: 'card.HEIC', type: 'image/heic', bytes: HEIC },
  ])

  assert.equal(onPayment.status, 201)
  assert.equal(onPayment.body.mimeType, 'application/pdf')
  assert.equal(onPayment.body.hasThumb, false)
  assert.equal(onVehicle.status, 201)
  assert.deepEqual([onVehicle.body.recordType, onVehicle.body.recordId, onVehicle.body.vehicleId], ['vehicle', vehicle.id, vehicle.id])
  assert.equal(onVehicle.body.mimeType, 'image/heic')
  assert.equal(onVehicle.body.label, 'Insurance card')

  const file = await fetchFile(onPayment.body.id)
  assert.equal(file.res.headers.get('content-type'), 'application/pdf')
  assert.equal(
    file.res.headers.get('content-disposition'),
    `inline; filename="Versicherung f_r _l.pdf"; filename*=UTF-8''Versicherung%20f%C3%BCr%20%C3%96l.pdf`
  )
  assert.deepEqual(file.bytes, PDF)

  const missingThumb = await request('GET', `/api/receipts/${onPayment.body.id}/thumb`)
  assert.equal(missingThumb.status, 404)
  assert.equal(typeof missingThumb.body.error, 'string')

  const listed = (await request('GET', `/api/receipts?vehicleId=${vehicle.id}`)).body
  assert.deepEqual(listed.map((r) => r.recordType), ['policy', 'vehicle'])
})

test('files are refused by extension, MIME type and content, and nothing is left on disk', async () => {
  const vehicle = await createVehicle()
  const before = storedFiles()
  const cases = [
    [{ name: 'setup.exe', type: 'application/x-msdownload', bytes: Buffer.from('MZ\x90\x00') }, 'file'],
    [{ name: 'setup.png', type: 'image/png', bytes: Buffer.from('MZ\x90\x00 not a png') }, 'file'],
    [{ name: 'page.png', type: 'text/html', bytes: PNG }, 'file'],
    [{ name: 'logo.svg', type: 'image/svg+xml', bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') }, 'file'],
    [{ name: 'scan.pdf', type: 'application/pdf', bytes: PNG }, 'file'],
    [{ name: 'photo.heic', type: 'image/heic', bytes: JPEG }, 'file'],
    [{ name: 'no-extension', type: 'image/png', bytes: PNG }, 'file'],
  ]
  for (const [file, field] of cases) {
    const { status, body } = await upload({ recordType: 'vehicle', recordId: vehicle.id }, [file])
    assert.equal(status, 400, file.name)
    assert.equal(body.field, field, file.name)
    assert.equal(typeof body.error, 'string', file.name)
  }

  const badThumb = await upload({ recordType: 'vehicle', recordId: vehicle.id }, [png(), { ...thumb(), bytes: PNG }])
  assert.equal(badThumb.status, 400)
  assert.equal(badThumb.body.field, 'thumb')

  const noFile = await upload({ recordType: 'vehicle', recordId: vehicle.id })
  assert.deepEqual([noFile.status, noFile.body.field], [400, 'file'])

  assert.deepEqual(storedFiles(), before)
  assert.deepEqual((await request('GET', `/api/receipts?vehicleId=${vehicle.id}`)).body, [])
})

test('a file over 10 MB is refused with 413 and its partial upload is removed', async () => {
  const vehicle = await createVehicle()
  const before = storedFiles()
  const big = Buffer.alloc(10 * 1024 * 1024 + 1)
  PNG.copy(big)

  const { status, body } = await upload({ recordType: 'vehicle', recordId: vehicle.id }, [{ name: 'huge.png', type: 'image/png', bytes: big }])

  assert.equal(status, 413)
  assert.deepEqual(body, { error: 'That file is larger than 10 MB.', field: 'file' })
  assert.deepEqual(storedFiles(), before)

  const exact = Buffer.alloc(10 * 1024 * 1024)
  PNG.copy(exact)
  const atLimit = await upload({ recordType: 'vehicle', recordId: vehicle.id }, [{ name: 'exact.png', type: 'image/png', bytes: exact }])
  assert.equal(atLimit.status, 201)
  assert.equal(atLimit.body.size, exact.length)
})

test('an upload for a record that does not exist is refused and leaves no file', async () => {
  const vehicle = await createVehicle()
  const before = storedFiles()
  const cases = [
    [{ recordType: 'service', recordId: 999999 }, 'recordId', /Service record not found/],
    [{ recordType: 'policy', recordId: 999999 }, 'recordId', /Payment not found/],
    [{ recordType: 'vehicle', recordId: 999999 }, 'recordId', /Vehicle not found/],
    [{ recordType: 'vehicle', recordId: 'abc' }, 'recordId', /recordId/],
    [{ recordType: 'fill-up', recordId: vehicle.id }, 'recordType', /recordType/],
    [{ recordId: vehicle.id }, 'recordType', /recordType/],
  ]
  for (const [fields, field, message] of cases) {
    const { status, body } = await upload(fields, [png(), thumb()])
    assert.equal(status, 400, JSON.stringify(fields))
    assert.equal(body.field, field, JSON.stringify(fields))
    assert.match(body.error, message)
  }
  assert.deepEqual(storedFiles(), before)
})

test('DELETE /api/receipts/:id removes the row, the file and the thumbnail', async () => {
  const before = storedFiles()
  const { record, receipt } = await serviceWithReceipt()
  assert.equal(storedFiles().length, before.length + 2)

  const { status } = await request('DELETE', `/api/receipts/${receipt.id}`)

  assert.equal(status, 204)
  assert.deepEqual(storedFiles(), before)
  assert.deepEqual((await request('GET', `/api/receipts?recordType=service&recordId=${record.id}`)).body, [])
  assert.equal((await request('GET', `/api/receipts/${receipt.id}/file`)).status, 404)
  assert.equal((await request('DELETE', `/api/receipts/${receipt.id}`)).status, 404)
})

test('deleting a service record removes its receipts and their files, and nothing else', async () => {
  const before = storedFiles()
  const { vehicle, record } = await serviceWithReceipt()
  await upload({ recordType: 'service', recordId: record.id }, [pdf()])
  const { body: keep } = await upload({ recordType: 'vehicle', recordId: vehicle.id }, [pdf('registration.pdf')])
  assert.equal(storedFiles().length, before.length + 4)

  assert.equal((await request('DELETE', `/api/service-records/${record.id}`)).status, 200)

  assert.equal(storedFiles().length, before.length + 1)
  assert.deepEqual((await request('GET', `/api/receipts?vehicleId=${vehicle.id}`)).body, [keep])
})

test('deleting a payment removes its receipts and their files', async () => {
  const vehicle = await createVehicle()
  const { body: payment } = await addPolicyRecord(vehicle.id)
  const before = storedFiles()
  await upload({ recordType: 'policy', recordId: payment.id }, [pdf()])
  await upload({ recordType: 'policy', recordId: payment.id }, [png(), thumb()])
  assert.equal(storedFiles().length, before.length + 3)

  assert.equal((await request('DELETE', `/api/policy-records/${payment.id}`)).status, 204)

  assert.deepEqual(storedFiles(), before)
  assert.deepEqual((await request('GET', `/api/receipts?recordType=policy&recordId=${payment.id}`)).body, [])
})

test('a payment moved to another vehicle takes its receipts with it', async () => {
  const from = await createVehicle()
  const to = await createVehicle()
  const { body: payment } = await addPolicyRecord(from.id)
  const { body: receipt } = await upload({ recordType: 'policy', recordId: payment.id }, [pdf()])

  assert.equal((await request('PATCH', `/api/policy-records/${payment.id}`, { vehicleId: to.id })).status, 200)

  assert.deepEqual((await request('GET', `/api/receipts?vehicleId=${from.id}`)).body, [])
  assert.deepEqual((await request('GET', `/api/receipts?vehicleId=${to.id}`)).body, [{ ...receipt, vehicleId: to.id }])
})

test('deleting a vehicle removes every receipt on it and on its records', async () => {
  const other = await serviceWithReceipt()
  const before = storedFiles()
  const { vehicle, record } = await serviceWithReceipt()
  const { body: payment } = await addPolicyRecord(vehicle.id)
  await upload({ recordType: 'policy', recordId: payment.id }, [pdf()])
  await upload({ recordType: 'vehicle', recordId: vehicle.id, label: 'Registration' }, [pdf('registration.pdf')])
  assert.equal(storedFiles().length, before.length + 4)

  assert.equal((await request('DELETE', `/api/vehicles/${vehicle.id}`)).status, 204)

  assert.deepEqual(storedFiles(), before)
  assert.deepEqual((await request('GET', `/api/receipts?vehicleId=${vehicle.id}`)).body, [])
  assert.deepEqual((await request('GET', `/api/receipts?recordType=service&recordId=${record.id}`)).body, [])
  assert.deepEqual((await request('GET', `/api/receipts?vehicleId=${other.vehicle.id}`)).body, [other.receipt])
})

test('a receipt whose files are gone answers 404 JSON and lists as missing', async () => {
  const before = storedFiles()
  const { record, receipt } = await serviceWithReceipt()
  for (const name of storedFiles().filter((n) => !before.includes(n))) fs.unlinkSync(path.join(RECEIPTS_DIR, name))

  for (const kind of ['file', 'thumb']) {
    const { status, body } = await request('GET', `/api/receipts/${receipt.id}/${kind}`)
    assert.equal(status, 404, kind)
    assert.deepEqual(body, { error: 'File missing' }, kind)
  }
  const [listed] = (await request('GET', `/api/receipts?recordType=service&recordId=${record.id}`)).body
  assert.deepEqual([listed.fileMissing, listed.hasThumb], [true, false])

  assert.equal((await request('GET', '/api/receipts/999999/file')).status, 404)
  assert.equal((await request('GET', '/api/receipts/abc/file')).status, 404)
  assert.equal((await request('DELETE', `/api/receipts/${receipt.id}`)).status, 204, 'a row without files still deletes')
})

test('the JSON backup round trip keeps receipt rows, including one whose file is gone', async () => {
  const kept = await serviceWithReceipt()
  const { body: gone } = await upload({ recordType: 'vehicle', recordId: kept.vehicle.id, label: 'Title' }, [pdf('title.pdf')])
  const receiptsBefore = (await request('GET', '/api/receipts')).body
  const backup = await (await fetch(`${baseUrl}/api/export`)).json()

  const exported = backup.receipts.find((r) => r.id === kept.receipt.id)
  assert.deepEqual(Object.keys(exported).sort(), [
    'createdAt', 'filename', 'id', 'label', 'mimeType', 'recordId', 'recordType', 'size', 'storedName', 'thumbName', 'vehicleId',
  ])
  assert.equal(backup.receipts.length, receiptsBefore.length)

  await request('DELETE', `/api/receipts/${gone.id}`)
  const { status, body } = await request('POST', '/api/import', backup)

  assert.equal(status, 200)
  assert.equal(body.receipts, backup.receipts.length)
  const restored = (await request('GET', '/api/receipts')).body
  assert.deepEqual(restored, receiptsBefore.map((r) => (r.id === gone.id ? { ...r, fileMissing: true } : r)))
  assert.deepEqual((await fetchFile(kept.receipt.id)).bytes, PNG, 'files already on disk are served again')
  assert.equal((await request('GET', `/api/receipts/${gone.id}/file`)).status, 404)
})

test('a backup whose receipt rows are wrong is refused whole, and one from before receipts restores none', async () => {
  const { vehicle } = await serviceWithReceipt()
  const backup = await (await fetch(`${baseUrl}/api/export`)).json()
  const before = (await request('GET', '/api/receipts')).body
  const row = backup.receipts.find((r) => r.vehicleId === vehicle.id)

  const cases = [
    [{ ...row, storedName: '../odometer.db' }, /storedName isn't a name Odometer gives files/],
    [{ ...row, thumbName: '/etc/passwd' }, /thumbName isn't a name/],
    [{ ...row, recordId: 999999 }, /Its service record isn't in the backup/],
    [{ ...row, vehicleId: vehicle.id === 1 ? 2 : 1 }, /vehicleId doesn't match/],
    [{ ...row, mimeType: 'image/svg+xml' }, /mimeType must be one of/],
    [{ ...row, recordType: 'fuel' }, /recordType must be/],
  ]
  for (const [bad, message] of cases) {
    const file = { ...backup, receipts: backup.receipts.map((r) => (r.id === row.id ? bad : r)) }
    const { status, body } = await request('POST', '/api/import', file)
    assert.equal(status, 400, String(message))
    assert.match(body.error, new RegExp(`^Receipt #${row.id} in the backup: `))
    assert.match(body.error, message)
    assert.deepEqual((await request('GET', '/api/receipts')).body, before, String(message))
  }

  const { receipts, ...older } = backup
  const { status, body } = await request('POST', '/api/import', { ...older, schemaVersion: 2 })
  assert.equal(status, 200)
  assert.equal(body.receipts, 0)
  assert.deepEqual((await request('GET', '/api/receipts')).body, [])
})

test('Clear demo data removes the demo vehicles\' receipt files and keeps everyone else\'s', async () => {
  const kept = await serviceWithReceipt()
  const demo = (await request('GET', '/api/vehicles')).body.find((vehicle) => vehicle.isDemo)
  const before = storedFiles()
  await upload({ recordType: 'vehicle', recordId: demo.id, label: 'Insurance card' }, [png(), thumb()])
  assert.equal(storedFiles().length, before.length + 2)

  assert.equal((await request('DELETE', '/api/demo')).status, 200)

  assert.deepEqual(storedFiles(), before)
  assert.deepEqual((await request('GET', `/api/receipts?vehicleId=${kept.vehicle.id}`)).body, [kept.receipt])
})
