import { test } from 'node:test'
import assert from 'node:assert/strict'
import { request, createVehicle } from './helpers.js'

const assertIntervalShape = (interval) => {
  assert.equal(typeof interval.id, 'number')
  assert.equal(typeof interval.name, 'string')
  assert.equal(typeof interval.categoryId, 'string')
  assert.ok(Array.isArray(interval.services), `${interval.name} has a services array`)
  assert.ok(interval.services.length > 0, `${interval.name} lists at least one service`)
  for (const service of interval.services) assert.equal(typeof service, 'string')
  for (const key of ['miles', 'months']) assert.ok(interval[key] === null || typeof interval[key] === 'number')
  assert.equal(typeof interval.warnMiles, 'number')
  assert.equal(typeof interval.warnDays, 'number')
}

test('GET /api/defaults/intervals returns the default intervals with the services that reset them', async () => {
  const { status, body } = await request('GET', '/api/defaults/intervals')

  assert.equal(status, 200)
  body.forEach(assertIntervalShape)
  assert.deepEqual(
    body.map(({ name, categoryId, services }) => ({ name, categoryId, services })),
    [
      { name: 'Oil + filter', categoryId: 'oil', services: ['Oil + filter change'] },
      { name: 'Tire rotation', categoryId: 'tires', services: ['Tire rotation'] },
      { name: 'Brake fluid', categoryId: 'brakes', services: ['Brake fluid'] },
      { name: 'Cabin air filter', categoryId: 'filters', services: ['Cabin air filter'] },
    ]
  )
  assert.equal(new Set(body.map((i) => i.id)).size, body.length)
})

test('POST /api/vehicles without intervals gets the defaults', async () => {
  const { body: defaults } = await request('GET', '/api/defaults/intervals')
  const vehicle = await createVehicle()

  assert.deepEqual(vehicle.intervals, defaults)
  vehicle.intervals.forEach(assertIntervalShape)
})

test('POST /api/vehicles with an empty intervals list gets the defaults', async () => {
  const { body: defaults } = await request('GET', '/api/defaults/intervals')
  const vehicle = await createVehicle({ intervals: [] })

  assert.deepEqual(vehicle.intervals, defaults)
})

test('POST /api/vehicles keeps intervals it is given', async () => {
  const intervals = [{ id: 7, categoryId: 'wipers', name: 'Wipers', services: ['Front wiper blades'], miles: null, months: 12, warnMiles: 0, warnDays: 14 }]
  const vehicle = await createVehicle({ intervals })

  assert.deepEqual(vehicle.intervals, intervals)
})

test('a vehicle can clear its intervals', async () => {
  const vehicle = await createVehicle()
  const { status, body } = await request('PATCH', `/api/vehicles/${vehicle.id}`, { intervals: [] })

  assert.equal(status, 200)
  assert.deepEqual(body.intervals, [])
})

test('seeded vehicles have intervals with services', async () => {
  const { body: vehicles } = await request('GET', '/api/vehicles')
  const seeded = vehicles.filter((v) => ['The Wagon', 'The Truck'].includes(v.nickname))

  assert.equal(seeded.length, 2)
  for (const vehicle of seeded) vehicle.intervals.forEach(assertIntervalShape)
})
