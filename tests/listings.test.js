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
})
