// Notification settings as stored in `settings` (key `notifications`) and as the API shows them. Pure: no database.

/** The channels a reminder can go out on, in the order Settings lists them. */
export const CHANNELS = ['ntfy', 'pushover', 'email']

/** @type {Record<string, string>} */
export const CHANNEL_NAMES = { ntfy: 'ntfy', pushover: 'Pushover', email: 'Email' }

/** SMTP security: STARTTLS upgrade (usually port 587), TLS from the start (465), or none (a LAN relay on 25). */
const TLS_MODES = ['starttls', 'tls', 'none']

/**
 * @typedef {object} NotificationConfig
 * @property {{ enabled: boolean, server: string, topic: string, token: string | null }} ntfy
 * @property {{ enabled: boolean, userKey: string | null, appToken: string | null }} pushover
 * @property {{ enabled: boolean, host: string, port: number, tls: 'starttls' | 'tls' | 'none', user: string,
 *   password: string | null, from: string, to: string }} email
 * @property {string} checkTime `HH:MM`, server local time, when the daily check runs
 * @property {number | null} digestDay the weekday of the weekly digest, 0 (Sunday) to 6; `null` is off
 */

/** @type {NotificationConfig} */
export const DEFAULT_CONFIG = {
  ntfy: { enabled: false, server: 'https://ntfy.sh', topic: '', token: null },
  pushover: { enabled: false, userKey: null, appToken: null },
  email: { enabled: false, host: '', port: 587, tls: 'starttls', user: '', password: null, from: '', to: '' },
  checkTime: '08:00',
  digestDay: 0,
}

/** The write-only fields of each channel. The API never returns them, only whether each is set (`hasToken`). */
const SECRETS = { ntfy: ['token'], pushover: ['userKey', 'appToken'], email: ['password'] }

/** The other fields a PATCH may set, per channel. */
const FIELDS = {
  ntfy: ['server', 'topic'],
  pushover: [],
  email: ['host', 'port', 'tls', 'user', 'from', 'to'],
}

/**
 * `token` → `hasToken`.
 * @param {string} field
 * @returns {string}
 */
const hasField = (field) => `has${field[0].toUpperCase()}${field.slice(1)}`

/**
 * Fills in whatever a stored config lacks from {@link DEFAULT_CONFIG}, so older or partial rows still work.
 * @param {unknown} stored the parsed `settings` value, or anything else
 * @returns {NotificationConfig}
 */
export function normalizeConfig(stored) {
  const value = stored && typeof stored === 'object' ? stored : {}
  const config = structuredClone(DEFAULT_CONFIG)
  for (const channel of CHANNELS) {
    if (value[channel] && typeof value[channel] === 'object') Object.assign(config[channel], value[channel])
  }
  if (typeof value.checkTime === 'string') config.checkTime = value.checkTime
  if (value.digestDay === null || Number.isInteger(value.digestDay)) config.digestDay = value.digestDay
  return config
}

/**
 * The config as `GET /api/settings/notifications` returns it: each secret replaced by whether it is set.
 * @param {NotificationConfig} config
 * @returns {object} e.g. `ntfy: { enabled, server, topic, hasToken }`
 */
export function maskConfig(config) {
  const masked = { checkTime: config.checkTime, digestDay: config.digestDay }
  for (const channel of CHANNELS) {
    const { ...settings } = config[channel]
    for (const field of SECRETS[channel]) {
      delete settings[field]
      settings[hasField(field)] = !!config[channel][field]
    }
    masked[channel] = settings
  }
  return masked
}

/** @typedef {{ error: string, field: string }} Invalid */

/**
 * Applies a `PATCH /api/settings/notifications` body to the stored config. Fields left out keep their value. A
 * secret sent as `''` also keeps its value, and `null` clears it. Text is trimmed, and the ntfy server loses any
 * trailing slash. Unknown fields are ignored.
 * @param {NotificationConfig} config the stored config
 * @param {unknown} body
 * @returns {{ config: NotificationConfig } | Invalid} the new config, or the first field of the wrong type
 */
export function applyPatch(config, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Send the settings as a JSON object.', field: 'body' }
  const next = structuredClone(config)

  for (const channel of CHANNELS) {
    const patch = body[channel]
    if (patch === undefined) continue
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      return { error: `${CHANNEL_NAMES[channel]} settings must be an object.`, field: channel }
    }
    if (patch.enabled !== undefined) {
      if (typeof patch.enabled !== 'boolean') return { error: 'Enabled must be true or false.', field: `${channel}.enabled` }
      next[channel].enabled = patch.enabled
    }
    for (const field of FIELDS[channel]) {
      const value = patch[field]
      if (value === undefined) continue
      if (field === 'port') {
        next[channel].port = value
        continue
      }
      if (value !== null && typeof value !== 'string') return { error: 'Enter this as text.', field: `${channel}.${field}` }
      next[channel][field] = (value ?? '').trim()
    }
    for (const field of SECRETS[channel]) {
      const value = patch[field]
      if (value === undefined || value === '') continue
      if (value !== null && typeof value !== 'string') return { error: 'Enter this as text.', field: `${channel}.${field}` }
      next[channel][field] = value === null ? null : value.trim() || config[channel][field]
    }
  }
  if (next.ntfy.server) next.ntfy.server = next.ntfy.server.replace(/\/+$/, '')

  if (body.checkTime !== undefined) next.checkTime = body.checkTime
  if (body.digestDay !== undefined) next.digestDay = body.digestDay
  return { config: next }
}

const CHECK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const NTFY_TOPIC = /^[-_A-Za-z0-9]{1,64}$/
const PUSHOVER_KEY = /^[A-Za-z0-9]{30}$/
const ADDRESS = /^[^\s@<>,]+@[^\s@<>,]+\.[^\s@<>,]+$/

/**
 * @param {string} value
 * @returns {boolean} an http(s) URL with a host
 */
function isHttpUrl(value) {
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:') && !!url.hostname
  } catch {
    return false
  }
}

/**
 * `ann@example.com` or `Odometer <odometer@example.com>`.
 * @param {string} value
 * @returns {boolean}
 */
const isAddress = (value) => ADDRESS.test(value) || /^[^<>]*<[^\s@<>,]+@[^\s@<>,]+\.[^\s@<>,]+>$/.test(value)

/**
 * Checks one channel's settings. Formats are checked whenever a value is set; the fields a message needs are
 * required only when `complete` is true (the channel is on, or is being tested).
 * @param {'ntfy' | 'pushover' | 'email'} channel
 * @param {NotificationConfig} config
 * @param {{ complete?: boolean }} [options]
 * @returns {Invalid | null}
 */
export function validateChannel(channel, config, { complete = config[channel].enabled } = {}) {
  const s = config[channel]
  const fail = (field, error) => ({ error, field: `${channel}.${field}` })

  if (channel === 'ntfy') {
    if (!s.server) return complete ? fail('server', 'Enter the ntfy server, e.g. https://ntfy.sh.') : null
    if (!isHttpUrl(s.server)) return fail('server', 'Enter the server as a URL starting with https:// or http://.')
    if (!s.topic) return complete ? fail('topic', 'Enter a topic.') : null
    if (!NTFY_TOPIC.test(s.topic)) return fail('topic', 'A topic is up to 64 letters, digits, - and _.')
  }

  if (channel === 'pushover') {
    for (const [field, noun] of [['userKey', 'user key'], ['appToken', 'app token']]) {
      if (!s[field]) {
        if (complete) return fail(field, `Enter your Pushover ${noun}.`)
      } else if (!PUSHOVER_KEY.test(s[field])) {
        return fail(field, `A Pushover ${noun} is 30 letters and digits.`)
      }
    }
  }

  if (channel === 'email') {
    if (!s.host && complete) return fail('host', 'Enter the SMTP server.')
    if (!Number.isInteger(s.port) || s.port < 1 || s.port > 65535) return fail('port', 'Port must be a whole number from 1 to 65535.')
    if (!TLS_MODES.includes(s.tls)) return fail('tls', 'Choose STARTTLS, TLS or none.')
    if (!s.from) {
      if (complete) return fail('from', 'Enter the address to send from.')
    } else if (!isAddress(s.from)) {
      return fail('from', 'Enter an address like odometer@example.com.')
    }
    if (!s.to) {
      if (complete) return fail('to', 'Enter the address to send to.')
    } else if (!s.to.split(',').every((address) => isAddress(address.trim()))) {
      return fail('to', 'Enter one address, or several separated by commas.')
    }
  }
  return null
}

/**
 * Checks a whole config before it is saved.
 * @param {NotificationConfig} config
 * @returns {Invalid | null} the first problem, as a `400` body
 */
export function validateConfig(config) {
  for (const channel of CHANNELS) {
    const invalid = validateChannel(channel, config)
    if (invalid) return invalid
  }
  if (typeof config.checkTime !== 'string' || !CHECK_TIME.test(config.checkTime)) {
    return { error: 'Enter the time as HH:MM, e.g. 08:00.', field: 'checkTime' }
  }
  if (config.digestDay !== null && !(Number.isInteger(config.digestDay) && config.digestDay >= 0 && config.digestDay <= 6)) {
    return { error: 'Choose a day of the week, or off.', field: 'digestDay' }
  }
  return null
}

/**
 * @param {NotificationConfig} config
 * @returns {Array<'ntfy' | 'pushover' | 'email'>} the channels that are on
 */
export const enabledChannels = (config) => CHANNELS.filter((channel) => config[channel].enabled)

/** Warn-at values for new intervals, and how early a renewal counts as coming up. */
export const DEFAULT_WARN = { warnMiles: 500, warnDays: 14, renewalWarnDays: 30 }

const WARN_RULES = {
  warnMiles: ['Miles', 100000],
  warnDays: ['Days', 365],
  renewalWarnDays: ['Days', 365],
}

/**
 * Applies and checks a `PATCH /api/settings/defaults` body. Each value must be a whole JSON number.
 * @param {typeof DEFAULT_WARN} current
 * @param {unknown} body
 * @returns {{ defaults: typeof DEFAULT_WARN } | Invalid}
 */
export function applyWarnPatch(current, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Send the settings as a JSON object.', field: 'body' }
  const next = { ...current }
  for (const [field, [label, max]] of Object.entries(WARN_RULES)) {
    const value = body[field]
    if (value === undefined) continue
    if (typeof value !== 'number' || !Number.isInteger(value)) return { error: `${label} must be a whole number.`, field }
    if (value < 0 || value > max) return { error: `${label} must be between 0 and ${max.toLocaleString('en-US')}.`, field }
    next[field] = value
  }
  return { defaults: next }
}
