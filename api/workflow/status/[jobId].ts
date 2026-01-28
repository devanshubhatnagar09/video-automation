import type { VercelRequest, VercelResponse } from '@vercel/node'

// Note: In Vercel serverless, each function is stateless
// For production, use Redis/Upstash/DB to share state
// This is a simplified version for demo

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { jobId } = req.query

  // In serverless, we can't access in-memory state from another function
  // Return a message indicating this limitation
  res.json({ 
    success: true,
    jobId,
    message: 'For production, implement Redis/Upstash for state management',
    note: 'Vercel serverless functions are stateless - use external state store'
  })
}
