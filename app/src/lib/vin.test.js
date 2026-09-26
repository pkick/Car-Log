import { describe, expect, it } from 'vitest'
import { checkVin, decodedSummary, describeDecoded, normalizeVin, planDecodedFill, replacePrompt } from './vin'

const VALID_VINS = ['1HGCM82633A004352', '1M8GDM9AXKP042788', '11111111111111111']

const volvo = { vin: 'YV1A22AK1K1234567', year: 2019, make: 'Volvo', model: 'V60', trim: 'T5 Momentum', warnings: [] }

describe('normalizeVin', () => {
  it('trims and uppercases', () => {
    expect(normalizeVin('  1hgcm82633a004352 \n')).toBe('1HGCM82633A004352')
  })

  it('turns nothing into an empty string', () => {
    expect(normalizeVin('')).toBe('')
    expect(normalizeVin(null)).toBe('')
    expect(normalizeVin(undefined)).toBe('')
  })
})

describe('checkVin', () => {
  it('passes real VINs, including one whose check digit is X', () => {
    for (const vin of VALID_VINS) expect(checkVin(vin)).toEqual({ ok: true })
  })

  it('normalizes lowercase and padded input before checking', () => {
    expect(checkVin(' 1hgcm82633a004352 ')).toEqual({ ok: true })
    expect(checkVin('1m8gdm9axkp042788')).toEqual({ ok: true })
  })

  it('flags a mistyped character through the check digit', () => {
    const reason = "The check digit doesn't match; look for a mistyped character."
    expect(checkVin('1HGCM82643A004352')).toEqual({ ok: false, reason })
    expect(checkVin('1HGCM82633A004353')).toEqual({ ok: false, reason })
    expect(checkVin('1M8GDM9A1KP042788')).toEqual({ ok: false, reason })
  })

  it('counts the characters when the length is wrong', () => {
    expect(checkVin('1HGCM82633A00435')).toEqual({ ok: false, reason: 'A VIN has 17 characters; this one has 16.' })
    expect(checkVin('1HGCM82633A0043521')).toEqual({ ok: false, reason: 'A VIN has 17 characters; this one has 18.' })
    expect(checkVin('')).toEqual({ ok: false, reason: 'A VIN has 17 characters; this one has 0.' })
  })

  it('flags the letters I, O and Q, in either case', () => {
    const reason = 'A VIN never uses the letters I, O or Q; look for a 1 or 0 typed as a letter.'
    for (const vin of ['IHGCM82633A004352', '1HGCM8263OA004352', '1HGCM82633A00435Q', '1hgcm82633a0o4352']) {
      expect(checkVin(vin)).toEqual({ ok: false, reason })
    }
  })

  it('flags anything other than letters and digits', () => {
    for (const vin of ['1HGCM8263-A004352', '1HGCM 82633A00435', '1HGCM82633A00435!']) {
      expect(checkVin(vin)).toEqual({ ok: false, reason: 'A VIN has only letters and digits.' })
    }
  })
})

describe('planDecodedFill', () => {
  const empty = { year: '', make: '', model: '', trim: '' }

  it('fills every blank field without asking', () => {
    expect(planDecodedFill(empty, volvo)).toEqual({
      fill: { year: 2019, make: 'Volvo', model: 'V60', trim: 'T5 Momentum' },
      conflicts: [],
    })
    expect(planDecodedFill({ year: null, make: null, model: undefined, trim: '  ' }, volvo).conflicts).toEqual([])
  })

  it('asks before replacing values the user entered, in form order', () => {
    expect(planDecodedFill({ year: '2018', make: 'Volvo', model: 'XC60', trim: '' }, volvo)).toEqual({
      fill: { trim: 'T5 Momentum' },
      conflicts: ['year', 'model'],
    })
  })

  it('leaves fields that already match, ignoring case and a string year', () => {
    expect(planDecodedFill({ year: '2019', make: 'VOLVO', model: 'v60 ', trim: 'T5 Momentum' }, volvo))
      .toEqual({ fill: {}, conflicts: [] })
  })

  it('skips fields the decode left blank', () => {
    const partial = { ...volvo, year: null, trim: '' }
    expect(planDecodedFill({ year: '2018', make: '', model: '', trim: 'Inscription' }, partial)).toEqual({
      fill: { make: 'Volvo', model: 'V60' },
      conflicts: [],
    })
  })

  it('replaces values the app filled in, such as a default year or an earlier decode', () => {
    const form = { year: 2026, make: 'Honda', model: 'Accord', trim: 'EX' }
    const filled = { year: 2026, make: 'Honda', model: 'Accord' }
    expect(planDecodedFill(form, volvo, filled)).toEqual({
      fill: { year: 2019, make: 'Volvo', model: 'V60' },
      conflicts: ['trim'],
    })
  })

  it('asks once the user changes an app-filled value', () => {
    expect(planDecodedFill({ ...empty, year: '2021' }, volvo, { year: 2026 }).conflicts).toEqual(['year'])
  })
})

describe('describeDecoded', () => {
  it('joins the parts that decoded', () => {
    expect(describeDecoded(volvo)).toBe('2019 Volvo V60 T5 Momentum')
    expect(describeDecoded({ year: null, make: 'Ford', model: 'F-150', trim: '' })).toBe('Ford F-150')
  })
})

describe('decodedSummary', () => {
  it('names the vehicle', () => {
    expect(decodedSummary(volvo)).toBe('Decoded 2019 Volvo V60 T5 Momentum.')
    expect(decodedSummary({ ...volvo, warnings: undefined })).toBe('Decoded 2019 Volvo V60 T5 Momentum.')
  })

  it("adds NHTSA's warnings after a partial decode", () => {
    const partial = { ...volvo, trim: '', warnings: ['Check Digit (9th position) does not calculate properly'] }
    expect(decodedSummary(partial))
      .toBe('Decoded 2019 Volvo V60. NHTSA warns: Check Digit (9th position) does not calculate properly.')
  })
})

describe('replacePrompt', () => {
  it('lists the fields it would replace', () => {
    expect(replacePrompt(volvo, ['year', 'make', 'model']))
      .toBe('Decoded 2019 Volvo V60 T5 Momentum. Replace the year, make and model you entered?')
    expect(replacePrompt(volvo, ['model', 'trim'])).toBe('Decoded 2019 Volvo V60 T5 Momentum. Replace the model and trim you entered?')
    expect(replacePrompt(volvo, ['trim'])).toBe('Decoded 2019 Volvo V60 T5 Momentum. Replace the trim you entered?')
  })
})
