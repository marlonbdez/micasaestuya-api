import ListingModel from '../models/listing.js'

class ListingController {
  static async create (req, res) {
    const listing = await ListingModel.create(req.body, req.user.id)

    return res.status(201).json(listing)
  }
}

export default ListingController
