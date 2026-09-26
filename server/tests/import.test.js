import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { request, baseUrl, createVehicle, addFillUp, listedOdometer } from './helpers.js'

// The rows the app sends for app/src/lib/fixtures/fuelly-export.csv: 20 fill-ups, 2 of them partial. The app's
// csvImport test checks that its preview produces exactly these, and that their MPG matches Fuelly's.
const FUELLY_ROWS = JSON.parse(fs.readFileSync(new URL('./fixtures/fuelly-import.json', import.meta.url), 'utf8'))

const importRows = (vehicleId, rows) => request('POST', '/api/import/fill-ups', { vehicleId, rows })

async function fillUpsOf(vehicleId) {
  return (await request('GET', `/api/fill-ups?vehicleId=${vehicleId}`)).body
}

const row = (date, odometer, fields = {}) => ({ date, odometer, gallons: 10, pricePerGal: 3.5, isFull: true, ...fields })

test('a Fuelly export imports once; importing it again inserts nothing and skips every row', async () => {
  const vehicle = await createVehicle({ nickname: 'Civic', purchaseOdometer: 20000 })

  const first = await importRows(vehicle.id, FUELLY_ROWS)

  assert.equal(first.status, 200)
  assert.equal(first.body.inserted, 20)
  assert.deepEqual(first.body.skipped, [])
  assert.deepEqual(first.body.errors, [])
  assert.equal(first.body.vehicle.id, vehicle.id)
  assert.equal(first.body.vehicle.odometer, 28854)
  assert.equal(await listedOdometer(vehicle.id), 28854)

  const saved = await fillUpsOf(vehicle.id)
  const strip = ({ id, vehicleId, ...fields }) => fields
  assert.deepEqual(saved.map(strip), FUELLY_ROWS)
  assert.equal(saved.filter((f) => !f.isFull).length, 2)

  const second = await importRows(vehicle.id, FUELLY_ROWS)

  assert.equal(second.status, 200)
  assert.equal(second.body.inserted, 0)
  assert.equal(second.body.skipped.length, 20)
  assert.deepEqual(second.body.skipped[0], { index: 0, reason: 'Matches your Jan 4, 2025 fill-up at 23,114 mi.' })
  assert.deepEqual(second.body.skipped.map((s) => s.index), FUELLY_ROWS.map((_, i) => i))
  assert.equal((await fillUpsOf(vehicle.id)).length, 20)
})

test('rows are checked against saved fill-ups and earlier rows, in date order whatever order they come in', async () => {
  const vehicle = await createVehicle()
  await addFillUp(vehicle.id, '2026-03-01', 11000)

  const { status, body } = await importRows(vehicle.id, [
    row('2026-04-01', 12000),
    row('2026-02-01', 10500),
    row('2026-03-15', 11500),
  ])

  assert.equal(status, 200)
  assert.equal(body.inserted, 3)
  assert.deepEqual((await fillUpsOf(vehicle.id)).map((f) => f.odometer), [10500, 11000, 11500, 12000])
  assert.equal(body.vehicle.odometer, 12000)
})

test('a duplicate of an earlier row in the same batch is skipped', async () => {
  const vehicle = await createVehicle()

  const { status, body } = await importRows(vehicle.id, [row('2026-05-01', 10300), row('2026-05-01', 10300, { notes: 'again' })])

  assert.equal(status, 200)
  assert.equal(body.inserted, 1)
  assert.deepEqual(body.skipped, [{ index: 1, reason: 'Matches your May 1, 2026 fill-up at 10,300 mi.' }])
})

test('any bad row rejects the whole batch, listing every problem, and writes nothing', async () => {
  const vehicle = await createVehicle()
  await addFillUp(vehicle.id, '2026-03-01', 11000)

  const { status, body } = await importRows(vehicle.id, [
    row('2026-01-10', 10200),
    row('2026-02-30', 10400),
    row('2026-02-10', 10600, { gallons: -1 }),
    row('2026-03-10', 10900),
    row('2026-03-20', 11200, { station: 'x'.repeat(81) }),
    row('2026-03-25', 11400),
    'not a row',
    row('2026-04-01', 11600, { notes: 'Duplicate of a saved fill-up next' }),
    row('2026-03-01', 11000),
  ])

  assert.equal(status, 400)
  assert.equal(body.error, '5 rows have problems, so nothing was imported.')
  assert.equal(body.inserted, 0)
  assert.deepEqual(body.errors, [
    { index: 1, error: "2026-02-30 isn't a real date.", field: 'date' },
    { index: 2, error: 'Gallons must be more than 0.', field: 'gallons' },
    { index: 3, error: 'Must be more than 11,000 mi, the reading on your Mar 1, 2026 fill-up.', field: 'odometer' },
    { index: 4, error: 'Station must be 80 characters or fewer.', field: 'station' },
    { index: 6, error: "This row isn't a fill-up.", field: null },
  ])
  assert.deepEqual(body.skipped, [{ index: 8, reason: 'Matches your Mar 1, 2026 fill-up at 11,000 mi.' }])
  assert.equal((await fillUpsOf(vehicle.id)).length, 1)
  assert.equal(await listedOdometer(vehicle.id), 11000)
})

test('a reading out of order with an earlier row of the batch is an error', async () => {
  const vehicle = await createVehicle()

  const { status, body } = await importRows(vehicle.id, [row('2026-05-01', 12000), row('2026-05-09', 11800)])

  assert.equal(status, 400)
  assert.deepEqual(body.errors, [
    { index: 1, error: 'Must be more than 12,000 mi, the reading on your May 1, 2026 fill-up.', field: 'odometer' },
  ])
  assert.equal((await fillUpsOf(vehicle.id)).length, 0)
})

test('keeps the total from the file when it matches gallons × price, and rejects one that does not', async () => {
  const vehicle = await createVehicle()

  const ok = await importRows(vehicle.id, [row('2026-05-01', 10300, { gallons: 13.2, pricePerGal: 3.459, total: 45.66 })])
  assert.equal(ok.status, 200)
  assert.equal((await fillUpsOf(vehicle.id))[0].total, 45.66)

  const computed = await importRows(vehicle.id, [row('2026-05-09', 10600, { gallons: 13.2, pricePerGal: 3.459 })])
  assert.equal(computed.status, 200)
  assert.equal((await fillUpsOf(vehicle.id))[1].total, 45.66)

  const off = await importRows(vehicle.id, [row('2026-05-20', 10900, { gallons: 10, pricePerGal: 3.5, total: 40 })])
  assert.equal(off.status, 400)
  assert.deepEqual(off.body.errors, [{ index: 0, error: "Total $40.00 doesn't match 10 gal at $3.5/gal ($35.00).", field: 'total' }])
})

test('station and notes are trimmed, and a row cannot pick another vehicle or an id', async () => {
  const vehicle = await createVehicle()
  const other = await createVehicle()

  const { status } = await importRows(vehicle.id, [
    { ...row('2026-05-01', 10300, { station: '  Costco ', notes: '   ' }), vehicleId: other.id, id: 999 },
  ])

  assert.equal(status, 200)
  const [saved] = await fillUpsOf(vehicle.id)
  assert.equal(saved.station, 'Costco')
  assert.equal(saved.notes, null)
  assert.notEqual(saved.id, 999)
  assert.equal((await fillUpsOf(other.id)).length, 0)
})

test('the vehicle and the rows list are checked first', async () => {
  const vehicle = await createVehicle()
  const cases = [
    [{ rows: [row('2026-05-01', 10300)] }, { error: 'Choose a vehicle.', field: 'vehicleId' }],
    [{ vehicleId: 999999, rows: [row('2026-05-01', 10300)] }, { error: 'Vehicle not found.', field: 'vehicleId' }],
    [{ vehicleId: vehicle.id }, { error: 'Send the fill-ups as a list of rows.', field: 'rows' }],
    [{ vehicleId: vehicle.id, rows: [] }, { error: 'There are no fill-ups to import.', field: 'rows' }],
    [{ vehicleId: vehicle.id, rows: Array.from({ length: 5001 }, (_, i) => row('2026-05-01', 10000 + i)) },
      { error: "That's 5,001 fill-ups; import at most 5,000 at a time.", field: 'rows' }],
  ]
  for (const [body, expected] of cases) {
    const res = await request('POST', '/api/import/fill-ups', body)
    assert.equal(res.status, 400, expected.error)
    assert.deepEqual(res.body, expected)
  }
})

test('5,000 rows import in one request, and a body over 5 MB is refused', async () => {
  const vehicle = await createVehicle()
  const rows = Array.from({ length: 5000 }, (_, i) => {
    const day = new Date(Date.UTC(2010, 0, 1 + i))
    const date = `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, '0')}-${String(day.getUTCDate()).padStart(2, '0')}`
    return row(date, 20000 + i * 40, { station: 'Costco', notes: 'Imported from an old spreadsheet' })
  })

  const started = Date.now()
  const { status, body } = await importRows(vehicle.id, rows)

  assert.equal(status, 200)
  assert.equal(body.inserted, 5000)
  assert.equal(body.vehicle.odometer, 20000 + 4999 * 40)
  assert.ok(Date.now() - started < 10000, `took ${Date.now() - started} ms`)

  const res = await fetch(`${baseUrl}/api/import/fill-ups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vehicleId: vehicle.id, rows: [row('2030-01-01', 900000, { notes: 'x'.repeat(5_300_000) })] }),
  })
  assert.equal(res.status, 413)
  assert.equal((await fillUpsOf(vehicle.id)).length, 5000)
})
