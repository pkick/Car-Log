import { describe, expect, it } from 'vitest'
import { buildCsv } from './exportCsv'
import { checkRows, detectPreset, importPayload, parseRows, readCsv, selectRows } from './csvImport'

const vehicles = [{ id: 1, nickname: 'The Wagon' }, { id: 2, nickname: 'The Truck' }]
const fillUps = [
  { id: 1, vehicleId: 1, date: '2026-07-09', odometer: 30420, gallons: 4.1, pricePerGal: 3.349, total: 13.73, isFull: false, station: 'Costco', notes: 'Quick, "top-off"' },
  { id: 2, vehicleId: 1, date: '2026-07-01', odometer: 30100, gallons: 10.2, pricePerGal: 3.299, total: 33.65, isFull: true, station: null, notes: null },
  { id: 3, vehicleId: 2, date: '2026-07-04', odometer: 48000, gallons: 20, pricePerGal: 3.5, total: 70, isFull: true, station: 'Shell', notes: 'Two\nlines' },
]
const serviceRecords = [
  { id: 1, vehicleId: 1, date: '2026-07-03', odometer: 30200, categoryId: 'oil', services: ['Oil + filter change', 'Tire rotation'], cost: 60, performedBy: 'Shop', shopName: 'Jiffy', partsUsed: '', notes: 'Synthetic' },
]

describe('buildCsv', () => {
  it('writes fill-ups with their station and notes and service records, oldest first', () => {
    const lines = buildCsv(vehicles, fillUps.slice(0, 2), serviceRecords).split('\n')

    expect(lines).toEqual([
      'Type,Vehicle,Date,Odometer,Gallons,Price/Gal,Total,Station,Category,Description,Cost,Performed By,Shop,Parts Used,Notes',
      'Fuel,The Wagon,2026-07-01,30100,10.2,3.299,33.65,,,Fill-up,,,,,',
      'Service,The Wagon,2026-07-03,30200,,,,,oil,Oil + filter change; Tire rotation,60,Shop,Jiffy,,Synthetic',
      'Fuel,The Wagon,2026-07-09,30420,4.1,3.349,13.73,Costco,,Partial fill-up,,,,,"Quick, ""top-off"""',
    ])
  })

  it("reads back through the CSV import as the same fill-ups, one vehicle's at a time", () => {
    const csv = readCsv(buildCsv(vehicles, fillUps, serviceRecords))
    const preset = detectPreset(csv.headers)
    expect(preset.id).toBe('odometer')

    const imported = (vehicle) => {
      const rows = selectRows(csv.rows, { ...preset, vehicle })
      return importPayload(checkRows(parseRows(rows, preset.mapping, { dateFormat: 'ymd' }), []))
    }
    const fields = ['date', 'odometer', 'gallons', 'pricePerGal', 'total', 'isFull', 'station', 'notes']
    const strip = (fill) => Object.fromEntries(fields.map((field) => [field, fill[field]]))

    expect(imported('The Wagon')).toEqual([fillUps[1], fillUps[0]].map(strip))
    expect(imported('The Truck')).toEqual([strip(fillUps[2])])
  })
})
