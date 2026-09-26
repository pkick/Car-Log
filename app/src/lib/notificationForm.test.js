import { describe, expect, it } from 'vitest'
import { WEEKDAYS, channelErrorField, channelForm, channelPatch, secretPatchValue, warnForm, warnPatch } from './notificationForm'

describe('channelForm', () => {
  it('holds text as strings and marks saved secrets', () => {
    expect(channelForm('email', { enabled: true, host: 'smtp.example.com', port: 587, tls: 'starttls', user: '', hasPassword: true, from: 'a@b.co', to: 'c@d.co' })).toEqual({
      enabled: true,
      values: { host: 'smtp.example.com', port: '587', tls: 'starttls', user: '', from: 'a@b.co', to: 'c@d.co' },
      secrets: { password: { saved: true, mode: 'saved', value: '' } },
    })
  })

  it('starts a secret that was never saved as new', () => {
    expect(channelForm('pushover', { enabled: false, hasUserKey: false, hasAppToken: true }).secrets).toEqual({
      userKey: { saved: false, mode: 'new', value: '' },
      appToken: { saved: true, mode: 'saved', value: '' },
    })
  })
})

describe('secretPatchValue', () => {
  it('keeps a saved secret unless it is replaced or removed', () => {
    expect(secretPatchValue({ saved: true, mode: 'saved', value: '' })).toBeUndefined()
    expect(secretPatchValue({ saved: true, mode: 'replace', value: '' })).toBeUndefined()
    expect(secretPatchValue({ saved: true, mode: 'replace', value: '  ' })).toBeUndefined()
    expect(secretPatchValue({ saved: true, mode: 'replace', value: ' tk_new ' })).toBe('tk_new')
    expect(secretPatchValue({ saved: true, mode: 'remove', value: 'ignored' })).toBeNull()
  })

  it('sends a first secret only once something is typed', () => {
    expect(secretPatchValue({ saved: false, mode: 'new', value: '' })).toBeUndefined()
    expect(secretPatchValue({ saved: false, mode: 'new', value: 'tk_first' })).toBe('tk_first')
  })
})

describe('channelPatch', () => {
  it('sends the switch, the text fields and only the secrets that change', () => {
    const form = channelForm('ntfy', { enabled: false, server: 'https://ntfy.sh', topic: '', hasToken: true })
    form.enabled = true
    form.values.topic = 'car-reminders'

    expect(channelPatch('ntfy', form)).toEqual({ ntfy: { enabled: true, server: 'https://ntfy.sh', topic: 'car-reminders' } })

    form.secrets.token = { saved: true, mode: 'remove', value: '' }
    expect(channelPatch('ntfy', form).ntfy.token).toBeNull()
  })

  it('sends the port as a number when it is one', () => {
    const form = channelForm('email', { enabled: true, host: 'h', port: 587, tls: 'tls', user: '', hasPassword: false, from: '', to: '' })
    expect(channelPatch('email', form).email.port).toBe(587)
    expect(channelPatch('email', { ...form, values: { ...form.values, port: ' 465 ' } }).email.port).toBe(465)
    expect(channelPatch('email', { ...form, values: { ...form.values, port: 'abc' } }).email.port).toBe('abc')
    expect(channelPatch('email', { ...form, values: { ...form.values, port: '' } }).email.port).toBeNull()
  })
})

describe('channelErrorField', () => {
  it("names the card's field a server error is about", () => {
    expect(channelErrorField({ field: 'ntfy.topic' }, 'ntfy')).toBe('topic')
    expect(channelErrorField({ field: 'pushover.appToken' }, 'pushover')).toBe('appToken')
  })

  it("returns null for another card's field, the switch, or no field", () => {
    expect(channelErrorField({ field: 'email.host' }, 'ntfy')).toBeNull()
    expect(channelErrorField({ field: 'ntfy.enabled' }, 'ntfy')).toBeNull()
    expect(channelErrorField({ field: 'checkTime' }, 'ntfy')).toBeNull()
    expect(channelErrorField({}, 'ntfy')).toBeNull()
    expect(channelErrorField(null, 'ntfy')).toBeNull()
  })
})

describe('warn-at defaults', () => {
  it('round-trips through the inputs as whole numbers', () => {
    const form = warnForm({ warnMiles: 500, warnDays: 14, renewalWarnDays: 30 })
    expect(form).toEqual({ warnMiles: '500', warnDays: '14', renewalWarnDays: '30' })
    expect(warnPatch({ ...form, warnMiles: ' 1,000 ' })).toEqual({ warnMiles: 1000, warnDays: 14, renewalWarnDays: 30 })
  })

  it('passes anything else on for the server to name', () => {
    expect(warnPatch({ warnMiles: '5.5', warnDays: '', renewalWarnDays: '-3' })).toEqual({ warnMiles: '5.5', warnDays: null, renewalWarnDays: '-3' })
  })
})

it('lists weekdays from Sunday, like Date#getDay', () => {
  expect(WEEKDAYS[0]).toBe('Sunday')
  expect(WEEKDAYS[6]).toBe('Saturday')
})
