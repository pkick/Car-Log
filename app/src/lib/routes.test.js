import { describe, expect, it } from 'vitest'
import { VEHICLE_SECTIONS, findVehicle, tracksSection, vehiclePath } from './routes'

const everything = { id: 1, tracksFuel: true, tracksService: true }
const serviceOnly = { id: 2, tracksFuel: false, tracksService: true }
const fuelOnly = { id: 3, tracksFuel: true, tracksService: false }

describe('tracksSection', () => {
  it('shows every section when the vehicle tracks fuel and service', () => {
    expect(VEHICLE_SECTIONS.every((section) => tracksSection(everything, section))).toBe(true)
  })

  it('treats missing flags as tracked, like the rest of the app', () => {
    expect(VEHICLE_SECTIONS.every((section) => tracksSection({ id: 4 }, section))).toBe(true)
  })

  it('hides Fuel and Trends without fuel tracking', () => {
    expect(VEHICLE_SECTIONS.filter((section) => tracksSection(serviceOnly, section))).toEqual([
      'overview',
      'maintenance',
      'documents',
    ])
  })

  it('hides Maintenance without service tracking', () => {
    expect(VEHICLE_SECTIONS.filter((section) => tracksSection(fuelOnly, section))).toEqual([
      'overview',
      'fuel',
      'documents',
      'trends',
    ])
  })

  it('rejects anything that is not a section', () => {
    expect(tracksSection(everything, 'garage')).toBe(false)
    expect(tracksSection(everything, '')).toBe(false)
    expect(tracksSection(everything, undefined)).toBe(false)
  })
})

describe('vehiclePath', () => {
  it('defaults to the overview', () => {
    expect(vehiclePath(everything)).toBe('/v/1/overview')
  })

  it('keeps a section the vehicle tracks', () => {
    expect(vehiclePath(everything, 'trends')).toBe('/v/1/trends')
    expect(vehiclePath(serviceOnly, 'maintenance')).toBe('/v/2/maintenance')
  })

  it('falls back to the overview for a section the vehicle does not track', () => {
    expect(vehiclePath(serviceOnly, 'trends')).toBe('/v/2/overview')
    expect(vehiclePath(serviceOnly, 'fuel')).toBe('/v/2/overview')
    expect(vehiclePath(fuelOnly, 'maintenance')).toBe('/v/3/overview')
  })

  it('falls back to the overview for an unknown section', () => {
    expect(vehiclePath(everything, 'nope')).toBe('/v/1/overview')
  })
})

describe('findVehicle', () => {
  const vehicles = [everything, serviceOnly]

  it('finds the vehicle a URL segment names', () => {
    expect(findVehicle(vehicles, '2')).toBe(serviceOnly)
  })

  it('finds nothing for an unknown, malformed or missing id', () => {
    expect(findVehicle(vehicles, '999')).toBeUndefined()
    expect(findVehicle(vehicles, '02')).toBeUndefined()
    expect(findVehicle(vehicles, '2x')).toBeUndefined()
    expect(findVehicle(vehicles, undefined)).toBeUndefined()
  })
})
