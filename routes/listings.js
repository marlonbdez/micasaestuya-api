import { Router } from 'express'
import ListingController from '../controllers/listing.js'
import { auth } from '../utils/middleware.js'

export const listingsRouter = Router()

listingsRouter.post('/', auth, ListingController.create)
