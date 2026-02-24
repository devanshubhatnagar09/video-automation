import { Router, Request, Response } from 'express'
import connectDB from '../db/mongodb.js'
import { User } from '../models/User.js'
import { generateToken } from '../middleware/auth.js'

export const authRouter = Router()

// Signup
authRouter.post('/signup', async (req: Request, res: Response) => {
  try {
    await connectDB()
    
    const { email, password, name } = req.body

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' })
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' })
    }

    // Create new user
    const user = new User({ email, password, name })
    await user.save()

    // Generate token
    const token = generateToken(user._id.toString())

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Signup error:', err)
    res.status(500).json({ error: err.message || 'Failed to create user' })
  }
})

// Login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    await connectDB()
    
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    // Find user
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Check password
    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Generate token
    const token = generateToken(user._id.toString())

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Login error:', err)
    res.status(500).json({ error: err.message || 'Failed to login' })
  }
})
