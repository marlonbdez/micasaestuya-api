import UserModel from '../models/user.js'
import { getTokenFrom } from '../utils/utils.js'

class UserController {
  static async login (req, res) {
    const { email, password } = req.body
    const token = await UserModel.login(email, password)

    return res.status(200).send({ token })
  }

  static async create (req, res) {
    const user = await UserModel.create(req.body)

    return res.status(201).json(user)
  }

  static async getAll (req, res) {
    const users = await UserModel.getAll()
    return res.status(200).json(users)
  }

  static async getByToken (req, res) {
    const token = getTokenFrom(req)
    const user = await UserModel.getByToken(token)

    return user
      ? res.status(200).json(user)
      : res.status(401).json({
        error: 'invalid token'
      })
  }
}

export default UserController
