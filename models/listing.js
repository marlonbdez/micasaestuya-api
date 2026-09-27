import { randomUUID } from 'node:crypto'
import Listing, { MAX_PHOTOS } from '../schemas/listing.js'
import { storage } from '../utils/r2.js'
import RegionModel from './region.js'

const badRequest = (message) => {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

const notFound = () => {
  const error = new Error('Listing or photo not found')
  error.statusCode = 404
  return error
}

// Tipos que web puede producir (WebP, y JPEG si el navegador no codifica WebP).
// Los pesos son un tope holgado sobre lo que sale de web (1280 px y miniatura
// de 400 px); si se ajusta el reescalado, se ajustan aquí.
const PHOTO_TYPES = ['image/webp', 'image/jpeg']
const MAX_PHOTO_BYTES = 600 * 1024
const MAX_THUMB_BYTES = 100 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// Los nombres los pone la api (`photoId` es un UUID que ella genera): el
// cliente no elige nunca dónde se guarda nada.
const photoKey = (listingId, photoId) => `listings/${listingId}/${photoId}`
const thumbKey = (listingId, photoId) => `${photoKey(listingId, photoId)}-thumb`
const photoUrl = (listingId, photoId) => storage.publicUrl(photoKey(listingId, photoId))

const assertPhotoIds = (photoIds) => {
  if (!Array.isArray(photoIds) || photoIds.length === 0 || !photoIds.every((id) => UUID.test(id))) {
    throw badRequest('photoIds must be a non-empty list of photo ids')
  }
}

const isValidObject = (object, maxBytes) =>
  object && PHOTO_TYPES.includes(object.contentType) && object.size <= maxBytes

const removeObjects = (listingId, photoId) =>
  Promise.all([storage.remove(photoKey(listingId, photoId)), storage.remove(thumbKey(listingId, photoId))])

// La región tiene que existir en el árbol y llegar hasta su último nivel: si
// al nodo elegido le cuelgan hijos, está a medias. web ya no deja enviarla
// así, pero aquí se comprueba igual porque el cliente no es de fiar.
const assertCompleteRegion = (region) => {
  if (!region || typeof region !== 'object') return // lo rechaza el schema

  const levels = [region.level1, region.level2, region.level3]
  const chain = []
  for (const level of levels) {
    if (!level) break
    chain.push(level)
  }

  if (levels.slice(chain.length).some(Boolean)) {
    throw badRequest('Region levels must be consecutive')
  }
  if (chain.length === 0) return // lo rechaza el schema (level1 obligatorio)
  if (region.level_type !== chain.length) {
    throw badRequest('Region level_type does not match its levels')
  }

  const children = RegionModel.children(region.country_code, chain)
  if (children === null) throw badRequest('Region not found')
  if (children.length > 0) throw badRequest('Region must reach its last level')
}

class ListingModel {
  // Solo se toman los campos que decide quien publica: `owner` sale del token
  // y `photos` nunca viene del cliente (se rellena al confirmar la subida).
  static async create ({ title, region, description, tasks, capacity, whatsapp }, ownerId) {
    assertCompleteRegion(region)

    const listing = new Listing({
      title,
      region,
      description,
      tasks,
      capacity,
      whatsapp,
      owner: ownerId
    })

    return listing.save()
  }

  // Un alojamiento ajeno y uno que no existe dan lo mismo: 404.
  static async findOwned (listingId, ownerId) {
    const listing = await Listing.findOne({ _id: listingId, owner: ownerId })
    if (!listing) throw notFound()
    return listing
  }

  // Paso 1: URLs firmadas para que el navegador suba las fotos a R2.
  static async requestPhotoUploads (listingId, ownerId, photos) {
    const listing = await ListingModel.findOwned(listingId, ownerId)

    if (!Array.isArray(photos) || photos.length === 0) {
      throw badRequest('photos must be a non-empty list')
    }
    if (listing.photos.length + photos.length > MAX_PHOTOS) {
      throw badRequest(`A listing can have at most ${MAX_PHOTOS} photos`)
    }
    if (!photos.every((photo) => PHOTO_TYPES.includes(photo?.contentType))) {
      throw badRequest(`contentType must be one of: ${PHOTO_TYPES.join(', ')}`)
    }

    return Promise.all(photos.map(async ({ contentType }) => {
      const photoId = randomUUID()
      const [uploadUrl, thumbUploadUrl] = await Promise.all([
        storage.presignPut(photoKey(listingId, photoId), contentType),
        storage.presignPut(thumbKey(listingId, photoId), contentType)
      ])
      return { photoId, contentType, uploadUrl, thumbUploadUrl }
    }))
  }

  // Paso 2: tras subir, se comprueba en R2 que cada foto existe, es del tipo
  // esperado y no pesa de más (la firma no puede limitar el peso). Solo
  // entonces se guarda su URL. Repetir la llamada con fotos ya guardadas no
  // hace nada.
  static async confirmPhotos (listingId, ownerId, photoIds) {
    assertPhotoIds(photoIds)
    const listing = await ListingModel.findOwned(listingId, ownerId)

    const pending = [...new Set(photoIds)]
      .filter((photoId) => !listing.photos.includes(photoUrl(listingId, photoId)))
    if (pending.length === 0) return listing
    if (listing.photos.length + pending.length > MAX_PHOTOS) {
      throw badRequest(`A listing can have at most ${MAX_PHOTOS} photos`)
    }

    const rejected = []
    await Promise.all(pending.map(async (photoId) => {
      const [photo, thumb] = await Promise.all([
        storage.head(photoKey(listingId, photoId)),
        storage.head(thumbKey(listingId, photoId))
      ])
      if (isValidObject(photo, MAX_PHOTO_BYTES) && isValidObject(thumb, MAX_THUMB_BYTES)) return
      rejected.push(photoId)
      await removeObjects(listingId, photoId)
    }))
    if (rejected.length > 0) {
      throw badRequest(`Photos missing, of the wrong type or too heavy: ${rejected.join(', ')}`)
    }

    // La condición sobre `photos.N` hace atómico el tope de fotos: solo casa si
    // caben todas, aunque dos confirmaciones lleguen a la vez.
    const updated = await Listing.findOneAndUpdate(
      { _id: listingId, owner: ownerId, [`photos.${MAX_PHOTOS - pending.length}`]: { $exists: false } },
      { $push: { photos: { $each: pending.map((photoId) => photoUrl(listingId, photoId)) } } },
      { new: true }
    )
    if (!updated) throw badRequest(`A listing can have at most ${MAX_PHOTOS} photos`)
    return updated
  }

  static async removePhoto (listingId, ownerId, photoId) {
    if (!UUID.test(photoId)) throw notFound()

    const url = photoUrl(listingId, photoId)
    const updated = await Listing.findOneAndUpdate(
      { _id: listingId, owner: ownerId, photos: url },
      { $pull: { photos: url } },
      { new: true }
    )
    if (!updated) throw notFound()

    await removeObjects(listingId, photoId)
    return updated
  }
}

export default ListingModel
