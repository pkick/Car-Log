import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import nodemailer from 'nodemailer'
import { ChannelError, sendEmail, sendNtfy, sendPushover, sendToChannels, smtpOptions } from '../notify/channels.js'
import { DEFAULT_CONFIG } from '../notify/config.js'
import { startMockServer } from './mockServer.js'

const reminder = { title: 'Odometer', message: 'The Wagon: Tire rotation is overdue (2,410 mi past due).' }
const PUSHOVER_USER = 'u'.repeat(30)
const PUSHOVER_APP = 'a'.repeat(30)

/** A port nothing listens on. */
async function closedPort() {
  const server = http.createServer().listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const { port } = server.address()
  await new Promise((resolve) => server.close(resolve))
  return port
}

test('ntfy: publishes JSON to the server root, with the token as a bearer header', async () => {
  const mock = await startMockServer()

  await sendNtfy({ server: `${mock.url}/`, topic: 'car-reminders', token: 'tk_secret' }, { title: 'Odomètre · test', message: reminder.message })

  assert.equal(mock.requests.length, 1)
  const [req] = mock.requests
  assert.equal(req.method, 'POST')
  assert.equal(req.url, '/')
  assert.equal(req.headers['content-type'], 'application/json')
  assert.equal(req.headers.authorization, 'Bearer tk_secret')
  assert.deepEqual(JSON.parse(req.body), { topic: 'car-reminders', title: 'Odomètre · test', message: reminder.message })
})

test('ntfy: sends no Authorization header without a token', async () => {
  const mock = await startMockServer()

  await sendNtfy({ server: mock.url, topic: 'car-reminders', token: null }, reminder)

  assert.equal(mock.requests[0].headers.authorization, undefined)
})

test("ntfy: a refusal rejects with ntfy's own error", async () => {
  const mock = await startMockServer()
  mock.reply(403, { code: 40301, http: 403, error: 'forbidden', link: 'https://ntfy.sh/docs/publish/#authentication' })

  await assert.rejects(
    sendNtfy({ server: mock.url, topic: 'private', token: 'tk_wrong' }, reminder),
    (err) => err instanceof ChannelError && err.message === 'ntfy answered 403: forbidden'
  )
})

test('ntfy: an unreachable server says which host it tried', async () => {
  const port = await closedPort()

  await assert.rejects(
    sendNtfy({ server: `http://127.0.0.1:${port}`, topic: 'car-reminders', token: null }, reminder),
    (err) => err instanceof ChannelError && err.message === `Couldn't reach ntfy at 127.0.0.1:${port}: ECONNREFUSED.`
  )
})

test('ntfy: a plain-text error body is passed on', async () => {
  const mock = await startMockServer()
  mock.reply(502, 'Bad Gateway from the proxy')

  await assert.rejects(sendNtfy({ server: mock.url, topic: 't', token: null }, reminder), { message: 'ntfy answered 502: Bad Gateway from the proxy' })
})

test('Pushover: posts the app token, user key, title and message as a form', async () => {
  const mock = await startMockServer()
  mock.reply(200, { status: 1, request: 'abc' })

  await sendPushover({ userKey: PUSHOVER_USER, appToken: PUSHOVER_APP }, reminder, { pushoverUrl: `${mock.url}/1/messages.json` })

  const [req] = mock.requests
  assert.equal(req.method, 'POST')
  assert.equal(req.url, '/1/messages.json')
  assert.equal(req.headers['content-type'], 'application/x-www-form-urlencoded')
  assert.deepEqual(Object.fromEntries(new URLSearchParams(req.body)), {
    token: PUSHOVER_APP,
    user: PUSHOVER_USER,
    title: 'Odometer',
    message: reminder.message,
  })
})

test("Pushover: a refusal rejects with Pushover's errors", async () => {
  const mock = await startMockServer()
  mock.reply(400, { user: 'invalid', errors: ['user identifier is not a valid user, group, or subscribed user key'], status: 0 })

  await assert.rejects(
    sendPushover({ userKey: PUSHOVER_USER, appToken: PUSHOVER_APP }, reminder, { pushoverUrl: `${mock.url}/1/messages.json` }),
    { name: 'ChannelError', message: 'Pushover answered 400: user identifier is not a valid user, group, or subscribed user key' }
  )
})

test('Pushover: goes to api.pushover.net unless told otherwise', async () => {
  const urls = []
  const fetch = async (url) => {
    urls.push(url)
    return Response.json({ status: 1 })
  }

  await sendPushover({ userKey: PUSHOVER_USER, appToken: PUSHOVER_APP }, reminder, { fetch })

  assert.deepEqual(urls, ['https://api.pushover.net/1/messages.json'])
})

const email = { host: 'smtp.example.com', port: 587, tls: 'starttls', user: 'ann', password: 'hunter2', from: 'Odometer <odometer@example.com>', to: 'ann@example.com' }

test('email: sends plain text from and to the configured addresses, with the subject', async () => {
  const sent = []
  let options
  const createTransport = (opts) => {
    options = opts
    const transport = nodemailer.createTransport({ jsonTransport: true })
    return {
      async sendMail(mail) {
        const info = await transport.sendMail(mail)
        sent.push(JSON.parse(info.message))
        return info
      },
    }
  }

  await sendEmail(email, { ...reminder, subject: reminder.message }, { createTransport })

  assert.equal(options.host, 'smtp.example.com')
  assert.deepEqual(options.auth, { user: 'ann', pass: 'hunter2' })
  assert.equal(sent.length, 1)
  assert.deepEqual(sent[0].from, { address: 'odometer@example.com', name: 'Odometer' })
  assert.deepEqual(sent[0].to, [{ address: 'ann@example.com', name: '' }])
  assert.equal(sent[0].subject, reminder.message)
  assert.equal(sent[0].text, reminder.message)
})

test('email: the subject falls back to the title, and the message is a valid UTF-8 email', async () => {
  const raw = []
  const createTransport = () => {
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' })
    return {
      async sendMail(mail) {
        const info = await transport.sendMail(mail)
        raw.push(info.message.toString())
        return info
      },
    }
  }

  await sendEmail(email, { title: 'Odometer weekly digest', message: 'Overdue\n- The Wagon: Brake fluid · due Apr 2' }, { createTransport })

  assert.match(raw[0], /^Subject: Odometer weekly digest$/m)
  assert.match(raw[0], /^To: ann@example.com$/m)
  assert.match(raw[0], /^Content-Type: text\/plain; charset=utf-8$/m)
})

test("email: a failure rejects with the mail server's error", async () => {
  const createTransport = () => ({
    sendMail: async () => {
      throw new Error('Invalid login: 535 5.7.8 Authentication failed')
    },
  })

  await assert.rejects(sendEmail(email, reminder, { createTransport }), {
    name: 'ChannelError',
    message: 'The mail server said: Invalid login: 535 5.7.8 Authentication failed',
  })
})

test('email: the TLS mode picks implicit TLS, a required STARTTLS upgrade, or neither', () => {
  const pick = ({ secure, requireTLS, ignoreTLS }) => ({ secure, requireTLS, ignoreTLS })

  assert.deepEqual(pick(smtpOptions({ ...email, tls: 'starttls' })), { secure: false, requireTLS: true, ignoreTLS: false })
  assert.deepEqual(pick(smtpOptions({ ...email, port: 465, tls: 'tls' })), { secure: true, requireTLS: false, ignoreTLS: false })
  assert.deepEqual(pick(smtpOptions({ ...email, port: 25, tls: 'none' })), { secure: false, requireTLS: false, ignoreTLS: true })
  assert.equal(smtpOptions({ ...email, user: '' }).auth, undefined)
  assert.equal(smtpOptions(email, 3000).connectionTimeout, 3000)
})

test('sendToChannels reports each channel and keeps going after a failure', async () => {
  const mock = await startMockServer()
  const config = structuredClone(DEFAULT_CONFIG)
  config.ntfy = { enabled: true, server: mock.url, topic: 'car-reminders', token: null }
  config.email = { ...email, enabled: true }
  const createTransport = () => ({
    sendMail: async () => {
      throw new Error('connect ECONNREFUSED')
    },
  })
  const logged = []
  const originalError = console.error
  console.error = (message) => logged.push(message)
  try {
    const results = await sendToChannels(['email', 'ntfy'], config, reminder, { createTransport })

    assert.deepEqual(results, [
      { channel: 'email', ok: false, error: 'The mail server said: connect ECONNREFUSED' },
      { channel: 'ntfy', ok: true },
    ])
  } finally {
    console.error = originalError
  }
  assert.equal(mock.requests.length, 1)
  assert.deepEqual(logged, ["Odometer couldn't send a reminder by Email: The mail server said: connect ECONNREFUSED"])
})
