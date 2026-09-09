import assert from 'node:assert'
import { describe, test } from 'node:test'
import supertest from 'supertest'
import app from '../app.js'

const api = supertest(app)

describe('GET /api/health', () => {
  test('returns 200 with an OK status payload', async () => {
    const response = await api
      .get('/api/health')
      .expect(200)
      .expect('Content-Type', /application\/json/)

    assert.strictEqual(response.body.message, 'OK')
    assert.strictEqual(typeof response.body.uptime, 'number')
    assert.strictEqual(typeof response.body.timestamp, 'number')
  })
})
