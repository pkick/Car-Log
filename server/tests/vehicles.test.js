import { test } from 'node:test'
import assert from 'node:assert/strict'
import { request, createVehicle, addFillUp, addServiceRecord, listedOdometer } from './helpers.js'

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
