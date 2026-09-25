import express from 'express'
import './db.js'
import vehiclesRouter from './routes/vehicles.js'
import fillUpsRouter from './routes/fillUps.js'
import serviceRecordsRouter from './routes/serviceRecords.js'
import policyRecordsRouter from './routes/policyRecords.js'
import defaultsRouter from './routes/defaults.js'

const app = express()

app.use(express.json())

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
app.use('/api/vehicles', vehiclesRouter)
app.use('/api/fill-ups', fillUpsRouter)
app.use('/api/service-records', serviceRecordsRouter)
app.use('/api/policy-records', policyRecordsRouter)
app.use('/api/defaults', defaultsRouter)

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

export default app
