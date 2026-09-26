import dotenv from 'dotenv'
dotenv.config()

export const PORT = process.env.PORT
export const MONGODB_URI = process.env.MONGODB_URI
export const MONGODB_TEST_URI = process.env.MONGODB_TEST_URI
export const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379'
export const REDIS_TEST_URI = process.env.REDIS_TEST_URI || 'redis://localhost:6379/1'
export const SECRET = process.env.SECRET

if (process.env.NODE_ENV === 'production') {
  const required = ['PORT', 'MONGODB_URI', 'REDIS_URI', 'SECRET']
  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}
