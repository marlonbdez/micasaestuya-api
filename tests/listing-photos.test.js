import assert from 'node:assert'
import { after, afterEach, before, beforeEach, describe, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import supertest from 'supertest'
import app from '../app.js'
import Listing from '../schemas/listing.js'
import { storage } from '../utils/r2.js'
import { clearDB, closeDB, connectDB, createTestUser, getAuthToken } from './test_helper.js'

const api = supertest(app)

const validListing = (owner) => ({
  title: 'Casa con jardín en Varadero',
  region: { country_code: 'CU', level1: 'Matanzas', level_type: 1 },
  description: 'Casa tranquila a diez minutos de la playa.',
  tasks: ['COOKING'],
  capacity: 2,
  whatsapp: '+5351234567',
  owner
})

const WEBP = 'image/webp'

describe('listing photos API', () => {
  const original = { ...storage }
  let objects
  let removed
  let user
  let token
  let listing

  before(async () => {
    await connectDB()
  })

  beforeEach(async () => {
    // R2 falso: `objects` hace de bucket.
    objects = new Map()
    removed = []
    storage.presignPut = async (key, contentType) => `https://upload.test/${key}?type=${contentType}`
    storage.head = async (key) => objects.get(key) ?? null
    storage.remove = async (key) => { removed.push(key); objects.delete(key) }
    storage.publicUrl = (key) => `https://photos.test/${key}`

    user = await createTestUser({ email: 'host@example.com' })
    token = getAuthToken(user)
    listing = await Listing.create(validListing(user._id))
  })

  afterEach(async () => {
    Object.assign(storage, original)
    await clearDB()
  })

  after(async () => {
    await closeDB()
  })

  const request = (method, path, body, authToken = token) => {
    const req = api[method](`/api/listings/${listing.id}${path}`)
    if (authToken) req.set('Authorization', `Bearer ${authToken}`)
    return body ? req.send(body) : req
  }

  // Simula lo que hace el navegador: sube los dos ficheros a R2.
  const upload = ({ photoId }, { size = 1000, thumbSize = 100, contentType = WEBP } = {}) => {
    objects.set(`listings/${listing.id}/${photoId}`, { contentType, size })
    objects.set(`listings/${listing.id}/${photoId}-thumb`, { contentType, size: thumbSize })
  }

  const requestUploads = async (count = 1) => {
    const response = await request('post', '/photos', { photos: Array(count).fill({ contentType: WEBP }) }).expect(200)
    return response.body.uploads
  }

  const confirm = (uploads) => request('post', '/photos/confirm', { photoIds: uploads.map((u) => u.photoId) })

  describe('POST /api/listings/:id/photos', () => {
    test('returns a signed upload url for each photo and its thumbnail', async () => {
      const uploads = await requestUploads(2)

      assert.strictEqual(uploads.length, 2)
      assert.notStrictEqual(uploads[0].photoId, uploads[1].photoId)
      assert.strictEqual(uploads[0].uploadUrl, `https://upload.test/listings/${listing.id}/${uploads[0].photoId}?type=${WEBP}`)
      assert.strictEqual(uploads[0].thumbUploadUrl, `https://upload.test/listings/${listing.id}/${uploads[0].photoId}-thumb?type=${WEBP}`)
    })

    test('rejects a content type that is not webp or jpeg', async () => {
      await request('post', '/photos', { photos: [{ contentType: 'image/gif' }] }).expect(400)
    })

    test('rejects an empty or missing list', async () => {
      await request('post', '/photos', { photos: [] }).expect(400)
      await request('post', '/photos', {}).expect(400)
    })

    test('rejects more than 10 photos', async () => {
      await request('post', '/photos', { photos: Array(11).fill({ contentType: WEBP }) }).expect(400)
    })

    test('counts the photos the listing already has', async () => {
      const uploads = await requestUploads(8)
      uploads.forEach((u) => upload(u))
      await confirm(uploads).expect(200)

      await request('post', '/photos', { photos: Array(3).fill({ contentType: WEBP }) }).expect(400)
      await request('post', '/photos', { photos: Array(2).fill({ contentType: WEBP }) }).expect(200)
    })

    test('requires a logged user', async () => {
      await request('post', '/photos', { photos: [{ contentType: WEBP }] }, null).expect(401)
    })

    test('a listing of someone else is a 404', async () => {
      const other = await createTestUser({ email: 'other@example.com' })
      await request('post', '/photos', { photos: [{ contentType: WEBP }] }, getAuthToken(other)).expect(404)
    })
  })

  describe('POST /api/listings/:id/photos/confirm', () => {
    test('saves the public url of each uploaded photo', async () => {
      const uploads = await requestUploads(2)
      uploads.forEach((u) => upload(u))

      const response = await confirm(uploads).expect(200)

      assert.deepStrictEqual(response.body.photos, uploads.map((u) => `https://photos.test/listings/${listing.id}/${u.photoId}`))
      const saved = await Listing.findById(listing.id)
      assert.strictEqual(saved.photos.length, 2)
    })

    test('confirming again does not duplicate photos', async () => {
      const uploads = await requestUploads(1)
      upload(uploads[0])

      await confirm(uploads).expect(200)
      const response = await confirm(uploads).expect(200)

      assert.strictEqual(response.body.photos.length, 1)
    })

    test('rejects a photo that was never uploaded', async () => {
      const uploads = await requestUploads(1)

      await confirm(uploads).expect(400)
      assert.strictEqual((await Listing.findById(listing.id)).photos.length, 0)
    })

    test('rejects a photo of the wrong type and deletes it from R2', async () => {
      const uploads = await requestUploads(1)
      upload(uploads[0], { contentType: 'image/png' })

      await confirm(uploads).expect(400)
      assert.strictEqual(removed.length, 2)
      assert.strictEqual(objects.size, 0)
    })

    test('rejects a photo that weighs too much', async () => {
      const uploads = await requestUploads(1)
      upload(uploads[0], { size: 2 * 1024 * 1024 })

      await confirm(uploads).expect(400)
      assert.strictEqual((await Listing.findById(listing.id)).photos.length, 0)
    })

    test('rejects a thumbnail that weighs too much', async () => {
      const uploads = await requestUploads(1)
      upload(uploads[0], { thumbSize: 200 * 1024 })

      await confirm(uploads).expect(400)
    })

    test('rejects ids that are not photo ids', async () => {
      await request('post', '/photos/confirm', { photoIds: ['../../secret'] }).expect(400)
      await request('post', '/photos/confirm', { photoIds: [] }).expect(400)
    })

    test('never goes over 10 photos', async () => {
      const first = await requestUploads(8)
      first.forEach((u) => upload(u))
      await confirm(first).expect(200)

      // Photos uploaded through a stale request that was valid when issued.
      const extra = Array.from({ length: 3 }, () => ({ photoId: randomUUID() }))
      extra.forEach((u) => upload(u))
      await confirm(extra).expect(400)

      assert.strictEqual((await Listing.findById(listing.id)).photos.length, 8)
    })

    test('a listing of someone else is a 404', async () => {
      const other = await createTestUser({ email: 'other@example.com' })
      await request('post', '/photos/confirm', { photoIds: [randomUUID()] }, getAuthToken(other)).expect(404)
    })
  })

  describe('DELETE /api/listings/:id/photos/:photoId', () => {
    test('removes the url and deletes both files from R2', async () => {
      const uploads = await requestUploads(2)
      uploads.forEach((u) => upload(u))
      await confirm(uploads).expect(200)

      await request('delete', `/photos/${uploads[0].photoId}`).expect(204)

      const saved = await Listing.findById(listing.id)
      assert.deepStrictEqual(saved.photos, [`https://photos.test/listings/${listing.id}/${uploads[1].photoId}`])
      assert.deepStrictEqual(removed.sort(), [
        `listings/${listing.id}/${uploads[0].photoId}`,
        `listings/${listing.id}/${uploads[0].photoId}-thumb`
      ].sort())
    })

    test('a photo that is not in the listing is a 404', async () => {
      await request('delete', `/photos/${randomUUID()}`).expect(404)
      await request('delete', '/photos/not-an-id').expect(404)
    })

    test('a listing of someone else is a 404 and keeps the photo', async () => {
      const uploads = await requestUploads(1)
      upload(uploads[0])
      await confirm(uploads).expect(200)
      const other = await createTestUser({ email: 'other@example.com' })

      await request('delete', `/photos/${uploads[0].photoId}`, null, getAuthToken(other)).expect(404)
      assert.strictEqual((await Listing.findById(listing.id)).photos.length, 1)
      assert.strictEqual(removed.length, 0)
    })
  })
})
