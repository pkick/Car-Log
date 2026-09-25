import { Router } from 'express'
import { DEFAULT_INTERVALS } from '../seed.js'

const router = Router()

router.get('/intervals', (req, res) => {
  res.json(DEFAULT_INTERVALS)
})

export default router
