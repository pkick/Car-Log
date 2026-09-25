import express from 'express'
import './db.js'
import vehiclesRouter from './routes/vehicles.js'
import fillUpsRouter from './routes/fillUps.js'
import serviceRecordsRouter from './routes/serviceRecords.js'
import policyRecordsRouter from './routes/policyRecords.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json())

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
app.use('/api/vehicles', vehiclesRouter)
app.use('/api/fill-ups', fillUpsRouter)
app.use('/api/service-records', serviceRecordsRouter)
app.use('/api/policy-records', policyRecordsRouter)

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`Odometer API listening on http://localhost:${PORT}`)
})
