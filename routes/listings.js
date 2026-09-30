import { Router } from 'express'
import ListingController from '../controllers/listing.js'
import { auth } from '../utils/middleware.js'
import { readLimiter, writeLimiter } from '../utils/rateLimit.js'

export const listingsRouter = Router()

listingsRouter.get('/', readLimiter, ListingController.list)
listingsRouter.get('/mine', readLimiter, auth, ListingController.mine)
listingsRouter.get('/:id', readLimiter, ListingController.findById)
listingsRouter.post('/', writeLimiter, auth, ListingController.create)
listingsRouter.post('/:id/photos', writeLimiter, auth, ListingController.requestPhotoUploads)
listingsRouter.post('/:id/photos/confirm', writeLimiter, auth, ListingController.confirmPhotos)
listingsRouter.delete('/:id/photos/:photoId', writeLimiter, auth, ListingController.removePhoto)
listingsRouter.delete('/:id', writeLimiter, auth, ListingController.remove)
