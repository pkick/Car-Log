import { useEffect, useRef, useState } from 'react'
import { useToast } from '../context/toast'
import { settingsRequest } from '../hooks/useReminderDefaults'
import { WEEKDAYS, channelErrorField, channelForm, channelPatch } from '../lib/notificationForm'
import { formatFullDate } from '../lib/renewals'
import { Button, Card, Field, Input, NumberInput, Select, Skeleton, Switch } from './ui'

const PATH = '/api/settings/notifications'

const CHANNELS = [
  { id: 'ntfy', name: 'ntfy', description: 'Push notifications through ntfy.sh or your own ntfy server.' },
  { id: 'pushover', name: 'Pushover', description: 'Push notifications through the Pushover app.' },
  { id: 'email', name: 'Email', description: 'Plain-text email through your SMTP server.' },
]

/**
 * A write-only field. A saved value shows as "Saved" with Replace (and Remove, when it's optional); the API never
 * sends the value back.
 *
 * @param {object} props
 * @param {string} props.label
 * @param {string} [props.hint]
 * @param {string} [props.error]
 * @param {import('../lib/notificationForm').SecretState} props.secret
 * @param {(secret: import('../lib/notificationForm').SecretState) => void} props.onChange
 * @param {boolean} [props.optional] offers Remove
 * @param {string} [props.placeholder]
 */
function SecretField({ label, hint, error, secret, onChange, optional = false, placeholder }) {
  const focusInput = useRef(false)
  const set = (patch) => onChange({ ...secret, ...patch })

  let aside = null
  if (secret.mode === 'saved') {
    aside = (
      <span className="flex items-center gap-3">
        <Button
          variant="link"
          size="sm"
          onClick={() => {
            focusInput.current = true
            set({ mode: 'replace', value: '' })
          }}
        >
          Replace
        </Button>
        {optional && (
          <Button variant="link-danger" size="sm" onClick={() => set({ mode: 'remove', value: '' })}>
            Remove
          </Button>
        )}
      </span>
    )
  } else if (secret.saved) {
    aside = (
      <Button variant="link-muted" size="sm" onClick={() => set({ mode: 'saved', value: '' })}>
        Keep saved
      </Button>
    )
  }

  const control =
    secret.mode === 'saved' ? (
      <Input value="Saved" disabled />
    ) : secret.mode === 'remove' ? (
      <Input value="" placeholder="Removed when you save" disabled />
    ) : (
      <Input
        ref={(el) => {
          if (el && focusInput.current) {
            el.focus()
            focusInput.current = false
          }
        }}
        type="password"
        autoComplete="new-password"
        value={secret.value}
        onChange={(e) => set({ value: e.target.value })}
        placeholder={secret.mode === 'replace' ? 'New value' : placeholder}
      />
    )

  return (
    <Field label={label} hint={secret.mode === 'replace' ? 'Leave it empty to keep the saved one.' : hint} error={error} aside={aside}>
      {control}
    </Field>
  )
}

/**
 * One channel: a switch, its settings, Save and Send test. Saving sends only this channel; Send test saves first
 * when something changed, then shows the provider's answer next to the button.
 *
 * @param {object} props
 * @param {{ id: 'ntfy' | 'pushover' | 'email', name: string, description: string }} props.channel
 * @param {object} props.settings this channel's part of `GET /api/settings/notifications`
 * @param {(settings: object) => void} props.onSaved gets the whole response after a save
 */
function ChannelCard({ channel, settings, onSaved }) {
  const toast = useToast()
  const initial = channelForm(channel.id, settings)
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})
  const [cardError, setCardError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [testResult, setTestResult] = useState(null)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)

  const setValue = (field) => (e) => {
    const { value } = e.target
    setForm((prev) => ({ ...prev, values: { ...prev.values, [field]: value } }))
    setErrors((prev) => ({ ...prev, [field]: null }))
  }
  const setSecret = (field) => (secret) => {
    setForm((prev) => ({ ...prev, secrets: { ...prev.secrets, [field]: secret } }))
    setErrors((prev) => ({ ...prev, [field]: null }))
  }
  const showError = (err) => {
    const field = channelErrorField(err, channel.id)
    if (field) setErrors({ [field]: err.message })
    else setCardError(err.message)
  }

  const save = async () => {
    setErrors({})
    setCardError(null)
    try {
      const body = await settingsRequest(PATH, { method: 'PATCH', body: JSON.stringify(channelPatch(channel.id, form)) })
      setForm(channelForm(channel.id, body[channel.id]))
      onSaved(body)
      return true
    } catch (err) {
      showError(err)
      return false
    }
  }

  const handleSave = async () => {
    setBusy('save')
    setTestResult(null)
    if (await save()) toast.success(`${channel.name} settings saved`)
    setBusy(null)
  }

  const handleTest = async () => {
    setBusy('test')
    setTestResult(null)
    if (!dirty || (await save())) {
      try {
        await settingsRequest(`${PATH}/test`, { method: 'POST', body: JSON.stringify({ channel: channel.id }) })
        setTestResult({ ok: true, message: `Test sent. Check ${channel.name} for it.` })
      } catch (err) {
        if (channelErrorField(err, channel.id)) showError(err)
        setTestResult({ ok: false, message: err.message })
      }
    }
    setBusy(null)
  }

  const text = (field, label, { hint, placeholder, className } = {}) => (
    <Field label={label} hint={hint} error={errors[field]} className={className}>
      <Input value={form.values[field]} onChange={setValue(field)} placeholder={placeholder} autoComplete="off" />
    </Field>
  )
  const secret = (field, label, options = {}) => (
    <SecretField label={label} error={errors[field]} secret={form.secrets[field]} onChange={setSecret(field)} {...options} />
  )

  return (
    <Card>
      <Switch
        label={channel.name}
        description={channel.description}
        checked={form.enabled}
        onChange={(enabled) => {
          setForm((prev) => ({ ...prev, enabled }))
          setCardError(null)
          setTestResult(null)
        }}
      />

      {form.enabled && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          {channel.id === 'ntfy' && (
            <>
              {text('server', 'Server', { hint: 'ntfy.sh, or the address of your own ntfy server.', placeholder: 'https://ntfy.sh', className: 'sm:col-span-2' })}
              {text('topic', 'Topic', { hint: 'Subscribe to it in the ntfy app. Pick one that is hard to guess.', placeholder: 'odometer-reminders' })}
              {secret('token', 'Access token', { optional: true, hint: 'Only for a protected topic.', placeholder: 'tk_…' })}
            </>
          )}
          {channel.id === 'pushover' && (
            <>
              {secret('userKey', 'User key', { hint: 'On your Pushover dashboard.' })}
              {secret('appToken', 'App token', { hint: 'Create an application at pushover.net for one.' })}
            </>
          )}
          {channel.id === 'email' && (
            <>
              {text('host', 'SMTP server', { placeholder: 'smtp.example.com', className: 'sm:col-span-2' })}
              <Field label="Port" error={errors.port}>
                <NumberInput inputMode="numeric" value={form.values.port} onChange={setValue('port')} />
              </Field>
              <Field label="Security" error={errors.tls}>
                <Select value={form.values.tls} onChange={setValue('tls')}>
                  <option value="starttls">STARTTLS (usually port 587)</option>
                  <option value="tls">TLS (usually port 465)</option>
                  <option value="none">None (a relay on your network)</option>
                </Select>
              </Field>
              {text('user', 'Username', { hint: 'Leave empty if the server needs no sign-in.' })}
              {secret('password', 'Password', { optional: true })}
              {text('from', 'From', { placeholder: 'odometer@example.com' })}
              {text('to', 'To', { placeholder: 'you@example.com', hint: 'Separate several addresses with commas.' })}
            </>
          )}
        </div>
      )}

      {(form.enabled || dirty) && (
        <div className="mt-5">
          {cardError && <p className="text-xs text-red mb-2">{cardError}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={handleSave} loading={busy === 'save'} disabled={!dirty || busy === 'test'}>
              Save
            </Button>
            {form.enabled && (
              <Button variant="ghost" size="sm" onClick={handleTest} loading={busy === 'test'} disabled={busy === 'save'}>
                Send test
              </Button>
            )}
            <p role="status" className={`text-xs ${testResult?.ok ? 'text-green' : 'text-red'}`}>
              {testResult?.message}
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}

/**
 * When the daily check runs and which day the weekly digest goes out.
 *
 * @param {object} props
 * @param {{ checkTime: string, digestDay: number | null, lastDailyRun: string | null }} props.settings
 * @param {(settings: object) => void} props.onSaved
 */
function ScheduleCard({ settings, onSaved }) {
  const toast = useToast()
  const initial = { checkTime: settings.checkTime, digestDay: settings.digestDay == null ? 'off' : String(settings.digestDay) }
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const dirty = form.checkTime !== initial.checkTime || form.digestDay !== initial.digestDay

  const handleSave = async () => {
    setSaving(true)
    setErrors({})
    try {
      const body = await settingsRequest(PATH, {
        method: 'PATCH',
        body: JSON.stringify({ checkTime: form.checkTime, digestDay: form.digestDay === 'off' ? null : Number(form.digestDay) }),
      })
      onSaved(body)
      toast.success('Schedule saved')
    } catch (err) {
      setErrors({ [err.field === 'digestDay' ? 'digestDay' : 'checkTime']: err.message })
    }
    setSaving(false)
  }

  const lastRun = settings.lastDailyRun ? ` Last ran ${formatFullDate(settings.lastDailyRun)}.` : ''

  return (
    <Card>
      <p className="text-sm font-semibold">Schedule</p>
      <p className="text-sm text-ink/50">A reminder goes out when something comes up and again if it becomes overdue.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
        <Field label="Daily check" hint={`In the server's time zone.${lastRun}`} error={errors.checkTime}>
          <Input
            type="time"
            required
            value={form.checkTime}
            onChange={(e) => {
              setForm({ ...form, checkTime: e.target.value })
              setErrors({})
            }}
          />
        </Field>
        <Field label="Weekly digest" hint="What's due, and this month's spend." error={errors.digestDay}>
          <Select value={form.digestDay} onChange={(e) => setForm({ ...form, digestDay: e.target.value })}>
            <option value="off">Off</option>
            {WEEKDAYS.map((day, index) => (
              <option key={day} value={String(index)}>
                {day}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Button size="sm" className="mt-5" onClick={handleSave} loading={saving} disabled={!dirty}>
        Save
      </Button>
    </Card>
  )
}

/**
 * Settings › Notifications: ntfy, Pushover and email reminders for services and renewals, and their schedule.
 * The server sends them (PLAN.md D15), so they arrive whether or not the app is open.
 */
export default function NotificationSettings() {
  const [settings, setSettings] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    settingsRequest(PATH).then(
      (body) => !cancelled && setSettings(body),
      (err) => !cancelled && setLoadError(err.message)
    )
    return () => {
      cancelled = true
    }
  }, [attempt])

  return (
    <section aria-labelledby="notifications-heading" className="mt-10">
      <h2 id="notifications-heading" className="text-base font-semibold">
        Notifications
      </h2>
      <p className="text-sm text-ink/50 mt-1">
        Reminders when a service or renewal is coming up, and again when it&apos;s overdue.
      </p>
      <p className="text-xs font-mono text-ink/50 mt-2">
        The server sends them, so they work over plain http:// on your network. Unlike offline mode and install, they
        don&apos;t need HTTPS.
      </p>

      {loadError ? (
        <Card className="mt-4">
          <p className="text-xs text-red">{loadError}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() => {
              setLoadError(null)
              setAttempt(attempt + 1)
            }}
          >
            Retry
          </Button>
        </Card>
      ) : !settings ? (
        <div className="space-y-4 mt-4" aria-busy="true">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : (
        <div className="space-y-4 mt-4">
          {CHANNELS.map((channel) => (
            <ChannelCard key={channel.id} channel={channel} settings={settings[channel.id]} onSaved={setSettings} />
          ))}
          <ScheduleCard settings={settings} onSaved={setSettings} />
        </div>
      )}
    </section>
  )
}
