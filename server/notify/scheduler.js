import { todayISO } from '../../shared/dates.js'
import { enabledChannels } from './config.js'
import { runDailyCheck, runDigest } from './reminders.js'
import { loadNotificationConfig, readSetting, writeSetting } from './store.js'

// Reminders run inside the API process on a one-minute timer (PLAN.md D15). Each tick asks whether today's daily
// check (and, on the digest day, the digest) is due; the day each last ran is kept in `settings`, so a restart
// neither repeats nor skips one.

/**
 * @param {string} time `HH:MM`
 * @returns {number} minutes after midnight
 */
const minutesOf = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

/**
 * Whether the daily check and the weekly digest are due at `now`: the check time has passed today, in the
 * server's time zone, and neither has run today. The digest is due only on its weekday, and runs after the check.
 * @param {object} state
 * @param {Date} state.now
 * @param {string} state.checkTime `HH:MM`
 * @param {number | null} state.digestDay 0 (Sunday) to 6, or `null` when the digest is off
 * @param {string | null} state.lastDailyRun `YYYY-MM-DD` the check last ran, or `null` if it never has
 * @param {string | null} state.lastDigestRun `YYYY-MM-DD` the digest last went out, or `null`
 * @returns {{ today: string, daily: boolean, digest: boolean }}
 */
export function dueRuns({ now, checkTime, digestDay, lastDailyRun, lastDigestRun }) {
  const today = todayISO(now)
  const timeReached = now.getHours() * 60 + now.getMinutes() >= minutesOf(checkTime)
  const notYet = (last) => typeof last !== 'string' || last < today
  return {
    today,
    daily: timeReached && notYet(lastDailyRun),
    digest: timeReached && digestDay != null && now.getDay() === digestDay && notYet(lastDigestRun),
  }
}

/**
 * The reminder timer. `start` ticks at once and then every `intervalMs`; a tick does nothing while no channel is
 * enabled, and skips while the previous one is still sending. The day is marked as run before sending, so a crash
 * mid-send never sends twice.
 * @param {object} [options]
 * @param {() => Date} [options.now] the clock
 * @param {number} [options.intervalMs]
 * @param {(options: { today: string }) => Promise<unknown>} [options.runDaily]
 * @param {(options: { today: string }) => Promise<unknown>} [options.runWeekly]
 * @param {(err: Error) => void} [options.onError]
 * @returns {{ start: () => void, stop: () => void, tick: () => Promise<{ today: string, daily: boolean, digest: boolean } | null> }}
 *   `tick` resolves to what it ran, or `null` when nothing is enabled or it failed.
 */
export function createScheduler({
  now = () => new Date(),
  intervalMs = 60000,
  runDaily = runDailyCheck,
  runWeekly = runDigest,
  onError = (err) => console.error('Odometer reminders failed:', err),
} = {}) {
  let timer = null
  let running = null

  async function run() {
    const config = loadNotificationConfig()
    if (!enabledChannels(config).length) return null
    const due = dueRuns({
      now: now(),
      checkTime: config.checkTime,
      digestDay: config.digestDay,
      lastDailyRun: readSetting('lastDailyRun'),
      lastDigestRun: readSetting('lastDigestRun'),
    })
    if (due.daily) {
      writeSetting('lastDailyRun', due.today)
      await runDaily({ today: due.today })
    }
    if (due.digest) {
      writeSetting('lastDigestRun', due.today)
      await runWeekly({ today: due.today })
    }
    return due
  }

  function tick() {
    running ??= run()
      .catch((err) => {
        onError(err)
        return null
      })
      .finally(() => {
        running = null
      })
    return running
  }

  return {
    start() {
      if (timer) return
      timer = setInterval(tick, intervalMs)
      timer.unref()
      tick()
    },
    stop() {
      clearInterval(timer)
      timer = null
    },
    tick,
  }
}
