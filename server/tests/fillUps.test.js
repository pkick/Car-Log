import { test } from 'node:test'
import assert from 'node:assert/strict'
import { request, createVehicle, addFillUp, listedOdometer } from './helpers.js'

async function fillUpCount(vehicleId) {
  const { body } = await request('GET', `/api/fill-ups?vehicleId=${vehicleId}`)
  return body.length
}

test('adding a fill-up above the current odometer raises the vehicle odometer', async () => {
  const vehicle = await createVehicle({ purchaseOdometer: 10000 })

  const { status, body } = await addFillUp(vehicle.id, '2026-08-28', 10500)

  assert.equal(status, 201)
  assert.equal(body.fillUp.odometer, 10500)
  assert.equal(body.fillUp.vehicleId, vehicle.id)
  assert.equal(body.fillUp.isFull, true)
  assert.equal(body.fillUp.total, 35)
  assert.equal(body.vehicle.id, vehicle.id)
  assert.equal(body.vehicle.odometer, 10500)
  assert.equal(await listedOdometer(vehicle.id), 10500)
})

test('editing a fill-up odometer changes the vehicle odometer', async () => {
  const vehicle = await createVehicle({ purchaseOdometer: 10000 })
  const { body: added } = await addFillUp(vehicle.id, '2026-08-28', 10500)

  const { status, body } = await request('PATCH', `/api/fill-ups/${added.fillUp.id}`, { odometer: 10700 })

  assert.equal(status, 200)
  assert.equal(body.fillUp.id, added.fillUp.id)
  assert.equal(body.fillUp.odometer, 10700)
  assert.equal(body.vehicle.odometer, 10700)

  const { body: lowered } = await request('PATCH', `/api/fill-ups/${added.fillUp.id}`, { odometer: 10300 })
  assert.equal(lowered.vehicle.odometer, 10300)
  assert.equal(await listedOdometer(vehicle.id), 10300)
})

test('deleting the newest fill-up brings the odometer back down', async () => {
  const vehicle = await createVehicle({ purchaseOdometer: 10000 })
  const { body: first } = await addFillUp(vehicle.id, '2026-08-10', 10300)
  const { body: second } = await addFillUp(vehicle.id, '2026-08-28', 10600)
  assert.equal(second.vehicle.odometer, 10600)

  const deleted = await request('DELETE', `/api/fill-ups/${second.fillUp.id}`)
  assert.equal(deleted.status, 200)
  assert.deepEqual(Object.keys(deleted.body), ['vehicle'])
  assert.equal(deleted.body.vehicle.odometer, 10300)
  assert.equal(await listedOdometer(vehicle.id), 10300)

  const last = await request('DELETE', `/api/fill-ups/${first.fillUp.id}`)
  assert.equal(last.body.vehicle.odometer, 10000)
  assert.equal(await listedOdometer(vehicle.id), 10000)
})

test('rejects a reading lower than the earlier fill-up and inserts nothing', async () => {
  const vehicle = await createVehicle()
  await addFillUp(vehicle.id, '2026-08-28', 84210)

  const { status, body } = await addFillUp(vehicle.id, '2026-09-10', 84000)

  assert.equal(status, 422)
  assert.equal(body.field, 'odometer')
  assert.equal(body.error, 'Must be more than 84,210 mi, the reading on your Aug 28, 2026 fill-up.')
  assert.equal(await fillUpCount(vehicle.id), 1)
  assert.equal(await listedOdometer(vehicle.id), 84210)
})

test('rejects a reading equal to the earlier fill-up', async () => {
  const vehicle = await createVehicle()
  await addFillUp(vehicle.id, '2026-08-28', 84210)

  const { status, body } = await addFillUp(vehicle.id, '2026-09-10', 84210)

  assert.equal(status, 422)
  assert.equal(body.field, 'odometer')
  assert.equal(body.error, 'Must be more than 84,210 mi, the reading on your Aug 28, 2026 fill-up.')
  assert.equal(await fillUpCount(vehicle.id), 1)
})

test('rejects a backdated reading higher than the next later fill-up', async () => {
  const vehicle = await createVehicle()
  await addFillUp(vehicle.id, '2026-08-28', 84210)
  await addFillUp(vehicle.id, '2026-09-10', 84900)

  const { status, body } = await addFillUp(vehicle.id, '2026-09-01', 85000)

  assert.equal(status, 422)
  assert.equal(body.field, 'odometer')
  assert.equal(body.error, 'Must be less than 84,900 mi, the reading on your Sep 10, 2026 fill-up.')
  assert.equal(await fillUpCount(vehicle.id), 2)
  assert.equal(await listedOdometer(vehicle.id), 84900)
})

test('rejects a fill-up on the same date with the same reading', async () => {
  const vehicle = await createVehicle()
  await addFillUp(vehicle.id, '2026-08-28', 84210)

  const { status, body } = await addFillUp(vehicle.id, '2026-08-28', 84210)

  assert.equal(status, 422)
  assert.equal(body.field, 'odometer')
  assert.equal(body.error, 'Matches your Aug 28, 2026 fill-up at 84,210 mi.')
  assert.equal(await fillUpCount(vehicle.id), 1)
})

test('accepts a backdated fill-up between the two surrounding fill-ups', async () => {
  const vehicle = await createVehicle()
  await addFillUp(vehicle.id, '2026-08-28', 84210)
  await addFillUp(vehicle.id, '2026-09-10', 84900)

  const { status, body } = await addFillUp(vehicle.id, '2026-09-01', 84500)

  assert.equal(status, 201)
  assert.equal(body.fillUp.date, '2026-09-01')
  assert.equal(body.vehicle.odometer, 84900)
  assert.equal(await fillUpCount(vehicle.id), 3)
})

test('same-date neighbours compare against the higher earlier and lower later reading', async () => {
  const vehicle = await createVehicle()
  await addFillUp(vehicle.id, '2026-08-28', 84000)
  await addFillUp(vehicle.id, '2026-08-28', 84210)
  await addFillUp(vehicle.id, '2026-09-01', 84900)
  await addFillUp(vehicle.id, '2026-09-01', 85100)

  const tooLow = await addFillUp(vehicle.id, '2026-08-30', 84100)
  assert.equal(tooLow.status, 422)
  assert.equal(tooLow.body.error, 'Must be more than 84,210 mi, the reading on your Aug 28, 2026 fill-up.')

  const tooHigh = await addFillUp(vehicle.id, '2026-08-30', 85000)
  assert.equal(tooHigh.status, 422)
  assert.equal(tooHigh.body.error, 'Must be less than 84,900 mi, the reading on your Sep 1, 2026 fill-up.')

  const fits = await addFillUp(vehicle.id, '2026-08-30', 84500)
  assert.equal(fits.status, 201)
})

test('rejects a second fill-up on the same date with a lower reading', async () => {
  const vehicle = await createVehicle()
  await addFillUp(vehicle.id, '2026-09-25', 84700)

  const lower = await addFillUp(vehicle.id, '2026-09-25', 84600)
  assert.equal(lower.status, 422)
  assert.equal(lower.body.error, 'Must be more than 84,700 mi, the reading on your Sep 25, 2026 fill-up.')
})

test('the earlier of two same-date fill-ups can be edited within its place', async () => {
  const vehicle = await createVehicle()
  const first = await addFillUp(vehicle.id, '2026-08-28', 84000)
  await addFillUp(vehicle.id, '2026-08-28', 84210)

  const fits = await request('PATCH', `/api/fill-ups/${first.body.fillUp.id}`, { odometer: 84100 })
  assert.equal(fits.status, 200)

  const passesNext = await request('PATCH', `/api/fill-ups/${first.body.fillUp.id}`, { odometer: 84300 })
  assert.equal(passesNext.status, 422)
  assert.equal(passesNext.body.error, 'Must be less than 84,210 mi, the reading on your Aug 28, 2026 fill-up.')
})

test('only compares against fill-ups of the same vehicle', async () => {
  const vehicle = await createVehicle()
  const other = await createVehicle()
  await addFillUp(other.id, '2026-08-28', 90000)

  const { status } = await addFillUp(vehicle.id, '2026-09-10', 84000)

  assert.equal(status, 201)
})

test('PATCH of a fill-up to its own current odometer succeeds', async () => {
  const vehicle = await createVehicle()
  const { body: added } = await addFillUp(vehicle.id, '2026-08-28', 84210)

  const { status, body } = await request('PATCH', `/api/fill-ups/${added.fillUp.id}`, {
    odometer: 84210,
    gallons: 12,
  })

  assert.equal(status, 200)
  assert.equal(body.fillUp.odometer, 84210)
  assert.equal(body.fillUp.gallons, 12)
  assert.equal(body.fillUp.total, 42)
})

test('PATCH that breaks the order is rejected and changes nothing', async () => {
  const vehicle = await createVehicle()
  await addFillUp(vehicle.id, '2026-08-28', 84210)
  const { body: later } = await addFillUp(vehicle.id, '2026-09-10', 84900)

  const { status, body } = await request('PATCH', `/api/fill-ups/${later.fillUp.id}`, { odometer: 84100 })

  assert.equal(status, 422)
  assert.equal(body.field, 'odometer')
  assert.equal(body.error, 'Must be more than 84,210 mi, the reading on your Aug 28, 2026 fill-up.')
  const { body: fills } = await request('GET', `/api/fill-ups?vehicleId=${vehicle.id}`)
  assert.equal(fills.find((f) => f.id === later.fillUp.id).odometer, 84900)
  assert.equal(await listedOdometer(vehicle.id), 84900)
})

test('PATCH ignores vehicleId in the body', async () => {
  const vehicle = await createVehicle()
  const other = await createVehicle()
  const { body: added } = await addFillUp(vehicle.id, '2026-08-28', 84210)

  const { status, body } = await request('PATCH', `/api/fill-ups/${added.fillUp.id}`, { vehicleId: other.id })

  assert.equal(status, 200)
  assert.equal(body.fillUp.vehicleId, vehicle.id)
  assert.equal(body.vehicle.id, vehicle.id)
  assert.equal(await fillUpCount(other.id), 0)
})

test('PATCH and DELETE of a missing fill-up return 404', async () => {
  const patched = await request('PATCH', '/api/fill-ups/999999', { odometer: 1 })
  assert.equal(patched.status, 404)
  assert.equal(typeof patched.body.error, 'string')

  const deleted = await request('DELETE', '/api/fill-ups/999999')
  assert.equal(deleted.status, 404)
  assert.equal(typeof deleted.body.error, 'string')
})
