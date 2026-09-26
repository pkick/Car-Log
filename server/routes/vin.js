import { Router } from 'express'

const NHTSA_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues'
const UNREACHABLE = "Couldn't reach NHTSA to decode this VIN. You can still fill in the details yourself."
const UNDECODED = "NHTSA couldn't decode this VIN."

// Makes NHTSA spells in capitals that don't title-case plainly.
const MAKE_SPELLINGS = { KIA: 'Kia', RAM: 'Ram', MCLAREN: 'McLaren', MINI: 'MINI' }

/**
 * A VIN as `GET /api/vin/:vin` answers it.
 * @typedef {object} DecodedVin
 * @property {string} vin
 * @property {number | null} year
 * @property {string} make `''` when NHTSA didn't return one.
 * @property {string} model
 * @property {string} trim NHTSA's `Trim`, or its `Series` when there's no trim.
 * @property {string[]} warnings NHTSA's notes when the decode wasn't clean; empty when it was.
 */

/**
 * Title-cases words NHTSA sends in capitals ("VOLVO", "LAND ROVER", "MERCEDES-BENZ") and leaves the rest alone:
 * mixed-case words, anything with a digit ("F-150", "RAV4") and words of three letters or fewer ("BMW", "CR-V").
 * @param {string} name A make or model.
 * @returns {string}
 */
export function titleCase(name) {
  return name.replace(/[\p{L}\p{N}]+/gu, (word) => {
    if (MAKE_SPELLINGS[word]) return MAKE_SPELLINGS[word]
    if (!/^\p{Lu}{4,}$/u.test(word)) return word
    return word[0] + word.slice(1).toLowerCase()
  })
}

/**
 * @param {string} vin The VIN from the URL, uppercased.
 * @returns {string | null} Why it isn't a VIN, as a sentence for the form, or `null` when it could be one.
 */
function formatProblem(vin) {
  if (vin.length !== 17) return `A VIN has 17 characters; this one has ${vin.length}.`
  if (/[IOQ]/.test(vin)) return 'A VIN never uses the letters I, O or Q; look for a 1 or 0 typed as a letter.'
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return 'A VIN has only letters and digits.'
  return null
}

const text = (value) => (typeof value === 'string' ? value.trim() : '')

/**
 * Splits NHTSA's `ErrorText` into one note per code, e.g. "1 - Check Digit ... properly; 5 - VIN has errors ..."
 * into ["Check Digit ... properly", "VIN has errors ..."]. Some notes contain a semicolon themselves, so it splits
 * only where the next code starts.
 * @param {string} errorCode NHTSA's `ErrorCode`, e.g. `"1,5"`.
 * @param {string} errorText NHTSA's `ErrorText`.
 * @returns {string[]} Empty for a clean decode (code `0`).
 */
function decodeWarnings(errorCode, errorText) {
  const codes = errorCode.split(',').map((code) => code.trim()).filter(Boolean)
  if (codes.every((code) => code === '0')) return []
  const notes = errorText
    .split(/;\s*(?=\d+\s*-\s)/)
    .filter((note) => !/^0\s*-/.test(note))
    .map((note) => note.replace(/^\d+\s*-\s*/, '').replace(/\.\s*$/, '').trim())
    .filter(Boolean)
  return notes.length ? notes : [`NHTSA returned error code ${codes.join(', ')}`]
}

/**
 * Maps NHTSA's first result to the API's shape.
 * @param {string} vin
 * @param {Record<string, string>} result One entry of `DecodeVinValues`' `Results`; every value is a string.
 * @returns {DecodedVin | null} `null` when neither the make nor the model decoded.
 */
function toDecodedVin(vin, result) {
  const make = titleCase(text(result.Make))
  const model = titleCase(text(result.Model))
  if (!make && !model) return null
  const year = text(result.ModelYear)
  return {
    vin,
    year: /^\d{4}$/.test(year) ? Number(year) : null,
    make,
    model,
    trim: text(result.Trim) || text(result.Series),
    warnings: decodeWarnings(text(result.ErrorCode), text(result.ErrorText)),
  }
}

/**
 * Builds the `/api/vin` router, which decodes VINs through NHTSA's vPIC API and remembers successful decodes.
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch] Makes the request to NHTSA; tests pass a stub.
 * @param {number} [options.timeoutMs=5000] How long to wait for NHTSA, including the body.
 * @param {number} [options.cacheSize=200] How many decoded VINs to remember; the least recently used goes first.
 * @returns {import('express').Router}
 */
export function createVinRouter({ fetch: fetchVin = globalThis.fetch, timeoutMs = 5000, cacheSize = 200 } = {}) {
  const router = Router()
  /** @type {Map<string, DecodedVin>} */
  const cache = new Map()

  const remember = (vin, decoded) => {
    cache.delete(vin)
    cache.set(vin, decoded)
    if (cache.size > cacheSize) cache.delete(cache.keys().next().value)
  }

  router.get('/:vin', async (req, res) => {
    const vin = req.params.vin.trim().toUpperCase()
    const problem = formatProblem(vin)
    if (problem) return res.status(400).json({ error: problem, field: 'vin' })

    const cached = cache.get(vin)
    if (cached) {
      remember(vin, cached)
      return res.json(cached)
    }

    let body
    try {
      const response = await fetchVin(`${NHTSA_URL}/${vin}?format=json`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!response.ok) throw new Error(`NHTSA answered ${response.status}`)
      body = await response.json()
    } catch {
      return res.status(502).json({ error: UNREACHABLE })
    }
    if (!Array.isArray(body?.Results)) return res.status(502).json({ error: UNREACHABLE })

    const decoded = body.Results[0] && toDecodedVin(vin, body.Results[0])
    if (!decoded) return res.status(422).json({ error: UNDECODED, field: 'vin' })

    remember(vin, decoded)
    res.json(decoded)
  })

  return router
}

export default createVinRouter()
