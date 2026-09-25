import assert from 'node:assert'
import { after, afterEach, before, beforeEach, describe, test } from 'node:test'
import bcrypt from 'bcrypt'
import supertest from 'supertest'
import app from '../app.js'
import { clearDB, closeDB, connectDB, createTestUser, getAuthToken, usersInDb } from './test_helper.js'

const api = supertest(app)

describe('users API', () => {
  before(async () => {
    await connectDB()
  })

  afterEach(async () => {
    await clearDB()
  })

  after(async () => {
    await closeDB()
  })

  describe('POST /api/users/create', () => {
    beforeEach(async () => {
      await createTestUser({ email: 'root@example.com' })
    })

    test('succeeds with a fresh email', async () => {
      const usersAtStart = await usersInDb()

      const response = await api
        .post('/api/users/create')
        .send({ email: 'lorem.ipsum@example.com', password: 'secret123', firstName: 'Lorem', lastName: 'Ipsum' })
        .expect(201)
        .expect('Content-Type', /application\/json/)

      assert.ok(response.body.token)
      assert.strictEqual((await usersInDb()).length, usersAtStart.length + 1)
    })

    test('fails with 400 if email already taken', async () => {
      const result = await api
        .post('/api/users/create')
        .send({ email: 'root@example.com', password: 'secret123', firstName: 'Super', lastName: 'User' })
        .expect(400)

      assert(result.body.error.includes('unique'))
    })
  })

  describe('POST /api/users/login', () => {
    beforeEach(async () => {
      const passwordHash = await bcrypt.hash('secret123', 10)
      await createTestUser({ email: 'root@example.com', passwordHash })
    })

    test('succeeds with correct credentials', async () => {
      const response = await api
        .post('/api/users/login')
        .send({ email: 'root@example.com', password: 'secret123' })
        .expect(200)

      assert.ok(response.body.token)
    })

    test('fails with 401 on wrong password', async () => {
      await api
        .post('/api/users/login')
        .send({ email: 'root@example.com', password: 'wrong' })
        .expect(401)
    })

    test('fails with 401 for unknown email', async () => {
      await api
        .post('/api/users/login')
        .send({ email: 'nope@example.com', password: 'secret123' })
        .expect(401)
    })
  })

  describe('GET /api/users', () => {
    test('returns all users when authenticated', async () => {
      const user = await createTestUser()
      const token = getAuthToken(user)

      const response = await api
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      assert.strictEqual(response.body.length, 1)
    })

    test('fails without a token', async () => {
      await api.get('/api/users').expect(401)
    })
  })

  describe('GET /api/users/current', () => {
    test('returns the user for a valid token', async () => {
      const user = await createTestUser({ email: 'root@example.com' })
      const token = getAuthToken(user)

      const response = await api
        .get('/api/users/current')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      assert.strictEqual(response.body.email, 'root@example.com')
    })

    test('fails with 401 for an invalid token', async () => {
      await api
        .get('/api/users/current')
        .set('Authorization', 'Bearer invalidtoken')
        .expect(401)
    })

    test('fails with 401 when the token is valid but the user no longer exists', async () => {
      const token = getAuthToken({ _id: 'ghost-id', email: 'ghost@example.com' })

      await api
        .get('/api/users/current')
        .set('Authorization', `Bearer ${token}`)
        .expect(401)
    })
  })
})
