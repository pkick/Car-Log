import nodemailer from 'nodemailer'
import { CHANNEL_NAMES } from './config.js'

export const PUSHOVER_URL = 'https://api.pushover.net/1/messages.json'
const TIMEOUT_MS = 10000

/**
 * A reminder, digest or test as the channels send it.
 * @typedef {object} Notification
 * @property {string} title the push notification's title
 * @property {string} message plain text; may have several lines
 * @property {string} [subject] the email subject; defaults to `title`
 */

/**
 * @typedef {object} ChannelDeps
 * @property {typeof fetch} [fetch] makes the ntfy and Pushover requests; tests pass a stub or use a local server
 * @property {string} [pushoverUrl] where Pushover messages go; tests point it at a local server
 * @property {(options: object) => { sendMail: (mail: object) => Promise<unknown> }} [createTransport] builds the
 *   SMTP transport; tests pass nodemailer's stream or JSON transport
 * @property {number} [timeoutMs] how long to wait for a provider
 */

/** A provider refused a message or couldn't be reached. The message is the provider's own, for Settings to show. */
export class ChannelError extends Error {
  name = 'ChannelError'
}

/**
 * The error text in a failed provider response: ntfy's and Pushover's JSON (`error`, `errors`), or the plain body.
 * @param {Response} response
 * @returns {Promise<string>}
 */
async function responseError(response) {
  const text = await response.text().catch(() => '')
  try {
    const body = JSON.parse(text)
    if (Array.isArray(body.errors) && body.errors.length) return body.errors.join('; ')
    if (typeof body.error === 'string') return body.error
  } catch {
    // Not JSON: use the text.
  }
  return text.trim().slice(0, 200) || response.statusText
}

/**
 * @param {string} url
 * @returns {string} the URL's host, or the URL itself when it doesn't parse
 */
function hostOf(url) {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/**
 * POSTs to a provider and turns a failure into a {@link ChannelError}.
 * @param {string} name the provider, as the error names it
 * @param {string} url
 * @param {RequestInit} init
 * @param {ChannelDeps} deps
 * @returns {Promise<void>}
 */
async function post(name, url, init, { fetch: fetchFn = globalThis.fetch, timeoutMs = TIMEOUT_MS }) {
  let response
  try {
    response = await fetchFn(url, { method: 'POST', ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? `no answer in ${timeoutMs / 1000} seconds` : err.cause?.code || err.cause?.message || err.message
    throw new ChannelError(`Couldn't reach ${name} at ${hostOf(url)}: ${reason}.`, { cause: err })
  }
  if (!response.ok) throw new ChannelError(`${name} answered ${response.status}: ${await responseError(response)}`)
}

/**
 * Publishes to an ntfy topic with ntfy's JSON API (a POST to the server root), which keeps non-ASCII titles intact.
 * @param {{ server: string, topic: string, token: string | null }} settings
 * @param {Notification} notification
 * @param {ChannelDeps} [deps]
 * @returns {Promise<void>}
 * @throws {ChannelError}
 */
export function sendNtfy(settings, { title, message }, deps = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (settings.token) headers.Authorization = `Bearer ${settings.token}`
  return post('ntfy', `${settings.server.replace(/\/+$/, '')}/`, {
    headers,
    body: JSON.stringify({ topic: settings.topic, title, message }),
  }, deps)
}

/**
 * Sends a Pushover message.
 * @param {{ userKey: string, appToken: string }} settings
 * @param {Notification} notification
 * @param {ChannelDeps} [deps]
 * @returns {Promise<void>}
 * @throws {ChannelError}
 */
export function sendPushover(settings, { title, message }, deps = {}) {
  const body = new URLSearchParams({ token: settings.appToken, user: settings.userKey, title, message })
  return post('Pushover', deps.pushoverUrl ?? PUSHOVER_URL, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  }, deps)
}

/**
 * nodemailer's SMTP options for the email settings.
 * @param {{ host: string, port: number, tls: 'starttls' | 'tls' | 'none', user: string, password: string | null }} settings
 * @param {number} [timeoutMs]
 * @returns {object}
 */
export function smtpOptions(settings, timeoutMs = TIMEOUT_MS) {
  return {
    host: settings.host,
    port: settings.port,
    secure: settings.tls === 'tls',
    requireTLS: settings.tls === 'starttls',
    ignoreTLS: settings.tls === 'none',
    auth: settings.user ? { user: settings.user, pass: settings.password ?? '' } : undefined,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
  }
}

/**
 * Sends a plain-text email through the configured SMTP server.
 * @param {{ host: string, port: number, tls: 'starttls' | 'tls' | 'none', user: string, password: string | null,
 *   from: string, to: string }} settings
 * @param {Notification} notification
 * @param {ChannelDeps} [deps]
 * @returns {Promise<void>}
 * @throws {ChannelError}
 */
export async function sendEmail(settings, { title, message, subject }, deps = {}) {
  const createTransport = deps.createTransport ?? nodemailer.createTransport
  try {
    const transport = createTransport(smtpOptions(settings, deps.timeoutMs))
    await transport.sendMail({ from: settings.from, to: settings.to, subject: subject ?? title, text: message })
  } catch (err) {
    throw new ChannelError(`The mail server said: ${err.message}`, { cause: err })
  }
}

const SENDERS = { ntfy: sendNtfy, pushover: sendPushover, email: sendEmail }

/**
 * Sends one notification on one channel.
 * @param {'ntfy' | 'pushover' | 'email'} channel
 * @param {import('./config.js').NotificationConfig} config
 * @param {Notification} notification
 * @param {ChannelDeps} [deps]
 * @returns {Promise<void>}
 * @throws {ChannelError}
 */
export function sendToChannel(channel, config, notification, deps) {
  return SENDERS[channel](config[channel], notification, deps)
}

/**
 * Sends one notification on each of `channels`, and reports how each went. Never throws.
 * @param {Array<'ntfy' | 'pushover' | 'email'>} channels
 * @param {import('./config.js').NotificationConfig} config
 * @param {Notification} notification
 * @param {ChannelDeps} [deps]
 * @returns {Promise<Array<{ channel: string, ok: boolean, error?: string }>>}
 */
export async function sendToChannels(channels, config, notification, deps) {
  const results = []
  for (const channel of channels) {
    try {
      await sendToChannel(channel, config, notification, deps)
      results.push({ channel, ok: true })
    } catch (err) {
      console.error(`Odometer couldn't send a reminder by ${CHANNEL_NAMES[channel]}: ${err.message}`)
      results.push({ channel, ok: false, error: err.message })
    }
  }
  return results
}
