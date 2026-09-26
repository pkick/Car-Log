import { describe, expect, it } from 'vitest'
import { fillUpSavedDetail, paymentSavedDetail, summarizeServices } from './toastDetails'

describe('fillUpSavedDetail', () => {
  it('shows the MPG of a full tank to one decimal', () => {
    expect(fillUpSavedDetail({ isFull: true, mpg: 32.2 })).toBe('32.2 mpg')
    expect(fillUpSavedDetail({ isFull: true, mpg: 30 })).toBe('30.0 mpg')
  })

  it('says partial for a partial fill, whatever the MPG', () => {
    expect(fillUpSavedDetail({ isFull: false, mpg: null })).toBe('partial')
    expect(fillUpSavedDetail({ isFull: false, mpg: 31 })).toBe('partial')
  })

  it('has no detail for a full tank without an MPG yet', () => {
    expect(fillUpSavedDetail({ isFull: true, mpg: null })).toBeUndefined()
    expect(fillUpSavedDetail({ isFull: true })).toBeUndefined()
    expect(fillUpSavedDetail({ isFull: true, mpg: Infinity })).toBeUndefined()
  })
})

describe('summarizeServices', () => {
  it('names a single service', () => {
    expect(summarizeServices(['Oil change'])).toBe('Oil change')
  })

  it('names the first service and counts the rest', () => {
    expect(summarizeServices(['Brake pads', 'Brake fluid'])).toBe('Brake pads + 1 more')
    expect(summarizeServices(['Brake pads', 'Brake fluid', 'Rotors'])).toBe('Brake pads + 2 more')
  })

  it('has no summary without services', () => {
    expect(summarizeServices([])).toBeUndefined()
    expect(summarizeServices(undefined)).toBeUndefined()
  })
})

describe('paymentSavedDetail', () => {
  it('names the type and the cost in dollars and cents', () => {
    expect(paymentSavedDetail({ type: 'insurance', cost: 612 })).toBe('Insurance $612.00')
    expect(paymentSavedDetail({ type: 'registration', cost: 89.5 })).toBe('Registration $89.50')
  })

  it('falls back to Payment for an unknown type', () => {
    expect(paymentSavedDetail({ type: 'other', cost: 10 })).toBe('Payment $10.00')
  })
})
