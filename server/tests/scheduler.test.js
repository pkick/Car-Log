import { test } from 'node:test'
import assert from 'node:assert/strict'
import './helpers.js'
import { createScheduler, dueRuns } from '../notify/scheduler.js'
import { DEFAULT_CONFIG } from '../notify/config.js'
import { readSetting, saveNotificationConfig, writeSetting } from '../notify/store.js'

// 2026-09-26 is a Saturday; the digest defaults to Sunday (0).
const at = (day, hours, minutes = 0) => new Date(2026, 8, day, hours, minutes)
const state = (overrides) => ({ checkTime: '08:00', digestDay: 0, lastDailyRun: null, lastDigestRun: null, ...overrides })

test('the daily check is due once the check time has passed, until it has run that day', () => {
  assert.deepEqual(dueRuns(state({ now: at(26, 7, 59) })), { today: '2026-09-26', daily: false, digest: false })
  assert.equal(dueRuns(state({ now: at(26, 8, 0) })).daily, true)
  assert.equal(dueRuns(state({ now: at(26, 23, 59) })).daily, true)
  assert.equal(dueRuns(state({ now: at(26, 9), lastDailyRun: '2026-09-25' })).daily, true)
  assert.equal(dueRuns(state({ now: at(26, 9), lastDailyRun: '2026-09-26' })).daily, false)
  assert.equal(dueRuns(state({ now: at(27, 0, 5), lastDailyRun: '2026-09-26' })).daily, false)
  assert.equal(dueRuns(state({ now: at(27, 8), lastDailyRun: '2026-09-26' })).daily, true)
})

test('a run recorded for a later day (the clock went back) is not repeated', () => {
  assert.equal(dueRuns(state({ now: at(26, 9), lastDailyRun: '2026-09-27' })).daily, false)
})

test('the check time is read in the local time zone, to the minute', () => {
  assert.equal(dueRuns(state({ now: at(26, 18, 29), checkTime: '18:30' })).daily, false)
  assert.equal(dueRuns(state({ now: at(26, 18, 30), checkTime: '18:30' })).daily, true)
  assert.equal(dueRuns(state({ now: new Date(2026, 8, 26, 23, 30), checkTime: '23:15' })).today, '2026-09-26')
})

test('the digest is due on its weekday after the check time, once', () => {
  assert.equal(dueRuns(state({ now: at(26, 9) })).digest, false)
  assert.equal(dueRuns(state({ now: at(27, 7) })).digest, false)
  assert.equal(dueRuns(state({ now: at(27, 8) })).digest, true)
  assert.equal(dueRuns(state({ now: at(27, 9), lastDigestRun: '2026-09-27' })).digest, false)
  assert.equal(dueRuns(state({ now: at(26, 9), digestDay: 6 })).digest, true)
  assert.equal(dueRuns(state({ now: at(27, 9), digestDay: null })).digest, false)
})

/**
 * A scheduler on a clock the test moves, recording what it ran.
 * @param {{ value: Date }} clock
 */
function fakeScheduler(clock, { runDaily } = {}) {
  const ran = []
  const errors = []
  const scheduler = createScheduler({
    now: () => clock.value,
    runDaily: runDaily ?? (async ({ today }) => ran.push(`daily ${today}`)),
    runWeekly: async ({ today }) => ran.push(`digest ${today}`),
    onError: (err) => errors.push(err.message),
  })
  return { scheduler, ran, errors }
}

const enableNtfy = () => saveNotificationConfig({ ...structuredClone(DEFAULT_CONFIG), ntfy: { enabled: true, server: 'http://127.0.0.1:9', topic: 't', token: null } })

test('with every channel off a tick does nothing and marks nothing', async () => {
  saveNotificationConfig(structuredClone(DEFAULT_CONFIG))
  const { scheduler, ran } = fakeScheduler({ value: at(26, 9) })

  assert.equal(await scheduler.tick(), null)
  assert.deepEqual(ran, [])
  assert.equal(readSetting('lastDailyRun'), null)
})

test('ticks run the check once a day, and a restart does not repeat it', async () => {
  enableNtfy()
  const clock = { value: at(26, 7, 59) }
  const { scheduler, ran } = fakeScheduler(clock)

  await scheduler.tick()
  clock.value = at(26, 8, 0)
  await scheduler.tick()
  clock.value = at(26, 8, 1)
  await scheduler.tick()
  assert.deepEqual(ran, ['daily 2026-09-26'])
  assert.equal(readSetting('lastDailyRun'), '2026-09-26')

  const restarted = fakeScheduler({ value: at(26, 12) })
  await restarted.scheduler.tick()
  assert.deepEqual(restarted.ran, [])
})

test('on the digest day the digest follows the check', async () => {
  enableNtfy()
  const clock = { value: at(27, 8, 30) }
  const { scheduler, ran } = fakeScheduler(clock)

  await scheduler.tick()
  await scheduler.tick()

  assert.deepEqual(ran, ['daily 2026-09-27', 'digest 2026-09-27'])
  assert.equal(readSetting('lastDigestRun'), '2026-09-27')
})

test('a tick while the last one is still sending waits for it instead of running again', async () => {
  enableNtfy()
  writeSetting('lastDailyRun', '2026-09-27')
  let finish
  const calls = []
  const { scheduler } = fakeScheduler({ value: at(28, 8) }, {
    runDaily: ({ today }) => {
      calls.push(today)
      return new Promise((resolve) => {
        finish = resolve
      })
    },
  })

  const first = scheduler.tick()
  const second = scheduler.tick()
  assert.equal(first, second)
  await new Promise((resolve) => setImmediate(resolve))
  finish()
  await first

  assert.deepEqual(calls, ['2026-09-28'])
})

test('a failed check is reported and not retried the same day', async () => {
  enableNtfy()
  writeSetting('lastDailyRun', '2026-09-28')
  const clock = { value: at(29, 8) }
  const { scheduler, errors } = fakeScheduler(clock, {
    runDaily: async () => {
      throw new Error('database is locked')
    },
  })

  assert.equal(await scheduler.tick(), null)
  assert.deepEqual(errors, ['database is locked'])
  assert.equal(readSetting('lastDailyRun'), '2026-09-29')
})

test('start ticks at once, a second start adds no timer, and stop clears it', async () => {
  enableNtfy()
  writeSetting('lastDailyRun', '2026-09-29')
  const { scheduler, ran } = fakeScheduler({ value: at(30, 9) })

  scheduler.start()
  scheduler.start()
  await scheduler.tick()
  scheduler.stop()

  assert.deepEqual(ran, ['daily 2026-09-30'])
})
