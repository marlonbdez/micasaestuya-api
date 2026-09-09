import { Router } from 'express'
import HealthController from '../controllers/health.js'

export const healthRouter = Router()

healthRouter.get('/', HealthController.getHealth)
