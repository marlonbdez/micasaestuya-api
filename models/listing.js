import Listing from '../schemas/listing.js'
import RegionModel from './region.js'

const badRequest = (message) => {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

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
  // y `photos` se ignora hasta que exista la subida.
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
}

export default ListingModel
