import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getJob, getAllJobs } from '../jobs.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { jobId } = req.query

  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'Job ID is required' })
  }

  try {
    const job = await getJob(jobId)

    if (!job) {
      const allJobs = await getAllJobs()
      console.log(`[Status] Job ${jobId} not found. Available jobs:`, Array.from(allJobs.keys()))
      return res.status(404).json({ 
        success: false,
        error: 'Job not found',
        note: 'Job may have expired or was not found in database.',
        jobId: jobId
      })
    }
    
    console.log(`[Status] Job ${jobId} found:`, { status: job.status, step: job.step })

    res.json({ 
      success: true,
      ...job
    })
  } catch (error) {
    console.error('[Status] Error:', error)
    res.status(500).json({
      success: false,
      error: 'Database error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }

