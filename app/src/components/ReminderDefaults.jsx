import { useState } from 'react'
import { useToast } from '../context/toast'
import { saveReminderDefaults, useReminderDefaults } from '../hooks/useReminderDefaults'
import { warnForm, warnPatch } from '../lib/notificationForm'
import { Button, Card, Field, FieldGroup, NumberInput, Skeleton } from './ui'

/**
 * The warn-at inputs, once the saved values are in.
 * @param {object} props
 * @param {{ warnMiles: number, warnDays: number, renewalWarnDays: number }} props.defaults
 */
function ReminderDefaultsForm({ defaults }) {
  const toast = useToast()
  const [saved, setSaved] = useState(defaults)
  const [form, setForm] = useState(() => warnForm(defaults))
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(warnForm(saved))

  const set = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value })
    setError(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const next = await saveReminderDefaults(warnPatch(form))
      setSaved(next)
      setForm(warnForm(next))
      toast.success('Reminder defaults saved')
    } catch (err) {
      setError({ field: err.field, message: err.message })
    }
    setSaving(false)
  }

  const errorFor = (field) => (error?.field === field ? error.message : null)
  const serviceError = errorFor('warnMiles') || errorFor('warnDays')
  const otherError = error && !['warnMiles', 'warnDays', 'renewalWarnDays'].includes(error.field) ? error.message : null

  return (
    <Card className="mt-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldGroup label="Warn before a service" hint="For each new interval." error={serviceError}>
          <div className="flex items-center gap-2">
            <NumberInput
              inputMode="numeric"
              unit="mi"
              value={form.warnMiles}
              onChange={set('warnMiles')}
              aria-label="Miles before a service is due"
              aria-invalid={!!errorFor('warnMiles')}
              className="w-28"
            />
            <span className="text-xs text-ink/40">/</span>
            <NumberInput
              inputMode="numeric"
              unit="days"
              value={form.warnDays}
              onChange={set('warnDays')}
              aria-label="Days before a service is due"
              aria-invalid={!!errorFor('warnDays')}
              className="w-28"
            />
          </div>
        </FieldGroup>
        <Field label="Warn before a renewal" hint="For insurance and registration reminders." error={errorFor('renewalWarnDays')}>
          <NumberInput inputMode="numeric" unit="days" value={form.renewalWarnDays} onChange={set('renewalWarnDays')} className="w-28" />
        </Field>
      </div>
      {otherError && <p className="text-xs text-red mt-4">{otherError}</p>}
      <Button size="sm" className="mt-5" onClick={handleSave} loading={saving} disabled={!dirty}>
        Save
      </Button>
    </Card>
  )
}

/**
 * Settings › Reminder defaults: how early a new service interval warns, and how early a renewal counts as coming up
 * (for reminders; Documents and the dashboard banner still use 30 days).
 */
export default function ReminderDefaults() {
  const { status, defaults } = useReminderDefaults()

  return (
    <section aria-labelledby="reminder-defaults-heading" className="mt-10">
      <h2 id="reminder-defaults-heading" className="text-base font-semibold">
        Reminder defaults
      </h2>
      <p className="text-sm text-ink/50 mt-1">
        When something counts as coming up. Each interval keeps its own warn-at, which you can change in Edit vehicle.
      </p>
      {status === 'loading' ? (
        <Skeleton className="h-28 mt-4" />
      ) : status === 'failed' ? (
        <Card className="mt-4">
          <p className="text-xs text-red">Couldn&apos;t load the saved defaults. Reload the page to try again.</p>
        </Card>
      ) : (
        <ReminderDefaultsForm defaults={defaults} />
      )}
    </section>
  )
}
