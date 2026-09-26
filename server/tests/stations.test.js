import { test } from 'node:test'
import assert from 'node:assert/strict'
import { request, createVehicle } from './helpers.js'

const addFillUpAt = (vehicleId, date, odometer, station) =>
  request('POST', '/api/fill-ups', { vehicleId, date, odometer, gallons: 10, pricePerGal: 3.5, station })

test("lists a vehicle's stations once each, most recently used first", async () => {
  const vehicle = await createVehicle()
  const other = await createVehicle()
  await addFillUpAt(vehicle.id, '2026-06-01', 10100, 'Shell')
  await addFillUpAt(vehicle.id, '2026-06-10', 10400, 'Costco')
  await addFillUpAt(vehicle.id, '2026-06-20', 10700, 'shell')
  await addFillUpAt(vehicle.id, '2026-06-25', 11000, null)
  await addFillUpAt(vehicle.id, '2026-06-28', 11300, '   ')
  await addFillUpAt(other.id, '2026-07-01', 20000, 'Arco')

  const { status, body } = await request('GET', `/api/stations?vehicleId=${vehicle.id}`)

  assert.equal(status, 200)
  assert.deepEqual(body, ['shell', 'Costco'])
  assert.deepEqual((await request('GET', `/api/stations?vehicleId=${other.id}`)).body, ['Arco'])
})

test('suggests at most 10 stations', async () => {
  const vehicle = await createVehicle()
  for (let i = 0; i < 12; i++) await addFillUpAt(vehicle.id, `2026-05-${String(i + 1).padStart(2, '0')}`, 10100 + i * 300, `Station ${i}`)

  const { body } = await request('GET', `/api/stations?vehicleId=${vehicle.id}`)

  assert.deepEqual(body, Array.from({ length: 10 }, (_, i) => `Station ${11 - i}`))
})

test('needs an existing vehicle', async () => {
  assert.deepEqual(await request('GET', '/api/stations'), { status: 400, body: { error: 'Choose a vehicle.', field: 'vehicleId' } })
  assert.deepEqual(await request('GET', '/api/stations?vehicleId=999999'), { status: 400, body: { error: 'Vehicle not found.', field: 'vehicleId' } })
  assert.deepEqual(await request('GET', '/api/stations?vehicleId=abc'), { status: 400, body: { error: 'Vehicle not found.', field: 'vehicleId' } })
})
