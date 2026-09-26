import { todayISO } from '../../shared/dates.js'
import { enabledChannels } from './config.js'
import { sendToChannels } from './channels.js'
import { buildDigest } from './digest.js'
import { planNotifications } from './plan.js'
import { clearLogged, loadNotificationConfig, loadReminderData, loadWarnDefaults, logSent } from './store.js'

/**
 * @typedef {object} RunOptions
 * @property {string} [today] `YYYY-MM-DD`; defaults to the server's local date
 * @property {import('./channels.js').ChannelDeps} [deps]
 */

/**
 * The daily check: sends a reminder for each interval and renewal that has become coming up or overdue since the
 * last check, on every enabled channel, and updates `notification_log`. A reminder is logged once any channel
 * takes it; one that no channel takes is tried again at the next check.
 * @param {RunOptions} [options]
 * @returns {Promise<{ sent: string[], failed: Array<{ message: string, errors: string[] }>, cleared: number }>}
 *   nothing happens when no channel is enabled.
 */
export async function runDailyCheck({ today = todayISO(), deps } = {}) {
  const config = loadNotificationConfig()
  const channels = enabledChannels(config)
  if (!channels.length) return { sent: [], failed: [], cleared: 0 }

  const data = loadReminderData()
  const { send, clear } = planNotifications({ ...data, today, renewalWarnDays: loadWarnDefaults().renewalWarnDays })
  clearLogged(clear)

  const sent = []
  const failed = []
  for (const entry of send) {
    const results = await sendToChannels(channels, config, { title: 'Odometer', message: entry.message, subject: entry.message }, deps)
    if (!results.some((result) => result.ok)) {
      failed.push({ message: entry.message, errors: results.map((result) => result.error) })
      continue
    }
    try {
      logSent(entry)
    } catch (err) {
      // The vehicle was deleted while the reminder was on its way.
      if (!/FOREIGN KEY/.test(err.message)) throw err
    }
    sent.push(entry.message)
  }
  return { sent, failed, cleared: clear.length }
}

/**
 * The weekly digest, sent once on every enabled channel.
 * @param {RunOptions} [options]
 * @returns {Promise<{ message: string | null, results: Array<{ channel: string, ok: boolean, error?: string }> }>}
 *   `message` is `null` when no channel is enabled.
 */
export async function runDigest({ today = todayISO(), deps } = {}) {
  const config = loadNotificationConfig()
  const channels = enabledChannels(config)
  if (!channels.length) return { message: null, results: [] }

  const digest = buildDigest({ ...loadReminderData(), today, renewalWarnDays: loadWarnDefaults().renewalWarnDays })
  return { message: digest.message, results: await sendToChannels(channels, config, digest, deps) }
}
