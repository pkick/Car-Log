import { Router } from 'express'
import { applyPatch, applyWarnPatch, CHANNELS, CHANNEL_NAMES, maskConfig, validateChannel, validateConfig } from '../notify/config.js'
import { ChannelError, sendToChannel } from '../notify/channels.js'
import { runDailyCheck, runDigest } from '../notify/reminders.js'
import {
  loadNotificationConfig,
  loadWarnDefaults,
  readSetting,
  saveNotificationConfig,
  saveWarnDefaults,
} from '../notify/store.js'
import { isValidDate } from '../validate.js'

const TEST_MESSAGE = 'This is a test from Odometer. Reminders about your vehicles will arrive here.'

/**
 * Passes a rejected async handler's error to Express, which version 4 doesn't do by itself.
 * @param {(req: import('express').Request, res: import('express').Response) => Promise<unknown>} handler
 * @returns {import('express').RequestHandler}
 */
const handle = (handler) => (req, res, next) => handler(req, res).catch(next)

/** The notification settings as the API returns them: secrets masked, plus when the check and digest last ran. */
const maskedSettings = () => ({
  ...maskConfig(loadNotificationConfig()),
  lastDailyRun: readSetting('lastDailyRun'),
  lastDigestRun: readSetting('lastDigestRun'),
})

/**
 * Builds the `/api/settings` router: notification channels (`/notifications`), a test send per channel, and the
 * warn-at defaults (`/defaults`). Outside production it also has `POST /notifications/run-now`, which runs the
 * daily check at once without touching the schedule; `{ digest: true }` sends the digest too, and `{ today }` runs
 * them as of another `YYYY-MM-DD`.
 * @param {object} [options]
 * @param {import('../notify/channels.js').ChannelDeps} [options.deps] how channels reach their providers; tests
 *   pass stubs
 * @returns {import('express').Router}
 */
export function createNotificationsRouter({ deps } = {}) {
  const router = Router()

  router.get('/notifications', (req, res) => {
    res.json(maskedSettings())
  })

  router.patch('/notifications', (req, res) => {
    const patched = applyPatch(loadNotificationConfig(), req.body)
    if (patched.error) return res.status(400).json(patched)
    const invalid = validateConfig(patched.config)
    if (invalid) return res.status(400).json(invalid)
    saveNotificationConfig(patched.config)
    res.json(maskedSettings())
  })

  router.post('/notifications/test', handle(async (req, res) => {
    const channel = req.body?.channel
    if (!CHANNELS.includes(channel)) return res.status(400).json({ error: 'Choose ntfy, Pushover or email.', field: 'channel' })
    const config = loadNotificationConfig()
    const invalid = validateChannel(channel, config, { complete: true })
    if (invalid) return res.status(400).json(invalid)
    try {
      await sendToChannel(channel, config, { title: 'Odometer test', message: TEST_MESSAGE }, deps)
    } catch (err) {
      if (!(err instanceof ChannelError)) throw err
      return res.status(502).json({ error: err.message })
    }
    res.json({ ok: true, channel: CHANNEL_NAMES[channel] })
  }))

  if (process.env.NODE_ENV !== 'production') {
    router.post('/notifications/run-now', handle(async (req, res) => {
      const today = isValidDate(req.body?.today) ? req.body.today : undefined
      const daily = await runDailyCheck({ today, deps })
      const digest = req.body?.digest ? await runDigest({ today, deps }) : null
      res.json({ ...daily, digest })
    }))
  }

  router.get('/defaults', (req, res) => {
    res.json(loadWarnDefaults())
  })

  router.patch('/defaults', (req, res) => {
    const patched = applyWarnPatch(loadWarnDefaults(), req.body)
    if (patched.error) return res.status(400).json(patched)
    saveWarnDefaults(patched.defaults)
    res.json(patched.defaults)
  })

  return router
}

export default createNotificationsRouter()
