import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    res.json({
      status: 'ok',
      message: 'VideoAI API is running',
      timestamp: new Date().toISOString(),
      endpoints: [
        'POST /api/gemini/verify',
        'POST /api/gemini/generate-idea',
        'GET /api/youtube/auth-url',
        'POST /api/workflow/start',
        'GET /api/workflow/status/:jobId',
        'POST /api/cron/generate-video'
      ]
    })
  } catch (error) {
    console.error('API index error:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
