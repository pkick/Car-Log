import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import nodemailer from 'nodemailer'
import { request } from './helpers.js'
import { startMockServer } from './mockServer.js'
import { applyPatch, applyWarnPatch, DEFAULT_CONFIG, DEFAULT_WARN, maskConfig, normalizeConfig } from '../notify/config.js'
import { createNotificationsRouter } from '../routes/notifications.js'

const PATH = '/api/settings/notifications'
const USER_KEY = 'uQiRzpo4DXghDmr9QzzfQu27cmVRsG'
const APP_TOKEN = 'azGDORePK8gMaC0QOYAMyEEuzJnyUi'

const DEFAULT_RESPONSE = {
  ntfy: { enabled: false, server: 'https://ntfy.sh', topic: '', hasToken: false },
  pushover: { enabled: false, hasUserKey: false, hasAppToken: false },
  email: { enabled: false, host: '', port: 587, tls: 'starttls', user: '', hasPassword: false, from: '', to: '' },
  checkTime: '08:00',
  digestDay: 0,
  lastDailyRun: null,
  lastDigestRun: null,
}

test('GET returns the defaults before anything is saved', async () => {
  const { status, body } = await request('GET', PATH)

  assert.equal(status, 200)
  assert.deepEqual(body, DEFAULT_RESPONSE)
})

test('secrets are write-only: saved, reported as set, never returned', async () => {
  const saved = await request('PATCH', PATH, {
    ntfy: { enabled: true, topic: 'car-reminders', token: 'tk_supersecret' },
    pushover: { userKey: USER_KEY, appToken: APP_TOKEN },
    email: { host: 'smtp.example.com', user: 'ann', password: 'hunter2', from: 'odometer@example.com', to: 'ann@example.com' },
  })

  assert.equal(saved.status, 200)
  assert.deepEqual(saved.body.ntfy, { enabled: true, server: 'https://ntfy.sh', topic: 'car-reminders', hasToken: true })
  assert.deepEqual(saved.body.pushover, { enabled: false, hasUserKey: true, hasAppToken: true })
  assert.equal(saved.body.email.hasPassword, true)

  const { body } = await request('GET', PATH)
  const text = JSON.stringify(body)
  for (const secret of ['tk_supersecret', USER_KEY, APP_TOKEN, 'hunter2']) assert.ok(!text.includes(secret), secret)
  for (const field of ['token', 'userKey', 'appToken', 'password']) assert.ok(!text.includes(`"${field}"`), field)
})

test("a secret left out or sent empty is kept, and null clears it", async () => {
  await request('PATCH', PATH, { ntfy: { topic: 'car-reminders', token: 'tk_keep' } })

  assert.equal((await request('PATCH', PATH, { ntfy: { topic: 'renamed' } })).body.ntfy.hasToken, true)
  assert.equal((await request('PATCH', PATH, { ntfy: { token: '' } })).body.ntfy.hasToken, true)
  assert.equal((await request('PATCH', PATH, { ntfy: { token: '   ' } })).body.ntfy.hasToken, true)

  const cleared = await request('PATCH', PATH, { ntfy: { token: null } })
  assert.equal(cleared.body.ntfy.hasToken, false)
  assert.equal(cleared.body.ntfy.topic, 'renamed')
})

test('PATCH trims text, drops the trailing slash of the ntfy server, and saves the schedule', async () => {
  const { status, body } = await request('PATCH', PATH, {
    ntfy: { server: ' https://ntfy.example.com/ ', topic: ' car-reminders ' },
    checkTime: '07:30',
    digestDay: null,
  })

  assert.equal(status, 200)
  assert.equal(body.ntfy.server, 'https://ntfy.example.com')
  assert.equal(body.ntfy.topic, 'car-reminders')
  assert.equal(body.checkTime, '07:30')
  assert.equal(body.digestDay, null)
  assert.deepEqual((await request('GET', PATH)).body.checkTime, '07:30')
})

test('invalid settings are refused with the field, and nothing is saved', async () => {
  const before = (await request('GET', PATH)).body
  const cases = [
    [{ ntfy: 'on' }, 'ntfy', 'ntfy settings must be an object.'],
    [{ ntfy: { enabled: 'yes' } }, 'ntfy.enabled', 'Enabled must be true or false.'],
    [{ ntfy: { enabled: true, topic: '' } }, 'ntfy.topic', 'Enter a topic.'],
    [{ ntfy: { server: 'ntfy.sh' } }, 'ntfy.server', 'Enter the server as a URL starting with https:// or http://.'],
    [{ ntfy: { topic: 'car reminders!' } }, 'ntfy.topic', 'A topic is up to 64 letters, digits, - and _.'],
    [{ ntfy: { topic: 42 } }, 'ntfy.topic', 'Enter this as text.'],
    [{ pushover: { enabled: true, userKey: null } }, 'pushover.userKey', 'Enter your Pushover user key.'],
    [{ pushover: { appToken: 'short' } }, 'pushover.appToken', 'A Pushover app token is 30 letters and digits.'],
    [{ email: { port: '587' } }, 'email.port', 'Port must be a whole number from 1 to 65535.'],
    [{ email: { port: 70000 } }, 'email.port', 'Port must be a whole number from 1 to 65535.'],
    [{ email: { tls: 'ssl' } }, 'email.tls', 'Choose STARTTLS, TLS or none.'],
    [{ email: { to: 'ann@example.com, bob' } }, 'email.to', 'Enter one address, or several separated by commas.'],
    [{ email: { enabled: true, host: '' } }, 'email.host', 'Enter the SMTP server.'],
    [{ checkTime: '8:00' }, 'checkTime', 'Enter the time as HH:MM, e.g. 08:00.'],
    [{ checkTime: '24:00' }, 'checkTime', 'Enter the time as HH:MM, e.g. 08:00.'],
    [{ digestDay: 7 }, 'digestDay', 'Choose a day of the week, or off.'],
    [[], 'body', 'Send the settings as a JSON object.'],
  ]
  for (const [body, field, error] of cases) {
    const res = await request('PATCH', PATH, body)
    assert.equal(res.status, 400, JSON.stringify(body))
    assert.deepEqual(res.body, { error, field }, JSON.stringify(body))
  }
  assert.deepEqual((await request('GET', PATH)).body, before)
})

test('a channel can be switched off while incomplete, but not on', async () => {
  const off = await request('PATCH', PATH, { email: { enabled: false, host: '', from: '', to: '' } })
  assert.equal(off.status, 200)

  const on = await request('PATCH', PATH, { email: { enabled: true } })
  assert.deepEqual(on.body, { error: 'Enter the SMTP server.', field: 'email.host' })
})

test('POST test sends a test message through the saved channel', async () => {
  const mock = await startMockServer()
  await request('PATCH', PATH, { ntfy: { enabled: false, server: mock.url, topic: 'car-reminders', token: 'tk_test' } })

  const { status, body } = await request('POST', `${PATH}/test`, { channel: 'ntfy' })

  assert.equal(status, 200)
  assert.deepEqual(body, { ok: true, channel: 'ntfy' })
  assert.equal(mock.requests.length, 1)
  assert.equal(mock.requests[0].headers.authorization, 'Bearer tk_test')
  assert.deepEqual(JSON.parse(mock.requests[0].body), {
    topic: 'car-reminders',
    title: 'Odometer test',
    message: 'This is a test from Odometer. Reminders about your vehicles will arrive here.',
  })
})

test("POST test returns the provider's error when it refuses", async () => {
  const mock = await startMockServer()
  mock.reply(401, { code: 40101, http: 401, error: 'unauthorized' })
  await request('PATCH', PATH, { ntfy: { server: mock.url, topic: 'car-reminders' } })

  const { status, body } = await request('POST', `${PATH}/test`, { channel: 'ntfy' })

  assert.equal(status, 502)
  assert.deepEqual(body, { error: 'ntfy answered 401: unauthorized' })
})

test('POST test refuses an unknown or incomplete channel', async () => {
  assert.deepEqual((await request('POST', `${PATH}/test`, { channel: 'sms' })).body, { error: 'Choose ntfy, Pushover or email.', field: 'channel' })
  await request('PATCH', PATH, { pushover: { enabled: false, userKey: null, appToken: null } })

  const { status, body } = await request('POST', `${PATH}/test`, { channel: 'pushover' })

  assert.equal(status, 400)
  assert.deepEqual(body, { error: 'Enter your Pushover user key.', field: 'pushover.userKey' })
})

test('POST test sends email through the configured transport', async () => {
  const sent = []
  const createTransport = () => {
    const transport = nodemailer.createTransport({ jsonTransport: true })
    return {
      async sendMail(mail) {
        const info = await transport.sendMail(mail)
        sent.push(JSON.parse(info.message))
        return info
      },
    }
  }
  const app = express().use(express.json()).use('/api/settings', createNotificationsRouter({ deps: { createTransport } }))
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  try {
    await request('PATCH', PATH, { email: { host: 'smtp.example.com', from: 'odometer@example.com', to: 'ann@example.com, bob@example.com' } })
    const res = await fetch(`http://127.0.0.1:${server.address().port}${PATH}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'email' }),
    })

    assert.equal(res.status, 200)
    assert.equal(sent.length, 1)
    assert.equal(sent[0].subject, 'Odometer test')
    assert.deepEqual(sent[0].to.map((to) => to.address), ['ann@example.com', 'bob@example.com'])
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('warn-at defaults start at 500 mi, 14 days and 30 days, and save whole numbers only', async () => {
  assert.deepEqual((await request('GET', '/api/settings/defaults')).body, { warnMiles: 500, warnDays: 14, renewalWarnDays: 30 })

  const saved = await request('PATCH', '/api/settings/defaults', { warnMiles: 750, renewalWarnDays: 45 })
  assert.equal(saved.status, 200)
  assert.deepEqual(saved.body, { warnMiles: 750, warnDays: 14, renewalWarnDays: 45 })
  assert.deepEqual((await request('GET', '/api/settings/defaults')).body, saved.body)

  for (const [body, field, error] of [
    [{ warnMiles: '500' }, 'warnMiles', 'Miles must be a whole number.'],
    [{ warnDays: 1.5 }, 'warnDays', 'Days must be a whole number.'],
    [{ warnDays: -1 }, 'warnDays', 'Days must be between 0 and 365.'],
    [{ renewalWarnDays: 400 }, 'renewalWarnDays', 'Days must be between 0 and 365.'],
    [{ warnMiles: null }, 'warnMiles', 'Miles must be a whole number.'],
  ]) {
    assert.deepEqual((await request('PATCH', '/api/settings/defaults', body)).body, { error, field })
  }
  assert.deepEqual((await request('GET', '/api/settings/defaults')).body, saved.body)
})

test('a stored config missing fields is filled in from the defaults', () => {
  assert.deepEqual(normalizeConfig(null), DEFAULT_CONFIG)
  assert.deepEqual(normalizeConfig({ ntfy: { topic: 'x' }, digestDay: null }).ntfy, { ...DEFAULT_CONFIG.ntfy, topic: 'x' })
  assert.equal(normalizeConfig({ digestDay: null }).digestDay, null)
  assert.equal(normalizeConfig({ digestDay: 'Sunday' }).digestDay, 0)
})

test('maskConfig and applyPatch leave the config they are given alone', () => {
  const config = structuredClone(DEFAULT_CONFIG)
  config.email.password = 'hunter2'

  assert.equal(maskConfig(config).email.hasPassword, true)
  assert.equal(config.email.password, 'hunter2')
  const { config: next } = applyPatch(config, { email: { password: null } })
  assert.equal(next.email.password, null)
  assert.equal(config.email.password, 'hunter2')
  assert.deepEqual(applyWarnPatch(DEFAULT_WARN, {}), { defaults: DEFAULT_WARN })
})
