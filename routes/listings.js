import { Router } from 'express'
import ListingController from '../controllers/listing.js'
import { auth } from '../utils/middleware.js'
import { writeLimiter } from '../utils/rateLimit.js'

export const listingsRouter = Router()

listingsRouter.post('/', writeLimiter, auth, ListingController.create)
listingsRouter.post('/:id/photos', writeLimiter, auth, ListingController.requestPhotoUploads)
listingsRouter.post('/:id/photos/confirm', writeLimiter, auth, ListingController.confirmPhotos)
listingsRouter.delete('/:id/photos/:photoId', writeLimiter, auth, ListingController.removePhoto)
