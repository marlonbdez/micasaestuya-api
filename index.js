import { connect } from 'mongoose'
import app from './app.js'
import { MONGODB_URI, PORT } from './utils/config.js'
import { connectRedis } from './utils/redisClient.js'
import { info, error as _error } from './utils/logger.js'

const start = async () => {
  info('Connecting to', MONGODB_URI)
  await connect(MONGODB_URI)
  info('Connected to MongoDB')

  // Redis connection failures are logged but non-fatal
  await connectRedis()

  app.listen(PORT, () => {
    info(`Server running on port ${PORT}`)
  })
}

start().catch((error) => {
  _error('Failed to start server:', error.message)
  process.exit(1)
})
