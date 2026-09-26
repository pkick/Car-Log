import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  KILOMETERS_ERROR,
  LITERS_ERROR,
  checkRows,
  checkUnits,
  countStatuses,
  detectDateFormat,
  detectPreset,
  importPayload,
  importSummary,
  listSourceVehicles,
  mappingProblems,
  parseDate,
  parseNumber,
  parseRows,
  parseTankFlag,
  previewMpg,
  readCsv,
  selectRows,
} from './csvImport'
import { computeFillMpg } from './vehicleStats'

const fixture = (name) => fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
const table = (lines) => readCsv(lines.join('\n'))

/** Reads a CSV the way the import modal does with the detected preset and date format. */
function preview(text, existing = []) {
  const csv = readCsv(text)
  const preset = detectPreset(csv.headers)
  const rows = selectRows(csv.rows, preset)
  const { format } = detectDateFormat(rows.map((r) => r.cells[preset.mapping.date]))
  return { csv, preset, format, checked: checkRows(parseRows(rows, preset.mapping, { dateFormat: format }), existing) }
}

describe('readCsv', () => {
  it('reads the header and data rows, skipping blank lines and keeping file row numbers', () => {
    expect(readCsv('Date,Odometer\n2025-01-04,23114\n\n,\n2025-01-16, 23434 \n')).toEqual({
      headers: ['Date', 'Odometer'],
      rows: [
        { row: 2, cells: ['2025-01-04', '23114'] },
        { row: 5, cells: ['2025-01-16', '23434'] },
      ],
    })
  })

  it('skips title lines above the header and stops at the next # section', () => {
    const csv = readCsv('Drivvo export\n##Refuelling\nDate,Odometer,Price\n2025-03-02,48210,3.459\n##Expense\nDate,Cost\n2025-03-05,20')

    expect(csv.headers).toEqual(['Date', 'Odometer', 'Price'])
    expect(csv.rows).toEqual([{ row: 4, cells: ['2025-03-02', '48210', '3.459'] }])
  })

  it('strips a byte order mark and keeps quoted commas', () => {
    const csv = readCsv('﻿Date,Odometer,Notes\n2025-01-04,23114,"Half a tank, cash only"')

    expect(csv.headers[0]).toBe('Date')
    expect(csv.rows[0].cells[2]).toBe('Half a tank, cash only')
  })

  it('returns no headers for an empty file', () => {
    expect(readCsv('\n\n')).toEqual({ headers: [], rows: [] })
  })
})

describe('detectPreset', () => {
  it('recognizes a Fuelly export and maps its columns', () => {
    const { headers } = readCsv(fixture('fuelly-export.csv'))
    const preset = detectPreset(headers)
    const column = (name) => headers.indexOf(name)

    expect(preset.id).toBe('fuelly')
    expect(preset.label).toBe('Fuelly export')
    expect(preset.mapping).toEqual({
      date: column('fuelup_date'),
      odometer: column('odometer'),
      gallons: column('gallons'),
      pricePerGal: column('price'),
      isPartial: column('partial_fuelup'),
      station: column('brand'),
      notes: column('notes'),
    })
    expect(preset.vehicleColumn).toBe(column('car_name'))
    expect(preset.rowFilter).toBeNull()
  })

  it('recognizes a Drivvo refuelling export, with English or Portuguese headers', () => {
    const english = ['Odometer', 'Date', 'Fuel', 'Price', 'Total cost', 'Gallons', 'Full tank', 'Gas station', 'Notes']
    expect(detectPreset(english)).toMatchObject({
      id: 'drivvo',
      mapping: { odometer: 0, date: 1, pricePerGal: 3, total: 4, gallons: 5, isFull: 6, station: 7, notes: 8 },
    })

    const portuguese = ['Odômetro', 'Data', 'Combustível', 'Preço', 'Valor total', 'Tanque cheio', 'Posto', 'Observação']
    expect(detectPreset(portuguese)).toMatchObject({
      id: 'drivvo',
      mapping: { odometer: 0, date: 1, pricePerGal: 3, total: 4, isFull: 5, station: 6, notes: 7 },
    })
  })

  it("recognizes Odometer's own export and keeps only its fuel rows", () => {
    const headers = ['Type', 'Vehicle', 'Date', 'Odometer', 'Gallons', 'Price/Gal', 'Total', 'Station', 'Category',
      'Description', 'Cost', 'Performed By', 'Shop', 'Parts Used', 'Notes']
    const preset = detectPreset(headers)

    expect(preset).toEqual({
      id: 'odometer',
      label: 'Odometer export',
      mapping: { date: 2, odometer: 3, gallons: 4, pricePerGal: 5, total: 6, isFull: 9, station: 7, notes: 14 },
      rowFilter: { column: 0, equals: 'fuel' },
      vehicleColumn: 1,
    })
    const rows = [
      { row: 2, cells: ['Fuel', 'The Wagon'] },
      { row: 3, cells: ['Service', 'The Wagon'] },
      { row: 4, cells: ['FUEL', 'The Truck'] },
    ]
    expect(selectRows(rows, preset).map((r) => r.row)).toEqual([2, 4])
    expect(selectRows(rows, { ...preset, vehicle: 'The Truck' }).map((r) => r.row)).toEqual([4])
    expect(listSourceVehicles(rows, preset.vehicleColumn, preset.rowFilter))
      .toEqual([{ name: 'The Wagon', count: 1 }, { name: 'The Truck', count: 1 }])
  })

  it('maps other files by common column names, ignoring case, punctuation and units', () => {
    const preset = detectPreset(['FILL DATE', 'Odometer (mi)', 'gallons', 'price_per_gallon', 'Location', 'Comments', 'MPG'])

    expect(preset).toEqual({
      id: 'generic',
      label: null,
      mapping: { date: 0, odometer: 1, gallons: 2, pricePerGal: 3, station: 4, notes: 5 },
      rowFilter: null,
      vehicleColumn: null,
    })
  })

  it('leaves fields with no matching column unmapped', () => {
    expect(detectPreset(['When', 'Miles on the clock', 'Paid']).mapping).toEqual({ total: 2 })
  })
})

describe('checkUnits', () => {
  it('rejects a liters file: a litres column, a (L) unit or a unit column', () => {
    expect(checkUnits(readCsv(fixture('fuelly-metric.csv')))).toBe(LITERS_ERROR)
    expect(checkUnits(table(['Date,Odometer,Volume (L),Price']))).toBe(LITERS_ERROR)
    expect(checkUnits(table(['Date,Odometer,Amount,Unit', '2025-01-01,1000,30,L']))).toBe(LITERS_ERROR)
    expect(LITERS_ERROR).toBe('This file uses liters; Odometer only supports gallons and miles for now.')
  })

  it('rejects a kilometers file', () => {
    expect(checkUnits(table(['Date,Odometer (km),Gallons,Price']))).toBe(KILOMETERS_ERROR)
    expect(checkUnits(table(['Date,Odometer,Gallons,Price,Distance unit', '2025-01-01,1000,10,3.5,km']))).toBe(KILOMETERS_ERROR)
  })

  it('accepts gallons and miles, including a file that also has a liters column', () => {
    expect(checkUnits(readCsv(fixture('fuelly-export.csv')))).toBeNull()
    expect(checkUnits(readCsv(fixture('drivvo-refuelling.csv')))).toBeNull()
    expect(checkUnits(table(['Date,Odometer,Gallons,Liters,Price']))).toBeNull()
  })
})

describe('parseDate', () => {
  it('reads each format with any separator and ignores a time after the date', () => {
    expect(parseDate('2025-03-04', 'ymd')).toBe('2025-03-04')
    expect(parseDate('2025/3/4 08:30', 'ymd')).toBe('2025-03-04')
    expect(parseDate('2025-03-04T08:30:00Z', 'ymd')).toBe('2025-03-04')
    expect(parseDate('03/04/2025', 'mdy')).toBe('2025-03-04')
    expect(parseDate('3-4-25', 'mdy')).toBe('2025-03-04')
    expect(parseDate('04.03.2025', 'dmy')).toBe('2025-03-04')
  })

  it('rejects impossible dates and dates in another format', () => {
    expect(parseDate('2025-02-30', 'ymd')).toBeNull()
    expect(parseDate('2024-02-29', 'ymd')).toBe('2024-02-29')
    expect(parseDate('13/04/2025', 'mdy')).toBeNull()
    expect(parseDate('03/04/2025', 'ymd')).toBeNull()
    expect(parseDate('25-03-04', 'ymd')).toBeNull()
    expect(parseDate('Mar 4, 2025', 'mdy')).toBeNull()
    expect(parseDate('', 'ymd')).toBeNull()
  })
})

describe('detectDateFormat', () => {
  it('picks the format that reads the most values', () => {
    expect(detectDateFormat(['2025-01-04', '2025-01-16', ''])).toEqual({ format: 'ymd', ambiguous: false })
    expect(detectDateFormat(['03/02/2025 08:30', '03/15/2025 12:40'])).toEqual({ format: 'mdy', ambiguous: false })
    expect(detectDateFormat(['02/03/2025', '15/03/2025'])).toEqual({ format: 'dmy', ambiguous: false })
  })

  it('calls MM/DD against DD/MM ambiguous when every day is 12 or less, and picks MM/DD', () => {
    expect(detectDateFormat(['03/02/2025', '04/11/2025'])).toEqual({ format: 'mdy', ambiguous: true })
  })

  it('finds no format for values that are not dates', () => {
    expect(detectDateFormat(['soon', ''])).toEqual({ format: null, ambiguous: false })
  })
})

describe('parseNumber', () => {
  it('reads US numbers with currency signs and thousands separators', () => {
    expect(parseNumber('$3.459')).toBe(3.459)
    expect(parseNumber(' 84,210 ')).toBe(84210)
    expect(parseNumber('23114.0')).toBe(23114)
    expect(parseNumber('.5')).toBe(0.5)
    expect(parseNumber('12,5')).toBe(12.5)
    expect(parseNumber('-2')).toBe(-2)
  })

  it('returns null for a blank cell and NaN for anything else', () => {
    expect(parseNumber('')).toBeNull()
    expect(parseNumber(undefined)).toBeNull()
    expect(parseNumber('abc')).toBeNaN()
    expect(parseNumber('1.2.3')).toBeNaN()
  })
})

describe('parseTankFlag', () => {
  it("reads Fuelly's partial_fuelup 1 / 0", () => {
    expect(parseTankFlag('1', 'isPartial')).toBe(false)
    expect(parseTankFlag('0', 'isPartial')).toBe(true)
  })

  it("reads Drivvo's Full tank yes / no / true / false", () => {
    expect(parseTankFlag('Yes', 'isFull')).toBe(true)
    expect(parseTankFlag('no', 'isFull')).toBe(false)
    expect(parseTankFlag('TRUE', 'isFull')).toBe(true)
    expect(parseTankFlag('false', 'isFull')).toBe(false)
  })

  it("reads full / partial words, including Odometer's own Fill-up / Partial fill-up", () => {
    expect(parseTankFlag('Fill-up', 'isFull')).toBe(true)
    expect(parseTankFlag('Partial fill-up', 'isFull')).toBe(false)
    expect(parseTankFlag('partial', 'isPartial')).toBe(false)
    expect(parseTankFlag('FULL', 'isPartial')).toBe(true)
  })

  it('treats a blank cell as a full tank and anything else as unreadable', () => {
    expect(parseTankFlag('', 'isFull')).toBe(true)
    expect(parseTankFlag('', 'isPartial')).toBe(true)
    expect(parseTankFlag('maybe', 'isFull')).toBeNull()
  })
})

describe('mappingProblems', () => {
  it('asks for a date, an odometer and two of the three amounts', () => {
    expect(mappingProblems({ date: 0, odometer: 1, gallons: 2, total: 3 })).toEqual([])
    expect(mappingProblems({ gallons: 2 })).toEqual([
      'Choose the column that holds the date.',
      'Choose the column that holds the odometer reading.',
      'Choose two of gallons, price per gallon and total; the third is worked out.',
    ])
  })
})

describe('parseRows', () => {
  const mapping = { date: 0, odometer: 1, gallons: 2, pricePerGal: 3, total: 4, isFull: 5, station: 6, notes: 7 }
  const parse = (cells, overrides = {}) => parseRows([{ row: 2, cells }], { ...mapping, ...overrides }, { dateFormat: 'mdy' })[0]

  it('returns each row exactly as it will be saved', () => {
    expect(parse(['03/02/2025 08:30', '48,210.4', '13.2', '$3.459', '45.66', 'Yes', ' Shell Main St ', ''])).toEqual({
      row: 2,
      date: '2025-03-02',
      odometer: 48210,
      gallons: 13.2,
      pricePerGal: 3.459,
      total: 45.66,
      isFull: true,
      station: 'Shell Main St',
      notes: null,
    })
  })

  it('works out the third of gallons, price per gallon and total', () => {
    const cells = ['03/02/2025', '48210', '13.2', '3.459', '45.66', '', '', '']
    expect(parse(cells, { total: undefined })).toMatchObject({ gallons: 13.2, pricePerGal: 3.459, total: 45.66 })
    expect(parse(cells, { pricePerGal: undefined })).toMatchObject({ gallons: 13.2, pricePerGal: 3.459, total: 45.66 })
    expect(parse(cells, { gallons: undefined })).toMatchObject({ gallons: 13.2, pricePerGal: 3.459, total: 45.66 })
  })

  it('gives the first reason a row cannot be saved', () => {
    const reasons = [
      [['', '48210', '13', '3.5', '', '', '', ''], 'No date.'],
      [['2025-03-02', '48210', '13', '3.5', '', '', '', ''], '“2025-03-02” isn\'t a date in MM/DD/YYYY.'],
      [['03/02/2025', '', '13', '3.5', '', '', '', ''], 'No odometer reading.'],
      [['03/02/2025', 'lots', '13', '3.5', '', '', '', ''], 'Odometer “lots” isn\'t a number.'],
      [['03/02/2025', '0', '13', '3.5', '', '', '', ''], 'Odometer must be more than 0.'],
      [['03/02/2025', '48210', '-1', '3.5', '', '', '', ''], 'Gallons must be more than 0.'],
      [['03/02/2025', '48210', '13', '', '', '', '', ''], 'Needs two of gallons, price per gallon and total.'],
      [['03/02/2025', '48210', '10', '3.5', '40', '', '', ''], 'Total $40.00 doesn\'t match 10 gal at $3.5/gal ($35.00).'],
      [['03/02/2025', '48210', '10', '3.5', '', 'maybe', '', ''], 'Full tank “maybe” isn\'t yes or no.'],
      [['03/02/2025', '48210', '10', '3.5', '', '', 'x'.repeat(81), ''], 'Station must be 80 characters or fewer.'],
      [['03/02/2025', '48210', '10', '3.5', '', '', '', 'x'.repeat(1001)], 'Notes must be 1,000 characters or fewer.'],
    ]
    for (const [cells, error] of reasons) expect(parse(cells)).toEqual({ row: 2, error })
  })
})

describe('checkRows', () => {
  const fill = (row, date, odometer) => ({ row, date, odometer, gallons: 10, pricePerGal: 3.5, total: 35, isFull: true, station: null, notes: null })
  const statuses = (checked) => checked.map(({ row, status, reason }) => ({ row, status, reason }))

  it('marks rows matching a saved fill-up or an earlier row as duplicates', () => {
    const checked = checkRows(
      [fill(2, '2025-07-01', 30100), fill(3, '2025-07-09', 30420), fill(4, '2025-07-09', 30420)],
      [{ id: 7, date: '2025-07-01', odometer: 30100 }]
    )

    expect(statuses(checked)).toEqual([
      { row: 2, status: 'duplicate', reason: 'Matches your Jul 1, 2025 fill-up at 30,100 mi.' },
      { row: 3, status: 'new', reason: null },
      { row: 4, status: 'duplicate', reason: 'Same date and odometer as row 3.' },
    ])
    expect(countStatuses(checked)).toEqual({ new: 1, duplicate: 2, invalid: 0 })
  })

  it('names the saved fill-up a reading clashes with', () => {
    const existing = [{ id: 1, date: '2025-07-01', odometer: 30100 }, { id: 2, date: '2025-08-01', odometer: 31000 }]
    const checked = checkRows([fill(2, '2025-07-15', 30050), fill(3, '2025-07-20', 31200), fill(4, '2025-07-25', 30600)], existing)

    expect(statuses(checked)).toEqual([
      { row: 2, status: 'invalid', reason: 'Must be more than 30,100 mi, the reading on your Jul 1, 2025 fill-up.' },
      { row: 3, status: 'invalid', reason: 'Must be less than 31,000 mi, the reading on your Aug 1, 2025 fill-up.' },
      { row: 4, status: 'new', reason: null },
    ])
  })

  it('flags only a mistyped reading, not every row after it, naming the row it clashes with', () => {
    const checked = checkRows([
      fill(2, '2025-07-01', 30100),
      fill(3, '2025-07-09', 93420),
      fill(4, '2025-07-17', 30750),
      fill(5, '2025-07-25', 31100),
      fill(6, '2025-08-02', 29000),
    ], [])

    expect(statuses(checked)).toEqual([
      { row: 2, status: 'new', reason: null },
      { row: 3, status: 'invalid', reason: 'Must be less than 30,750 mi, the reading on row 4 (Jul 17, 2025).' },
      { row: 4, status: 'new', reason: null },
      { row: 5, status: 'new', reason: null },
      { row: 6, status: 'invalid', reason: 'Must be more than 31,100 mi, the reading on row 5 (Jul 25, 2025).' },
    ])
  })

  it('orders rows by date whatever order the file lists them in', () => {
    const checked = checkRows([fill(2, '2025-08-01', 31000), fill(3, '2025-07-01', 30100), fill(4, '2025-07-15', 30500)], [])

    expect(checked.map((c) => c.status)).toEqual(['new', 'new', 'new'])
  })

  it('puts a saved fill-up before a row on the same date, as the server does', () => {
    const checked = checkRows([fill(2, '2025-07-01', 30000), fill(3, '2025-07-01', 30200)], [{ id: 1, date: '2025-07-01', odometer: 30100 }])

    expect(statuses(checked)).toEqual([
      { row: 2, status: 'invalid', reason: 'Must be more than 30,100 mi, the reading on your Jul 1, 2025 fill-up.' },
      { row: 3, status: 'new', reason: null },
    ])
  })

  it('keeps invalid rows invalid with their reason', () => {
    expect(statuses(checkRows([{ row: 2, error: 'No date.' }], []))).toEqual([{ row: 2, status: 'invalid', reason: 'No date.' }])
  })

  it('shows a bad date and an out-of-order reading in a file as invalid with reasons', () => {
    const { checked } = preview(fixture('bad-rows.csv'))

    expect(statuses(checked)).toEqual([
      { row: 2, status: 'new', reason: null },
      { row: 3, status: 'new', reason: null },
      { row: 4, status: 'invalid', reason: '“2025-02-30” isn\'t a date in YYYY-MM-DD.' },
      { row: 5, status: 'invalid', reason: 'Must be more than 30,420 mi, the reading on row 3 (Jul 9, 2025).' },
      { row: 6, status: 'new', reason: null },
      { row: 7, status: 'duplicate', reason: 'Same date and odometer as row 6.' },
      { row: 8, status: 'new', reason: null },
    ])
  })
})

describe('Fuelly export (P4-E acceptance)', () => {
  const text = fixture('fuelly-export.csv')
  const fuellyMpg = readCsv(text).rows.map((r) => r.cells[2])

  it('imports with the MPG Fuelly showed, and importing it again adds nothing', () => {
    const first = preview(text)
    expect(first.preset.id).toBe('fuelly')
    expect(first.format).toBe('ymd')
    expect(countStatuses(first.checked)).toEqual({ new: 20, duplicate: 0, invalid: 0 })

    const payload = importPayload(first.checked)
    const serverFixture = JSON.parse(fs.readFileSync(new URL('../../../server/tests/fixtures/fuelly-import.json', import.meta.url), 'utf8'))
    expect(payload).toEqual(serverFixture)
    expect(payload.filter((f) => !f.isFull)).toHaveLength(2)

    // Saved as the server stores them, then read back the way every page computes MPG.
    const saved = payload.map((f, i) => ({ ...f, id: i + 1, vehicleId: 9 }))
    const withMpg = computeFillMpg([...saved].sort((a, b) => a.odometer - b.odometer))
    withMpg.forEach((f, i) => {
      if (i === 0 || !f.isFull) expect(f.mpg).toBeNull()
      else expect(f.mpg).toBe(Number(fuellyMpg[i]))
    })
    expect(previewMpg(first.checked, []).get(9)).toBe(29)

    const second = preview(text, saved)
    expect(countStatuses(second.checked)).toEqual({ new: 0, duplicate: 20, invalid: 0 })
    expect(importPayload(second.checked)).toEqual([])
  })
})

describe('Drivvo and Odometer exports', () => {
  it('reads a Drivvo refuelling export with times, yes / no and all three amounts', () => {
    const { preset, format, checked } = preview(fixture('drivvo-refuelling.csv'))

    expect(preset.id).toBe('drivvo')
    expect(format).toBe('mdy')
    expect(countStatuses(checked)).toEqual({ new: 6, duplicate: 0, invalid: 0 })
    expect(checked[2]).toMatchObject({
      date: '2025-03-15', odometer: 48701, gallons: 6, pricePerGal: 3.519, total: 21.11, isFull: false,
      station: 'Chevron', notes: 'Half tank, in a hurry',
    })
  })

  it("round-trips this app's own export, one vehicle's fuel rows at a time", () => {
    const csv = [
      'Type,Vehicle,Date,Odometer,Gallons,Price/Gal,Total,Station,Category,Description,Cost,Performed By,Shop,Parts Used,Notes',
      'Fuel,The Wagon,2025-07-01,30100,10.2,3.299,33.65,Shell,,Fill-up,,,,,',
      'Service,The Wagon,2025-07-03,30200,,,,,oil,Oil + filter change,60,Shop,Jiffy,,Synthetic',
      'Fuel,The Truck,2025-07-04,48000,20,3.5,70,,,Fill-up,,,,,',
      'Fuel,The Wagon,2025-07-09,30420,4.1,3.349,13.73,Costco,,Partial fill-up,,,,,"Quick, top-off"',
    ].join('\n')
    const { csv: parsed, preset } = preview(csv)
    const rows = selectRows(parsed.rows, { ...preset, vehicle: 'The Wagon' })
    const checked = checkRows(parseRows(rows, preset.mapping, { dateFormat: 'ymd' }), [])

    expect(importPayload(checked)).toEqual([
      { date: '2025-07-01', odometer: 30100, gallons: 10.2, pricePerGal: 3.299, total: 33.65, isFull: true, station: 'Shell', notes: null },
      { date: '2025-07-09', odometer: 30420, gallons: 4.1, pricePerGal: 3.349, total: 13.73, isFull: false, station: 'Costco', notes: 'Quick, top-off' },
    ])
  })
})

describe('importSummary', () => {
  it('says how many were imported and how many duplicates were skipped', () => {
    expect(importSummary(42, 3)).toEqual({ message: 'Imported 42 fill-ups', detail: '3 duplicates skipped' })
    expect(importSummary(1, 1)).toEqual({ message: 'Imported 1 fill-up', detail: '1 duplicate skipped' })
    expect(importSummary(1200, 0)).toEqual({ message: 'Imported 1,200 fill-ups', detail: undefined })
  })
})
