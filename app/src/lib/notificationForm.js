// Form state for Settings › Notifications, and the PATCH bodies it sends. The API never returns a secret, only
// whether one is saved (`hasToken`), so each secret field tracks what to do with the saved value.

/** @typedef {'ntfy' | 'pushover' | 'email'} Channel */

/** Weekday names for the digest picker, indexed like `Date#getDay` (0 is Sunday). */
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * The fields each channel's card edits. `secrets` are write-only; `optional` ones can be removed.
 * @type {Record<Channel, { text: string[], secrets: string[], optional: string[] }>}
 */
export const CHANNEL_FIELDS = {
  ntfy: { text: ['server', 'topic'], secrets: ['token'], optional: ['token'] },
  pushover: { text: [], secrets: ['userKey', 'appToken'], optional: [] },
  email: { text: ['host', 'port', 'tls', 'user', 'from', 'to'], secrets: ['password'], optional: ['password'] },
}

/**
 * @typedef {object} SecretState
 * @property {boolean} saved the server has a value
 * @property {'saved' | 'replace' | 'remove' | 'new'} mode `saved` keeps the saved value; `replace` types a new one
 *   over it; `remove` clears it on save; `new` types the first one
 * @property {string} value what has been typed
 *
 * @typedef {object} ChannelForm
 * @property {boolean} enabled
 * @property {Record<string, string>} values the text fields, as the inputs hold them
 * @property {Record<string, SecretState>} secrets
 */

/**
 * `token` → `hasToken`, as the API names whether a secret is saved.
 * @param {string} field
 * @returns {string}
 */
const hasField = (field) => `has${field[0].toUpperCase()}${field.slice(1)}`

/**
 * A channel card's form, from `GET /api/settings/notifications`.
 * @param {Channel} channel
 * @param {object} settings that channel's part of the response, e.g. `{ enabled, server, topic, hasToken }`
 * @returns {ChannelForm}
 */
export function channelForm(channel, settings) {
  const { text, secrets } = CHANNEL_FIELDS[channel]
  return {
    enabled: !!settings.enabled,
    values: Object.fromEntries(text.map((field) => [field, settings[field] == null ? '' : String(settings[field])])),
    secrets: Object.fromEntries(secrets.map((field) => {
      const saved = !!settings[hasField(field)]
      return [field, { saved, mode: saved ? 'saved' : 'new', value: '' }]
    })),
  }
}

/**
 * What a PATCH should say about one secret: leave it out to keep the saved value, `null` to clear it, or the new
 * value. Typing nothing over a saved value keeps it.
 * @param {SecretState} secret
 * @returns {string | null | undefined}
 */
export function secretPatchValue(secret) {
  if (secret.mode === 'remove') return null
  if (secret.mode === 'saved') return undefined
  return secret.value.trim() || undefined
}

/**
 * The `PATCH /api/settings/notifications` body that saves one channel card. The port goes as a number when it is
 * one; anything else goes as typed, so the server's message names the problem.
 * @param {Channel} channel
 * @param {ChannelForm} form
 * @returns {object} e.g. `{ ntfy: { enabled: true, server: '…', topic: '…', token: '…' } }`
 */
export function channelPatch(channel, form) {
  const patch = { enabled: form.enabled, ...form.values }
  if ('port' in patch) patch.port = /^\d+$/.test(patch.port.trim()) ? Number(patch.port.trim()) : patch.port.trim() || null
  for (const [field, secret] of Object.entries(form.secrets)) {
    const value = secretPatchValue(secret)
    if (value !== undefined) patch[field] = value
  }
  return { [channel]: patch }
}

/**
 * Which field of a card a server error belongs to: `ntfy.topic` → `topic`.
 * @param {{ field?: string } | null} error
 * @param {Channel} channel
 * @returns {string | null} `null` when it isn't one of the card's fields, so the card shows it by its buttons.
 */
export function channelErrorField(error, channel) {
  const [prefix, field] = (error?.field ?? '').split('.')
  if (prefix !== channel || !field) return null
  const { text, secrets } = CHANNEL_FIELDS[channel]
  return text.includes(field) || secrets.includes(field) ? field : null
}

/**
 * The warn-at defaults as the inputs hold them.
 * @param {{ warnMiles: number, warnDays: number, renewalWarnDays: number }} defaults
 * @returns {{ warnMiles: string, warnDays: string, renewalWarnDays: string }}
 */
export const warnForm = (defaults) => ({
  warnMiles: String(defaults.warnMiles),
  warnDays: String(defaults.warnDays),
  renewalWarnDays: String(defaults.renewalWarnDays),
})

/**
 * The `PATCH /api/settings/defaults` body for the warn-at inputs. Whole numbers go as numbers; anything else goes
 * as typed (or `null` when blank), so the server's message names the field.
 * @param {{ warnMiles: string, warnDays: string, renewalWarnDays: string }} form
 * @returns {Record<string, number | string | null>}
 */
export function warnPatch(form) {
  return Object.fromEntries(Object.entries(form).map(([field, raw]) => {
    const value = raw.trim().replace(/,/g, '')
    return [field, /^\d+$/.test(value) ? Number(value) : value || null]
  }))
}
