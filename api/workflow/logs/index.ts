import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAllJobs } from '../jobs.js'

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

    res.json({ logs: allLogs.slice(0, 100) }) // Last 100 logs
  } catch (error) {
    console.error('[All Logs] Error:', error)
    res.status(500).json({
      logs: [],
      error: 'Database error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
