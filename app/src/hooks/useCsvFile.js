import { useState } from 'react'

const CSV_NAME = /\.(csv|txt)$/i

/**
 * Reads a CSV file the person picked or dropped for the fill-up import: parses it in the browser and refuses files
 * that aren't CSV, have no rows, or record liters or kilometers.
 *
 * @returns {{
 *   source: { name: string, table: import('../lib/csvImport').CsvTable } | null,
 *   error: string | null,
 *   reading: boolean,
 *   read: (file: File | undefined) => Promise<void>,
 *   clear: () => void,
 * }} `source` is set once a file is ready for the mapping step; `clear` closes it.
 */
export function useCsvFile() {
  const [source, setSource] = useState(null)
  const [error, setError] = useState(null)
  const [reading, setReading] = useState(false)

  const read = async (file) => {
    if (!file) return
    setError(null)
    setSource(null)
    if (!CSV_NAME.test(file.name) && !/csv|text\/plain/.test(file.type)) {
      setError(`${file.name} isn't a CSV file. Export your fill-ups as CSV and choose that file.`)
      return
    }
    setReading(true)
    try {
      // The parser (papaparse) loads with the first file, so it stays out of the main bundle.
      const { checkUnits, readCsv } = await import('../lib/csvImport')
      const table = readCsv(await file.text())
      const problem = table.headers.length === 0
        ? `${file.name} is empty.`
        : table.rows.length === 0 ? `${file.name} has a header row but no fill-ups under it.` : checkUnits(table)
      if (problem) setError(problem)
      else setSource({ name: file.name, table })
    } catch (err) {
      setError(`Couldn't read ${file.name}: ${err.message}`)
    } finally {
      setReading(false)
    }
  }

  return { source, error, reading, read, clear: () => setSource(null) }
}
