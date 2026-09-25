import { test } from 'node:test'
import assert from 'node:assert/strict'
import { request, createVehicle, addFillUp, addServiceRecord, listedOdometer } from './helpers.js'

test('adding a service record above the current odometer raises the vehicle odometer', async () => {
  const vehicle = await createVehicle({ purchaseOdometer: 10000 })

  const { status, body } = await addServiceRecord(vehicle.id, '2026-08-28', 10800)

  assert.equal(status, 201)
  assert.equal(body.serviceRecord.odometer, 10800)
  assert.equal(body.serviceRecord.vehicleId, vehicle.id)
  assert.deepEqual(body.serviceRecord.services, ['Oil + filter change'])
  assert.equal(body.vehicle.id, vehicle.id)
  assert.equal(body.vehicle.odometer, 10800)
  assert.equal(await listedOdometer(vehicle.id), 10800)
})

test('editing a service record odometer changes the vehicle odometer', async () => {
  const vehicle = await createVehicle({ purchaseOdometer: 10000 })
  await addFillUp(vehicle.id, '2026-08-10', 10400)
  const { body: added } = await addServiceRecord(vehicle.id, '2026-08-28', 10800)

  const { status, body } = await request('PATCH', `/api/service-records/${added.serviceRecord.id}`, { odometer: 11200 })

  assert.equal(status, 200)
  assert.equal(body.serviceRecord.id, added.serviceRecord.id)
  assert.equal(body.serviceRecord.odometer, 11200)
  assert.equal(body.vehicle.odometer, 11200)

  const { body: lowered } = await request('PATCH', `/api/service-records/${added.serviceRecord.id}`, { odometer: 10200 })
  assert.equal(lowered.vehicle.odometer, 10400)
  assert.equal(await listedOdometer(vehicle.id), 10400)
})

test('deleting the highest service record brings the odometer back down', async () => {
  const vehicle = await createVehicle({ purchaseOdometer: 10000 })
  const { body: fill } = await addFillUp(vehicle.id, '2026-08-10', 10400)
  const { body: added } = await addServiceRecord(vehicle.id, '2026-08-28', 10800)

  const deleted = await request('DELETE', `/api/service-records/${added.serviceRecord.id}`)
  assert.equal(deleted.status, 200)
  assert.deepEqual(Object.keys(deleted.body), ['vehicle'])
  assert.equal(deleted.body.vehicle.odometer, 10400)

  await request('DELETE', `/api/fill-ups/${fill.fillUp.id}`)
  assert.equal(await listedOdometer(vehicle.id), 10000)
})

test('service odometers are not validated against other records', async () => {
  const vehicle = await createVehicle({ purchaseOdometer: 10000 })
  await addFillUp(vehicle.id, '2026-08-28', 10800)

  const { status, body } = await addServiceRecord(vehicle.id, '2026-09-10', 10500)

  assert.equal(status, 201)
  assert.equal(body.vehicle.odometer, 10800)
})

test('PATCH ignores vehicleId in the body', async () => {
  const vehicle = await createVehicle()
  const other = await createVehicle()
  const { body: added } = await addServiceRecord(vehicle.id, '2026-08-28', 10800)

  const { status, body } = await request('PATCH', `/api/service-records/${added.serviceRecord.id}`, { vehicleId: other.id })

  assert.equal(status, 200)
  assert.equal(body.serviceRecord.vehicleId, vehicle.id)
  assert.equal(body.vehicle.id, vehicle.id)
  const { body: otherRecords } = await request('GET', `/api/service-records?vehicleId=${other.id}`)
  assert.equal(otherRecords.length, 0)
})

test('PATCH and DELETE of a missing service record return 404', async () => {
  const patched = await request('PATCH', '/api/service-records/999999', { odometer: 1 })
  assert.equal(patched.status, 404)
  assert.equal(typeof patched.body.error, 'string')

  const deleted = await request('DELETE', '/api/service-records/999999')
  assert.equal(deleted.status, 404)
  assert.equal(typeof deleted.body.error, 'string')
})
