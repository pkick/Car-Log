import { test } from 'node:test'
import assert from 'node:assert/strict'
import { request, baseUrl, createVehicle, addFillUp, addServiceRecord, addPolicyRecord } from './helpers.js'

const LIST_PATHS = {
  vehicles: '/api/vehicles',
  fillUps: '/api/fill-ups',
  serviceRecords: '/api/service-records',
  policyRecords: '/api/policy-records',
}

/** Every GET list, keyed like the backup, so tests can compare the whole database before and after. */
async function snapshot() {
  const entries = await Promise.all(Object.entries(LIST_PATHS).map(async ([key, path]) => [key, (await request('GET', path)).body]))
  return Object.fromEntries(entries)
}

async function exportBackup() {
  const res = await fetch(`${baseUrl}/api/export`)
  return { res, backup: await res.json() }
}

const byId = (a, b) => a.id - b.id
const pad = (n) => String(n).padStart(2, '0')

test('GET /api/export sends every table as a dated attachment, in the shapes the GET routes return', async () => {
  const vehicle = await createVehicle({ nickname: 'Exported', tracksFuel: false })
  await addFillUp(vehicle.id, '2026-08-28', 10500)
  await addServiceRecord(vehicle.id, '2026-09-01', 10600)
  await addPolicyRecord(vehicle.id)

  const { res, backup } = await exportBackup()

  const now = new Date()
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type'), /^application\/json/)
  assert.equal(res.headers.get('content-disposition'), `attachment; filename="odometer-backup-${today}.json"`)
  assert.equal(backup.app, 'odometer')
  assert.equal(backup.schemaVersion, 1)
  assert.match(backup.exportedAt, new RegExp(`^${today}T\\d{2}:\\d{2}:\\d{2}[+-]\\d{2}:\\d{2}$`))

  const current = await snapshot()
  for (const key of Object.keys(LIST_PATHS)) {
    assert.deepEqual(backup[key], [...current[key]].sort(byId), key)
  }
  const exported = backup.vehicles.find((v) => v.id === vehicle.id)
  assert.equal(exported.tracksFuel, false)
  assert.ok(Array.isArray(exported.intervals))
  assert.ok(Array.isArray(backup.serviceRecords.find((r) => r.vehicleId === vehicle.id).services))
  assert.equal(backup.fillUps.find((f) => f.vehicleId === vehicle.id).isFull, true)
})

test('an export imported back reproduces every GET exactly', async () => {
  const vehicle = await createVehicle({ nickname: 'Round trip', color: 'teal' })
  await addFillUp(vehicle.id, '2026-07-01', 10200)
  await addFillUp(vehicle.id, '2026-08-01', 10700)
  await addServiceRecord(vehicle.id, '2026-08-15', 10900)
  await addPolicyRecord(vehicle.id, { type: 'registration', renewalDate: null, provider: null })
  const before = await snapshot()
  const { backup } = await exportBackup()

  const extra = await createVehicle({ nickname: 'Made after the backup' })
  await addFillUp(extra.id, '2026-09-01', 20000)
  await request('DELETE', `/api/vehicles/${vehicle.id}`)
  backup.vehicles.find((v) => v.id === vehicle.id).odometer = 1

  const { status, body } = await request('POST', '/api/import', backup)

  assert.equal(status, 200)
  assert.deepEqual(body, {
    vehicles: backup.vehicles.length,
    fillUps: backup.fillUps.length,
    serviceRecords: backup.serviceRecords.length,
    policyRecords: backup.policyRecords.length,
  })
  assert.deepEqual(await snapshot(), before)
  assert.equal(before.vehicles.find((v) => v.id === vehicle.id).odometer, 10900, 'the odometer is recomputed, not taken from the file')

  const { body: next } = await request('POST', '/api/vehicles', { nickname: 'After restore' })
  assert.equal(next.id, Math.max(...backup.vehicles.map((v) => v.id)) + 1)
})

test('import rejects files it cannot restore and changes nothing', async () => {
  await createVehicle({ nickname: 'Keep me' })
  const before = await snapshot()
  const { backup } = await exportBackup()

  const cases = [
    [{ ...backup, app: 'something-else' }, /isn't an Odometer backup/],
    [[backup], /isn't an Odometer backup/],
    [{ ...backup, schemaVersion: backup.schemaVersion + 1 }, /newer version of Odometer \(schema 2; this server is on 1\)/],
    [{ ...backup, schemaVersion: '1' }, /doesn't say which schema version/],
    [{ ...backup, policyRecords: undefined }, /no policyRecords list/],
  ]
  for (const [file, message] of cases) {
    const { status, body } = await request('POST', '/api/import', file)
    assert.equal(status, 400, String(message))
    assert.match(body.error, message)
  }
  assert.deepEqual(await snapshot(), before)
})

test('a backup with a bad record is rejected whole and changes nothing', async () => {
  const vehicle = await createVehicle({ nickname: 'Still here' })
  await addFillUp(vehicle.id, '2026-08-28', 10500)
  const before = await snapshot()
  const { backup } = await exportBackup()
  const lastFillUp = backup.fillUps.at(-1)

  const cases = [
    [{ ...backup, fillUps: [...backup.fillUps.slice(0, -1), { ...lastFillUp, gallons: -2 }] },
      new RegExp(`^Fill-up #${lastFillUp.id} in the backup: Gallons must be more than 0\\.$`)],
    [{ ...backup, fillUps: [...backup.fillUps, { ...lastFillUp, id: lastFillUp.id + 1000, vehicleId: 999999 }] },
      /Fill-up #\d+ in the backup: Vehicle not found\./],
    [{ ...backup, vehicles: [...backup.vehicles, { ...backup.vehicles[0] }] }, /two vehicles with id/],
    [{ ...backup, serviceRecords: [...backup.serviceRecords, { vehicleId: vehicle.id }] }, /Service record \d+ in the backup has no id/],
    [{ ...backup, policyRecords: [...backup.policyRecords, { ...backup.policyRecords[0], id: 5000, provider: { name: 'x' } }] },
      /Payment #5000 in the backup: provider must be text\./],
  ]
  for (const [file, message] of cases) {
    const { status, body } = await request('POST', '/api/import', file)
    assert.equal(status, 400, String(message))
    assert.match(body.error, message)
    assert.deepEqual(await snapshot(), before, String(message))
  }
})

test('import accepts a backup far larger than the usual 100 kB request limit', async () => {
  const { backup } = await exportBackup()
  backup.fillUps = Array.from({ length: 3000 }, (_, i) => ({
    id: i + 1, vehicleId: backup.vehicles[0].id, date: '2026-01-01', odometer: 100000 + i * 300,
    gallons: 10, pricePerGal: 3.5, total: 35, isFull: true,
  }))
  assert.ok(JSON.stringify(backup).length > 200_000)

  const { status, body } = await request('POST', '/api/import', backup)

  assert.equal(status, 200)
  assert.equal(body.fillUps, 3000)
  assert.equal((await request('GET', '/api/fill-ups')).body.length, 3000)
})

test('a request body that is not JSON gets a 400 with a message', async () => {
  const res = await fetch(`${baseUrl}/api/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"app":' })

  assert.equal(res.status, 400)
  assert.equal(typeof (await res.json()).error, 'string')
})
