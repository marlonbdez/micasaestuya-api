import assert from 'node:assert'
import { after, afterEach, before, beforeEach, describe, test } from 'node:test'
import supertest from 'supertest'
import app from '../app.js'
import Listing from '../schemas/listing.js'
import { clearDB, closeDB, connectDB, createTestUser, getAuthToken } from './test_helper.js'

const api = supertest(app)

// Varadero es una hoja del árbol: Matanzas → Cárdenas → Varadero.
const validListing = () => ({
  title: 'Casa con jardín en Varadero',
  region: {
    country_code: 'CU',
    level1: 'Matanzas',
    level2: 'Cárdenas',
    level3: 'Varadero',
    level_type: 3,
    term: 'Matanzas, Cárdenas, Varadero'
  },
  description: 'Casa tranquila a diez minutos de la playa.',
  tasks: ['COOKING', 'GARDENING'],
  capacity: 2,
  whatsapp: '+5351234567'
})

describe('listings API', () => {
  let user
  let token

  before(async () => {
    await connectDB()
  })

  beforeEach(async () => {
    user = await createTestUser({ email: 'host@example.com' })
    token = getAuthToken(user)
  })

  afterEach(async () => {
    await clearDB()
  })

  after(async () => {
    await closeDB()
  })

  const post = (body, authToken = token) => {
    const request = api.post('/api/listings').send(body)
    return authToken ? request.set('Authorization', `Bearer ${authToken}`) : request
  }

  describe('POST /api/listings', () => {
    test('creates the listing for the logged user', async () => {
      const response = await post(validListing())
        .expect(201)
        .expect('Content-Type', /application\/json/)

      assert.ok(response.body.id)
      assert.strictEqual(response.body.owner, user._id.toString())
      assert.deepStrictEqual(response.body.photos, [])
      assert.strictEqual(response.body.region.level3, 'Varadero')
      assert.strictEqual(await Listing.countDocuments(), 1)
    })

    test('fails with 401 without a token', async () => {
      await post(validListing(), null).expect(401)
      assert.strictEqual(await Listing.countDocuments(), 0)
    })

    test('ignores owner and photos sent in the body', async () => {
      const response = await post({
        ...validListing(),
        owner: '64b000000000000000000000',
        photos: ['https://example.com/x.jpg']
      }).expect(201)

      assert.strictEqual(response.body.owner, user._id.toString())
      assert.deepStrictEqual(response.body.photos, [])
    })

    test('fails with 400 when a required field is missing', async () => {
      const withoutTitle = validListing()
      delete withoutTitle.title
      await post(withoutTitle).expect(400)
    })

    test('fails with 400 without tasks or with an unknown task', async () => {
      await post({ ...validListing(), tasks: [] }).expect(400)
      await post({ ...validListing(), tasks: ['SURFING'] }).expect(400)
    })

    test('fails with 400 when capacity is out of range or not whole', async () => {
      await post({ ...validListing(), capacity: 0 }).expect(400)
      await post({ ...validListing(), capacity: 21 }).expect(400)
      await post({ ...validListing(), capacity: 2.5 }).expect(400)
    })

    test('fails with 400 with a WhatsApp number without country code', async () => {
      await post({ ...validListing(), whatsapp: '51234567' }).expect(400)
    })

    test('fails with 400 when the region stops before its last level', async () => {
      const region = { country_code: 'CU', level1: 'Matanzas', level2: 'Cárdenas', level_type: 2 }
      const response = await post({ ...validListing(), region }).expect(400)
      assert.match(response.body.error, /last level/)
    })

    test('fails with 400 when the region does not exist', async () => {
      const region = { ...validListing().region, level3: 'Atlántida' }
      await post({ ...validListing(), region }).expect(400)
    })

    test('fails with 400 when level_type does not match the levels', async () => {
      const region = { ...validListing().region, level_type: 2 }
      await post({ ...validListing(), region }).expect(400)
    })
  })

  describe('GET /api/listings', () => {
    const create = (fields = {}) =>
      Listing.create({
        ...validListing(),
        owner: user._id,
        photos: ['https://photos.test/a'],
        ...fields
      })

    test('is public and lists only the card fields', async () => {
      await create()

      const response = await api.get('/api/listings').expect(200)

      assert.strictEqual(response.body.total, 1)
      const [item] = response.body.items
      assert.deepStrictEqual(
        Object.keys(item).sort(),
        ['capacity', 'id', 'photos', 'region', 'tasks', 'title']
      )
    })

    test('skips listings without photos', async () => {
      await create({ title: 'Con foto' })
      await create({ title: 'Sin foto', photos: [] })

      const response = await api.get('/api/listings').expect(200)

      assert.deepStrictEqual(response.body.items.map((item) => item.title), ['Con foto'])
      assert.strictEqual(response.body.total, 1)
    })

    test('returns the newest first and paginates', async () => {
      await create({ title: 'Primera' })
      await create({ title: 'Segunda' })
      await create({ title: 'Tercera' })

      const first = await api.get('/api/listings?limit=2').expect(200)
      const second = await api.get('/api/listings?limit=2&page=2').expect(200)

      assert.deepStrictEqual(first.body.items.map((item) => item.title), ['Tercera', 'Segunda'])
      assert.deepStrictEqual(second.body.items.map((item) => item.title), ['Primera'])
      assert.strictEqual(first.body.total, 3)
    })

    test('returns an empty page past the end', async () => {
      await create()

      const response = await api.get('/api/listings?page=5').expect(200)

      assert.deepStrictEqual(response.body, { items: [], total: 1 })
    })

    test('fails with 400 for a bad page or limit', async () => {
      await api.get('/api/listings?page=0').expect(400)
      await api.get('/api/listings?page=abc').expect(400)
      await api.get('/api/listings?limit=51').expect(400)
    })
  })

  describe('GET /api/listings/:id', () => {
    test('is public and returns the listing with the host first name only', async () => {
      const listing = await Listing.create({ ...validListing(), owner: user._id })

      const response = await api.get(`/api/listings/${listing.id}`).expect(200)

      assert.strictEqual(response.body.title, listing.title)
      assert.strictEqual(response.body.whatsapp, listing.whatsapp)
      assert.deepStrictEqual(response.body.owner, { id: user.id, firstName: 'Test' })
    })

    test('fails with 404 when the listing does not exist', async () => {
      await api.get('/api/listings/64b000000000000000000000').expect(404)
    })

    test('fails with 404 when the id is malformed', async () => {
      await api.get('/api/listings/nope').expect(404)
    })
  })
})
