import http from 'node:http'
import { after } from 'node:test'

/**
 * @typedef {object} RecordedRequest
 * @property {string} method
 * @property {string} url path and query
 * @property {http.IncomingHttpHeaders} headers
 * @property {string} body
 */

/**
 * A local HTTP server standing in for ntfy or Pushover. It records every request and answers with whatever
 * `reply` was last set to (200 `{}` at first). It closes when the test file ends.
 * @returns {Promise<{ url: string, requests: RecordedRequest[], reply: (status: number, body?: unknown) => void }>}
 */
export async function startMockServer() {
  const requests = []
  let answer = { status: 200, body: {} }
  const server = http.createServer((req, res) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      requests.push({ method: req.method, url: req.url, headers: req.headers, body })
      res.writeHead(answer.status, { 'Content-Type': typeof answer.body === 'string' ? 'text/plain' : 'application/json' })
      res.end(typeof answer.body === 'string' ? answer.body : JSON.stringify(answer.body))
    })
  })
  server.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  after(() => new Promise((resolve) => server.close(resolve)))
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    requests,
    reply(status, body = {}) {
      answer = { status, body }
    },
  }
}
