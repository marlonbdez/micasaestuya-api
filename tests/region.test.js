import assert from 'node:assert'
import { after, afterEach, describe, test } from 'node:test'
import supertest from 'supertest'
import app from '../app.js'
import redisClient from '../utils/redisClient.js'

const api = supertest(app)

const seedRegion = async ({ id, term, countryCode }) => {
  await redisClient.hset('regions-data', id, JSON.stringify({ term, country_code: countryCode }))

  const word = term.toUpperCase().split(' ')[0]
  for (let i = 1; i <= word.length; i++) {
    await redisClient.zadd(`regions-index:${countryCode}:${word.substring(0, i)}`, 1, id)
  }
}

describe('GET /api/regions/suggest', () => {
  afterEach(async () => {
    await redisClient.flushdb()
  })

  after(async () => {
    await redisClient.quit()
  })

  test('fails with 400 when term is missing', async () => {
    await api.get('/api/regions/suggest?country_code=CU').expect(400)
  })

  test('fails with 400 when country_code is missing', async () => {
    await api.get('/api/regions/suggest?term=hav').expect(400)
  })

  test('returns matching regions for a valid prefix', async () => {
    await seedRegion({ id: '1', term: 'Havana', countryCode: 'CU' })

    const response = await api
      .get('/api/regions/suggest?term=hav&country_code=CU')
      .expect(200)
      .expect('Content-Type', /application\/json/)

    assert.strictEqual(response.body.length, 1)
    assert.strictEqual(response.body[0].term, 'Havana')
    assert.ok(response.body[0].highlighted_text.includes('<b>Hav</b>'))
  })

  test('returns an empty array when nothing matches', async () => {
    const response = await api
      .get('/api/regions/suggest?term=zzz&country_code=CU')
      .expect(200)

    assert.deepStrictEqual(response.body, [])
  })
})
