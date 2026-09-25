import { Router } from 'express'
import UserController from '../controllers/user.js'
import { auth } from '../utils/middleware.js'
import { authLimiter } from '../utils/rateLimit.js'

export const usersRouter = Router()

usersRouter.get('/', auth, UserController.getAll)
usersRouter.post('/login', authLimiter, UserController.login)
usersRouter.post('/create', authLimiter, UserController.create)
usersRouter.get('/current', auth, UserController.getByToken)
usersRouter.get('/profile', auth, UserController.getByToken)
