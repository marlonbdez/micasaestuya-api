import ListingModel from '../models/listing.js'

class ListingController {
  static async list (req, res) {
    const listings = await ListingModel.list(req.query)

    return res.json(listings)
  }

  static async mine (req, res) {
    const listings = await ListingModel.findByOwner(req.user.id)

    return res.json(listings)
  }

  static async findById (req, res) {
    const listing = await ListingModel.findById(req.params.id)

    return res.json(listing)
  }

  static async create (req, res) {
    const listing = await ListingModel.create(req.body, req.user.id)

    return res.status(201).json(listing)
  }

  static async remove (req, res) {
    await ListingModel.remove(req.params.id, req.user.id)

    return res.status(204).end()
  }

  static async requestPhotoUploads (req, res) {
    const uploads = await ListingModel.requestPhotoUploads(req.params.id, req.user.id, req.body.photos)

    return res.json({ uploads })
  }

  static async confirmPhotos (req, res) {
    const listing = await ListingModel.confirmPhotos(req.params.id, req.user.id, req.body.photoIds)

    return res.json(listing)
  }

  static async removePhoto (req, res) {
    await ListingModel.removePhoto(req.params.id, req.user.id, req.params.photoId)

    return res.status(204).end()
  }
}

export default ListingController
