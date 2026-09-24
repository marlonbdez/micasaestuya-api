import { compare, hash } from 'bcrypt'
import jwt from 'jsonwebtoken'
import User from '../schemas/user.js'

class UserModel {
  static async getAll () {
    return User.find({})
  }

  static async getByToken (token) {
    const decodedToken = jwt.verify(token, process.env.SECRET)

    if (!decodedToken.id) {
      const error = new Error('invalid token')
      error.statusCode = 401
      throw error
    }

    const { email } = decodedToken
    const user = await User.findOne({ email })
    return user
  }

  static async login (email, password) {
    const user = await User.findOne({ email })
    const passwordCorrect = user === null
      ? false
      : await compare(password, user.passwordHash)

    if (!(user && passwordCorrect)) {
      const error = new Error('Invalid email or password')
      error.statusCode = 401
      throw error
    }

    const userForToken = {
      email,
      id: user._id
    }

    return jwt.sign(userForToken, process.env.SECRET)
  }

  static async create ({ email, password, firstName, lastName }) {
    const saltRounds = 10
    const passwordHash = await hash(password, saltRounds)
    const user = new User({
      firstName,
      lastName,
      email,
      passwordHash
    })

    const savedUser = await user.save()
    const userForToken = {
      email: user.email,
      id: savedUser._id
    }

    return { token: jwt.sign(userForToken, process.env.SECRET) }
  }
}

export default UserModel
