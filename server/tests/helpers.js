import { after } from 'node:test'

// Never let a test run against the real dev database, even when a file is run without `npm test`.
process.env.DB_PATH ??= ':memory:'
process.env.SEED_DEMO ??= '1'
const { default: app } = await import('../app.js')

const server = app.listen(0)
await new Promise((resolve) => server.once('listening', resolve))

/** The test server's origin, for requests that `request` can't make (non-JSON responses). */
export const baseUrl = `http://127.0.0.1:${server.address().port}`

after(() => new Promise((resolve) => server.close(resolve)))

/**
 * Sends a JSON request to the test server.
 * @param {string} method HTTP method.
 * @param {string} path Path starting with `/api`.
 * @param {object} [body] JSON body to send.
 * @returns {Promise<{ status: number, body: any }>} The status and parsed JSON body (`null` when empty).
 */
export async function request(method, path, body) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

/**
 * Creates a fresh vehicle so a test doesn't depend on seed data.
 * @param {object} [fields] Fields to override.
 * @returns {Promise<object>} The created vehicle.
 */
export async function createVehicle(fields = {}) {
  const { status, body } = await request('POST', '/api/vehicles', { nickname: 'Test car', purchaseOdometer: 10000, ...fields })
  if (status !== 201) throw new Error(`Creating a vehicle failed with ${status}`)
  return body
}

/**
 * Posts a fill-up for a vehicle.
 * @param {number} vehicleId The vehicle id.
 * @param {string} date `YYYY-MM-DD`.
 * @param {number} odometer The reading.
 * @returns {Promise<{ status: number, body: any }>} The response.
 */
export function addFillUp(vehicleId, date, odometer) {
  return request('POST', '/api/fill-ups', { vehicleId, date, odometer, gallons: 10, pricePerGal: 3.5, isFull: true })
}

/**
 * Posts a service record for a vehicle.
 * @param {number} vehicleId The vehicle id.
 * @param {string} date `YYYY-MM-DD`.
 * @param {number} odometer The reading.
 * @returns {Promise<{ status: number, body: any }>} The response.
 */
export function addServiceRecord(vehicleId, date, odometer) {
  return request('POST', '/api/service-records', {
    vehicleId, date, odometer, categoryId: 'oil', services: ['Oil + filter change'], cost: 60,
  })
}

/**
 * Posts an insurance payment for a vehicle.
 * @param {number} vehicleId The vehicle id.
 * @param {object} [fields] Fields to override.
 * @returns {Promise<{ status: number, body: any }>} The response.
 */
export function addPolicyRecord(vehicleId, fields = {}) {
  return request('POST', '/api/policy-records', {
    vehicleId, type: 'insurance', date: '2026-05-14', cost: 612, renewalDate: '2026-11-14', provider: 'State Farm', ...fields,
  })
}

/**
 * Reads a vehicle's odometer from `GET /api/vehicles`.
 * @param {number} vehicleId The vehicle id.
 * @returns {Promise<number>} The stored odometer.
 */
export async function listedOdometer(vehicleId) {
  const { body } = await request('GET', '/api/vehicles')
  return body.find((v) => v.id === vehicleId).odometer
}
