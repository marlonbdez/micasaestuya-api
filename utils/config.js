import dotenv from 'dotenv'
dotenv.config()

export const PORT = process.env.PORT
export const MONGODB_URI = process.env.MONGODB_URI
export const MONGODB_TEST_URI = process.env.MONGODB_TEST_URI
export const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379'
export const REDIS_TEST_URI = process.env.REDIS_TEST_URI || 'redis://localhost:6379/1'
export const SECRET = process.env.SECRET
export const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
export const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
export const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
export const R2_BUCKET = process.env.R2_BUCKET
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL

if (process.env.NODE_ENV === 'production') {
  const required = [
    'PORT', 'MONGODB_URI', 'REDIS_URI', 'SECRET',
    'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_URL'
  ]
  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}
