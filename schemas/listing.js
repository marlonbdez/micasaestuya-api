import mongoose from 'mongoose'
import { storage } from '../utils/r2.js'

// Las tareas que un anfitrión puede pedir. Mismos valores que el enum
// CollaborationTask de web (core/types/listing.ts).
export const COLLABORATION_TASKS = [
  'COOKING',
  'GARDENING',
  'CLEANING',
  'CHILDCARE',
  'PET_CARE',
  'MAINTENANCE',
  'OTHER'
]

export const CAPACITY_MIN = 1
export const CAPACITY_MAX = 20
export const TITLE_MAX = 100
export const MAX_PHOTOS = 10
// "+", código de país y el número, sin espacios (web lo envía ya limpio).
export const WHATSAPP_PATTERN = /^\+[1-9]\d{7,19}$/

// Un nodo del árbol administrativo, con la misma forma que usa web (IAdRegion).
// Nunca lleva calle ni coordenadas (micasaestuya-docs/Domain-Vocabulary.md).
const regionSchema = new mongoose.Schema({
  country_code: { type: String, required: true, enum: ['CU', 'DO'] },
  level1: { type: String, required: true },
  level2: String,
  level3: String,
  level_type: { type: Number, required: true, enum: [1, 2, 3] },
  term: String
}, { _id: false })

const listingSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: TITLE_MAX },
  region: { type: regionSchema, required: true },
  description: { type: String, required: true, trim: true },
  tasks: {
    type: [{ type: String, enum: COLLABORATION_TASKS }],
    validate: {
      validator: (tasks) => tasks.length > 0,
      message: 'At least one task is required'
    }
  },
  capacity: {
    type: Number,
    required: true,
    min: CAPACITY_MIN,
    max: CAPACITY_MAX,
    validate: {
      validator: Number.isInteger,
      message: 'Capacity must be a whole number'
    }
  },
  whatsapp: { type: String, required: true, match: WHATSAPP_PATTERN },
  // Ids de las fotos en R2 (`listings/<id>/<photoId>`); la URL se compone al
  // responder. Las pone la api al confirmar la subida, nunca el cliente.
  photos: {
    type: [String],
    default: [],
    validate: {
      validator: (photos) => photos.length <= MAX_PHOTOS,
      message: `At most ${MAX_PHOTOS} photos`
    }
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true })

listingSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    returnedObject.photos = returnedObject.photos?.map((photoId) =>
      storage.publicUrl(`listings/${returnedObject.id}/${photoId}`))
    delete returnedObject._id
    delete returnedObject.__v
  }
})

const Listing = mongoose.model('Listing', listingSchema)

export default Listing
