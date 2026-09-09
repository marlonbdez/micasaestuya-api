import { info, error as _error } from './logger.js'
import { getTokenFrom } from './utils.js'
import jwt from 'jsonwebtoken'

export const requestLogger = (request, response, next) => {
  const { password, ...safeBody } = request.body || {}
  info('Method:', request.method)
  info('Path:  ', request.path)
  info('Body:  ', safeBody)
  info('---')
  next()
}

export const unknownEndpoint = (request, response) => {
  response.status(404).send({ error: 'unknown endpoint' })
}

export const errorHandler = (error, request, response, next) => {
  if (error.name === 'CastError') {
    return response.status(400).send({
      error: 'malformatted id'
    })
  } else if (error.name === 'ValidationError') {
    return response.status(400).json({
      error: error.message
    })
  } else if (error.name === 'JsonWebTokenError') {
    return response.status(401).json({
      error: 'invalid token'
    })
  }

  _error(error.message)

  return response.status(error.statusCode || 500).json({ error: error.message })
}

export const auth = async (request, response, next) => {
  const token = getTokenFrom(request)
  const decodedToken = jwt.verify(token, process.env.SECRET)

  if (!decodedToken.id) {
    const error = new Error('token missing or invalid')
    error.statusCode = 401
    throw error
  }

  request.user = decodedToken
  next()
}
