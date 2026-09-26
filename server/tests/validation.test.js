import { test } from 'node:test'
import assert from 'node:assert/strict'
import { request, createVehicle, addFillUp, addServiceRecord, addPolicyRecord } from './helpers.js'
import { isValidDate } from '../validate.js'

const vehicle = await createVehicle()

const VALID = {
  '/api/vehicles': {
    nickname: 'Test car', year: 2019, purchaseDate: '2021-04-02', purchaseOdometer: 41880, registrationRenewal: '2027-03-31',
    insuranceRenewal: '2026-11-14', tankSize: 15.9, tracksFuel: true, tracksService: true, intervals: [],
  },
  '/api/fill-ups': { vehicleId: vehicle.id, date: '2026-08-28', odometer: 10500, gallons: 10, pricePerGal: 3.5, isFull: true },
  '/api/service-records': {
    vehicleId: vehicle.id, date: '2026-09-01', odometer: 10600, categoryId: 'oil', services: ['Oil + filter change'], cost: 60,
  },
  '/api/policy-records': { vehicleId: vehicle.id, type: 'insurance', date: '2026-05-14', cost: 612, renewalDate: '2026-11-14' },
}

// [path, what's wrong, changes to the valid body (`undefined` drops the key), expected field, expected error]
const REJECTED_POSTS = [
  ['/api/vehicles', 'a missing nickname', { nickname: undefined }, 'nickname', 'Enter a nickname.'],
  ['/api/vehicles', 'a blank nickname', { nickname: '   ' }, 'nickname', 'Enter a nickname.'],
  ['/api/vehicles', 'a year out of range', { year: 1850 }, 'year', 'Year must be between 1900 and 2100.'],
  ['/api/vehicles', 'a fractional year', { year: 2019.5 }, 'year', 'Year must be a whole number.'],
  ['/api/vehicles', 'a year sent as a string', { year: '2019' }, 'year', 'Year must be a number.'],
  ['/api/vehicles', 'an impossible purchase date', { purchaseDate: '2026-02-30' }, 'purchaseDate', "2026-02-30 isn't a real date."],
  ['/api/vehicles', 'a negative purchase odometer', { purchaseOdometer: -1 }, 'purchaseOdometer', "Purchase odometer can't be negative."],
  ['/api/vehicles', 'a fractional purchase odometer', { purchaseOdometer: 41880.5 }, 'purchaseOdometer', 'Purchase odometer must be a whole number.'],
  ['/api/vehicles', 'a malformed registration renewal', { registrationRenewal: '09/25/2026' }, 'registrationRenewal', 'Enter the registration renewal date as YYYY-MM-DD.'],
  ['/api/vehicles', 'an impossible insurance renewal', { insuranceRenewal: '2026-13-01' }, 'insuranceRenewal', "2026-13-01 isn't a real date."],
  ['/api/vehicles', 'a zero tank size', { tankSize: 0 }, 'tankSize', 'Tank size must be more than 0.'],
  ['/api/vehicles', 'a tank size sent as a string', { tankSize: '15.9' }, 'tankSize', 'Tank size must be a number.'],
  ['/api/vehicles', 'a non-boolean tracksFuel', { tracksFuel: 'yes' }, 'tracksFuel', 'Fuel tracking must be true or false.'],
  ['/api/vehicles', 'a non-boolean tracksService', { tracksService: 1 }, 'tracksService', 'Service tracking must be true or false.'],
  ['/api/vehicles', 'intervals that are not a list', { intervals: { id: 1 } }, 'intervals', 'Intervals must be a list.'],

  ['/api/fill-ups', 'a missing vehicleId', { vehicleId: undefined }, 'vehicleId', 'Choose a vehicle.'],
  ['/api/fill-ups', 'an unknown vehicleId', { vehicleId: 999999 }, 'vehicleId', 'Vehicle not found.'],
  ['/api/fill-ups', 'a missing date', { date: undefined }, 'date', 'Enter a date.'],
  ['/api/fill-ups', 'an empty date', { date: '' }, 'date', 'Enter a date.'],
  ['/api/fill-ups', 'an impossible date', { date: '2026-02-30' }, 'date', "2026-02-30 isn't a real date."],
  ['/api/fill-ups', 'a malformed date', { date: '09/25/2026' }, 'date', 'Enter a date as YYYY-MM-DD.'],
  ['/api/fill-ups', 'a missing odometer', { odometer: undefined }, 'odometer', 'Enter the odometer reading.'],
  ['/api/fill-ups', 'a zero odometer', { odometer: 0 }, 'odometer', 'Odometer must be more than 0.'],
  ['/api/fill-ups', 'a fractional odometer', { odometer: 10500.5 }, 'odometer', 'Odometer must be a whole number.'],
  ['/api/fill-ups', 'an odometer sent as a string', { odometer: '10500' }, 'odometer', 'Odometer must be a number.'],
  ['/api/fill-ups', 'missing gallons', { gallons: undefined }, 'gallons', 'Enter the gallons.'],
  ['/api/fill-ups', 'zero gallons', { gallons: 0 }, 'gallons', 'Gallons must be more than 0.'],
  ['/api/fill-ups', 'gallons sent as a string', { gallons: '12' }, 'gallons', 'Gallons must be a number.'],
  ['/api/fill-ups', 'a missing price', { pricePerGal: undefined }, 'pricePerGal', 'Enter the price per gallon.'],
  ['/api/fill-ups', 'a negative price', { pricePerGal: -3.5 }, 'pricePerGal', 'Price per gallon must be more than 0.'],
  ['/api/fill-ups', 'a non-boolean isFull', { isFull: 'yes' }, 'isFull', 'Full tank must be true or false.'],
  ['/api/fill-ups', 'two bad fields, naming only the first', { date: undefined, gallons: 0 }, 'date', 'Enter a date.'],
  ['/api/fill-ups', 'a station that is not text', { station: 42 }, 'station', 'Station must be text.'],
  ['/api/fill-ups', 'a station over 80 characters', { station: 'x'.repeat(81) }, 'station', 'Station must be 80 characters or fewer.'],
  ['/api/fill-ups', 'notes over 1,000 characters', { notes: 'x'.repeat(1001) }, 'notes', 'Notes must be 1,000 characters or fewer.'],

  ['/api/service-records', 'a missing vehicleId', { vehicleId: undefined }, 'vehicleId', 'Choose a vehicle.'],
  ['/api/service-records', 'an unknown vehicleId', { vehicleId: 999999 }, 'vehicleId', 'Vehicle not found.'],
  ['/api/service-records', 'a missing date', { date: undefined }, 'date', 'Enter a date.'],
  ['/api/service-records', 'an impossible date', { date: '2026-02-30' }, 'date', "2026-02-30 isn't a real date."],
  ['/api/service-records', 'a malformed date', { date: '09/25/2026' }, 'date', 'Enter a date as YYYY-MM-DD.'],
  ['/api/service-records', 'a missing odometer', { odometer: undefined }, 'odometer', 'Enter the odometer reading.'],
  ['/api/service-records', 'a negative odometer', { odometer: -5 }, 'odometer', 'Odometer must be more than 0.'],
  ['/api/service-records', 'a fractional odometer', { odometer: 10600.5 }, 'odometer', 'Odometer must be a whole number.'],
  ['/api/service-records', 'a missing category', { categoryId: undefined }, 'categoryId', 'Choose a category.'],
  ['/api/service-records', 'missing services', { services: undefined }, 'services', 'Choose at least one service.'],
  ['/api/service-records', 'an empty services list', { services: [] }, 'services', 'Choose at least one service.'],
  ['/api/service-records', 'services sent as a string', { services: 'Oil + filter change' }, 'services', 'Choose at least one service.'],
  ['/api/service-records', 'a service that is not a name', { services: ['Oil + filter change', 42] }, 'services', 'Each service must be a name.'],
  ['/api/service-records', 'a negative cost', { cost: -60 }, 'cost', "Cost can't be negative."],
  ['/api/service-records', 'a cost sent as a string', { cost: '60' }, 'cost', 'Cost must be a number.'],

  ['/api/policy-records', 'a missing vehicleId', { vehicleId: undefined }, 'vehicleId', 'Choose a vehicle.'],
  ['/api/policy-records', 'an unknown vehicleId', { vehicleId: 999999 }, 'vehicleId', 'Vehicle not found.'],
  ['/api/policy-records', 'a missing type', { type: undefined }, 'type', 'Choose insurance or registration.'],
  ['/api/policy-records', 'an unknown type', { type: 'warranty' }, 'type', 'Choose insurance or registration.'],
  ['/api/policy-records', 'a missing date', { date: undefined }, 'date', 'Enter a date.'],
  ['/api/policy-records', 'an impossible date', { date: '2026-02-30' }, 'date', "2026-02-30 isn't a real date."],
  ['/api/policy-records', 'a malformed date', { date: '09/25/2026' }, 'date', 'Enter a date as YYYY-MM-DD.'],
  ['/api/policy-records', 'a negative cost', { cost: -612 }, 'cost', "Cost can't be negative."],
  ['/api/policy-records', 'a cost sent as a string', { cost: '612' }, 'cost', 'Cost must be a number.'],
  ['/api/policy-records', 'an impossible renewal date', { renewalDate: '2027-02-29' }, 'renewalDate', "2027-02-29 isn't a real date."],
  ['/api/policy-records', 'a malformed renewal date', { renewalDate: '11/14/2026' }, 'renewalDate', 'Enter the renewal date as YYYY-MM-DD.'],
]

for (const [path, description, changes, field, error] of REJECTED_POSTS) {
  test(`POST ${path} rejects ${description}`, async () => {
    const { body: before } = await request('GET', path)

    const { status, body } = await request('POST', path, { ...VALID[path], ...changes })

    assert.equal(status, 400)
    assert.deepEqual(body, { error, field })
    const { body: after } = await request('GET', path)
    assert.equal(after.length, before.length)
  })
}

test('the valid payloads used above are accepted', async () => {
  for (const [path, body] of Object.entries(VALID)) {
    const { status } = await request('POST', path, body)
    assert.equal(status, 201, path)
  }
})

test('optional fields may be left out, null or empty', async () => {
  const created = await request('POST', '/api/vehicles', {
    nickname: 'Bare', year: null, purchaseDate: '', purchaseOdometer: null, registrationRenewal: null, insuranceRenewal: '',
    tankSize: null, tracksFuel: null, intervals: null,
  })
  assert.equal(created.status, 201)
  const id = created.body.id

  const fill = await request('POST', '/api/fill-ups', { vehicleId: id, date: '2026-08-28', odometer: 100, gallons: 10, pricePerGal: 3.5 })
  assert.equal(fill.status, 201)
  assert.equal(fill.body.fillUp.isFull, true)

  const service = await request('POST', '/api/service-records', {
    vehicleId: id, date: '2026-09-01', odometer: 200, categoryId: 'oil', services: ['Oil + filter change'],
  })
  assert.equal(service.status, 201)
  assert.equal(service.body.serviceRecord.cost, 0)

  const noRenewal = await request('POST', '/api/policy-records', { vehicleId: id, type: 'registration', date: '2026-03-15', renewalDate: null })
  assert.equal(noRenewal.status, 201)
  assert.equal(noRenewal.body.cost, 0)
  const emptyRenewal = await request('POST', '/api/policy-records', { vehicleId: id, type: 'insurance', date: '2026-03-15', renewalDate: '' })
  assert.equal(emptyRenewal.status, 201)
})

test('fill-up validation runs before the odometer order check', async () => {
  const car = await createVehicle()
  await addFillUp(car.id, '2026-08-28', 84210)

  const { status, body } = await request('POST', '/api/fill-ups', {
    vehicleId: car.id, date: '2026-09-10', odometer: 84000, gallons: 0, pricePerGal: 3.5,
  })

  assert.equal(status, 400)
  assert.deepEqual(body, { error: 'Gallons must be more than 0.', field: 'gallons' })
})

async function findListed(path, id) {
  const { body } = await request('GET', path)
  return body.find((record) => record.id === id)
}

/**
 * PATCHes each change in turn, expects a 400 naming `field`, and checks the stored record didn't change.
 * @param {string} path The collection path, e.g. `/api/fill-ups`.
 * @param {number} id The record to PATCH.
 * @param {Array<[object, string, string]>} cases `[changes, field, error]` for each rejected PATCH.
 */
async function assertPatchesRejected(path, id, cases) {
  const before = await findListed(path, id)
  for (const [changes, field, error] of cases) {
    const { status, body } = await request('PATCH', `${path}/${id}`, changes)
    assert.equal(status, 400, JSON.stringify(changes))
    assert.deepEqual(body, { error, field })
  }
  assert.deepEqual(await findListed(path, id), before)
}

test('PATCH /api/vehicles changes one field and keeps the rest', async () => {
  const car = await createVehicle({ year: 2019, plate: 'OLD123', tankSize: 15.9, purchaseDate: '2021-04-02' })

  const { status, body } = await request('PATCH', `/api/vehicles/${car.id}`, { plate: 'NEW456' })

  assert.equal(status, 200)
  assert.deepEqual(body, { ...car, plate: 'NEW456' })
})

test('PATCH /api/vehicles rejects a change that makes the vehicle invalid', async () => {
  const car = await createVehicle({ year: 2019 })

  await assertPatchesRejected('/api/vehicles', car.id, [
    [{ nickname: '' }, 'nickname', 'Enter a nickname.'],
    [{ year: 2019.5 }, 'year', 'Year must be a whole number.'],
    [{ purchaseDate: '2026-02-30' }, 'purchaseDate', "2026-02-30 isn't a real date."],
    [{ purchaseOdometer: '10000' }, 'purchaseOdometer', 'Purchase odometer must be a number.'],
    [{ intervals: 'none' }, 'intervals', 'Intervals must be a list.'],
  ])
})

test('PATCH /api/fill-ups changes one field and keeps the rest', async () => {
  const car = await createVehicle()
  const { body: added } = await addFillUp(car.id, '2026-08-28', 10500)

  const { status, body } = await request('PATCH', `/api/fill-ups/${added.fillUp.id}`, { pricePerGal: 4 })

  assert.equal(status, 200)
  assert.deepEqual(body.fillUp, { ...added.fillUp, pricePerGal: 4, total: 40 })
})

test('PATCH /api/fill-ups rejects a change that makes the fill-up invalid', async () => {
  const car = await createVehicle()
  const { body: added } = await addFillUp(car.id, '2026-08-28', 10500)

  await assertPatchesRejected('/api/fill-ups', added.fillUp.id, [
    [{ gallons: 0 }, 'gallons', 'Gallons must be more than 0.'],
    [{ date: '2026-02-30' }, 'date', "2026-02-30 isn't a real date."],
    [{ date: '09/25/2026' }, 'date', 'Enter a date as YYYY-MM-DD.'],
    [{ odometer: null }, 'odometer', 'Enter the odometer reading.'],
    [{ isFull: 'no' }, 'isFull', 'Full tank must be true or false.'],
  ])
})

test('PATCH /api/service-records changes one field and keeps the rest', async () => {
  const car = await createVehicle()
  const { body: added } = await addServiceRecord(car.id, '2026-08-28', 10800)

  const { status, body } = await request('PATCH', `/api/service-records/${added.serviceRecord.id}`, { notes: 'Synthetic' })

  assert.equal(status, 200)
  assert.deepEqual(body.serviceRecord, { ...added.serviceRecord, notes: 'Synthetic' })
})

test('PATCH /api/service-records rejects a change that makes the record invalid', async () => {
  const car = await createVehicle()
  const { body: added } = await addServiceRecord(car.id, '2026-08-28', 10800)

  await assertPatchesRejected('/api/service-records', added.serviceRecord.id, [
    [{ services: [] }, 'services', 'Choose at least one service.'],
    [{ cost: -1 }, 'cost', "Cost can't be negative."],
    [{ date: '2026-02-30' }, 'date', "2026-02-30 isn't a real date."],
    [{ odometer: '11000' }, 'odometer', 'Odometer must be a number.'],
  ])
})

test('PATCH /api/policy-records changes one field and keeps the rest', async () => {
  const car = await createVehicle()
  const { body: added } = await addPolicyRecord(car.id)

  const { status, body } = await request('PATCH', `/api/policy-records/${added.id}`, { cost: 650 })

  assert.equal(status, 200)
  assert.deepEqual(body, { ...added, cost: 650 })
})

test('PATCH /api/policy-records rejects a change that makes the record invalid', async () => {
  const car = await createVehicle()
  const { body: added } = await addPolicyRecord(car.id)

  await assertPatchesRejected('/api/policy-records', added.id, [
    [{ type: 'warranty' }, 'type', 'Choose insurance or registration.'],
    [{ date: null }, 'date', 'Enter a date.'],
    [{ renewalDate: '2026-02-30' }, 'renewalDate', "2026-02-30 isn't a real date."],
    [{ vehicleId: 999999 }, 'vehicleId', 'Vehicle not found.'],
  ])
})

test('isValidDate accepts real YYYY-MM-DD dates only', () => {
  for (const date of ['2026-09-25', '2024-02-29', '2000-02-29', '2026-12-31', '2026-04-30']) {
    assert.equal(isValidDate(date), true, date)
  }
  for (const date of [
    '2026-02-30', '2026-02-29', '1900-02-29', '2026-04-31', '2026-00-10', '2026-13-01', '2026-09-00',
    '09/25/2026', '2026-9-25', '2026-09-25T00:00', ' 2026-09-25', '', null, undefined, 20260925,
  ]) {
    assert.equal(isValidDate(date), false, String(date))
  }
})
