import { test } from 'node:test'
import assert from 'node:assert/strict'
import { request, addServiceRecord } from './helpers.js'
import { startMockServer } from './mockServer.js'
import { db } from '../db.js'

const RUN = '/api/settings/notifications/run-now'
const TODAY = '2026-09-26'

// The seeded demo vehicles on TODAY: The Wagon has two services overdue by date, Tire rotation overdue by miles and
// Oil coming up; The Truck has Brake fluid overdue by date and Oil coming up. No renewal is within 30 days.
const SEEDED = [
  'The Wagon: Cabin air filter is overdue (due Apr 2, 2023).',
  'The Wagon: Brake fluid is overdue (due Apr 2, 2024).',
  'The Wagon: Tire rotation is overdue (2,410 mi past due).',
  'The Wagon: Oil + filter is due in 420 mi (at 84,630).',
  'The Truck: Brake fluid is overdue (due Sep 10, 2025).',
  'The Truck: Oil + filter is due in 380 mi (at 48,230).',
]

const mock = await startMockServer()
const published = () => mock.requests.map((req) => JSON.parse(req.body).message)
const logRows = () => db.prepare('SELECT vehicleId, itemKey, state FROM notification_log ORDER BY id').all().map((row) => ({ ...row }))

test('nothing is checked or logged while every channel is off', async () => {
  const { status, body } = await request('POST', RUN, { today: TODAY })

  assert.equal(status, 200)
  assert.deepEqual(body, { sent: [], failed: [], cleared: 0, digest: null })
  assert.deepEqual(logRows(), [])
})

test('the daily check sends one message per due item, and the next check sends nothing', async () => {
  await request('PATCH', '/api/settings/notifications', { ntfy: { enabled: true, server: mock.url, topic: 'car-reminders' } })

  const first = await request('POST', RUN, { today: TODAY })

  assert.deepEqual(first.body.sent, SEEDED)
  assert.deepEqual(published(), SEEDED)
  assert.ok(mock.requests.every((req) => JSON.parse(req.body).topic === 'car-reminders'))
  assert.equal(logRows().length, SEEDED.length)

  const second = await request('POST', RUN, { today: TODAY })
  assert.deepEqual(second.body, { sent: [], failed: [], cleared: 0, digest: null })
  assert.equal(mock.requests.length, SEEDED.length)
})

test('an item that becomes overdue sends once more', async () => {
  mock.requests.length = 0

  const { body } = await request('POST', RUN, { today: '2026-10-10' })

  assert.deepEqual(body.sent, [])
  const res = await request('POST', '/api/fill-ups', { vehicleId: 2, date: '2026-10-10', odometer: 48300, gallons: 10, pricePerGal: 3.5, isFull: true })
  assert.equal(res.status, 201)
  assert.deepEqual((await request('POST', RUN, { today: '2026-10-10' })).body.sent, ['The Truck: Oil + filter is overdue (70 mi past due).'])
  assert.deepEqual((await request('POST', RUN, { today: '2026-10-11' })).body.sent, [])
})

test('logging the service clears its reminders, so the next time it comes due sends again', async () => {
  assert.equal((await addServiceRecord(2, '2026-10-11', 48300)).status, 201)

  const { body } = await request('POST', RUN, { today: '2026-10-11' })

  assert.equal(body.cleared, 2)
  assert.deepEqual(body.sent, [])
  assert.ok(!logRows().some((row) => row.vehicleId === 2 && row.itemKey === 'interval:1'))
})

test('renewal reminders follow the renewal warn-at setting', async () => {
  mock.requests.length = 0
  await request('PATCH', '/api/settings/defaults', { renewalWarnDays: 10 })

  assert.deepEqual((await request('POST', RUN, { today: '2026-11-01' })).body.sent, [])

  await request('PATCH', '/api/settings/defaults', { renewalWarnDays: 30 })
  assert.deepEqual((await request('POST', RUN, { today: '2026-11-01' })).body.sent, ['The Wagon: insurance renews in 13 days (Nov 14).'])
})

test('a reminder no channel takes is not logged, so the next check tries it again', async () => {
  mock.requests.length = 0
  mock.reply(500, { error: 'ntfy is down' })
  await request('PATCH', '/api/vehicles/2', { registrationRenewal: '2026-11-20' })
  const originalError = console.error
  console.error = () => {}
  try {
    const failing = await request('POST', RUN, { today: '2026-11-01' })
    assert.deepEqual(failing.body.sent, [])
    assert.deepEqual(failing.body.failed, [
      { message: 'The Truck: registration renews in 19 days (Nov 20).', errors: ['ntfy answered 500: ntfy is down'] },
    ])
  } finally {
    console.error = originalError
  }

  mock.reply(200, {})
  assert.deepEqual((await request('POST', RUN, { today: '2026-11-02' })).body.sent, ['The Truck: registration renews in 18 days (Nov 20).'])
})

test('run-now with digest sends the weekly digest to each channel', async () => {
  mock.requests.length = 0

  const { body } = await request('POST', RUN, { today: '2026-11-02', digest: true })

  assert.deepEqual(body.sent, [])
  assert.deepEqual(body.digest.results, [{ channel: 'ntfy', ok: true }])
  const [digest] = mock.requests.map((req) => JSON.parse(req.body))
  assert.equal(digest.title, 'Odometer weekly digest')
  assert.match(digest.message, /^Overdue\n- The Wagon: Cabin air filter is overdue/)
  assert.ok(digest.message.includes('\n\nComing up\n- The Wagon: Oil + filter is due in 420 mi (at 84,630).\n'), digest.message)
  assert.ok(digest.message.includes('\n- The Truck: registration renews in 18 days (Nov 20).\n'), digest.message)
  assert.match(digest.message, /\n\nNothing spent yet in November\.$/)
})

test('deleting a vehicle deletes its reminder log', async () => {
  assert.ok(logRows().some((row) => row.vehicleId === 1))

  assert.equal((await request('DELETE', '/api/vehicles/1')).status, 204)

  assert.ok(!logRows().some((row) => row.vehicleId === 1))
})
