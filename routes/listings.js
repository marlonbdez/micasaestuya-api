import { Router } from 'express'
import ListingController from '../controllers/listing.js'
import { auth } from '../utils/middleware.js'
import { writeLimiter } from '../utils/rateLimit.js'

export const listingsRouter = Router()

listingsRouter.post('/', writeLimiter, auth, ListingController.create)
