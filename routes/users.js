import { Router } from 'express'
import UserController from '../controllers/user.js'
import { auth } from '../utils/middleware.js'

export const usersRouter = Router()

usersRouter.get('/', auth, UserController.getAll)
usersRouter.post('/login', UserController.login)
usersRouter.post('/create', UserController.create)
usersRouter.get('/current', auth, UserController.getByToken)
usersRouter.get('/profile', auth, UserController.getByToken)
