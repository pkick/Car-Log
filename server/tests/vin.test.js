import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { request } from './helpers.js'
import { createVinRouter, titleCase } from '../routes/vin.js'

const UNREACHABLE = "Couldn't reach NHTSA to decode this VIN. You can still fill in the details yourself."
const CLEAN = { ErrorCode: '0', ErrorText: '0 - VIN decoded clean. Check Digit (9th position) is correct' }

/**
 * A `DecodeVinValues` body with one result. Like NHTSA's, every value is a string and blanks are `''`.
 * @param {object} fields Result fields to set.
 */
const nhtsaBody = (fields) => ({
  Count: 1,
  Message: 'Results returned successfully. NOTE: Any missing decoded values should be interpreted as NHTSA does not have data on the specific variable.',
  SearchCriteria: 'VIN(s): 1HGCM82633A004352',
  Results: [{ ModelYear: '', Make: '', Model: '', Trim: '', Series: '', BodyClass: '', ...CLEAN, ...fields }],
})

/**
 * A fetch stub that records the URLs it's asked for.
 * @param {(url: string, init: RequestInit) => Promise<Response>} respond
 */
function stubFetch(respond) {
  const calls = []
  const fetch = (url, init) => {
    calls.push(url)
    return respond(url, init)
  }
  return { fetch, calls }
}

const servers = []
after(() => Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve)))))

/**
 * Serves a fresh VIN router (with its own empty cache) on a random port.
 * @param {Parameters<typeof createVinRouter>[0]} options
 * @returns {Promise<(vin: string) => Promise<{ status: number, body: any }>>} Requests `GET /api/vin/:vin`.
 */
async function serveVinRouter(options) {
  const app = express()
  app.use('/api/vin', createVinRouter(options))
  const server = app.listen(0)
  servers.push(server)
  await new Promise((resolve) => server.once('listening', resolve))
  return async (vin) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/vin/${encodeURIComponent(vin)}`)
    return { status: res.status, body: await res.json() }
  }
}

test('GET /api/vin/:vin maps NHTSA’s result and title-cases the make', async () => {
  const { fetch, calls } = stubFetch(async () => Response.json(nhtsaBody({
    ModelYear: '2019', Make: 'VOLVO', Model: 'V60', Trim: 'T5 Momentum', Series: 'Base',
  })))
  const get = await serveVinRouter({ fetch })

  const { status, body } = await get('yv1a22ak1k1234567')

  assert.equal(status, 200)
  assert.deepEqual(body, { vin: 'YV1A22AK1K1234567', year: 2019, make: 'Volvo', model: 'V60', trim: 'T5 Momentum', warnings: [] })
  assert.deepEqual(calls, ['https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/YV1A22AK1K1234567?format=json'])
})

test('GET /api/vin/:vin falls back to the series when there is no trim', async () => {
  const { fetch } = stubFetch(async () => Response.json(nhtsaBody({ ModelYear: '2021', Make: 'FORD', Model: 'F-150', Series: 'XLT' })))
  const get = await serveVinRouter({ fetch })

  const { status, body } = await get('1FTFW1E5XMKD12345')

  assert.equal(status, 200)
  assert.deepEqual(body, { vin: '1FTFW1E5XMKD12345', year: 2021, make: 'Ford', model: 'F-150', trim: 'XLT', warnings: [] })
})

test('titleCase fixes capitals but keeps model numbers and short acronyms', () => {
  const cases = {
    VOLVO: 'Volvo',
    'MERCEDES-BENZ': 'Mercedes-Benz',
    'LAND ROVER': 'Land Rover',
    'GRAND CHEROKEE': 'Grand Cherokee',
    'MUSTANG MACH-E': 'Mustang Mach-E',
    'E-CLASS': 'E-Class',
    'F-150': 'F-150',
    RAV4: 'RAV4',
    'CR-V': 'CR-V',
    BMW: 'BMW',
    GMC: 'GMC',
    KIA: 'Kia',
    MCLAREN: 'McLaren',
    Accord: 'Accord',
    'Model 3': 'Model 3',
    '': '',
  }
  for (const [input, expected] of Object.entries(cases)) assert.equal(titleCase(input), expected, input)
})

test('GET /api/vin/:vin returns a partial decode with NHTSA’s warnings', async () => {
  const { fetch } = stubFetch(async () => Response.json(nhtsaBody({
    ModelYear: '2003',
    Make: 'HONDA',
    Model: 'Accord',
    ErrorCode: '1,7',
    ErrorText: '1 - Check Digit (9th position) does not calculate properly; 7 - Manufacturer is not registered with NHTSA for sale or importation in the U.S. for use on U.S roads; Please contact the manufacturer directly for more information',
  })))
  const get = await serveVinRouter({ fetch })

  const { status, body } = await get('1HGCM82643A004352')

  assert.equal(status, 200)
  assert.deepEqual(body, {
    vin: '1HGCM82643A004352',
    year: 2003,
    make: 'Honda',
    model: 'Accord',
    trim: '',
    warnings: [
      'Check Digit (9th position) does not calculate properly',
      'Manufacturer is not registered with NHTSA for sale or importation in the U.S. for use on U.S roads; Please contact the manufacturer directly for more information',
    ],
  })
})

test('GET /api/vin/:vin gives a year of null when NHTSA has none', async () => {
  const { fetch } = stubFetch(async () => Response.json(nhtsaBody({ Make: 'TESLA', ErrorCode: '14', ErrorText: '' })))
  const get = await serveVinRouter({ fetch })

  const { status, body } = await get('5YJ3E1EA7KF317000')

  assert.equal(status, 200)
  assert.equal(body.year, null)
  assert.equal(body.make, 'Tesla')
  assert.deepEqual(body.warnings, ['NHTSA returned error code 14'])
})

test('GET /api/vin/:vin answers 422 when NHTSA decodes neither make nor model', async () => {
  const { fetch } = stubFetch(async () => Response.json(nhtsaBody({
    ModelYear: '2003',
    ErrorCode: '1,5,11',
    ErrorText: '1 - Check Digit (9th position) does not calculate properly; 5 - VIN has errors in few positions; 11 - Incorrect Model Year, decoded data may not be accurate!',
  })))
  const get = await serveVinRouter({ fetch })

  const { status, body } = await get('11111111111111111')

  assert.equal(status, 422)
  assert.deepEqual(body, { error: "NHTSA couldn't decode this VIN.", field: 'vin' })
})

test('GET /api/vin/:vin answers 422 when NHTSA returns no results', async () => {
  const { fetch } = stubFetch(async () => Response.json({ Count: 0, Message: 'No data', Results: [] }))
  const get = await serveVinRouter({ fetch })

  assert.equal((await get('11111111111111111')).status, 422)
})

test('GET /api/vin/:vin answers 502 when NHTSA takes longer than the timeout', async () => {
  let signal
  // Like fetch, the stub only settles when its signal aborts.
  const { fetch } = stubFetch((url, init) => new Promise((resolve, reject) => {
    signal = init.signal
    signal.addEventListener('abort', () => reject(signal.reason))
  }))
  const get = await serveVinRouter({ fetch, timeoutMs: 20 })

  const { status, body } = await get('1HGCM82633A004352')

  assert.equal(status, 502)
  assert.deepEqual(body, { error: UNREACHABLE })
  assert.equal(signal.reason.name, 'TimeoutError')
})

test('GET /api/vin/:vin answers 502 when the network fails', async () => {
  const { fetch } = stubFetch(async () => {
    throw new TypeError('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND vpic.nhtsa.dot.gov') })
  })
  const get = await serveVinRouter({ fetch })

  const { status, body } = await get('1HGCM82633A004352')

  assert.equal(status, 502)
  assert.deepEqual(body, { error: UNREACHABLE })
})

test('GET /api/vin/:vin answers 502 when NHTSA answers with an error or something other than JSON', async () => {
  const responses = [new Response('Service Unavailable', { status: 503 }), new Response('<html>maintenance</html>'), Response.json({})]
  const { fetch } = stubFetch(async () => responses.shift())
  const get = await serveVinRouter({ fetch })

  for (let i = 0; i < 3; i++) assert.deepEqual(await get('1HGCM82633A004352'), { status: 502, body: { error: UNREACHABLE } })
})

test('GET /api/vin/:vin rejects anything that isn’t a VIN without calling NHTSA', async () => {
  const { fetch, calls } = stubFetch(async () => Response.json(nhtsaBody({ Make: 'HONDA', Model: 'Accord' })))
  const get = await serveVinRouter({ fetch })
  const cases = {
    '1HGCM82633A00435': 'A VIN has 17 characters; this one has 16.',
    '1HGCM82633A0043521': 'A VIN has 17 characters; this one has 18.',
    '1HGCM8263OA004352': 'A VIN never uses the letters I, O or Q; look for a 1 or 0 typed as a letter.',
    '1HGCM8263-A004352': 'A VIN has only letters and digits.',
  }

  for (const [vin, error] of Object.entries(cases)) {
    assert.deepEqual(await get(vin), { status: 400, body: { error, field: 'vin' } }, vin)
  }
  assert.equal(calls.length, 0)
})

test('the app mounts the VIN route at /api/vin', async () => {
  const { status, body } = await request('GET', '/api/vin/1HGCM82633A00435')

  assert.equal(status, 400)
  assert.deepEqual(body, { error: 'A VIN has 17 characters; this one has 16.', field: 'vin' })
})

test('GET /api/vin/:vin serves a repeat decode from its cache', async () => {
  const { fetch, calls } = stubFetch(async () => Response.json(nhtsaBody({ ModelYear: '2003', Make: 'HONDA', Model: 'Accord', Trim: 'EX' })))
  const get = await serveVinRouter({ fetch })

  const first = await get('1HGCM82633A004352')
  const second = await get('1hgcm82633a004352')

  assert.equal(first.status, 200)
  assert.deepEqual(second, first)
  assert.equal(calls.length, 1)
})

test('GET /api/vin/:vin doesn’t cache failures', async () => {
  const responses = [Response.json(nhtsaBody({})), Response.json(nhtsaBody({ Make: 'HONDA', Model: 'Accord' }))]
  const { fetch, calls } = stubFetch(async () => responses.shift())
  const get = await serveVinRouter({ fetch })

  assert.equal((await get('1HGCM82633A004352')).status, 422)
  assert.equal((await get('1HGCM82633A004352')).status, 200)
  assert.equal(calls.length, 2)
})

test('GET /api/vin/:vin forgets the least recently used VIN once the cache is full', async () => {
  const { fetch, calls } = stubFetch(async () => Response.json(nhtsaBody({ Make: 'HONDA', Model: 'Accord' })))
  const get = await serveVinRouter({ fetch, cacheSize: 2 })
  const [a, b, c] = ['1HGCM82633A004352', '1M8GDM9AXKP042788', '11111111111111111']

  await get(a)
  await get(b)
  await get(a)
  await get(c)
  assert.equal(calls.length, 3)

  await get(a)
  assert.equal(calls.length, 3)
  await get(b)
  assert.equal(calls.length, 4)
})
