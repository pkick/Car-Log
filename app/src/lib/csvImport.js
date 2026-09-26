// CSV import of fill-ups (P4-E): reading the file, recognizing Fuelly, Drivvo and Odometer's own export, turning
// rows into fill-ups exactly as they'll be saved, and checking them against the vehicle's fill-ups before anything
// is sent. The server runs the same checks again (`POST /api/import/fill-ups`); these let the preview show them.

import Papa from 'papaparse'
import { parseISODate } from './dates'
import { computeFillMpg } from './vehicleStats'

/** The most fill-ups one import may send (the server's limit). */
export const MAX_IMPORT_ROWS = 5000
export const STATION_MAX_LENGTH = 80
export const NOTES_MAX_LENGTH = 1000

/**
 * @typedef {'date' | 'odometer' | 'gallons' | 'pricePerGal' | 'total' | 'isFull' | 'isPartial' | 'station' | 'notes'} ImportField
 *   `isFull` reads a column where yes means a full tank; `isPartial` one where yes means a partial fill.
 * @typedef {Partial<Record<ImportField, number>>} ColumnMapping The column index each field is read from.
 * @typedef {'ymd' | 'mdy' | 'dmy'} DateFormat
 * @typedef {{ row: number, cells: string[] }} CsvRow `row` is the 1-based row number in the file, as a
 *   spreadsheet shows it.
 * @typedef {{ headers: string[], rows: CsvRow[] }} CsvTable
 * @typedef {{ column: number, equals: string }} RowFilter Keeps rows whose cell in `column` is `equals`, ignoring case.
 * @typedef {object} Preset
 * @property {'odometer' | 'fuelly' | 'drivvo' | 'generic'} id
 * @property {string | null} label e.g. `Fuelly export`; `null` when the columns were matched by name only.
 * @property {ColumnMapping} mapping
 * @property {RowFilter | null} rowFilter Rows that aren't fill-ups (the service rows of an Odometer export).
 * @property {number | null} vehicleColumn The column naming each row's vehicle, when the file has one.
 * @typedef {object} ImportedFillUp A row as it will be saved.
 * @property {number} row
 * @property {string} date `YYYY-MM-DD`
 * @property {number} odometer
 * @property {number} gallons
 * @property {number} pricePerGal
 * @property {number} total
 * @property {boolean} isFull
 * @property {string | null} station
 * @property {string | null} notes
 * @typedef {ImportedFillUp | { row: number, error: string }} ParsedRow
 * @typedef {(ImportedFillUp | { row: number, error: string }) & {
 *   status: 'new' | 'duplicate' | 'invalid',
 *   reason: string | null,
 * }} CheckedRow `reason` says why a row is skipped or invalid; `null` for a new row.
 */

/** The fields a column can be mapped to, in the order the mapping step lists them. */
export const IMPORT_FIELDS = [
  { value: 'date', label: 'Date' },
  { value: 'odometer', label: 'Odometer' },
  { value: 'gallons', label: 'Gallons' },
  { value: 'pricePerGal', label: 'Price per gallon' },
  { value: 'total', label: 'Total' },
  { value: 'isFull', label: 'Full tank (yes/no)' },
  { value: 'isPartial', label: 'Partial (yes/no)' },
  { value: 'station', label: 'Station' },
  { value: 'notes', label: 'Notes' },
]

/** @type {Array<{ value: DateFormat, label: string }>} */
export const DATE_FORMATS = [
  { value: 'ymd', label: 'YYYY-MM-DD' },
  { value: 'mdy', label: 'MM/DD/YYYY' },
  { value: 'dmy', label: 'DD/MM/YYYY' },
]

export const LITERS_ERROR = 'This file uses liters; Odometer only supports gallons and miles for now.'
export const KILOMETERS_ERROR = 'This file uses kilometers; Odometer only supports gallons and miles for now.'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** @param {string} iso `YYYY-MM-DD` @returns {string} `Mar 3, 2025`, as the server's messages write dates. */
function formatDate(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  return `${MONTHS[month - 1]} ${day}, ${year}`
}

/** @param {number} odometer @returns {string} `84,210 mi` */
const formatMiles = (odometer) => `${odometer.toLocaleString('en-US')} mi`

/** @param {number} value @returns {string} `$45.10` */
const formatMoney = (value) => `$${value.toFixed(2)}`

const round = (value, places) => Math.round(value * 10 ** places) / 10 ** places

/**
 * Lowercases a header or value and drops accents and punctuation, so `Price/Gal`, `price_gal` and `PRICE GAL` all
 * read `price gal`, and `Odômetro` reads `odometro`.
 * @param {string} text
 * @param {{ keepParentheses?: boolean }} [options] By default a parenthetical such as `(mi)` is dropped.
 * @returns {string}
 */
export function normalizeName(text, { keepParentheses = false } = {}) {
  const plain = String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return (keepParentheses ? plain : plain.replace(/\([^)]*\)/g, ' ')).replace(/[^a-z0-9]+/g, ' ').trim()
}

const DATE_HEADERS = ['date', 'fuelup date', 'fill date', 'fillup date', 'fill up date', 'fuel date', 'data', 'day']
const ODOMETER_HEADERS = ['odometer', 'odo', 'odometer reading', 'odometro', 'reading']
const VEHICLE_HEADERS = ['vehicle', 'car name', 'car', 'vehicle name', 'veiculo']

const looksLikeHeader = (cells) => {
  const names = cells.map((cell) => normalizeName(cell))
  return names.some((name) => DATE_HEADERS.includes(name)) && names.some((name) => ODOMETER_HEADERS.includes(name))
}

/**
 * Parses CSV text into a header row and data rows. Blank rows are skipped. The header row is the first row (of the
 * first 10) naming a date and an odometer column, so title lines above it are ignored; without one it's the first
 * row. A later row holding a single `#` title starts another section of the file and ends the table.
 * @param {string} text The file's contents.
 * @returns {CsvTable} Cells are trimmed; `headers` is empty for a file with no rows.
 */
export function readCsv(text) {
  const { data } = Papa.parse(String(text).replace(/^﻿/, ''), { skipEmptyLines: false })
  const records = data
    .map((cells, index) => ({ row: index + 1, cells: cells.map((cell) => String(cell ?? '').trim()) }))
    .filter(({ cells }) => cells.some((cell) => cell !== ''))
  if (records.length === 0) return { headers: [], rows: [] }

  const found = records.slice(0, 10).findIndex(({ cells }) => looksLikeHeader(cells))
  const headerAt = Math.max(found, 0)
  const rows = []
  for (const record of records.slice(headerAt + 1)) {
    const filled = record.cells.filter((cell) => cell !== '')
    if (filled.length === 1 && filled[0].startsWith('#')) break
    rows.push(record)
  }
  return { headers: records[headerAt].cells, rows }
}

const LITER_WORDS = ['l', 'liter', 'liters', 'litre', 'litres', 'litro', 'litros', 'kpl']
const GALLON_WORDS = ['gal', 'gals', 'gallon', 'gallons', 'mpg']
const KILOMETER_WORDS = ['km', 'kms', 'kilometer', 'kilometers', 'kilometre', 'kilometres', 'quilometros', '100km', 'kph']
const MILE_WORDS = ['mi', 'mile', 'miles', 'mpg', 'milhas']
const UNIT_HEADERS = ['unit', 'units', 'volume unit', 'fuel unit', 'distance unit', 'odometer unit', 'unidade']

/**
 * Checks that a file records gallons and miles, the only units Odometer supports so far. A file uses liters when a
 * header names them (`litres`, `Volume (L)`, `l/100km`) and none names gallons, or a unit column says so; likewise
 * kilometers.
 * @param {CsvTable} table
 * @returns {string | null} {@link LITERS_ERROR} or {@link KILOMETERS_ERROR}, or `null` when the units are fine.
 */
export function checkUnits({ headers, rows }) {
  const words = new Set(headers.flatMap((header) => normalizeName(header, { keepParentheses: true }).split(' ')))
  const unitColumns = headers
    .map((header, index) => (UNIT_HEADERS.includes(normalizeName(header)) ? index : -1))
    .filter((index) => index !== -1)
  for (const { cells } of rows) {
    for (const index of unitColumns) {
      for (const word of normalizeName(cells[index]).split(' ')) words.add(word)
    }
  }
  const has = (list) => list.some((word) => words.has(word))
  if (has(LITER_WORDS) && !has(GALLON_WORDS)) return LITERS_ERROR
  if (has(KILOMETER_WORDS) && !has(MILE_WORDS)) return KILOMETERS_ERROR
  return null
}

/**
 * Header names (normalized) each preset reads a field from, best match first.
 * @typedef {{ id: Preset['id'], label: string | null, matches: (names: string[]) => boolean,
 *   aliases: Partial<Record<ImportField, string[]>>, rowFilter?: { header: string, equals: string } }} PresetDefinition
 */

/** @type {PresetDefinition[]} */
const PRESETS = [
  {
    id: 'odometer',
    label: 'Odometer export',
    matches: (names) => ['type', 'vehicle', 'price gal', 'description'].every((name) => names.includes(name)),
    aliases: {
      date: ['date'],
      odometer: ['odometer'],
      gallons: ['gallons'],
      pricePerGal: ['price gal'],
      total: ['total'],
      isFull: ['description'],
      station: ['station'],
      notes: ['notes'],
    },
    rowFilter: { header: 'type', equals: 'fuel' },
  },
  {
    id: 'fuelly',
    label: 'Fuelly export',
    matches: (names) => names.includes('fuelup date') || (names.includes('partial fuelup') && names.includes('odometer')),
    aliases: {
      date: ['fuelup date', 'date'],
      odometer: ['odometer'],
      gallons: ['gallons', 'gal'],
      pricePerGal: ['price', 'price per gallon', 'ppg'],
      total: ['total', 'total price', 'total cost'],
      isPartial: ['partial fuelup', 'partial'],
      station: ['brand', 'station'],
      notes: ['notes', 'note'],
    },
  },
  {
    id: 'drivvo',
    label: 'Drivvo export',
    matches: (names) => ['full tank', 'gas station', 'total cost', 'tanque cheio', 'posto', 'valor total']
      .filter((name) => names.includes(name)).length >= 2,
    aliases: {
      date: ['date', 'data'],
      odometer: ['odometer', 'odometro'],
      gallons: ['gallons', 'gallon', 'gal', 'volume', 'quantity'],
      pricePerGal: ['price', 'fuel price', 'price per gallon', 'unit price', 'preco'],
      total: ['total cost', 'total', 'valor total', 'custo total'],
      isFull: ['full tank', 'tank full', 'tanque cheio'],
      station: ['gas station', 'station', 'posto', 'posto de combustivel'],
      notes: ['notes', 'note', 'observation', 'observations', 'observacao', 'observacoes', 'notas'],
    },
  },
]

/** @type {PresetDefinition} */
const GENERIC = {
  id: 'generic',
  label: null,
  matches: () => true,
  aliases: {
    date: DATE_HEADERS,
    odometer: ODOMETER_HEADERS,
    gallons: ['gallons', 'gal', 'gallons pumped', 'volume', 'quantity'],
    pricePerGal: ['price per gallon', 'price gal', 'price per gal', 'ppg', 'unit price', 'cost per gallon', 'price'],
    total: ['total', 'total cost', 'total price', 'total paid', 'amount', 'amount paid', 'cost', 'paid'],
    isFull: ['full', 'full tank', 'filled up', 'fill type', 'tank'],
    isPartial: ['partial', 'partial fill', 'partial fillup', 'partial fill up', 'partial fuelup'],
    station: ['station', 'gas station', 'fuel station', 'location', 'brand', 'vendor'],
    notes: ['notes', 'note', 'comment', 'comments', 'memo'],
  },
}

/**
 * Recognizes a Fuelly export, a Drivvo refuelling export or Odometer's own CSV by its headers, ignoring case, accents
 * and punctuation, and maps each field to its column. Any other file gets columns mapped by common names.
 * @param {string[]} headers The file's header row.
 * @returns {Preset} Fields with no matching column are left out of `mapping`.
 */
export function detectPreset(headers) {
  const names = headers.map((header) => normalizeName(header))
  const preset = PRESETS.find((candidate) => candidate.matches(names)) ?? GENERIC

  const used = new Set()
  const mapping = {}
  for (const { value: field } of IMPORT_FIELDS) {
    for (const alias of preset.aliases[field] ?? []) {
      const index = names.findIndex((name, i) => name === alias && !used.has(i))
      if (index !== -1) {
        mapping[field] = index
        used.add(index)
        break
      }
    }
  }

  const filterColumn = preset.rowFilter ? names.indexOf(preset.rowFilter.header) : -1
  const vehicleColumn = names.findIndex((name) => VEHICLE_HEADERS.includes(name))
  return {
    id: preset.id,
    label: preset.label,
    mapping,
    rowFilter: filterColumn === -1 ? null : { column: filterColumn, equals: preset.rowFilter.equals },
    vehicleColumn: vehicleColumn === -1 ? null : vehicleColumn,
  }
}

/**
 * The vehicle names in a file's vehicle column, for picking whose rows to import.
 * @param {CsvRow[]} rows
 * @param {number | null} vehicleColumn
 * @param {RowFilter | null} [rowFilter] Only rows it keeps are counted.
 * @returns {Array<{ name: string, count: number }>} In order of first appearance; blank names are left out.
 */
export function listSourceVehicles(rows, vehicleColumn, rowFilter = null) {
  if (vehicleColumn == null) return []
  const counts = new Map()
  for (const { cells } of selectRows(rows, { rowFilter })) {
    const name = cells[vehicleColumn] ?? ''
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts].map(([name, count]) => ({ name, count }))
}

/**
 * The rows to import: those `rowFilter` keeps and, when `vehicle` is given, whose vehicle column holds that name.
 * @param {CsvRow[]} rows
 * @param {{ rowFilter?: RowFilter | null, vehicleColumn?: number | null, vehicle?: string | null }} [options]
 * @returns {CsvRow[]}
 */
export function selectRows(rows, { rowFilter = null, vehicleColumn = null, vehicle = null } = {}) {
  return rows.filter(({ cells }) => (
    (!rowFilter || (cells[rowFilter.column] ?? '').toLowerCase() === rowFilter.equals) &&
    (vehicleColumn == null || vehicle == null || (cells[vehicleColumn] ?? '') === vehicle)
  ))
}

const pad = (n) => String(n).padStart(2, '0')

/**
 * Reads a date in the given format. A time after the date (`2025-03-14 08:30`, `2025-03-14T08:30:00`) is ignored;
 * `-`, `/` and `.` all separate the parts, and a two-digit year is in the 2000s.
 * @param {string} value
 * @param {DateFormat} format
 * @returns {string | null} `YYYY-MM-DD`, or `null` unless it's a real date in that format.
 */
export function parseDate(value, format) {
  const datePart = String(value ?? '').trim().split(/[\sT]/)[0]
  const parts = datePart.split(/[-/.]/)
  if (parts.length !== 3 || !parts.every((part) => /^\d+$/.test(part))) return null
  const [year, month, day] = { ymd: [0, 1, 2], mdy: [2, 0, 1], dmy: [2, 1, 0] }[format].map((i) => parts[i])
  if (month.length > 2 || day.length > 2 || (year.length !== 4 && year.length !== 2)) return null
  if (format === 'ymd' && year.length !== 4) return null
  const iso = `${year.length === 2 ? `20${year}` : year}-${pad(month)}-${pad(day)}`
  return parseISODate(iso) ? iso : null
}

/**
 * Picks the date format that reads the most values. When MM/DD and DD/MM read them equally (every day is 12 or
 * less), it's MM/DD/YYYY and `ambiguous`.
 * @param {string[]} values A column's cells.
 * @returns {{ format: DateFormat | null, ambiguous: boolean }} `format` is `null` when no format reads any value.
 */
export function detectDateFormat(values) {
  const filled = values.filter((value) => String(value ?? '').trim() !== '')
  const count = (format) => filled.filter((value) => parseDate(value, format)).length
  const ymd = count('ymd')
  const mdy = count('mdy')
  const dmy = count('dmy')
  const best = Math.max(ymd, mdy, dmy)
  if (best === 0) return { format: null, ambiguous: false }
  if (ymd === best) return { format: 'ymd', ambiguous: false }
  if (dmy > mdy) return { format: 'dmy', ambiguous: false }
  return { format: 'mdy', ambiguous: mdy === dmy }
}

/**
 * Reads a number written the US way: `$3.459`, `1,234.5`, ` 12 `. A comma followed by one or two digits
 * (`12,5`) is taken as a decimal comma.
 * @param {string} value
 * @returns {number | null} `null` for a blank cell, `NaN` for anything that isn't a number.
 */
export function parseNumber(value) {
  let text = String(value ?? '').replace(/[$€£\s]/g, '')
  if (text === '') return null
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) text = text.replace(/,/g, '')
  else if (/^-?\d+,\d{1,2}$/.test(text)) text = text.replace(',', '.')
  return /^-?(\d+\.?\d*|\.\d+)$/.test(text) ? Number(text) : NaN
}

const YES = ['1', 'yes', 'y', 'true', 't', 'x', 'sim', 's']
const NO = ['0', 'no', 'n', 'false', 'f', 'nao']
const FULL_WORDS = ['full', 'fill up', 'fillup', 'full tank', 'full fill up', 'cheio']
const PARTIAL_WORDS = ['partial', 'partial fill up', 'partial fillup', 'partial fill', 'parcial']

/**
 * Reads a full / partial cell: `full` / `partial` (and Odometer's `Fill-up` / `Partial fill-up`) mean what they say;
 * yes / no, true / false and 1 / 0 depend on the column, full for `isFull`, partial for `isPartial`. A blank cell is a
 * full tank, as a new fill-up is by default.
 * @param {string} value
 * @param {'isFull' | 'isPartial'} field
 * @returns {boolean | null} Whether the tank was filled, or `null` when the cell can't be read.
 */
export function parseTankFlag(value, field) {
  const text = normalizeName(value)
  if (text === '') return true
  if (FULL_WORDS.includes(text)) return true
  if (PARTIAL_WORDS.includes(text)) return false
  const yes = YES.includes(text)
  if (!yes && !NO.includes(text)) return null
  return field === 'isFull' ? yes : !yes
}

/**
 * What's missing from a mapping before rows can be read.
 * @param {ColumnMapping} mapping
 * @returns {string[]} One sentence per problem; empty when the mapping is complete.
 */
export function mappingProblems(mapping) {
  const problems = []
  if (mapping.date == null) problems.push('Choose the column that holds the date.')
  if (mapping.odometer == null) problems.push('Choose the column that holds the odometer reading.')
  if (['gallons', 'pricePerGal', 'total'].filter((field) => mapping[field] != null).length < 2) {
    problems.push('Choose two of gallons, price per gallon and total; the third is worked out.')
  }
  return problems
}

/**
 * @param {string} label e.g. `Gallons`.
 * @param {string} raw The cell.
 * @returns {{ value: number | null } | { error: string }} A positive number, `null` for a blank cell, or why not.
 */
function positiveNumber(label, raw) {
  const value = parseNumber(raw)
  if (value === null) return { value: null }
  if (Number.isNaN(value)) return { error: `${label} “${raw}” isn't a number.` }
  if (value <= 0) return { error: `${label} must be more than 0.` }
  return { value }
}

/**
 * Works out gallons, price per gallon and total from any two of them. Gallons and price keep 3 decimals, the
 * total 2. With all three, the total must be gallons × price give or take rounding (5 cents, or 1% of a large total).
 * @param {{ gallons: number | null, pricePerGal: number | null, total: number | null }} amounts
 * @returns {{ gallons: number, pricePerGal: number, total: number } | { error: string }}
 */
function solveAmounts({ gallons, pricePerGal, total }) {
  const known = [gallons, pricePerGal, total].filter((value) => value != null).length
  if (known < 2) return { error: 'Needs two of gallons, price per gallon and total.' }
  const g = gallons != null ? round(gallons, 3) : round(total / pricePerGal, 3)
  const p = pricePerGal != null ? round(pricePerGal, 3) : round(total / gallons, 3)
  const t = total != null ? round(total, 2) : round(g * p, 2)
  if (known === 3 && Math.abs(t - g * p) > Math.max(0.05, t * 0.01)) {
    return { error: `Total ${formatMoney(t)} doesn't match ${g} gal at $${p}/gal (${formatMoney(g * p)}).` }
  }
  return { gallons: g, pricePerGal: p, total: t }
}

/**
 * @param {string} raw
 * @param {string} label
 * @param {number} max
 * @returns {{ value: string | null } | { error: string }}
 */
function optionalText(raw, label, max) {
  const value = String(raw ?? '').trim()
  if (value.length > max) return { error: `${label} must be ${max.toLocaleString('en-US')} characters or fewer.` }
  return { value: value || null }
}

/**
 * Turns one CSV row into the fill-up it will be saved as, or the first reason it can't be.
 * @param {CsvRow} csvRow
 * @param {ColumnMapping} mapping
 * @param {DateFormat} dateFormat
 * @returns {ParsedRow}
 */
function parseRow({ row, cells }, mapping, dateFormat) {
  const cell = (field) => (mapping[field] == null ? '' : cells[mapping[field]] ?? '')
  const fail = (error) => ({ row, error })

  const rawDate = cell('date')
  if (!rawDate) return fail('No date.')
  const date = parseDate(rawDate, dateFormat)
  if (!date) {
    return fail(`“${rawDate}” isn't a date in ${DATE_FORMATS.find((f) => f.value === dateFormat)?.label ?? dateFormat}.`)
  }

  const reading = positiveNumber('Odometer', cell('odometer'))
  if (reading.error) return fail(reading.error)
  if (reading.value === null) return fail('No odometer reading.')

  const amounts = {}
  for (const [field, label] of [['gallons', 'Gallons'], ['pricePerGal', 'Price per gallon'], ['total', 'Total']]) {
    const parsed = positiveNumber(label, cell(field))
    if (parsed.error) return fail(parsed.error)
    amounts[field] = parsed.value
  }
  const solved = solveAmounts(amounts)
  if (solved.error) return fail(solved.error)

  const flagField = mapping.isFull != null ? 'isFull' : 'isPartial'
  const isFull = parseTankFlag(cell(flagField), flagField)
  if (isFull === null) {
    return fail(`${flagField === 'isFull' ? 'Full tank' : 'Partial'} “${cell(flagField)}” isn't yes or no.`)
  }

  const station = optionalText(cell('station'), 'Station', STATION_MAX_LENGTH)
  if (station.error) return fail(station.error)
  const notes = optionalText(cell('notes'), 'Notes', NOTES_MAX_LENGTH)
  if (notes.error) return fail(notes.error)

  return {
    row,
    date,
    odometer: Math.round(reading.value),
    ...solved,
    isFull,
    station: station.value,
    notes: notes.value,
  }
}

/**
 * Reads each row through the mapping into a fill-up as it will be saved: a real date, a whole positive odometer
 * reading (rounded), gallons, price per gallon and total (any two, the third worked out), full or partial, and the
 * optional station and notes, trimmed. The first problem in a row makes it `{ row, error }`.
 * @param {CsvRow[]} rows
 * @param {ColumnMapping} mapping
 * @param {{ dateFormat: DateFormat }} options
 * @returns {ParsedRow[]} One per row, in the same order.
 */
export function parseRows(rows, mapping, { dateFormat }) {
  return rows.map((csvRow) => parseRow(csvRow, mapping, dateFormat))
}

/**
 * Longest strictly increasing run of odometer readings, keeping the file's order.
 * @param {Array<{ odometer: number }>} items
 * @returns {Set<number>} Indexes into `items` of the readings to keep.
 */
function longestIncreasing(items) {
  const tails = []
  const previous = new Array(items.length).fill(-1)
  items.forEach((item, i) => {
    let low = 0
    let high = tails.length
    while (low < high) {
      const mid = (low + high) >> 1
      if (items[tails[mid]].odometer < item.odometer) low = mid + 1
      else high = mid
    }
    previous[i] = low > 0 ? tails[low - 1] : -1
    tails[low] = i
  })
  const kept = new Set()
  for (let i = tails.at(-1) ?? -1; i !== -1; i = previous[i]) kept.add(i)
  return kept
}

/**
 * @param {{ existing: boolean, date: string, odometer: number, row?: number }} neighbour
 * @returns {string} `your Mar 3, 2025 fill-up` for a saved fill-up, `row 7 (Mar 3, 2025)` for a row of the file.
 */
const describeNeighbour = (neighbour) => (neighbour.existing
  ? `your ${formatDate(neighbour.date)} fill-up`
  : `row ${neighbour.row} (${formatDate(neighbour.date)})`)

const tooLow = (neighbour) => `Must be more than ${formatMiles(neighbour.odometer)}, the reading on ${describeNeighbour(neighbour)}.`
const tooHigh = (neighbour) => `Must be less than ${formatMiles(neighbour.odometer)}, the reading on ${describeNeighbour(neighbour)}.`

/**
 * Finds the rows whose readings don't fit the vehicle's other fill-ups, each with a reason naming the neighbour it
 * clashes with. Existing and imported fill-ups are ordered by date; on the same date, existing ones come first (a
 * new fill-up is the latest of its day, as the server orders them), then by reading. Existing fill-ups always stay,
 * so a row must fall between the saved readings around it; among the rows, the fewest are marked so the rest
 * increase, which flags a mistyped reading instead of every row after it.
 * @param {Array<{ index: number, date: string, odometer: number, row: number }>} candidates Valid, non-duplicate rows.
 * @param {Array<{ id?: number, date: string, odometer: number }>} existing
 * @returns {Map<number, string>} Reasons keyed by candidate `index`.
 */
function findOrderProblems(candidates, existing) {
  const items = [
    ...existing.map((fill, i) => ({ existing: true, date: fill.date, odometer: fill.odometer, order: fill.id ?? i })),
    ...candidates.map((candidate) => ({ ...candidate, existing: false, order: candidate.odometer })),
  ].sort((a, b) => (
    a.date < b.date ? -1 : a.date > b.date ? 1 : Number(b.existing) - Number(a.existing) || a.order - b.order
  ))

  const nextExisting = []
  for (let i = items.length - 1, next = null; i >= 0; i--) {
    nextExisting[i] = next
    if (items[i].existing) next = items[i]
  }

  const problems = new Map()
  const between = []
  let before = null
  items.forEach((item, i) => {
    if (item.existing) {
      before = item
      return
    }
    const after = nextExisting[i]
    if (before && item.odometer <= before.odometer) problems.set(item.index, tooLow(before))
    else if (after && item.odometer >= after.odometer) problems.set(item.index, tooHigh(after))
    else between.push(i)
  })

  const kept = longestIncreasing(between.map((position) => items[position]))
  const keeps = items.map((item) => item.existing)
  between.forEach((position, k) => {
    if (kept.has(k)) keeps[position] = true
  })
  const keptBefore = []
  const keptAfter = []
  for (let i = 0, last = null; i < items.length; i++) {
    keptBefore[i] = last
    if (keeps[i]) last = items[i]
  }
  for (let i = items.length - 1, last = null; i >= 0; i--) {
    keptAfter[i] = last
    if (keeps[i]) last = items[i]
  }
  // A reading the longest run leaves out is at or below the kept reading before it, or at or above the one after.
  between.forEach((position, k) => {
    if (kept.has(k)) return
    const item = items[position]
    const earlier = keptBefore[position]
    const later = keptAfter[position]
    problems.set(item.index, earlier && (item.odometer <= earlier.odometer || !later) ? tooLow(earlier) : tooHigh(later))
  })
  return problems
}

/**
 * Sorts parsed rows into new, duplicate (skipped) and invalid. A row is a duplicate when a saved fill-up of the
 * vehicle, or an earlier row, has the same date and reading. A reading that breaks the odometer order of the saved
 * fill-ups plus the new rows is invalid, with a reason naming the neighbour it clashes with.
 * @param {ParsedRow[]} parsed From {@link parseRows}.
 * @param {Array<{ id?: number, date: string, odometer: number }>} existing The target vehicle's saved fill-ups.
 * @returns {CheckedRow[]} In the same order as `parsed`.
 */
export function checkRows(parsed, existing) {
  const saved = new Map(existing.map((fill) => [`${fill.date}|${fill.odometer}`, fill]))
  const seen = new Map()
  const checked = parsed.map((item) => {
    if (item.error) return { ...item, status: 'invalid', reason: item.error }
    const key = `${item.date}|${item.odometer}`
    const match = saved.get(key)
    if (match) {
      return { ...item, status: 'duplicate', reason: `Matches your ${formatDate(match.date)} fill-up at ${formatMiles(match.odometer)}.` }
    }
    if (seen.has(key)) return { ...item, status: 'duplicate', reason: `Same date and odometer as row ${seen.get(key)}.` }
    seen.set(key, item.row)
    return { ...item, status: 'new', reason: null }
  })

  const candidates = checked
    .map((item, index) => ({ index, date: item.date, odometer: item.odometer, row: item.row, status: item.status }))
    .filter((item) => item.status === 'new')
  for (const [index, reason] of findOrderProblems(candidates, existing)) {
    checked[index] = { ...checked[index], status: 'invalid', reason }
  }
  return checked
}

/**
 * @param {CheckedRow[]} checked
 * @returns {{ new: number, duplicate: number, invalid: number }}
 */
export function countStatuses(checked) {
  const counts = { new: 0, duplicate: 0, invalid: 0 }
  for (const { status } of checked) counts[status] += 1
  return counts
}

/**
 * The MPG each new row will show once imported, worked out with the vehicle's saved fill-ups as the app does.
 * @param {CheckedRow[]} checked
 * @param {import('./vehicleStats').FillUp[]} existing The target vehicle's saved fill-ups.
 * @returns {Map<number, number | null>} MPG keyed by file row number, for new rows only.
 */
export function previewMpg(checked, existing) {
  const fresh = checked.filter((item) => item.status === 'new').map((item) => ({ ...item, importRow: item.row }))
  const sorted = [...existing, ...fresh].sort((a, b) => a.odometer - b.odometer)
  return new Map(computeFillMpg(sorted).filter((fill) => fill.importRow != null).map((fill) => [fill.importRow, fill.mpg]))
}

/**
 * The body rows for `POST /api/import/fill-ups`: the new rows, as the preview showed them.
 * @param {CheckedRow[]} checked
 * @returns {Array<Omit<ImportedFillUp, 'row'>>}
 */
export function importPayload(checked) {
  return checked
    .filter((item) => item.status === 'new')
    .map(({ date, odometer, gallons, pricePerGal, total, isFull, station, notes }) => (
      { date, odometer, gallons, pricePerGal, total, isFull, station, notes }
    ))
}

/**
 * The toast after an import: `Imported 42 fill-ups` with `3 duplicates skipped`.
 * @param {number} inserted
 * @param {number} skipped
 * @returns {{ message: string, detail: string | undefined }}
 */
export function importSummary(inserted, skipped) {
  const plural = (n, noun) => `${n.toLocaleString('en-US')} ${noun}${n === 1 ? '' : 's'}`
  return {
    message: `Imported ${plural(inserted, 'fill-up')}`,
    detail: skipped > 0 ? `${plural(skipped, 'duplicate')} skipped` : undefined,
  }
}
