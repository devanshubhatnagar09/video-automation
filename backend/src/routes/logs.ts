import { Router, Request, Response } from 'express'
import connectDB from '../db/mongodb.js'
import { Job, IJob } from '../models/Job.js'
import { User } from '../models/User.js'
import mongoose from 'mongoose'

// Type for lean job document (without Document methods)
type LeanJob = Omit<IJob, keyof mongoose.Document> & {
  _id: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

export const logsRouter = Router()

/**
 * Get logs for a specific user
 * Query params: user (email), pass (password)
 */
logsRouter.get('/logs', async (req: Request, res: Response) => {
  try {
    await connectDB()
    
    const { user: userEmail, pass: password } = req.query

    if (!userEmail || !password) {
      return res.status(400).json({ 
        error: 'Missing credentials',
        message: 'Please provide user (email) and pass (password) query parameters'
      })
    }

    // Authenticate user
    const user = await User.findOne({ email: String(userEmail).toLowerCase() })
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const isMatch = await user.comparePassword(String(password))
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Get all jobs for this user filtered by userId
    const recentJobs = await Job.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean() as LeanJob[]

    // Extract all logs from jobs
    const allLogs: Array<{
      jobId: string
      timestamp: string
      type: string
      step: string
      message: string
      data?: unknown
    }> = []

    recentJobs.forEach((job) => {
      if (job.logs && Array.isArray(job.logs)) {
        job.logs.forEach((log: {
          type: string
          step: string
          message: string
          data?: unknown
          timestamp: string
        }) => {
          allLogs.push({
            jobId: job.jobId,
            timestamp: log.timestamp || job.createdAt?.toISOString() || new Date().toISOString(),
            type: log.type,
            step: log.step,
            message: log.message,
            data: log.data
          })
        })
      }
    })

    // Sort by timestamp (newest first)
    allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    res.json({
      success: true,
      user: {
        email: user.email,
        name: user.name
      },
      totalLogs: allLogs.length,
      logs: allLogs.slice(0, 500) // Limit to 500 most recent logs
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Logs fetch error:', err)
    res.status(500).json({ error: err.message || 'Failed to fetch logs' })
  }
})

/**
 * Get logs for a specific job (with user authentication)
 */
logsRouter.get('/logs/job/:jobId', async (req: Request, res: Response) => {
  try {
    await connectDB()
    
    const { user: userEmail, pass: password } = req.query
    const { jobId } = req.params

    if (!userEmail || !password) {
      return res.status(400).json({ error: 'Missing credentials' })
    }

    // Authenticate user
    const user = await User.findOne({ email: String(userEmail).toLowerCase() })
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const isMatch = await user.comparePassword(String(password))
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Get job logs (only if it belongs to this user)
    const job = await Job.findOne({ jobId, userId: user._id }).lean() as LeanJob | null

    if (!job) {
      return res.status(404).json({ error: 'Job not found or access denied' })
    }

    res.json({
      success: true,
      jobId: job.jobId,
      status: job.status,
      step: job.step,
      message: job.message,
      logs: job.logs || [],
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Job logs fetch error:', err)
    res.status(500).json({ error: err.message || 'Failed to fetch job logs' })
  }
})
