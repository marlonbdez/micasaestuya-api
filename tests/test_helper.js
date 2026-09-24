import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import { MONGODB_TEST_URI } from '../utils/config.js'
import User from '../schemas/user.js'

export const connectDB = async () => {
  if (mongoose.connection.readyState !== 0) return
  await mongoose.connect(MONGODB_TEST_URI)
}

export const clearDB = async () => {
  const collections = mongoose.connection.collections
  for (const key in collections) {
    await collections[key].deleteMany({})
  }
}

export const closeDB = async () => {
  await mongoose.connection.close()
}

export const createTestUser = async ({ email, firstName = 'Test', lastName = 'User', passwordHash = 'hashed' } = {}) => {
  const resolvedEmail = email || `user-${Date.now()}@test.com`
  return User.create({ email: resolvedEmail, firstName, lastName, passwordHash })
}

export const getAuthToken = (user) => {
  return jwt.sign({ id: user._id, email: user.email }, process.env.SECRET)
}

export const usersInDb = async () => {
  const users = await User.find({})
  return users.map(u => u.toJSON())
}
