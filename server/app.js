import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import './db.js'
import vehiclesRouter from './routes/vehicles.js'
import fillUpsRouter from './routes/fillUps.js'
import serviceRecordsRouter from './routes/serviceRecords.js'
import policyRecordsRouter from './routes/policyRecords.js'
import defaultsRouter from './routes/defaults.js'
import backupRouter from './routes/backup.js'
import vinRouter from './routes/vin.js'
import demoRouter from './routes/demo.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** The built app (`npm run build` in `app/`). `STATIC_DIR` overrides it; in development Vite serves the app instead. */
const STATIC_DIR = path.resolve(process.env.STATIC_DIR || path.join(__dirname, '..', 'app', 'dist'))
const INDEX_HTML = path.join(STATIC_DIR, 'index.html')
const ASSETS_DIR = path.join(STATIC_DIR, 'assets') + path.sep

const app = express()

// A restore sends the whole backup at once. This parser runs first, so the default 100 kB one skips the request.
app.use('/api/import', express.json({ limit: '20mb' }))
app.use(express.json())

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
app.use('/api/vehicles', vehiclesRouter)
app.use('/api/fill-ups', fillUpsRouter)
app.use('/api/service-records', serviceRecordsRouter)
app.use('/api/policy-records', policyRecordsRouter)
app.use('/api/defaults', defaultsRouter)
app.use('/api/vin', vinRouter)
app.use('/api/demo', demoRouter)
app.use('/api', backupRouter)
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }))

if (fs.existsSync(INDEX_HTML)) {
  app.use(express.static(STATIC_DIR, {
    index: false,
    setHeaders(res, filePath) {
      // Vite puts a content hash in every file name under assets/, so a changed file gets a new URL.
      if (filePath.startsWith(ASSETS_DIR)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    },
  }))
  // Client-side routes such as /v/2/trends get the app shell. It's never cached, so an upgrade takes effect on reload.
  app.get('*', (req, res) => res.sendFile(INDEX_HTML, { headers: { 'Cache-Control': 'no-cache' } }))
}

app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That request is too large.' })
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: "That request isn't valid JSON." })
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

export default app
