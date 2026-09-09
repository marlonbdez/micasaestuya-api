import { Router } from 'express'
import RegionController from '../controllers/region.js'

export const regionsRouter = Router()

regionsRouter.get('/suggest', RegionController.suggest)
regionsRouter.get('/children', RegionController.children)
