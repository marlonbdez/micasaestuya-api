import Redis from 'ioredis'
import { REDIS_URI, REDIS_TEST_URI } from './config.js'
import { info, error as _error } from './logger.js'

const url = process.env.NODE_ENV === 'test' ? REDIS_TEST_URI : REDIS_URI
const redisClient = new Redis(url, { lazyConnect: true })

redisClient.on('connect', () => {
  info('Connected to Redis')
})

redisClient.on('error', (err) => {
  _error('Redis error:', err)
})

export const connectRedis = async () => {
  try {
    info('Connecting to Redis', REDIS_URI)
    await redisClient.connect()
    await redisClient.ping()
    info('Redis is ready to use')
  } catch (err) {
    _error('Failed to connect to Redis:', err)
  }
}

export default redisClient
