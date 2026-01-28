// MongoDB-based jobs storage for Vercel serverless functions
import connectDB from '../db/mongodb.js'
import { Job, IJob } from '../models/Job.js'

export interface JobStatus {
  status: 'running' | 'completed' | 'error'
  step: string
  message?: string
  data?: Record<string, unknown>
  error?: string
  logs: Array<{
    type: string
    step: string
    message: string
    data?: unknown
    timestamp: string
  }>
  createdAt: string
}

// Convert MongoDB document to JobStatus
function docToJobStatus(doc: IJob): JobStatus {
  return {
    status: doc.status,
    step: doc.step,
    message: doc.message,
    data: doc.data as Record<string, unknown> | undefined,
    error: doc.error,
    logs: doc.logs.map(log => ({
      type: log.type,
      step: log.step,
      message: log.message,
      data: log.data,
      timestamp: log.timestamp
    })),
    createdAt: doc.createdAt.toISOString()
  }
}

export async function getJob(jobId: string): Promise<JobStatus | undefined> {
  try {
    await connectDB()
    const job = await Job.findOne({ jobId })
    return job ? docToJobStatus(job) : undefined
  } catch (error) {
    console.error('[getJob] Error:', error)
    return undefined
  }
}

export async function setJob(jobId: string, job: JobStatus): Promise<void> {
  try {
    await connectDB()
    await Job.findOneAndUpdate(
      { jobId },
      {
        jobId,
        status: job.status,
        step: job.step,
        message: job.message,
        data: job.data,
        error: job.error,
        logs: job.logs,
        createdAt: new Date(job.createdAt)
      },
      { upsert: true, new: true }
    )
    console.log(`[setJob] Saved job ${jobId}`)
  } catch (error) {
    console.error('[setJob] Error:', error)
    throw error
  }
}

export async function updateJob(jobId: string, updates: Partial<JobStatus>): Promise<void> {
  try {
    await connectDB()
    const updateData: any = {}
    
    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.step !== undefined) updateData.step = updates.step
    if (updates.message !== undefined) updateData.message = updates.message
    if (updates.error !== undefined) updateData.error = updates.error
    if (updates.data !== undefined) updateData.data = updates.data
    if (updates.logs !== undefined) updateData.logs = updates.logs
    
    await Job.findOneAndUpdate(
      { jobId },
      { $set: updateData },
      { new: true }
    )
  } catch (error) {
    console.error('[updateJob] Error:', error)
    throw error
  }
}

export async function getAllJobs(): Promise<Map<string, JobStatus>> {
  try {
    await connectDB()
    const jobs = await Job.find().sort({ createdAt: -1 }).limit(100)
    const jobsMap = new Map<string, JobStatus>()
    
    jobs.forEach(job => {
      jobsMap.set(job.jobId, docToJobStatus(job))
    })
    
    return jobsMap
  } catch (error) {
    console.error('[getAllJobs] Error:', error)
    return new Map()
  }
}
