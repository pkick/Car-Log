import { test } from 'node:test'
import assert from 'node:assert/strict'
import { currentOdometer, getReminderItems, planNotifications } from '../notify/plan.js'
import { buildDigest, monthToDateSpend } from '../notify/digest.js'

const TODAY = '2026-09-26'

const oil = { id: 1, categoryId: 'oil', name: 'Oil + filter', services: ['Oil + filter change'], miles: 5000, months: 12, warnMiles: 500, warnDays: 14 }
const tires = { id: 2, categoryId: 'tires', name: 'Tire rotation', services: ['Tire rotation'], miles: 5000, months: null, warnMiles: 500, warnDays: 14 }
const cabin = { id: 3, categoryId: 'filters', name: 'Cabin air filter', services: ['Cabin air filter'], miles: null, months: 24, warnMiles: 0, warnDays: 21 }

const wagon = {
  id: 1,
  nickname: 'The Wagon',
  purchaseDate: '2021-04-02',
  purchaseOdometer: 41880,
  odometer: 84210,
  insuranceRenewal: '2026-10-08',
  registrationRenewal: '2027-03-31',
  tracksService: true,
  intervals: [oil, tires],
}

const service = (vehicleId, date, odometer, services) => ({ vehicleId, date, odometer, services })
const wagonServices = [service(1, '2026-02-01', 76800, ['Tire rotation']), service(1, '2026-04-22', 79630, ['Oil + filter change'])]

const data = (overrides = {}) => ({ vehicles: [wagon], fills: [], services: wagonServices, policies: [], today: TODAY, ...overrides })
const logged = (...entries) => entries.map(([vehicleId, itemKey, state]) => ({ vehicleId, itemKey, state }))

test('the first check sends each item that is coming up or overdue, with a short plain message', () => {
  const { send, clear } = planNotifications({ ...data(), log: [] })

  assert.deepEqual(send, [
    { vehicleId: 1, itemKey: 'interval:2', state: 'overdue', message: 'The Wagon: Tire rotation is overdue (2,410 mi past due).' },
    { vehicleId: 1, itemKey: 'interval:1', state: 'coming-up', message: 'The Wagon: Oil + filter is due in 420 mi (at 84,630).' },
    { vehicleId: 1, itemKey: 'renewal:insurance', state: 'coming-up', message: 'The Wagon: insurance renews in 12 days (Oct 8).' },
  ])
  assert.deepEqual(clear, [])
})

test('nothing is sent again while an item stays in the state it was sent for', () => {
  const log = logged([1, 'interval:2', 'overdue'], [1, 'interval:1', 'coming-up'], [1, 'renewal:insurance', 'coming-up'])

  assert.deepEqual(planNotifications({ ...data(), log }), { send: [], clear: [] })
  assert.deepEqual(planNotifications({ ...data({ today: '2026-09-30' }), log }).send, [])
})

test('an item that was coming up sends again when it becomes overdue', () => {
  const log = logged([1, 'interval:2', 'overdue'], [1, 'interval:1', 'coming-up'], [1, 'renewal:insurance', 'coming-up'])
  const fills = [{ vehicleId: 1, date: '2026-10-02', odometer: 84700, total: 50 }]

  const { send, clear } = planNotifications({ ...data({ today: '2026-10-09', fills }), log })

  assert.deepEqual(send, [
    { vehicleId: 1, itemKey: 'interval:1', state: 'overdue', message: 'The Wagon: Oil + filter is overdue (70 mi past due).' },
    { vehicleId: 1, itemKey: 'renewal:insurance', state: 'overdue', message: 'The Wagon: insurance renewal is overdue (due Oct 8).' },
  ])
  assert.deepEqual(clear, [])
})

test('an item that is already overdue on its first check sends only the overdue message', () => {
  const { send } = planNotifications({ ...data({ vehicles: [{ ...wagon, intervals: [tires] }] }), log: [] })

  assert.deepEqual(send.filter((entry) => entry.itemKey === 'interval:2').map((entry) => entry.state), ['overdue'])
})

test('a service that resets an interval clears its log, so its next due date sends again', () => {
  const log = logged([1, 'interval:1', 'coming-up'], [1, 'interval:1', 'overdue'], [1, 'interval:2', 'overdue'])
  const services = [...wagonServices, service(1, '2026-10-02', 84700, ['Oil + filter change'])]

  const afterService = planNotifications({ ...data({ services, today: '2026-10-02' }), log })
  assert.deepEqual(afterService.clear, logged([1, 'interval:1', 'coming-up'], [1, 'interval:1', 'overdue']))
  assert.ok(!afterService.send.some((entry) => entry.itemKey === 'interval:1'))

  const remaining = logged([1, 'interval:2', 'overdue'])
  const fills = [{ vehicleId: 1, date: '2027-02-01', odometer: 89300, total: 50 }]
  const later = planNotifications({ ...data({ services, fills, today: '2027-02-01' }), log: remaining })
  assert.deepEqual(later.send.filter((entry) => entry.itemKey === 'interval:1'), [
    { vehicleId: 1, itemKey: 'interval:1', state: 'coming-up', message: 'The Wagon: Oil + filter is due in 400 mi (at 89,700).' },
  ])
})

test('a renewal that moves to a later date clears its log', () => {
  const log = logged([1, 'renewal:insurance', 'coming-up'])
  const renewed = { ...wagon, insuranceRenewal: '2027-10-08' }

  const { send, clear } = planNotifications({ ...data({ vehicles: [renewed] }), log })

  assert.deepEqual(clear, log)
  assert.ok(!send.some((entry) => entry.itemKey === 'renewal:insurance'))
})

test('renewals use the warn days setting, and read their date from the newest payment when the vehicle has none', () => {
  const noDates = { ...wagon, insuranceRenewal: null, registrationRenewal: null, intervals: [] }
  const policies = [{ vehicleId: 1, type: 'registration', date: '2026-03-15', cost: 145, renewalDate: '2026-10-20' }]
  const renewals = (renewalWarnDays) => planNotifications({ ...data({ vehicles: [noDates], policies, renewalWarnDays }), log: [] }).send

  assert.deepEqual(renewals(30), [
    { vehicleId: 1, itemKey: 'renewal:registration', state: 'coming-up', message: 'The Wagon: registration renews in 24 days (Oct 20).' },
  ])
  assert.deepEqual(renewals(14), [])
  assert.deepEqual(planNotifications({ ...data({ vehicles: [noDates], policies, today: '2026-10-19' }), log: [] }).send.map((e) => e.message), [
    'The Wagon: registration renews tomorrow (Oct 20).',
  ])
  assert.deepEqual(planNotifications({ ...data({ vehicles: [noDates], policies, today: '2026-10-20' }), log: [] }).send.map((e) => e.message), [
    'The Wagon: registration renews today (Oct 20).',
  ])
})

test("a vehicle that doesn't track service gets renewal reminders only, and its interval log is cleared", () => {
  const untracked = { ...wagon, tracksService: false }
  const log = logged([1, 'interval:2', 'overdue'], [1, 'renewal:insurance', 'coming-up'])

  const { send, clear } = planNotifications({ ...data({ vehicles: [untracked] }), log })

  assert.deepEqual(send, [])
  assert.deepEqual(clear, logged([1, 'interval:2', 'overdue']))
  assert.deepEqual(planNotifications({ ...data({ vehicles: [untracked] }), log: [] }).send.map((e) => e.itemKey), ['renewal:insurance'])
})

test('a deleted interval or vehicle has its log cleared, so a new interval that reuses the id starts fresh', () => {
  const log = logged([1, 'interval:9', 'overdue'], [7, 'renewal:insurance', 'coming-up'], [1, 'interval:2', 'overdue'])

  assert.deepEqual(planNotifications({ ...data(), log }).clear, logged([1, 'interval:9', 'overdue'], [7, 'renewal:insurance', 'coming-up']))
})

test('an item back to coming up from overdue loses its overdue row, so it can be overdue again', () => {
  const lengthened = { ...wagon, intervals: [{ ...tires, miles: 7800 }] }
  const log = logged([1, 'interval:2', 'coming-up'], [1, 'interval:2', 'overdue'])

  const { send, clear } = planNotifications({ ...data({ vehicles: [lengthened] }), log })

  assert.deepEqual(clear, logged([1, 'interval:2', 'overdue']))
  assert.ok(!send.some((entry) => entry.itemKey === 'interval:2'))
})

test('date limits name the day, and the limit that triggered the state', () => {
  const vehicle = { ...wagon, intervals: [cabin, { ...oil, id: 4, name: 'Brake fluid', services: ['Brake fluid'], miles: 30000, months: 36 }] }
  const services = [service(1, '2024-10-10', 70000, ['Cabin air filter'])]
  const messages = getReminderItems(data({ vehicles: [vehicle], services })).filter((i) => i.message).map((i) => i.message)

  assert.deepEqual(messages, [
    'The Wagon: Brake fluid is overdue (due Apr 2, 2024).',
    'The Wagon: Cabin air filter is due in 14 days (Oct 10).',
    'The Wagon: insurance renews in 12 days (Oct 8).',
  ])
})

test('a coming-up date limit is named even when the miles limit is further along', () => {
  // 4,800 of 5,000 mi is further along than 173 of 183 days, but 200 mi left isn't within 100 mi.
  const both = { ...oil, months: 6, warnMiles: 100 }
  const services = [service(1, '2026-04-06', 79410, ['Oil + filter change'])]
  const [item] = getReminderItems(data({ vehicles: [{ ...wagon, intervals: [both] }], services }))

  assert.equal(item.message, 'The Wagon: Oil + filter is due in 10 days (Oct 6).')
})

test("the reading is the highest of the vehicle's own and every logged one", () => {
  assert.equal(currentOdometer({ purchaseOdometer: 100, odometer: 500 }, [{ odometer: 700 }, { odometer: 300 }]), 700)
  assert.equal(currentOdometer({ purchaseOdometer: 100, odometer: null }, []), 100)
  assert.equal(currentOdometer({}, []), 0)
})

test('the digest lists what is overdue and coming up on every vehicle, then the month so far', () => {
  const truck = { id: 2, nickname: 'The Truck', purchaseDate: '2022-09-10', purchaseOdometer: 18500, odometer: 47850, tracksService: true, intervals: [] }
  const fills = [
    { vehicleId: 1, date: '2026-09-03', odometer: 84000, total: 55.01 },
    { vehicleId: 2, date: '2026-09-20', odometer: 47850, total: 84.42 },
    { vehicleId: 1, date: '2026-08-28', odometer: 83900, total: 50 },
  ]
  const services = [...wagonServices, { ...service(2, '2026-09-12', 47800, ['Tire rotation']), cost: 74 }]
  const policies = [
    { vehicleId: 2, type: 'insurance', date: '2026-09-01', cost: 612 },
    { vehicleId: 2, type: 'registration', date: '2026-09-30', cost: 145 },
  ]

  const digest = buildDigest({ vehicles: [wagon, truck], fills, services, policies, today: TODAY })

  assert.equal(digest.title, 'Odometer weekly digest')
  assert.equal(digest.message, [
    'Overdue',
    '- The Wagon: Tire rotation is overdue (2,410 mi past due).',
    '',
    'Coming up',
    '- The Wagon: Oil + filter is due in 420 mi (at 84,630).',
    '- The Wagon: insurance renews in 12 days (Oct 8).',
    '',
    'Spent in September so far: $825.43 (fuel $139.43, service $74.00, insurance $612.00).',
  ].join('\n'))
})

test('the digest says so when nothing is due or spent', () => {
  const quiet = { ...wagon, insuranceRenewal: null, registrationRenewal: null, intervals: [] }

  assert.equal(
    buildDigest({ vehicles: [quiet], today: '2026-01-04' }).message,
    'Nothing is overdue or coming up.\n\nNothing spent yet in January.'
  )
})

test('month-to-date spend adds fuel, service and both policy types, and skips later dates and other months', () => {
  const spend = monthToDateSpend({
    fills: [{ date: '2026-09-01', total: 10.1 }, { date: '2026-09-27', total: 99 }, { date: '2026-08-31', total: 99 }],
    services: [{ date: '2026-09-26', cost: 20.2 }, { date: 'soon', cost: 99 }],
    policies: [{ date: '2026-09-02', cost: 30, type: 'insurance' }, { date: '2026-09-03', cost: 40, type: 'registration' }, { date: '2026-09-04', cost: 99, type: 'other' }],
  }, TODAY)

  assert.deepEqual(spend, { total: 100.3, fuel: 10.1, service: 20.2, insurance: 30, registration: 40 })
})
