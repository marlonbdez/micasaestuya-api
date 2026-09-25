import express, { json } from 'express'
import cors from 'cors'
import 'express-async-errors'
import { healthRouter } from './routes/health.js'
import { usersRouter } from './routes/users.js'
import { regionsRouter } from './routes/regions.js'
import { listingsRouter } from './routes/listings.js'
import { requestLogger, unknownEndpoint, errorHandler } from './utils/middleware.js'

const app = express()

// En producción la API va detrás del proxy de Render: sin esto, el límite de
// peticiones vería la IP del proxy y contaría a todos los usuarios juntos.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)

// Middlewares
app.use(cors())
app.use(express.static('build'))
app.use(json())
app.use(requestLogger)

// Routes (MongoDB)
app.use('/api/health', healthRouter)
app.use('/api/users', usersRouter)
app.use('/api/listings', listingsRouter)

// Routes (Redis)
app.use('/api/regions', regionsRouter)

// Not found and error handling middlewares
app.use(unknownEndpoint)
app.use(errorHandler)

export default app
