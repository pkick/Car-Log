import { test } from 'node:test'
import assert from 'node:assert/strict'
import { request, createVehicle, addFillUp, addServiceRecord, addPolicyRecord, listedOdometer } from './helpers.js'

const RECORD_PATHS = ['/api/fill-ups', '/api/service-records', '/api/policy-records']

test('POST ignores a client-sent odometer', async () => {
  const { status, body } = await request('POST', '/api/vehicles', {
    nickname: 'Test car',
    purchaseOdometer: 12000,
    odometer: 99999,
  })

  assert.equal(status, 201)
  assert.equal(body.nickname, 'Test car')
  assert.equal(body.odometer, 12000)
  assert.equal(await listedOdometer(body.id), 12000)
})

test('POST without a purchase odometer starts at 0', async () => {
  const { body } = await request('POST', '/api/vehicles', { nickname: 'No reading', odometer: 5000 })

  assert.equal(body.purchaseOdometer, null)
  assert.equal(body.odometer, 0)
})

test('PATCH ignores a client-sent odometer', async () => {
  const vehicle = await createVehicle({ purchaseOdometer: 10000 })
  await addFillUp(vehicle.id, '2026-08-28', 10500)

  const { status, body } = await request('PATCH', `/api/vehicles/${vehicle.id}`, { nickname: 'Renamed', odometer: 1 })

  assert.equal(status, 200)
  assert.equal(body.nickname, 'Renamed')
  assert.equal(body.odometer, 10500)
  assert.equal(await listedOdometer(vehicle.id), 10500)
})

test('PATCHing purchaseOdometer above all readings raises the odometer', async () => {
  const vehicle = await createVehicle({ purchaseOdometer: 10000 })
  await addFillUp(vehicle.id, '2026-08-28', 10500)
  await addServiceRecord(vehicle.id, '2026-09-01', 10600)

  const { body: raised } = await request('PATCH', `/api/vehicles/${vehicle.id}`, { purchaseOdometer: 20000 })
  assert.equal(raised.purchaseOdometer, 20000)
  assert.equal(raised.odometer, 20000)
  assert.equal(await listedOdometer(vehicle.id), 20000)

  const { body: lowered } = await request('PATCH', `/api/vehicles/${vehicle.id}`, { purchaseOdometer: 9000 })
  assert.equal(lowered.odometer, 10600)
})

test('vehicle responses keep their shape', async () => {
  const vehicle = await createVehicle({ tracksFuel: false, intervals: [{ id: 1, name: 'Oil' }] })

  assert.equal(vehicle.tracksFuel, false)
  assert.equal(vehicle.tracksService, true)
  assert.deepEqual(vehicle.intervals, [{ id: 1, name: 'Oil' }])
  assert.equal(vehicle.color, 'slate')
})

test('deleting a vehicle removes its fill-ups, service records and policy records', async () => {
  const vehicle = await createVehicle()
  const other = await createVehicle()
  for (const { id } of [vehicle, other]) {
    assert.equal((await addFillUp(id, '2026-08-28', 10500)).status, 201)
    assert.equal((await addServiceRecord(id, '2026-09-01', 10600)).status, 201)
    assert.equal((await addPolicyRecord(id)).status, 201)
  }

  const deleted = await request('DELETE', `/api/vehicles/${vehicle.id}`)

  assert.equal(deleted.status, 204)
  const { body: vehicles } = await request('GET', '/api/vehicles')
  assert.equal(vehicles.some((v) => v.id === vehicle.id), false)
  for (const path of RECORD_PATHS) {
    const { body: all } = await request('GET', path)
    assert.equal(all.some((record) => record.vehicleId === vehicle.id), false, path)
    assert.equal(all.filter((record) => record.vehicleId === other.id).length, 1, path)
  }
})

test('DELETE of a missing vehicle returns 404', async () => {
  const { status, body } = await request('DELETE', '/api/vehicles/999999')

  assert.equal(status, 404)
  assert.equal(typeof body.error, 'string')
})

// Runs last in this file: it deletes the seeded vehicles and every vehicle the tests above created.
test('the last remaining vehicle can be deleted', async () => {
  const { body: vehicles } = await request('GET', '/api/vehicles')
  const ids = vehicles.map((v) => v.id)
  assert.ok(ids.includes(1) && ids.includes(2), 'the seeded vehicles are present')

  for (const id of ids.slice(0, -1)) {
    assert.equal((await request('DELETE', `/api/vehicles/${id}`)).status, 204)
  }
  assert.deepEqual((await request('GET', '/api/vehicles')).body.map((v) => v.id), ids.slice(-1))

  const last = await request('DELETE', `/api/vehicles/${ids.at(-1)}`)

  assert.equal(last.status, 204)
  assert.deepEqual((await request('GET', '/api/vehicles')).body, [])
  for (const path of RECORD_PATHS) {
    assert.deepEqual((await request('GET', path)).body, [], path)
  }
  const { status } = await request('POST', '/api/vehicles', { nickname: 'Fresh start' })
  assert.equal(status, 201)
})
