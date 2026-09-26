import { StartupError } from './errors.js'

let app, db, DB_PATH
try {
  ;({ default: app } = await import('./app.js'))
  ;({ db, DB_PATH } = await import('./db.js'))
} catch (err) {
  if (!(err instanceof StartupError)) throw err
  console.error(`Odometer can't start: ${err.message}`)
  process.exit(1)
}

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`Odometer listening on http://localhost:${PORT} (database: ${DB_PATH})`)
})

// `docker stop` sends SIGTERM, which Node ignores when it runs as PID 1 unless it has a handler. Every write is
// synchronous, so none is in flight when a handler runs.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    db.close()
    process.exit(0)
  })
}
