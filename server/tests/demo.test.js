import { test } from 'node:test'
import assert from 'node:assert/strict'

// These tests need a database that starts empty, like a fresh install.
process.env.SEED_DEMO = '0'
const { request, createVehicle, addFillUp, addServiceRecord, addPolicyRecord } = await import('./helpers.js')
const { SEED_VEHICLES, SEED_FILL_UPS, SEED_SERVICE_RECORDS, SEED_POLICY_RECORDS } = await import('../seed.js')

const LIST_PATHS = {
  vehicles: '/api/vehicles',
  fillUps: '/api/fill-ups',
  serviceRecords: '/api/service-records',
  policyRecords: '/api/policy-records',
}

const DEMO_COUNTS = {
  vehicles: SEED_VEHICLES.length,
  fillUps: SEED_FILL_UPS.length,
  serviceRecords: SEED_SERVICE_RECORDS.length,
  policyRecords: SEED_POLICY_RECORDS.length,
}

async function snapshot() {
  const entries = await Promise.all(Object.entries(LIST_PATHS).map(async ([key, path]) => [key, (await request('GET', path)).body]))
  return Object.fromEntries(entries)
}

async function deleteEveryVehicle() {
  for (const { id } of (await request('GET', '/api/vehicles')).body) await request('DELETE', `/api/vehicles/${id}`)
}

test('the database starts empty without SEED_DEMO', async () => {
  const lists = await snapshot()

  for (const [key, list] of Object.entries(lists)) assert.deepEqual(list, [], key)
})

test('POST /api/demo loads the demo vehicles and their records into an empty database', async () => {
  const { status, body } = await request('POST', '/api/demo')

  assert.equal(status, 201)
  assert.deepEqual(body.map((v) => v.nickname), SEED_VEHICLES.map((v) => v.nickname))
  assert.ok(body.every((v) => v.isDemo === true && v.tracksFuel === true && Array.isArray(v.intervals)))
  assert.deepEqual(body.map((v) => v.odometer), SEED_VEHICLES.map((v) => v.odometer))

  const lists = await snapshot()
  assert.deepEqual(lists.vehicles, body)
  for (const key of Object.keys(DEMO_COUNTS)) assert.equal(lists[key].length, DEMO_COUNTS[key], key)
  const ids = new Set(body.map((v) => v.id))
  for (const key of ['fillUps', 'serviceRecords', 'policyRecords']) {
    assert.ok(lists[key].every((record) => ids.has(record.vehicleId)), key)
  }
  const wagon = body.find((v) => v.nickname === 'The Wagon')
  assert.equal(lists.fillUps.filter((f) => f.vehicleId === wagon.id).length, SEED_FILL_UPS.filter((f) => f.vehicleId === 1).length)
})

test('POST /api/demo refuses with 409 when vehicles exist and changes nothing', async () => {
  const before = await snapshot()
  assert.ok(before.vehicles.length > 0, 'the demo data from the test above is still loaded')

  const again = await request('POST', '/api/demo')

  assert.equal(again.status, 409)
  assert.match(again.body.error, /only be loaded when there are no vehicles/)
  assert.deepEqual(await snapshot(), before)

  await deleteEveryVehicle()
  await createVehicle({ nickname: 'Real car' })
  const withReal = await request('POST', '/api/demo')

  assert.equal(withReal.status, 409)
  assert.deepEqual((await request('GET', '/api/vehicles')).body.map((v) => v.nickname), ['Real car'])
  await deleteEveryVehicle()
})

test('GET /api/vehicles has isDemo as a boolean, and clients cannot set it', async () => {
  const created = await createVehicle({ nickname: 'Claims to be demo', isDemo: true })
  assert.equal(created.isDemo, false)

  const patched = await request('PATCH', `/api/vehicles/${created.id}`, { isDemo: true })
  assert.equal(patched.status, 200)
  assert.equal(patched.body.isDemo, false)

  const { body: vehicles } = await request('GET', '/api/vehicles')
  assert.deepEqual(vehicles.map((v) => v.isDemo), [false])
  await deleteEveryVehicle()
})

test('DELETE /api/demo removes only the demo vehicles and their records, and returns counts', async () => {
  const real = await createVehicle({ nickname: 'Real car' })
  await addFillUp(real.id, '2026-08-28', 10500)
  await addServiceRecord(real.id, '2026-09-01', 10600)
  await addPolicyRecord(real.id)
  const realOnly = await snapshot()
  // A real vehicle blocks loading demo data through the API, so load it straight into the database.
  const { db } = await import('../db.js')
  const { seedDemoData } = await import('../seed.js')
  const demoIds = seedDemoData(db)
  const { body: demo } = await request('GET', '/api/vehicles')
  assert.deepEqual(demo.filter((v) => v.isDemo).map((v) => v.id), demoIds)
  // Something logged on a demo vehicle goes with it.
  assert.equal((await addFillUp(demoIds[0], '2026-09-20', 90000)).status, 201)

  const { status, body } = await request('DELETE', '/api/demo')

  assert.equal(status, 200)
  assert.deepEqual(body, { ...DEMO_COUNTS, fillUps: DEMO_COUNTS.fillUps + 1 })
  assert.deepEqual(await snapshot(), realOnly)
  await deleteEveryVehicle()
})

test('loading and clearing demo data leaves an empty database, and clearing again is a no-op', async () => {
  assert.equal((await request('POST', '/api/demo')).status, 201)

  const cleared = await request('DELETE', '/api/demo')

  assert.equal(cleared.status, 200)
  assert.deepEqual(cleared.body, DEMO_COUNTS)
  for (const [key, list] of Object.entries(await snapshot())) assert.deepEqual(list, [], key)

  const again = await request('DELETE', '/api/demo')
  assert.equal(again.status, 200)
  assert.deepEqual(again.body, { vehicles: 0, fillUps: 0, serviceRecords: 0, policyRecords: 0 })

  const reloaded = await request('POST', '/api/demo')
  assert.equal(reloaded.status, 201)
  assert.ok(Math.min(...reloaded.body.map((v) => v.id)) > 2, 'demo vehicles never reuse a deleted id')
})
