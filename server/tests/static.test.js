import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const STUB_HTML = '<!doctype html><title>Odometer stub</title><div id="root"></div>'
const STUB_JS = 'console.log("stub")'

const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odometer-dist-'))
fs.writeFileSync(path.join(staticDir, 'index.html'), STUB_HTML)
fs.mkdirSync(path.join(staticDir, 'assets'))
fs.writeFileSync(path.join(staticDir, 'assets', 'index-abc123.js'), STUB_JS)
process.env.STATIC_DIR = staticDir

const { baseUrl, request } = await import('./helpers.js')

test('the built app is served at /, uncached', async () => {
  const res = await fetch(`${baseUrl}/`)

  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type'), /^text\/html/)
  assert.equal(res.headers.get('cache-control'), 'no-cache')
  assert.equal(await res.text(), STUB_HTML)
})

test('client-side routes fall back to index.html', async () => {
  for (const route of ['/v/2/trends', '/garage', '/settings?tab=backup']) {
    const res = await fetch(baseUrl + route)
    assert.equal(res.status, 200, route)
    assert.equal(await res.text(), STUB_HTML, route)
  }
})

test('hashed assets are served with a long cache lifetime', async () => {
  const res = await fetch(`${baseUrl}/assets/index-abc123.js`)

  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type'), /javascript/)
  assert.match(res.headers.get('cache-control'), /max-age=31536000, immutable/)
  assert.equal(await res.text(), STUB_JS)
})

test('unknown /api paths get a JSON 404 instead of the app', async () => {
  for (const [method, route] of [['GET', '/api/nope'], ['POST', '/api/nope'], ['GET', '/api'], ['DELETE', '/api/vehicles/1/extra']]) {
    const { status, body } = await request(method, route)
    assert.equal(status, 404, `${method} ${route}`)
    assert.deepEqual(body, { error: 'Not found' }, `${method} ${route}`)
  }
})

test('the API still answers alongside the app', async () => {
  const { status, body } = await request('GET', '/api/health')

  assert.equal(status, 200)
  assert.deepEqual(body, { status: 'ok' })
})
