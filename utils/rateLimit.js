import rateLimit from 'express-rate-limit'

const FIFTEEN_MINUTES = 15 * 60 * 1000

// En los tests todas las peticiones salen de la misma IP y en ráfaga: el
// límite los haría fallar sin estar probando nada de esto. En local se puede
// apagar a propósito con RATE_LIMIT=off; en producción esa variable se ignora.
const skip = () =>
  process.env.NODE_ENV === 'test' ||
  (process.env.NODE_ENV !== 'production' && process.env.RATE_LIMIT === 'off')

const limiter = (limit) => rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  skip
})

// Login y registro: frena el prueba y error con contraseñas.
export const authLimiter = limiter(20)

// Escrituras con sesión (publicar un alojamiento).
export const writeLimiter = limiter(30)
