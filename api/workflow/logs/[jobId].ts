import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getJob } from '../jobs.js'

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
      return res.status(404).json({ 
        logs: [],
        error: 'Job not found'
      })
    }

    res.json({ logs: job.logs || [] })
  } catch (error) {
    console.error('[Logs] Error:', error)
    res.status(500).json({
      logs: [],
      error: 'Database error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
