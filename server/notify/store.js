import { db } from '../db.js'
import { rowToVehicle } from '../vehicles.js'
import { rowToFillUp, rowToServiceRecord } from '../records.js'
import { DEFAULT_WARN, normalizeConfig } from './config.js'

/**
 * Reads one value from `settings`.
 * @param {string} key
 * @param {*} fallback returned when the key is missing or its value isn't valid JSON
 * @returns {*}
 */
export function readSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  if (!row) return fallback
  try {
    return JSON.parse(row.value)
  } catch {
    return fallback
  }
}

/**
 * Writes one value to `settings`, as JSON.
 * @param {string} key
 * @param {*} value
 * @returns {void}
 */
export function writeSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value))
}

/** @returns {import('./config.js').NotificationConfig} */
export const loadNotificationConfig = () => normalizeConfig(readSetting('notifications'))

/** @param {import('./config.js').NotificationConfig} config */
export const saveNotificationConfig = (config) => writeSetting('notifications', config)

/** @returns {typeof DEFAULT_WARN} */
export const loadWarnDefaults = () => ({ ...DEFAULT_WARN, ...readSetting('warnDefaults', {}) })

/** @param {typeof DEFAULT_WARN} defaults */
export const saveWarnDefaults = (defaults) => writeSetting('warnDefaults', defaults)

/**
 * Everything the daily check and the digest read: every vehicle and record, and the reminders already sent.
 * @returns {{ vehicles: object[], fills: object[], services: object[], policies: object[],
 *   log: Array<{ vehicleId: number, itemKey: string, state: string }> }}
 */
export function loadReminderData() {
  return {
    vehicles: db.prepare('SELECT * FROM vehicles ORDER BY id').all().map(rowToVehicle),
    fills: db.prepare('SELECT * FROM fill_ups').all().map(rowToFillUp),
    services: db.prepare('SELECT * FROM service_records').all().map(rowToServiceRecord),
    policies: db.prepare('SELECT * FROM policy_records').all().map((row) => ({ ...row })),
    log: db.prepare('SELECT vehicleId, itemKey, state FROM notification_log').all().map((row) => ({ ...row })),
  }
}

/**
 * Records a reminder as sent.
 * @param {{ vehicleId: number, itemKey: string, state: string }} entry
 * @returns {void}
 */
export function logSent({ vehicleId, itemKey, state }) {
  db.prepare(`
    INSERT INTO notification_log (vehicleId, itemKey, state, sentAt) VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  `).run(vehicleId, itemKey, state)
}

/**
 * Forgets that reminders were sent, so the next change of state sends again.
 * @param {Array<{ vehicleId: number | null, itemKey: string, state: string }>} entries
 * @returns {void}
 */
export function clearLogged(entries) {
  const remove = db.prepare('DELETE FROM notification_log WHERE vehicleId IS ? AND itemKey = ? AND state = ?')
  for (const { vehicleId, itemKey, state } of entries) remove.run(vehicleId, itemKey, state)
}
