import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getJob, getAllJobs } from './jobs.js'

// Consolidated logs endpoint - handles both /logs and /logs/[jobId]
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version')
  // Prevent caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { jobId } = req.query

  // If jobId provided, return logs for that job
  if (jobId && typeof jobId === 'string') {
    try {
      const job = await getJob(jobId)

      if (!job) {
        return res.status(404).json({ 
          logs: [],
          error: 'Job not found'
        })
      }

      return res.json({ logs: job.logs || [] })
    } catch (error) {
      console.error('[Logs] Error:', error)
      return res.status(500).json({
        logs: [],
        error: 'Database error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // Otherwise, return all logs
  try {
    const jobs = await getAllJobs()
    const allLogs: Array<{ jobId: string; type: string; step: string; message: string; data?: unknown; timestamp: string }> = []
    
    jobs.forEach((job, jobId) => {
      job.logs.forEach(log => {
        allLogs.push({ ...log, jobId })
      })
    })

    // Sort by timestamp, most recent first
    allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return res.json({ logs: allLogs.slice(0, 100) })
  } catch (error) {
    console.error('[All Logs] Error:', error)
    return res.status(500).json({
      logs: [],
      error: 'Database error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
